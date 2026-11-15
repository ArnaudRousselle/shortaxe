-- =====================================================================
-- Shortaxe — lignes « budget »
-- =====================================================================
-- Une échéance ou une opération peut être marquée « budget » (enveloppe).
-- Une opération peut être imputée sur une ligne de budget (budget_id) :
--   - à la création, le montant de l'opération est retiré du budget ;
--   - à la modification, l'ancien montant est rendu puis le nouveau retiré ;
--   - à la suppression, le montant est rendu au budget (trigger).
-- Un budget (échéance ou opération) porte sur une seule catégorie, et ses
-- opérations imputées ont cette même catégorie (elles la suivent si elle
-- change) : la part du budget est donc toujours égale à son montant.
-- Un budget ne passe jamais de l'autre côté de zéro : dépassé, il reste à 0
-- et le dépassement est conservé dans budget_overrun (rendu si on supprime
-- ou réduit une opération imputée).
-- Idempotente : peut être relancée sans erreur.

-- ---------------------------------------------------------------- Colonnes
alter table public.scheduled_transactions
  add column if not exists is_budget boolean not null default false;

alter table public.transactions
  add column if not exists is_budget boolean not null default false;

alter table public.transactions
  add column if not exists budget_id uuid references public.transactions(id) on delete set null;

-- Dépassement d'un budget (même signe que le budget) : le budget reste à 0
alter table public.transactions
  add column if not exists budget_overrun numeric(12,2) not null default 0;

create index if not exists transactions_budget_idx on public.transactions (budget_id) where budget_id is not null;

-- ---------------------------------------------------------------- Imputation
-- p_factor = -1 : retire le montant de l'opération p_child de son budget
-- p_factor = +1 : le rend au budget
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

  -- Un budget n'a qu'une catégorie : sa part suit toujours son montant
  update public.transaction_splits
     set amount = v_new_amount
   where transaction_id = v_budget;
end;
$$;

-- Suppression d'une opération imputée : le montant est rendu au budget,
-- quel que soit le chemin de suppression.
create or replace function public.transactions_budget_on_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.budget_id is not null then
    perform public.budget_apply(old.id, 1);
  end if;
  return old;
end;
$$;

drop trigger if exists transactions_budget_on_delete on public.transactions;
create trigger transactions_budget_on_delete
  before delete on public.transactions
  for each row execute function public.transactions_budget_on_delete();

-- ---------------------------------------------------------------- save_transaction
drop function if exists public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, jsonb);

create or replace function public.save_transaction(
  p_id         uuid,
  p_account_id uuid,
  p_date       date,
  p_label      text,
  p_amount     numeric,
  p_notes      text,
  p_is_checked boolean,
  p_splits     jsonb,
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
  v_splits    jsonb := coalesce(p_splits, '[]'::jsonb);
  v_sum       numeric;
  v_is_budget boolean := coalesce(p_is_budget, false);
  v_category  uuid;
begin
  if not public.is_family_member() then
    raise exception 'Accès refusé';
  end if;

  select coalesce(sum((s ->> 'amount')::numeric), 0)
    into v_sum
    from jsonb_array_elements(v_splits) s;

  if jsonb_array_length(v_splits) > 0 and v_sum <> p_amount then
    raise exception 'La ventilation (% €) ne correspond pas au montant de l''opération (% €)', v_sum, p_amount;
  end if;

  -- Un budget porte sur une seule catégorie
  if v_is_budget and jsonb_array_length(v_splits) <> 1 then
    raise exception 'Une ligne de budget doit avoir une seule catégorie';
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
    -- Une opération imputée garde la catégorie du budget
    select category_id into v_category
      from public.transaction_splits where transaction_id = p_budget_id limit 1;
    if jsonb_array_length(v_splits) <> 1 or (v_splits -> 0 ->> 'category_id')::uuid is distinct from v_category then
      raise exception 'Une opération imputée sur un budget doit avoir la catégorie du budget';
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

    delete from public.transaction_splits where transaction_id = v_id;

    -- Une ligne qui n'est plus un budget libère ses opérations imputées
    if not v_is_budget then
      update public.transactions set budget_id = null where budget_id = v_id;
    else
      -- Catégorie du budget modifiée : ses opérations imputées la suivent
      update public.transaction_splits s
         set category_id = (v_splits -> 0 ->> 'category_id')::uuid
        from public.transactions t
       where t.id = s.transaction_id
         and t.budget_id = v_id;
    end if;
  end if;

  insert into public.transaction_splits (transaction_id, category_id, amount)
  select v_id, (s ->> 'category_id')::uuid, (s ->> 'amount')::numeric
    from jsonb_array_elements(v_splits) s;

  -- Retire le nouveau montant du budget
  perform public.budget_apply(v_id, -1);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------- Échéancier
drop function if exists public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, jsonb);

