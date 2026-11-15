-- =====================================================================
-- Shortaxe — suppression des catégories
-- =====================================================================
-- Les opérations et les échéances n'ont plus de catégorie ni de ventilation.
-- Supprime la vue category_monthly_totals et les tables transaction_splits,
-- scheduled_transaction_splits et categories (données perdues).
-- Les fonctions save_transaction et save_scheduled_transaction perdent leur
-- paramètre p_splits ; budget_apply ne met plus à jour de ventilation.
-- Idempotente : peut être relancée sans erreur.

-- ---------------------------------------------------------------- Anciennes signatures
drop function if exists public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, jsonb, boolean, uuid);
drop function if exists public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, jsonb);
drop function if exists public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, jsonb, boolean);
drop function if exists public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, jsonb);

-- ---------------------------------------------------------------- Budgets
create or replace function public.budget_apply(p_child uuid, p_factor integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_budget     uuid;
  v_amount     numeric;
  v_old_amount numeric;
  v_old_over   numeric;
  v_sign       numeric;
  v_raw        numeric;
  v_new_amount numeric;
  v_new_over   numeric;
begin
  select budget_id, amount into v_budget, v_amount
    from public.transactions where id = p_child;
  if v_budget is null then
    return;
  end if;

  -- Verrou : deux imputations simultanées sur le même budget restent justes
  select amount, budget_overrun into v_old_amount, v_old_over
    from public.transactions where id = v_budget for update;

  -- Sens du budget : -1 pour un budget de dépenses, +1 pour un budget de recettes
  v_sign := case
    when v_old_over <> 0   then sign(v_old_over)
    when v_old_amount <> 0 then sign(v_old_amount)
    when v_amount <> 0     then sign(v_amount)
    else -1
  end;

  -- Montant « brut » (sans plafond à zéro) après imputation
  v_raw := v_old_amount - v_old_over + p_factor * v_amount;

  if v_raw = 0 or sign(v_raw) = v_sign then
    v_new_amount := v_raw;
    v_new_over   := 0;
  else
    -- Budget dépassé : il reste 0, le dépassement est conservé à part
    v_new_amount := 0;
    v_new_over   := -v_raw;
  end if;

  update public.transactions
     set amount         = v_new_amount,
         budget_overrun = v_new_over,
         updated_at     = now()
   where id = v_budget;
end;
$$;

-- ---------------------------------------------------------------- Opérations
-- ---------------------------------------------------------------------
-- Enregistrement atomique d'une opération (avec le calcul des budgets)
-- ---------------------------------------------------------------------
create or replace function public.save_transaction(
  p_id         uuid,
  p_account_id uuid,
  p_date       date,
  p_label      text,
  p_amount     numeric,
  p_notes      text,
  p_is_checked boolean,
  p_is_budget  boolean default false,
  p_budget_id  uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id        uuid;
  v_is_budget boolean := coalesce(p_is_budget, false);
begin
  if not public.is_family_member() then
    raise exception 'Accès refusé';
  end if;

  if p_budget_id is not null then
    if v_is_budget then
      raise exception 'Une ligne de budget ne peut pas être imputée sur un autre budget';
    end if;
    if p_budget_id = p_id then
      raise exception 'Une opération ne peut pas être imputée sur elle-même';
    end if;
    if not exists (select 1 from public.transactions where id = p_budget_id and is_budget) then
      raise exception 'Ligne de budget introuvable';
    end if;
  end if;

  if p_id is null then
    insert into public.transactions (account_id, date, label, amount, notes, is_checked, is_budget, budget_id)
    values (p_account_id, p_date, p_label, p_amount, p_notes, coalesce(p_is_checked, false), v_is_budget, p_budget_id)
    returning id into v_id;
  else
    -- Rend l'ancien montant à l'ancien budget avant de modifier l'opération
    perform public.budget_apply(p_id, 1);

    update public.transactions
       set account_id = p_account_id,
           date       = p_date,
           label      = p_label,
           amount     = p_amount,
           notes      = p_notes,
           is_checked = coalesce(p_is_checked, false),
           is_budget  = v_is_budget,
           budget_id  = p_budget_id,
           -- Montant du budget saisi à la main : le dépassement repart de zéro
           budget_overrun = case when v_is_budget and amount = p_amount then budget_overrun else 0 end,
           updated_at = now()
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Opération introuvable';
    end if;

    -- Une ligne qui n'est plus un budget libère ses opérations imputées
    if not v_is_budget then
      update public.transactions set budget_id = null where budget_id = v_id;
    end if;
  end if;

  -- Retire le nouveau montant du budget
  perform public.budget_apply(v_id, -1);

  return v_id;
end;
$$;

revoke execute on function public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, boolean, uuid) from anon, public;
grant  execute on function public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, boolean, uuid) to authenticated;

-- ---------------------------------------------------------------- Échéancier
-- Enregistrement d'une échéance
create or replace function public.save_scheduled_transaction(
  p_id               uuid,
  p_account_id       uuid,
  p_label            text,
  p_amount           numeric,
  p_notes            text,
  p_frequency_months integer,
  p_next_date        date,
  p_is_budget        boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_family_member() then
    raise exception 'Accès refusé';
  end if;

  if p_frequency_months is null or p_frequency_months < 1 then
    raise exception 'La fréquence doit être un nombre de mois supérieur ou égal à 1';
  end if;

  if p_id is null then
    insert into public.scheduled_transactions
      (account_id, label, amount, notes, frequency_months, next_date, day_of_month, is_budget)
    values
      (p_account_id, p_label, p_amount, p_notes, p_frequency_months, p_next_date, extract(day from p_next_date)::int, coalesce(p_is_budget, false))
    returning id into v_id;
  else
    update public.scheduled_transactions
       set account_id       = p_account_id,
           label            = p_label,
           amount           = p_amount,
           notes            = p_notes,
           frequency_months = p_frequency_months,
           next_date        = p_next_date,
           day_of_month     = extract(day from p_next_date)::int,
           is_budget        = coalesce(p_is_budget, false),
           updated_at       = now()
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Échéance introuvable';
    end if;
  end if;

  return v_id;
end;
$$;

-- Crée une opération pour chaque échéance sélectionnée,
-- datée de sa prochaine échéance, puis décale cette date de la fréquence.
-- Tout est fait en une seule transaction ; renvoie le nombre d'opérations créées.
create or replace function public.create_transactions_from_schedule(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  r      public.scheduled_transactions%rowtype;
  v_n    integer := 0;
begin
  if not public.is_family_member() then
    raise exception 'Accès refusé';
  end if;

  -- "for update" : si deux membres cliquent en même temps, pas de doublon
  for r in
    select * from public.scheduled_transactions
     where id = any(p_ids)
     order by next_date, label
       for update
  loop
    insert into public.transactions (account_id, date, label, amount, notes, is_checked, is_budget)
    values (r.account_id, r.next_date, r.label, r.amount, r.notes, false, r.is_budget);

    update public.scheduled_transactions
       set next_date  = public.schedule_advance(r.next_date, r.frequency_months, r.day_of_month),
           updated_at = now()
     where id = r.id;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke execute on function public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, boolean) from anon, public;
grant  execute on function public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, boolean) to authenticated;

-- ---------------------------------------------------------------- Suppression
drop view  if exists public.category_monthly_totals;
drop table if exists public.transaction_splits;
drop table if exists public.scheduled_transaction_splits;
drop table if exists public.categories;
