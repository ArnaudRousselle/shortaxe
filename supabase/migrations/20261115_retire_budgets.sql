-- =====================================================================
-- Shortaxe — retrait des budgets
-- =====================================================================
-- La notion de budget est retirée de l'application.
-- Supprime la table des budgets annuels et l'ancienne table des budgets
-- mensuels (conservée jusqu'ici par la migration 20261115_budgets_annuels).
-- Attention : les montants de budget saisis sont définitivement perdus.
-- À appliquer après le déploiement du site sans budgets (l'ancienne version
-- du site lit encore annual_budgets).
-- Idempotente : peut être relancée sans erreur.

drop table if exists public.annual_budgets;
drop table if exists public.budgets;