create or replace function public.save_scheduled_transaction(
  p_id               uuid,
  p_account_id       uuid,
  p_label            text,
  p_amount           numeric,
  p_notes            text,
  p_frequency_months integer,
  p_next_date        date,
  p_splits           jsonb,
  p_is_budget        boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id     uuid;
  v_splits jsonb := coalesce(p_splits, '[]'::jsonb);
  v_sum    numeric;
begin
  if not public.is_family_member() then
    raise exception 'Accès refusé';
  end if;

  if p_frequency_months is null or p_frequency_months < 1 then
    raise exception 'La fréquence doit être un nombre de mois supérieur ou égal à 1';
  end if;

  select coalesce(sum((s ->> 'amount')::numeric), 0)
    into v_sum
    from jsonb_array_elements(v_splits) s;

  if jsonb_array_length(v_splits) > 0 and v_sum <> p_amount then
    raise exception 'La ventilation (% €) ne correspond pas au montant de l''échéance (% €)', v_sum, p_amount;
  end if;

  -- Un budget porte sur une seule catégorie
  if coalesce(p_is_budget, false) and jsonb_array_length(v_splits) <> 1 then
    raise exception 'Une échéance « budget » doit avoir une seule catégorie';
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

    delete from public.scheduled_transaction_splits where scheduled_transaction_id = v_id;
  end if;

  insert into public.scheduled_transaction_splits (scheduled_transaction_id, category_id, amount)
  select v_id, (s ->> 'category_id')::uuid, (s ->> 'amount')::numeric
    from jsonb_array_elements(v_splits) s;

  return v_id;
end;
$$;

-- Les opérations créées depuis une échéance « budget » sont des lignes de budget
create or replace function public.create_transactions_from_schedule(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  r      public.scheduled_transactions%rowtype;
  v_tx   uuid;
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
    values (r.account_id, r.next_date, r.label, r.amount, r.notes, false, r.is_budget)
    returning id into v_tx;

    insert into public.transaction_splits (transaction_id, category_id, amount)
    select v_tx, s.category_id, s.amount
      from public.scheduled_transaction_splits s
     where s.scheduled_transaction_id = r.id;

    update public.scheduled_transactions
       set next_date  = public.schedule_advance(r.next_date, r.frequency_months, r.day_of_month),
           updated_at = now()
     where id = r.id;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

-- ---------------------------------------------------------------- Droits
revoke execute on function public.budget_apply(uuid, integer) from anon, public;
grant  execute on function public.budget_apply(uuid, integer) to authenticated;
revoke execute on function public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, jsonb, boolean, uuid) from anon, public;
grant  execute on function public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, jsonb, boolean, uuid) to authenticated;
revoke execute on function public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, jsonb, boolean) from anon, public;
grant  execute on function public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, jsonb, boolean) to authenticated;
revoke execute on function public.create_transactions_from_schedule(uuid[]) from anon, public;
grant  execute on function public.create_transactions_from_schedule(uuid[]) to authenticated;
