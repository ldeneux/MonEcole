-- =========================================================
-- MIGRATION 2 : Notes/appréciations/bilans, Coin lecture, Projets d'école
-- A exécuter dans Supabase > SQL Editor (après schema.sql)
-- =========================================================

-- ---------- COMPETENCES ----------
create table if not exists public.competences (
  id uuid primary key default gen_random_uuid(),
  matiere_id uuid references public.matieres(id) on delete cascade,
  libelle text not null,
  cycle smallint check (cycle in (1,2,3))
);

-- ---------- EVALUATIONS ----------
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  matiere_id uuid references public.matieres(id),
  competence_id uuid references public.competences(id),
  date date not null default current_date,
  niveau text not null check (niveau in ('non_acquis','en_cours','acquis','expert')),
  commentaire text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- BILANS PERIODIQUES ----------
create table if not exists public.bilans_periodiques (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  periode text not null,              -- 'P1'..'P5'
  appreciation_generale text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (eleve_id, periode)
);

-- ---------- COIN LECTURE ----------
create table if not exists public.livres (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  isbn text,
  titre text not null,
  auteur text,
  resume text,
  couverture_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.emprunts (
  id uuid primary key default gen_random_uuid(),
  livre_id uuid not null references public.livres(id) on delete cascade,
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  date_emprunt date not null default current_date,
  date_retour date
);

-- ---------- PROJETS D'ECOLE / INTER-CLASSE ----------
create table if not exists public.projets (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  objectifs text,
  planning text,
  avancement text not null default 'a_venir' check (avancement in ('a_venir','en_cours','termine')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.projets_classes (
  projet_id uuid not null references public.projets(id) on delete cascade,
  classe_id uuid not null references public.classes(id) on delete cascade,
  primary key (projet_id, classe_id)
);

-- =========================================================
-- RLS
-- =========================================================
alter table public.competences enable row level security;
alter table public.evaluations enable row level security;
alter table public.bilans_periodiques enable row level security;
alter table public.livres enable row level security;
alter table public.emprunts enable row level security;
alter table public.projets enable row level security;
alter table public.projets_classes enable row level security;

-- competences : lecture pour tous les connectés, écriture pour tous (simplifié)
create policy "competences_select" on public.competences for select using (auth.uid() is not null);
create policy "competences_write" on public.competences for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- evaluations
create policy "evaluations_select" on public.evaluations for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "evaluations_write" on public.evaluations for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

-- bilans_periodiques
create policy "bilans_select" on public.bilans_periodiques for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "bilans_write" on public.bilans_periodiques for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

-- livres
create policy "livres_select" on public.livres for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "livres_write" on public.livres for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

-- emprunts
create policy "emprunts_select" on public.emprunts for select using (is_admin() or livre_id in (select id from public.livres where classe_id in (select mes_classe_ids())));
create policy "emprunts_write" on public.emprunts for all using (is_admin() or livre_id in (select id from public.livres where classe_id in (select mes_classe_ids()))) with check (is_admin() or livre_id in (select id from public.livres where classe_id in (select mes_classe_ids())));

-- projets : visibles/modifiables si au moins une des classes associées m'appartient, ou si créateur, ou admin
create policy "projets_select" on public.projets for select using (
  is_admin() or created_by = auth.uid() or id in (select projet_id from public.projets_classes where classe_id in (select mes_classe_ids()))
);
create policy "projets_insert" on public.projets for insert with check (auth.uid() is not null);
create policy "projets_update" on public.projets for update using (
  is_admin() or created_by = auth.uid() or id in (select projet_id from public.projets_classes where classe_id in (select mes_classe_ids()))
);
create policy "projets_delete" on public.projets for delete using (is_admin() or created_by = auth.uid());

-- projets_classes
create policy "pc_select" on public.projets_classes for select using (
  is_admin() or classe_id in (select mes_classe_ids()) or projet_id in (select id from public.projets where created_by = auth.uid())
);
create policy "pc_write" on public.projets_classes for all using (
  is_admin() or classe_id in (select mes_classe_ids()) or projet_id in (select id from public.projets where created_by = auth.uid())
) with check (
  is_admin() or classe_id in (select mes_classe_ids()) or projet_id in (select id from public.projets where created_by = auth.uid())
);

-- Competences de base (facultatif, à adapter) : quelques exemples par matière
insert into public.competences (matiere_id, libelle, cycle)
select id, 'Lire et comprendre un texte', 2 from public.matieres where nom = 'Français'
union all
select id, 'Écrire un texte court', 2 from public.matieres where nom = 'Français'
union all
select id, 'Calculer mentalement', 2 from public.matieres where nom = 'Mathématiques'
union all
select id, 'Résoudre un problème', 2 from public.matieres where nom = 'Mathématiques'
on conflict do nothing;
