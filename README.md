# Shortaxe

Application web de gestion des comptes de la famille : plusieurs comptes bancaires, opérations ventilées sur plusieurs catégories, budgets annuels par catégorie, rapports mensuels et annuels, export JSON.

- **Front** : React 19 + TypeScript (Vite), Tailwind CSS v4, React Router
- **Données et connexion** : Supabase (PostgreSQL + Auth)
- **Hébergement** : Vercel
- Interface 100 % française, montants en euros, responsive (ordinateur et smartphone)

## Fonctionnalités

| Écran | Contenu |
|---|---|
| Accueil | Soldes des comptes, reste à dépenser du mois par catégorie, dernières opérations |
| Opérations | Liste par mois ou par année, filtres compte / catégorie / recherche, pointage, saisie et modification |
| Échéancier | Opérations récurrentes (fréquence en mois, prochaine échéance) ; les échéances du mois en orange ; sélection multiple puis « Créer les opérations » |
| Budgets | Budget annuel par catégorie (navigation par année), dépensé, reste ; calcul automatique à partir de l'échéancier |
| Rapports | Bilan mensuel ou annuel : recettes, dépenses, budgets, détail mois par mois |
| Évolution | Graphique du solde jour par jour (tous les comptes ou un seul) : historique réel et prévision tenant compte de l'échéancier ; par défaut d'il y a 1 an à dans 2 mois |
| Comptes / Catégories | Création, modification, archivage |
| Réglages | Export de toutes les données en JSON |

**Ventilation** : une opération peut être répartie sur plusieurs catégories, en saisissant le montant de chaque part en euros (ex. Intermarché 100 € : 30 € Loisirs, 70 € Courses). La base de données vérifie que la somme de la ventilation est égale au montant.

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
| `transaction_splits` | Ventilation d'une opération par catégorie (même signe que l'opération) |
| `annual_budgets` | Budget d'une catégorie pour une année (l'accueil et les rapports mensuels en utilisent un douzième par mois) |
| `scheduled_transactions` | Échéancier : modèle d'opération + `frequency_months` (1 = tous les mois, 12 = tous les ans) + `next_date` |
| `scheduled_transaction_splits` | Ventilation d'une échéance par catégorie |
| `family_members` | E-mails autorisés à accéder aux données |

Vues : `account_balances` (solde et solde pointé par compte), `category_monthly_totals` (total par catégorie et par mois).
Fonctions : `save_transaction(...)` enregistre une opération et sa ventilation en une seule transaction, avec contrôle de cohérence ; `save_scheduled_transaction(...)` fait de même pour une échéance ; `create_transactions_from_schedule(ids)` crée les opérations des échéances choisies (datées de leur prochaine échéance, ventilation recopiée) et décale leur date de la fréquence (le jour voulu est conservé : un 31 donne le 30 ou le 28/29 selon le mois).

L'échéancier n'est qu'un ensemble de modèles : tant qu'une échéance n'a pas été transformée en opération, elle n'entre ni dans les soldes, ni dans les budgets, ni dans les rapports.

**Évolutions du schéma** : pour une base déjà installée, exécuter dans le SQL Editor les fichiers de `supabase/migrations/` qui n'ont pas encore été appliqués (`schema.sql` contient toujours le schéma complet pour une nouvelle installation).

**Budget calculé à partir de l'échéancier** : pour l'année choisie, chaque échéance est comptée autant de fois qu'elle tombe dans l'année civile (selon sa fréquence et sa prochaine date, que les opérations aient déjà été créées ou non) ; les montants sont regroupés par catégorie (dépenses moins recettes ventilées). Après confirmation, tout le budget de l'année est remplacé : les catégories absentes de l'échéancier passent à 0. Rien n'est enregistré avant « Enregistrer ».

Le « dépensé » d'une catégorie correspond aux dépenses moins les remboursements ventilés sur cette catégorie. Une opération sans catégorie (par exemple un virement entre deux comptes) n'entre dans aucun budget.

## Sauvegarde

**Réglages → Exporter en JSON** télécharge un fichier `shortaxe-sauvegarde-AAAA-MM-JJ.json` contenant toutes les tables.

Sur le plan gratuit, Supabase ne donne accès à aucune sauvegarde restaurable. Le workflow GitHub Actions `.github/workflows/backup.yml` fait donc chaque nuit un dump complet de la base de **production** (rôles, schéma, données), chiffré en AES-256 avec GPG puis conservé 30 jours comme artefact du workflow. Il peut aussi être lancé à la main (onglet **Actions → Sauvegarde de la base → Run workflow**).

**Mise en place** (une seule fois), dans **Settings → Secrets and variables → Actions** du dépôt :

- `SUPABASE_DB_URL` : chaîne de connexion **Session pooler** du projet `shortaxe` (bouton **Connect** du tableau de bord Supabase), avec le mot de passe de la base à la place de `[YOUR-PASSWORD]`. La connexion directe ne marche pas depuis GitHub Actions, qui ne parle pas IPv6.
- `BACKUP_PASSPHRASE` : une longue phrase secrète. Garde-la aussi dans un gestionnaire de mots de passe : sans elle, les sauvegardes sont illisibles.

Le dépôt étant public, n'importe quel compte GitHub peut télécharger les artefacts ; c'est pour ça qu'ils sont chiffrés.

**Restauration** (sur un projet Supabase vide, de préférence un projet de test d'abord) :

```bash
gpg --decrypt shortaxe-AAAA-MM-JJ.tar.gz.gpg | tar -xz   # demande la phrase secrète
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "<chaîne de connexion du projet cible>"
```

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
