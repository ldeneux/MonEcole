-- =========================================================
-- SCHEMA : Gestion de classe(s) - Socle + Carnet de liaison + Sorties scolaires
-- A executer dans l'editeur SQL de Supabase (SQL Editor > New query)
-- =========================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";

-- ---------- PROFILS (roles) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'professeur' check (role in ('admin','professeur')),
  created_at timestamptz not null default now()
);

-- Crée automatiquement un profil "professeur" a l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'professeur');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- ANNEES SCOLAIRES ----------
create table if not exists public.annees_scolaires (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,               -- ex: "2026-2027"
  date_debut date not null,
  date_fin date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- CLASSES ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  annee_id uuid not null references public.annees_scolaires(id) on delete cascade,
  nom text not null,                    -- ex: "CP-CE1 A"
  niveaux text[] not null default '{}', -- ex: {"CP","CE1"}
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Association professeurs <-> classes (plusieurs profs par classe possible)
create table if not exists public.classe_professeurs (
  classe_id uuid not null references public.classes(id) on delete cascade,
  professeur_id uuid not null references public.profiles(id) on delete cascade,
  primary key (classe_id, professeur_id)
);

-- ---------- ELEVES ----------
create table if not exists public.eleves (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  nom text not null,
  prenom text not null,
  date_naissance date,
  created_at timestamptz not null default now()
);

-- ---------- ABSENCES ----------
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  date date not null,
  motif text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- MATIERES ----------
create table if not exists public.matieres (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  couleur text not null default '#3f7264'
);

insert into public.matieres (nom, couleur) values
  ('Français', '#2f5b4f'), ('Mathématiques', '#e0724a'), ('EPS', '#4472ca'),
  ('Arts / Musique', '#a55fb0'), ('Sciences', '#3f9b6b'),
  ('Histoire-Géographie', '#c98a2b'), ('EMC', '#7a7a7a'), ('Langue vivante', '#2ba0a0')
on conflict (nom) do nothing;

-- ---------- EMPLOI DU TEMPS ----------
create table if not exists public.emploi_du_temps (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  jour smallint not null check (jour between 1 and 5), -- 1=Lundi ... 5=Vendredi
  heure_debut time not null,
  heure_fin time not null,
  matiere_id uuid references public.matieres(id),
  libelle text, -- libellé libre si besoin (ex: "Récréation")
  couleur text
);

-- ---------- CAHIER JOURNAL ----------
create table if not exists public.cahier_journal (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  date date not null,
  creneau_id uuid references public.emploi_du_temps(id) on delete set null,
  matiere_id uuid references public.matieres(id),
  contenu text not null default '',
  materiel text,
  remarques text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (classe_id, date, creneau_id)
);

-- ---------- CARNET DE LIAISON ----------
create table if not exists public.messages_liaison (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  eleve_id uuid references public.eleves(id) on delete cascade, -- null = message à toute la classe
  auteur_id uuid references public.profiles(id),
  titre text not null,
  contenu text not null,
  necessite_signature boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.messages_liaison_reponses (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages_liaison(id) on delete cascade,
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  signe boolean not null default false,
  signe_at timestamptz,
  commentaire text,
  unique (message_id, eleve_id)
);

-- ---------- SORTIES SCOLAIRES ----------
create table if not exists public.sorties_scolaires (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  titre text not null,
  lieu text,
  date_sortie date not null,
  heure_debut time,
  heure_fin time,
  objectifs text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sorties_participants (
  id uuid primary key default gen_random_uuid(),
  sortie_id uuid not null references public.sorties_scolaires(id) on delete cascade,
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  autorisation boolean not null default false,
  fiche_sanitaire boolean not null default false,
  assurance boolean not null default false,
  unique (sortie_id, eleve_id)
);

create table if not exists public.sorties_accompagnateurs (
  id uuid primary key default gen_random_uuid(),
  sortie_id uuid not null references public.sorties_scolaires(id) on delete cascade,
  nom text not null,
  role text
);

-- =========================================================
-- FONCTIONS UTILITAIRES POUR LES POLICIES
-- =========================================================
create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$ language sql stable security definer;

create or replace function public.mes_classe_ids()
returns setof uuid as $$
  select classe_id from public.classe_professeurs where professeur_id = auth.uid()
  union
  select id from public.classes where created_by = auth.uid();
$$ language sql stable security definer;

-- =========================================================
-- RLS
-- =========================================================
alter table public.profiles enable row level security;
alter table public.annees_scolaires enable row level security;
alter table public.classes enable row level security;
alter table public.classe_professeurs enable row level security;
alter table public.eleves enable row level security;
alter table public.absences enable row level security;
alter table public.matieres enable row level security;
alter table public.emploi_du_temps enable row level security;
alter table public.cahier_journal enable row level security;
alter table public.messages_liaison enable row level security;
alter table public.messages_liaison_reponses enable row level security;
alter table public.sorties_scolaires enable row level security;
alter table public.sorties_participants enable row level security;
alter table public.sorties_accompagnateurs enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid() or is_admin());

-- annees_scolaires : lecture + création pour tous les connectés (nécessaire pour créer une classe),
-- modification/suppression réservées à l'admin
create policy "annees_select" on public.annees_scolaires for select using (auth.uid() is not null);
create policy "annees_insert" on public.annees_scolaires for insert with check (auth.uid() is not null);
create policy "annees_update" on public.annees_scolaires for update using (is_admin());
create policy "annees_delete" on public.annees_scolaires for delete using (is_admin());

-- classes
create policy "classes_select" on public.classes for select using (is_admin() or id in (select mes_classe_ids()));
create policy "classes_insert" on public.classes for insert with check (auth.uid() is not null);
create policy "classes_update" on public.classes for update using (is_admin() or id in (select mes_classe_ids()));
create policy "classes_delete" on public.classes for delete using (is_admin() or created_by = auth.uid());

-- classe_professeurs
create policy "cp_select" on public.classe_professeurs for select using (is_admin() or classe_id in (select mes_classe_ids()) or professeur_id = auth.uid());
create policy "cp_write" on public.classe_professeurs for all using (is_admin() or classe_id in (select id from public.classes where created_by = auth.uid())) with check (is_admin() or classe_id in (select id from public.classes where created_by = auth.uid()));

-- eleves
create policy "eleves_select" on public.eleves for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "eleves_write" on public.eleves for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

-- absences
create policy "absences_select" on public.absences for select using (is_admin() or eleve_id in (select id from public.eleves where classe_id in (select mes_classe_ids())));
create policy "absences_write" on public.absences for all using (is_admin() or eleve_id in (select id from public.eleves where classe_id in (select mes_classe_ids()))) with check (is_admin() or eleve_id in (select id from public.eleves where classe_id in (select mes_classe_ids())));

-- matieres : lecture tous, écriture admin
create policy "matieres_select" on public.matieres for select using (auth.uid() is not null);
create policy "matieres_write" on public.matieres for all using (is_admin()) with check (is_admin());

-- emploi_du_temps
create policy "edt_select" on public.emploi_du_temps for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "edt_write" on public.emploi_du_temps for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

-- cahier_journal
create policy "cj_select" on public.cahier_journal for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "cj_write" on public.cahier_journal for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

-- messages_liaison
create policy "ml_select" on public.messages_liaison for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "ml_write" on public.messages_liaison for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

-- messages_liaison_reponses
create policy "mlr_select" on public.messages_liaison_reponses for select using (is_admin() or message_id in (select id from public.messages_liaison where classe_id in (select mes_classe_ids())));
create policy "mlr_write" on public.messages_liaison_reponses for all using (is_admin() or message_id in (select id from public.messages_liaison where classe_id in (select mes_classe_ids()))) with check (is_admin() or message_id in (select id from public.messages_liaison where classe_id in (select mes_classe_ids())));

-- sorties_scolaires
create policy "ss_select" on public.sorties_scolaires for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "ss_write" on public.sorties_scolaires for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

-- sorties_participants
create policy "sp_select" on public.sorties_participants for select using (is_admin() or sortie_id in (select id from public.sorties_scolaires where classe_id in (select mes_classe_ids())));
create policy "sp_write" on public.sorties_participants for all using (is_admin() or sortie_id in (select id from public.sorties_scolaires where classe_id in (select mes_classe_ids()))) with check (is_admin() or sortie_id in (select id from public.sorties_scolaires where classe_id in (select mes_classe_ids())));

-- sorties_accompagnateurs
create policy "sa_select" on public.sorties_accompagnateurs for select using (is_admin() or sortie_id in (select id from public.sorties_scolaires where classe_id in (select mes_classe_ids())));
create policy "sa_write" on public.sorties_accompagnateurs for all using (is_admin() or sortie_id in (select id from public.sorties_scolaires where classe_id in (select mes_classe_ids()))) with check (is_admin() or sortie_id in (select id from public.sorties_scolaires where classe_id in (select mes_classe_ids())));
