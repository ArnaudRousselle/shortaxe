# Shortaxe

Application web de gestion des comptes de la famille : plusieurs comptes bancaires, opérations ventilées sur plusieurs catégories, budgets mensuels par catégorie, rapports mensuels et annuels, export JSON.

- **Front** : React 19 + TypeScript (Vite), Tailwind CSS v4, React Router
- **Données et connexion** : Supabase (PostgreSQL + Auth)
- **Hébergement** : Vercel
- Interface 100 % française, montants en euros, responsive (ordinateur et smartphone)

## Fonctionnalités

| Écran | Contenu |
|---|---|
| Accueil | Soldes des comptes, reste à dépenser du mois par catégorie, dernières opérations |
| Opérations | Liste par mois ou par année, filtres compte / catégorie / recherche, pointage, saisie et modification |
| Budgets | Budget par catégorie et par mois, dépensé, reste ; copie du mois précédent ; application jusqu'à décembre |
| Rapports | Bilan mensuel ou annuel : recettes, dépenses, budgets, détail mois par mois |
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

### 3. Déployer sur Vercel

1. Crée un compte sur [vercel.com](https://vercel.com) avec ton compte GitHub.
2. **Add New → Project**, importe le dépôt `shortaxe`. Vercel détecte Vite automatiquement.
3. Dans **Environment Variables**, ajoute :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**. Chaque `git push` sur `main` redéploie le site.
5. Dans Supabase, **Authentication → URL Configuration** : mets l'adresse Vercel (ex. `https://shortaxe.vercel.app`) dans **Site URL** et dans **Redirect URLs** (nécessaire pour les e-mails « mot de passe oublié »).

Sur smartphone, ouvre le site puis « Ajouter à l'écran d'accueil » pour l'utiliser comme une application.

---

## Modèle de données

| Table | Rôle |
|---|---|
| `accounts` | Comptes bancaires (nom, banque, solde initial, archivé) |
| `categories` | Catégories personnalisables (nom, couleur, archivée) |
| `transactions` | Opérations : montant **négatif = dépense**, **positif = recette** |
| `transaction_splits` | Ventilation d'une opération par catégorie (même signe que l'opération) |
| `budgets` | Budget d'une catégorie pour un mois (`month` = 1er du mois) |
| `family_members` | E-mails autorisés à accéder aux données |

Vues : `account_balances` (solde et solde pointé par compte), `category_monthly_totals` (total par catégorie et par mois).
Fonction : `save_transaction(...)` enregistre une opération et sa ventilation en une seule transaction, avec contrôle de cohérence.

Le « dépensé » d'une catégorie correspond aux dépenses moins les remboursements ventilés sur cette catégorie. Une opération sans catégorie (par exemple un virement entre deux comptes) n'entre dans aucun budget.

## Sauvegarde

**Réglages → Exporter en JSON** télécharge un fichier `shortaxe-sauvegarde-AAAA-MM-JJ.json` contenant toutes les tables. Supabase fait aussi ses propres sauvegardes quotidiennes (plan gratuit : rétention limitée).

## Structure du code

```
src/
  auth/        connexion, mot de passe, contrôle d'accès
  components/  mise en page, modale d'opération, composants communs
  data/        comptes et catégories partagés entre les écrans
  lib/         client Supabase, accès aux données, formats, calculs
  pages/       un fichier par écran
supabase/
  schema.sql   tables, sécurité, vues, fonctions
```
