-- =====================================================================
-- Shortaxe — budgets annuels
-- Migration pour une base existante : SQL Editor → New query → Run.
-- (Déjà incluse dans supabase/schema.sql pour une nouvelle installation.)
--
-- Le budget est désormais défini par année et par catégorie.
-- Les budgets mensuels existants sont additionnés par année.
-- L'ancienne table budgets est conservée pour ne pas casser le site encore
-- en ligne entre l'application de cette migration et le déploiement ;
-- elle pourra être supprimée ensuite (voir tout en bas).
-- =====================================================================

create table if not exists public.annual_budgets (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  year        smallint not null check (year between 2000 and 2100),
  amount      numeric(12,2) not null check (amount >= 0),
  unique (category_id, year)
);
create index if not exists annual_budgets_year_idx on public.annual_budgets (year);

alter table public.annual_budgets enable row level security;

drop policy if exists "famille" on public.annual_budgets;
create policy "famille" on public.annual_budgets
  for all to authenticated using (public.is_family_member()) with check (public.is_family_member());

revoke all on public.annual_budgets from anon;

-- Reprise des budgets mensuels (somme des mois de chaque année).
-- « on conflict do nothing » : relancer la migration n'écrase pas un budget annuel déjà saisi.
do $$
begin
  if to_regclass('public.budgets') is not null then
    insert into public.annual_budgets (category_id, year, amount)
    select category_id, extract(year from month)::smallint, sum(amount)
      from public.budgets
     group by category_id, extract(year from month)
    on conflict (category_id, year) do nothing;
  end if;
end $$;

-- Une fois la nouvelle version du site déployée, l'ancienne table peut être supprimée :
-- drop table if exists public.budgets;
