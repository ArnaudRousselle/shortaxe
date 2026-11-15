# CLAUDE.md — Shortaxe

Application web de gestion des comptes de la famille (plusieurs comptes bancaires, opérations ventilées par catégorie, budgets mensuels, échéancier, rapports, évolution du solde, export JSON). Le README détaille les fonctionnalités et la mise en route.

## Stack

- React 19 + TypeScript 5.8 (strict), Vite 7, React Router 7
- Tailwind CSS v4 (plugin `@tailwindcss/vite`, pas de `tailwind.config`)
- Supabase (PostgreSQL + Auth) via `@supabase/supabase-js`
- Tests : Vitest, uniquement sur la logique pure de `src/lib` (`*.test.ts`, environnement `node`)
- Hébergement : Vercel (chaque push sur `main` redéploie la production)
- Node.js ≥ 20.19

## Commandes

```bash
npm install
npm run dev         # serveur de dev (nécessite .env.local, voir .env.example)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # typecheck + build Vite
```

Avant de proposer un commit : `npm run typecheck` et `npm test` doivent passer (ce sont les deux étapes de la CI GitHub Actions, `.github/workflows/ci.yml`).

## Structure

```
src/
  auth/        connexion, mot de passe, contrôle d'accès (AuthProvider)
  components/  mise en page, modales, graphique du solde, composants communs (ui.tsx)
  data/        DataProvider : comptes et catégories partagés entre les écrans
  lib/         client Supabase, accès aux données (api.ts), types, formats, calculs
  pages/       un fichier par écran (XxxPage.tsx)
supabase/
  schema.sql   schéma complet pour une nouvelle installation
  migrations/  évolutions à appliquer sur une base existante (AAAAMMJJ_nom.sql)
```

## Conventions

**Langue**
- Interface 100 % en français, tutoiement dans les messages à l'utilisateur.
- Commentaires, messages de commit et descriptions de PR en français.
- Noms de code (variables, fonctions, tables, colonnes) en anglais.

**Montants**
- En base : `numeric(12,2)`. Négatif = dépense, positif = recette. Une ventilation (`transaction_splits`) a le même signe que l'opération.
- Les calculs se font en centimes entiers (`toCents` / `fromCents` / `parseEuroToCents` dans `src/lib/format.ts`) pour éviter les erreurs d'arrondi.
- Affichage via `formatEuro` / `formatSignedEuro` ou le composant `<Amount>` (`fr-FR`, EUR). Ne pas formater les montants à la main.

**Accès aux données**
- Tous les appels Supabase passent par `src/lib/api.ts` : les pages et composants n'appellent pas `supabase` directement.
- Utiliser `check()` pour lever les erreurs et `num()` pour normaliser les `numeric` renvoyés en chaîne par PostgREST.
- Les messages d'erreur affichés passent par `errorMessage()` (`src/lib/supabase.ts`) ; ajouter un cas si un nouveau code Postgres doit être traduit.
- Les écritures qui touchent plusieurs tables (opération + ventilation, échéancier) passent par des fonctions SQL (`save_transaction`, `save_scheduled_transaction`, `create_transactions_from_schedule`) pour rester atomiques.
- Les types partagés sont dans `src/lib/types.ts`.

**Logique métier**
- Les calculs (rapports, prévision du solde, ventilation, dates) vont dans `src/lib`, sous forme de fonctions pures testées dans un `*.test.ts` voisin.
- Tout changement de logique dans `src/lib` s'accompagne de tests.
- La projection de l'échéancier côté front (`advanceSchedule` dans `balance.ts`) doit suivre la même règle de jour du mois que la fonction SQL `schedule_advance`.

**Interface**
- Réutiliser les composants de `src/components/ui.tsx` (`PageHeader`, `Modal`, `Amount`, `MonthPicker`, `Segmented`, `ErrorBanner`, `Loading`, `EmptyState`…) avant d'en créer de nouveaux.
- Responsive obligatoire : chaque écran doit être utilisable sur smartphone (approche mobile-first avec les classes Tailwind).
- Pas de nouvelle dépendance sans raison forte : le graphique du solde est en SVG maison (`BalanceChart.tsx`).

## Base de données et sécurité

- Les données sont partagées par toute la famille. L'accès est contrôlé côté base par RLS : seules les adresses e-mail présentes dans `family_members` y ont accès. Toute nouvelle table doit activer la RLS avec la même règle (`is_family_member()`).
- Côté application, uniquement la clé **publishable / anon** (`VITE_SUPABASE_ANON_KEY`). Ne jamais utiliser ni committer la clé `service_role` ou un fichier `.env.local`.
- Toute évolution du schéma :
  1. nouvelle migration idempotente dans `supabase/migrations/AAAAMMJJ_nom.sql` (`create … if not exists`, `create or replace`) ;
  2. même changement reporté dans `supabase/schema.sql` ;
  3. migration appliquée sur la base de production (SQL Editor Supabase) **avant** de merger la PR, puisque le merge redéploie le site immédiatement.
- Projet Supabase de production : `shortaxe` (réf. `slgovycftiqvyzdfbkls`). Ne pas modifier la base de production sans accord explicite.
- Projet Supabase de développement : `shortaxe-dev` (réf. `rpiouzqephpuomimlfld`), utilisé par les déploiements Preview de la branche `develop`. Appliquer les migrations ici en premier.

## Git

- `main` = production. Travailler sur une branche et ouvrir une PR ; ne pas pousser directement sur `main`.
- Messages de commit courts, en français, à l'impératif présent (ex. « Ajoute l'export CSV »).
