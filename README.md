# Shortaxe

Application web de gestion des comptes de la famille : plusieurs comptes bancaires, opérations ventilées sur plusieurs catégories, échéancier, rapports mensuels et annuels.

- **Front** : React 19 + TypeScript (Vite), Tailwind CSS v4, React Router
- **Données et connexion** : Supabase (PostgreSQL + Auth)
- **Hébergement** : Vercel
- Interface 100 % française, montants en euros, responsive (ordinateur et smartphone)

## Fonctionnalités

| Écran | Contenu |
|---|---|
| Accueil | Soldes des comptes, dépenses du mois par catégorie, dernières opérations |
| Opérations | Liste par mois ou par année, filtres compte / catégorie / recherche, pointage, saisie et modification |
| Échéancier | Opérations récurrentes (fréquence en mois, prochaine échéance) ; les échéances du mois en orange ; sélection multiple puis « Créer les opérations » |
| Rapports | Bilan mensuel ou annuel : recettes, dépenses, dépensé par catégorie, détail mois par mois |
| Évolution | Graphique du solde jour par jour (tous les comptes ou un seul) : historique réel et prévision tenant compte de l'échéancier ; par défaut d'il y a 1 an à dans 2 mois |
| Comptes / Catégories | Création, modification, archivage |
| Réglages | Accès aux autres écrans, déconnexion |

**Ventilation** : une opération peut être répartie sur plusieurs catégories, en saisissant le montant de chaque part en euros (ex. Intermarché 100 € : 30 € Loisirs, 70 € Courses). La base de données vérifie que la somme de la ventilation est égale au montant.

**Lignes de budget** : une échéance ou une opération peut être cochée « Budget » (enveloppe, ex. Courses 400 € par mois) ; elle apparaît en gris clair. Les opérations créées depuis une échéance « Budget » sont des lignes de budget. Dans la liste des opérations, le bouton « + » d'une ligne de budget ouvre la saisie d'une opération imputée dessus : son montant est déduit du budget (et de la part de même catégorie dans sa ventilation), l'écart est répercuté si on la modifie, et le montant est rendu au budget si on la supprime. Un budget dépassé reste à 0 € et affiche « Dépassé de … » ; le dépassement est rendu en priorité si on supprime ou réduit une opération.

**Partage familial** : tous les membres voient et modifient les mêmes données. Seules les adresses e-mail inscrites dans la table `family_members` ont accès aux données (sécurité appliquée côté base de données).

---

## Mise en route

### 1. Créer le projet Supabase

