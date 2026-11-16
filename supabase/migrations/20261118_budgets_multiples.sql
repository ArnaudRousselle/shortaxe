-- =====================================================================
-- Shortaxe — répartition d'une opération sur plusieurs lignes de budget
-- =====================================================================
-- - Une opération peut être répartie sur une ou plusieurs lignes de budget
--   (table transaction_budget_allocations, remplace la colonne budget_id).
--   Chaque part a le même sens que l'opération ; leur somme ne dépasse pas
--   le montant de l'opération.
-- - Une ligne de budget (opération ou échéance) n'a plus de compte.
-- - Une ligne de budget ne peut pas être supprimée, ni cesser d'être un
--   budget, tant que des opérations y sont rattachées.
-- Idempotente : peut être relancée sans erreur.

-- ---------------------------------------------------------------- Budgets sans compte
alter table public.transactions alter column account_id drop not null;
alter table public.scheduled_transactions alter column account_id drop not null;
update public.transactions set account_id = null where is_budget and account_id is not null;
update public.scheduled_transactions set account_id = null where is_budget and account_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_budget_account_check') then
    alter table public.transactions add constraint transactions_budget_account_check
      check ((is_budget and account_id is null) or (not is_budget and account_id is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scheduled_transactions_budget_account_check') then
    alter table public.scheduled_transactions add constraint scheduled_transactions_budget_account_check
      check ((is_budget and account_id is null) or (not is_budget and account_id is not null));
  end if;
end;
$$;

-- ---------------------------------------------------------------- Répartition
-- Répartition d'une opération sur une ou plusieurs lignes de budget.
-- Chaque part a le même signe que l'opération ; la somme des parts ne
-- dépasse pas le montant de l'opération (contrôlé dans save_transaction).
create table if not exists public.transaction_budget_allocations (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  budget_id      uuid not null references public.transactions(id) on delete restrict,
  amount         numeric(12,2) not null check (amount <> 0),
  unique (transaction_id, budget_id),
  check (transaction_id <> budget_id)
);
create index if not exists transaction_budget_allocations_budget_idx on public.transaction_budget_allocations (budget_id);

alter table public.transaction_budget_allocations enable row level security;
drop policy if exists "famille" on public.transaction_budget_allocations;
create policy "famille" on public.transaction_budget_allocations
  for all to authenticated using (public.is_family_member()) with check (public.is_family_member());
revoke all on public.transaction_budget_allocations from anon;

-- Reprise des anciennes imputations (budget_id) : une part égale au montant
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'transactions' and column_name = 'budget_id') then
    execute $q$
      insert into public.transaction_budget_allocations (transaction_id, budget_id, amount)
      select id, budget_id, amount from public.transactions
       where budget_id is not null and amount <> 0
      on conflict (transaction_id, budget_id) do nothing
    $q$;
  end if;
end;
$$;

-- ---------------------------------------------------------------- Anciennes fonctions et colonne
drop trigger if exists transactions_budget_on_delete on public.transactions;
drop function if exists public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, boolean, uuid);
drop function if exists public.budget_apply(uuid, integer);
alter table public.transactions drop column if exists budget_id;

