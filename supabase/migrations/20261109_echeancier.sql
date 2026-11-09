-- =====================================================================
-- Shortaxe — échéancier (opérations récurrentes)
-- Migration pour une base existante : SQL Editor → New query → Run.
-- (Déjà incluse dans supabase/schema.sql pour une nouvelle installation.)
-- =====================================================================

-- Échéances : mêmes informations qu'une opération, plus une fréquence (en mois)
-- et la date de la prochaine opération à créer.
-- Ces lignes ne sont PAS des opérations : elles n'entrent ni dans les soldes,
-- ni dans les budgets, ni dans les rapports.
create table if not exists public.scheduled_transactions (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.accounts(id) on delete restrict,
  label            text not null,
  amount           numeric(12,2) not null,
  notes            text,
  frequency_months integer not null check (frequency_months between 1 and 120),
  next_date        date not null,
  -- Jour du mois voulu (ex. 31) : conservé pour ne pas dériver après un mois court
  day_of_month     smallint not null check (day_of_month between 1 and 31),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists scheduled_transactions_next_idx on public.scheduled_transactions (next_date);
create index if not exists scheduled_transactions_account_idx on public.scheduled_transactions (account_id);

create table if not exists public.scheduled_transaction_splits (
  id                       uuid primary key default gen_random_uuid(),
  scheduled_transaction_id uuid not null references public.scheduled_transactions(id) on delete cascade,
  category_id              uuid not null references public.categories(id) on delete restrict,
  amount                   numeric(12,2) not null
);
create index if not exists scheduled_transaction_splits_st_idx on public.scheduled_transaction_splits (scheduled_transaction_id);
create index if not exists scheduled_transaction_splits_cat_idx on public.scheduled_transaction_splits (category_id);

-- Date suivante : + N mois, en gardant le jour voulu (31 → 28/29/30 selon le mois)
create or replace function public.schedule_advance(p_date date, p_months integer, p_day integer)
returns date
language sql
immutable
set search_path = public
as $$
  select m + (least(p_day, extract(day from (m + interval '1 month' - interval '1 day'))::int) - 1)
    from (select (date_trunc('month', p_date) + make_interval(months => p_months))::date as m) x;
$$;

-- Enregistrement atomique d'une échéance et de sa ventilation
create or replace function public.save_scheduled_transaction(
  p_id               uuid,
  p_account_id       uuid,
  p_label            text,
  p_amount           numeric,
  p_notes            text,
  p_frequency_months integer,
  p_next_date        date,
  p_splits           jsonb
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

  if p_id is null then
    insert into public.scheduled_transactions
      (account_id, label, amount, notes, frequency_months, next_date, day_of_month)
    values
      (p_account_id, p_label, p_amount, p_notes, p_frequency_months, p_next_date, extract(day from p_next_date)::int)
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

-- Crée une opération (avec sa ventilation) pour chaque échéance sélectionnée,
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
    insert into public.transactions (account_id, date, label, amount, notes, is_checked)
    values (r.account_id, r.next_date, r.label, r.amount, r.notes, false)
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

-- Sécurité
alter table public.scheduled_transactions       enable row level security;
alter table public.scheduled_transaction_splits enable row level security;

drop policy if exists "famille" on public.scheduled_transactions;
create policy "famille" on public.scheduled_transactions
  for all to authenticated using (public.is_family_member()) with check (public.is_family_member());

drop policy if exists "famille" on public.scheduled_transaction_splits;
create policy "famille" on public.scheduled_transaction_splits
  for all to authenticated using (public.is_family_member()) with check (public.is_family_member());

revoke all on public.scheduled_transactions, public.scheduled_transaction_splits from anon;
revoke execute on function public.schedule_advance(date, integer, integer) from anon, public;
grant  execute on function public.schedule_advance(date, integer, integer) to authenticated;
revoke execute on function public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, jsonb) from anon, public;
grant  execute on function public.save_scheduled_transaction(uuid, uuid, text, numeric, text, integer, date, jsonb) to authenticated;
revoke execute on function public.create_transactions_from_schedule(uuid[]) from anon, public;
grant  execute on function public.create_transactions_from_schedule(uuid[]) to authenticated;
