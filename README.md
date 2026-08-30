# Classe — cahier de bord numérique (V1)

Application de gestion de classe : classes & élèves, emploi du temps,
cahier journal préremplifié, carnet de liaison numérique, sorties scolaires.
Stack : **Next.js 14 (App Router)** + **Supabase** (auth + Postgres + RLS), déployée sur **Vercel**.

## Point d'entrée : l'année scolaire

**Toute l'application tourne autour de l'année scolaire active**, sélectionnée
en permanence dans le menu de gauche (mémorisée dans un cookie). Une classe
n'existe que pour une année donnée ; élèves, emploi du temps, cahier journal,
notes, coin lecture, carnet de liaison, sorties et projets n'affichent que les
classes de l'année sélectionnée. Gère tes années scolaires depuis `/annees`.

## Modules inclus

**V1** : socle (auth, années/classes, élèves, absences, emploi du temps, cahier
journal), carnet de liaison, sorties scolaires.

**V2** : notes/évaluations par compétence, bilans périodiques (P1 à P5), coin
lecture (ISBN, emprunts), projets d'école inter-classe.

**V3 (cette version)** :
- Élèves détachés des classes : annuaire d'école (`/eleves`) + affectations
  élève ↔ classe ↔ année scolaire (`/eleves/[id]`), avec niveau précis pour
  les classes multi-niveaux.
- Contacts (parents, tuteurs…) liés à chaque élève.
- Emploi du temps multi-niveau (colonnes séparées par niveau au même horaire).
- Gestion des matières avec couleur (`/matieres`).
- Sélecteur d'année scolaire global (`/annees`) — point d'entrée de toute
  l'application.
- Modifier/Supprimer ajoutés partout : classes, élèves, matières, années,
  créneaux d'emploi du temps, évaluations, livres, messages du carnet de
  liaison, sorties, projets.

Reste à venir : ateliers autonomes, fournitures, documents administratifs,
bien-être/climat de classe, agenda, portfolio élève, tâches récurrentes, agent IA.

## 1. Créer le projet Supabase

1. Sur https://supabase.com → **New project**. Note l'URL et la clé `anon public`
   (Project Settings → API).
2. Ouvre **SQL Editor → New query**, exécute dans l'ordre :
   `schema.sql`, `migration_002_notes_lecture_projets.sql`,
   `migration_003_eleves_contacts_multiniveau.sql`. Cela crée toutes les
   tables, les rôles (admin/professeur) et les règles de sécurité (RLS) : un
   professeur ne voit que ses classes, un admin voit tout.
3. Dans **Authentication → Providers**, l'email/mot de passe est activé par défaut.
   Tu peux désactiver "Confirm email" (Authentication → Providers → Email) pour
   te connecter immédiatement en développement.

## 2. Créer le dépôt GitHub

```bash
cd classe-app
git init
git add .
git commit -m "Initial commit — socle, carnet de liaison, sorties scolaires"
git branch -M main
git remote add origin https://github.com/<ton-compte>/classe-app.git
git push -u origin main
```

## 3. Déployer sur Vercel

1. Sur https://vercel.com → **Add New → Project** → importe le dépôt GitHub `classe-app`.
2. Dans **Environment Variables**, ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL` = URL de ton projet Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = clé anon public
3. Déploie. Vercel détecte Next.js automatiquement.

## 4. En local

```bash
cp .env.example .env.local   # puis renseigne les 2 variables Supabase
npm install
npm run dev
```

## 5. Devenir administrateur

Le premier compte créé via "Créer un compte enseignant" a le rôle `professeur`
par défaut. Pour le passer en `admin` :
- Supabase → **Table editor → profiles** → modifie la colonne `role` de ta ligne
  en `admin`.

## Structure du projet

```
src/
  app/
    login/                  page de connexion / inscription
    (app)/                  zone protégée (sidebar + auth requise)
      dashboard/            vue "aujourd'hui"
      classes/[id]/         classes, élèves, absences
      emploi-du-temps/      grille hebdomadaire par classe
      cahier-journal/       préremplié à partir de l'emploi du temps
      carnet-de-liaison/    messages + suivi des signatures parents
      sorties/[id]/         sorties scolaires + documents par élève
      notes/                évaluations par compétence
      bilans/               bilans périodiques (P1 à P5)
      coin-lecture/         catalogue livres (ISBN), emprunts
      projets/[id]/         projets d'école inter-classe
  lib/supabase/             clients Supabase (navigateur / serveur)
  middleware.ts             protège les routes, gère la session
supabase/schema.sql         schéma complet + policies RLS
```

## Prochaines étapes suggérées

- Ateliers autonomes, fournitures scolaires, documents administratifs
- Bien-être / météo émotionnelle
- Agenda de classe, portfolio élève, tâches récurrentes
- Agent IA (préremplissage intelligent, suggestions, génération de
  questionnaires sur les livres, reformulation des messages) — nécessite une
  clé API Anthropic côté serveur