-- ---------------------------------------------------------------- Fonctions
-- ---------------------------------------------------------------------
-- Lignes de budget : une opération peut être répartie sur plusieurs budgets
-- (transaction_budget_allocations). Chaque part est retirée de son budget ;
-- modifiée, l'écart est répercuté ; supprimée, elle y est rendue.
-- Une recette rattachée à un budget de dépenses le recrédite.
-- Dépassé, un budget reste à 0 et le dépassement est conservé dans budget_overrun.
-- Une ligne de budget n'a pas de compte et ne peut pas être supprimée (ni
-- cesser d'être un budget) tant que des opérations y sont rattachées.
-- ---------------------------------------------------------------------
-- p_factor = -1 : retire p_amount du budget ; p_factor = +1 : le rend
create or replace function public.budget_apply(p_budget uuid, p_amount numeric, p_factor integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old_amount numeric;
  v_old_over   numeric;
  v_sign       numeric;
  v_raw        numeric;
  v_new_amount numeric;
  v_new_over   numeric;
begin
  -- Verrou : deux imputations simultanées sur le même budget restent justes
  select amount, budget_overrun into v_old_amount, v_old_over
    from public.transactions where id = p_budget for update;
  if not found then
    return;
  end if;

  -- Sens du budget : -1 pour un budget de dépenses, +1 pour un budget de recettes
  v_sign := case
    when v_old_over <> 0   then sign(v_old_over)
    when v_old_amount <> 0 then sign(v_old_amount)
    when p_amount <> 0     then sign(p_amount)
    else -1
  end;

  -- Montant « brut » (sans plafond à zéro) après imputation
  v_raw := v_old_amount - v_old_over + p_factor * p_amount;

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
   where id = p_budget;
end;
$$;

-- Applique toutes les parts d'une opération (p_factor = -1 : retire, +1 : rend),
-- budgets traités dans un ordre fixe pour éviter les interblocages.
create or replace function public.budget_apply_all(p_tx uuid, p_factor integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select budget_id, amount from public.transaction_budget_allocations
     where transaction_id = p_tx
     order by budget_id
  loop
    perform public.budget_apply(r.budget_id, r.amount, p_factor);
  end loop;
end;
$$;

-- Suppression d'une opération : ses parts sont rendues aux budgets ;
-- une ligne de budget avec des opérations rattachées ne peut pas être supprimée.
create or replace function public.transactions_budget_on_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.is_budget and exists (select 1 from public.transaction_budget_allocations where budget_id = old.id) then
    raise exception 'Cette ligne de budget a des opérations rattachées : supprime-les ou retire-les de ce budget avant de la supprimer.';
  end if;
  perform public.budget_apply_all(old.id, 1);
  return old;
end;
$$;

drop trigger if exists transactions_budget_on_delete on public.transactions;
create trigger transactions_budget_on_delete
  before delete on public.transactions
  for each row execute function public.transactions_budget_on_delete();

-- ---------------------------------------------------------------------
-- Enregistrement atomique d'une opération, de sa répartition sur les
-- budgets et du calcul des budgets.
-- p_allocations : [{"budget_id": "...", "amount": -50.00}, ...]
-- ---------------------------------------------------------------------
create or replace function public.save_transaction(
  p_id          uuid,
  p_account_id  uuid,
  p_date        date,
  p_label       text,
  p_amount      numeric,
  p_notes       text,
  p_is_checked  boolean,
  p_is_budget   boolean default false,
  p_allocations jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id        uuid;
  v_is_budget boolean := coalesce(p_is_budget, false);
  v_alloc     jsonb := coalesce(p_allocations, '[]'::jsonb);
  v_sum       numeric;
  v_distinct  integer;
  a           record;
begin
  if not public.is_family_member() then
    raise exception 'Accès refusé';
  end if;

  if p_id is not null and not v_is_budget
     and exists (select 1 from public.transaction_budget_allocations where budget_id = p_id) then
    raise exception 'Cette ligne de budget a des opérations rattachées : elle doit rester un budget.';
  end if;

  if v_is_budget then
    if p_account_id is not null then
      raise exception 'Une ligne de budget n''est rattachée à aucun compte';
    end if;
    if jsonb_array_length(v_alloc) > 0 then
      raise exception 'Une ligne de budget ne peut pas être imputée sur un autre budget';
    end if;
  elsif p_account_id is null then
    raise exception 'Choisis un compte';
  end if;

  -- Contrôle de la répartition
  for a in
    select (x ->> 'budget_id')::uuid as budget_id, (x ->> 'amount')::numeric as amount
      from jsonb_array_elements(v_alloc) x
  loop
    if a.amount is null or a.amount = 0 or sign(a.amount) <> sign(p_amount) then
      raise exception 'Chaque part doit avoir un montant non nul, du même sens que l''opération';
    end if;
    if a.budget_id is null or a.budget_id is not distinct from p_id
       or not exists (select 1 from public.transactions where id = a.budget_id and is_budget) then
      raise exception 'Ligne de budget introuvable';
    end if;
  end loop;

  select coalesce(sum((x ->> 'amount')::numeric), 0), count(distinct x ->> 'budget_id')
    into v_sum, v_distinct
    from jsonb_array_elements(v_alloc) x;
  if v_distinct <> jsonb_array_length(v_alloc) then
    raise exception 'Un même budget apparaît deux fois dans la répartition';
  end if;
  if abs(v_sum) > abs(p_amount) then
    raise exception 'La répartition (% €) dépasse le montant de l''opération (% €)', abs(v_sum), abs(p_amount);
  end if;

  if p_id is null then
    insert into public.transactions (account_id, date, label, amount, notes, is_checked, is_budget)
    values (p_account_id, p_date, p_label, p_amount, p_notes, coalesce(p_is_checked, false), v_is_budget)
    returning id into v_id;
  else
    -- Rend les anciennes parts aux budgets avant de modifier l'opération
    perform public.budget_apply_all(p_id, 1);
    delete from public.transaction_budget_allocations where transaction_id = p_id;

    update public.transactions
       set account_id = p_account_id,
           date       = p_date,
           label      = p_label,
           amount     = p_amount,
           notes      = p_notes,
           is_checked = coalesce(p_is_checked, false),
           is_budget  = v_is_budget,
           -- Montant du budget saisi à la main : le dépassement repart de zéro
           budget_overrun = case when v_is_budget and amount = p_amount then budget_overrun else 0 end,
           updated_at = now()
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Opération introuvable';
    end if;
  end if;

  insert into public.transaction_budget_allocations (transaction_id, budget_id, amount)
  select v_id, (x ->> 'budget_id')::uuid, (x ->> 'amount')::numeric
    from jsonb_array_elements(v_alloc) x;

  -- Retire les nouvelles parts des budgets
  perform public.budget_apply_all(v_id, -1);

  return v_id;
end;
$$;

revoke execute on function public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, boolean, jsonb) from anon, public;
grant  execute on function public.save_transaction(uuid, uuid, date, text, numeric, text, boolean, boolean, jsonb) to authenticated;
revoke execute on function public.budget_apply(uuid, numeric, integer) from anon, public;
grant  execute on function public.budget_apply(uuid, numeric, integer) to authenticated;
revoke execute on function public.budget_apply_all(uuid, integer) from anon, public;
grant  execute on function public.budget_apply_all(uuid, integer) to authenticated;

-- ---------------------------------------------------------------- Échéancier
-- Enregistrement d'une échéance (une échéance « budget » n'a pas de compte)
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
  v_id        uuid;
  v_is_budget boolean := coalesce(p_is_budget, false);
begin
  if not public.is_family_member() then
    raise exception 'Accès refusé';
  end if;

  if p_frequency_months is null or p_frequency_months < 1 then
    raise exception 'La fréquence doit être un nombre de mois supérieur ou égal à 1';
  end if;

  if v_is_budget and p_account_id is not null then
    raise exception 'Une échéance « budget » n''est rattachée à aucun compte';
  elsif not v_is_budget and p_account_id is null then
    raise exception 'Choisis un compte';
  end if;

  if p_id is null then
    insert into public.scheduled_transactions
      (account_id, label, amount, notes, frequency_months, next_date, day_of_month, is_budget)
    values
      (p_account_id, p_label, p_amount, p_notes, p_frequency_months, p_next_date, extract(day from p_next_date)::int, v_is_budget)
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
           is_budget        = v_is_budget,
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