1. Crée un compte sur [supabase.com](https://supabase.com) (connexion possible avec GitHub).
2. **New project** : nom `shortaxe`, choisis un mot de passe de base de données (garde-le), région **West EU (Paris)**.
3. Une fois le projet prêt : **SQL Editor → New query**, colle le contenu de [`supabase/schema.sql`](supabase/schema.sql) et clique **Run**.
   - Avant d'exécuter, modifie à la fin du fichier la liste des e-mails des membres de la famille.
   - Pour ajouter un membre plus tard :
     ```sql
     insert into public.family_members (email, display_name) values ('prenom@exemple.fr', 'Prénom');
     ```
4. **Authentication → Sign In / Providers → Email** : désactive **Allow new users to sign up** (les comptes sont créés par toi, pas par inscription libre).
5. **Authentication → Users → Add user → Create new user** : crée un utilisateur par membre (e-mail + mot de passe), en cochant **Auto Confirm User**.
6. Récupère dans **Project Settings → API Keys** (et **Data API** pour l'URL) :
   - l'URL du projet (`https://xxxx.supabase.co`)
   - la clé **publishable** (ou l'ancienne clé **anon**). Ne jamais utiliser la clé secrète / `service_role` dans l'application.

### 2. Lancer en local (facultatif)

Prérequis : Node.js 20.19 ou plus récent.

```bash
npm install
cp .env.example .env.local   # puis renseigner l'URL et la clé
npm run dev
```

### Tests

Les calculs de `src/lib/` (solde et prévisions, échéancier, ventilation, formats, rapports) sont couverts par des tests unitaires [Vitest](https://vitest.dev) (fichiers `*.test.ts` à côté du code testé).

```bash
npm test             # lance les tests une fois
npm run test:watch   # relance les tests à chaque modification
```

Une GitHub Action ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) vérifie les types et lance les tests à chaque push sur `main` et à chaque pull request.

### 3. Déployer sur Vercel

1. Crée un compte sur [vercel.com](https://vercel.com) avec ton compte GitHub.
2. **Add New → Project**, importe le dépôt `shortaxe`. Vercel détecte Vite automatiquement.
3. Dans **Environment Variables**, ajoute :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**. Chaque `git push` sur `main` redéploie le site.
5. Dans Supabase, **Authentication → URL Configuration** : mets l'adresse Vercel (ex. `https://shortaxe.vercel.app`) dans **Site URL** et dans **Redirect URLs** (nécessaire pour les e-mails « mot de passe oublié »).

Sur smartphone, ouvre le site puis « Ajouter à l'écran d'accueil » pour l'utiliser comme une application.

### 4. Environnement de développement (branche `develop`)

| Branche | Site | Base Supabase |
|---|---|---|
| `main` | production (`https://shortaxe.vercel.app`) | `shortaxe` |
| `develop` | déploiement Preview Vercel de la branche | `shortaxe-dev` (données de test) |

- Dans Vercel, `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définies une seconde fois en **Preview**, limitées à la branche `develop`, avec les valeurs de `shortaxe-dev`.
- Les nouvelles fonctionnalités partent de `develop` ; une PR `develop` → `main` met en production.
- Une migration s'applique d'abord sur `shortaxe-dev`, puis sur `shortaxe` avant le merge dans `main`.
- Sur le plan gratuit, Supabase met en pause un projet inactif depuis une semaine : le relancer depuis le tableau de bord.

---

## Modèle de données

| Table | Rôle |
|---|---|
| `accounts` | Comptes bancaires (nom, banque, solde initial, archivé) |
| `categories` | Catégories personnalisables (nom, couleur, archivée) |
| `transactions` | Opérations : montant **négatif = dépense**, **positif = recette** |
| `transactions.is_budget` / `budget_id` / `budget_overrun` | Ligne de budget / budget sur lequel l'opération est imputée / dépassement du budget (trigger de suppression + `budget_apply`) |
| `transaction_splits` | Ventilation d'une opération par catégorie (même signe que l'opération) |
| `scheduled_transactions` | Échéancier : modèle d'opération + `frequency_months` (1 = tous les mois, 12 = tous les ans) + `next_date` |
| `scheduled_transaction_splits` | Ventilation d'une échéance par catégorie |
| `family_members` | E-mails autorisés à accéder aux données |

Vues : `account_balances` (solde et solde pointé par compte), `category_monthly_totals` (total par catégorie et par mois).
Fonctions : `save_transaction(...)` enregistre une opération et sa ventilation en une seule transaction, avec contrôle de cohérence ; `save_scheduled_transaction(...)` fait de même pour une échéance ; `create_transactions_from_schedule(ids)` crée les opérations des échéances choisies (datées de leur prochaine échéance, ventilation recopiée) et décale leur date de la fréquence (le jour voulu est conservé : un 31 donne le 30 ou le 28/29 selon le mois).

L'échéancier n'est qu'un ensemble de modèles : tant qu'une échéance n'a pas été transformée en opération, elle n'entre ni dans les soldes, ni dans les rapports.

**Évolutions du schéma** : pour une base déjà installée, exécuter dans le SQL Editor les fichiers de `supabase/migrations/` qui n'ont pas encore été appliqués (`schema.sql` contient toujours le schéma complet pour une nouvelle installation).

Le « dépensé » d'une catégorie correspond aux dépenses moins les remboursements ventilés sur cette catégorie. Une opération sans catégorie (par exemple un virement entre deux comptes) n'apparaît dans aucune catégorie des rapports.

## Sauvegarde

Les sauvegardes sont assurées par Supabase (sauvegardes quotidiennes ; plan gratuit : rétention limitée).

## Structure du code

```
src/
  auth/        connexion, mot de passe, contrôle d'accès
  components/  mise en page, modale d'opération, composants communs
  data/        comptes et catégories partagés entre les écrans
  lib/         client Supabase, accès aux données, formats, calculs (+ tests *.test.ts)
  pages/       un fichier par écran
supabase/
  schema.sql   tables, sécurité, vues, fonctions
```
