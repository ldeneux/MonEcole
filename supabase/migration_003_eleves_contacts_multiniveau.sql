-- =========================================================
-- MIGRATION 3 : élèves indépendants des classes + affectations par année,
-- contacts (parents/tuteurs), emploi du temps multi-niveau, gestion des matières
-- A exécuter dans Supabase > SQL Editor (après schema.sql + migration_002)
-- =========================================================

-- ---------- ELEVES : on détache de la classe ----------
alter table public.eleves add column if not exists created_by uuid references public.profiles(id);

-- ---------- AFFECTATIONS eleve <-> classe <-> annee ----------
create table if not exists public.affectations (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  classe_id uuid not null references public.classes(id) on delete cascade,
  annee_id uuid not null references public.annees_scolaires(id) on delete cascade,
  niveau text, -- niveau précis de l'élève cette année-là (utile si classe multi-niveaux)
  created_at timestamptz not null default now(),
  unique (eleve_id, annee_id)
);

-- Migration des données existantes (si la colonne eleves.classe_id existe encore)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'eleves' and column_name = 'classe_id'
  ) then
    insert into public.affectations (eleve_id, classe_id, annee_id)
    select e.id, e.classe_id, c.annee_id
    from public.eleves e
    join public.classes c on c.id = e.classe_id
    where e.classe_id is not null
    on conflict (eleve_id, annee_id) do nothing;

    alter table public.eleves drop column classe_id;
  end if;
end $$;

-- ---------- CONTACTS (parents, tuteurs...) ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  telephone text,
  email text,
  adresse text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.eleve_contacts (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  lien text not null default 'parent', -- parent, mère, père, tuteur, autre
  contact_principal boolean not null default false,
  unique (eleve_id, contact_id)
);

-- ---------- EMPLOI DU TEMPS MULTI-NIVEAU ----------
alter table public.emploi_du_temps add column if not exists niveau text;
-- niveau = null  -> créneau commun à toute la classe
-- niveau = 'CE1' -> créneau spécifique à ce niveau, en parallèle d'un autre niveau au même horaire

-- =========================================================
-- RLS : nouvelles tables
-- =========================================================
alter table public.affectations enable row level security;
alter table public.contacts enable row level security;
alter table public.eleve_contacts enable row level security;

create policy "affectations_select" on public.affectations for select using (is_admin() or classe_id in (select mes_classe_ids()));
create policy "affectations_write" on public.affectations for all using (is_admin() or classe_id in (select mes_classe_ids())) with check (is_admin() or classe_id in (select mes_classe_ids()));

create policy "contacts_select" on public.contacts for select using (
  is_admin() or created_by = auth.uid() or id in (
    select contact_id from public.eleve_contacts where eleve_id in (
      select eleve_id from public.affectations where classe_id in (select mes_classe_ids())
    )
  )
);
create policy "contacts_insert" on public.contacts for insert with check (auth.uid() is not null);
create policy "contacts_update" on public.contacts for update using (
  is_admin() or created_by = auth.uid() or id in (
    select contact_id from public.eleve_contacts where eleve_id in (
      select eleve_id from public.affectations where classe_id in (select mes_classe_ids())
    )
  )
);
create policy "contacts_delete" on public.contacts for delete using (is_admin() or created_by = auth.uid());

create policy "ec_select" on public.eleve_contacts for select using (
  is_admin()
  or eleve_id in (select id from public.eleves where created_by = auth.uid())
  or eleve_id in (select eleve_id from public.affectations where classe_id in (select mes_classe_ids()))
);
create policy "ec_write" on public.eleve_contacts for all using (
  is_admin()
  or eleve_id in (select id from public.eleves where created_by = auth.uid())
  or eleve_id in (select eleve_id from public.affectations where classe_id in (select mes_classe_ids()))
) with check (
  is_admin()
  or eleve_id in (select id from public.eleves where created_by = auth.uid())
  or eleve_id in (select eleve_id from public.affectations where classe_id in (select mes_classe_ids()))
);

-- =========================================================
-- RLS : eleves et absences (ré-écrites, ne dépendent plus de eleves.classe_id)
-- =========================================================
drop policy if exists "eleves_select" on public.eleves;
drop policy if exists "eleves_write" on public.eleves;

create policy "eleves_select" on public.eleves for select using (
  is_admin() or created_by = auth.uid() or id in (select eleve_id from public.affectations where classe_id in (select mes_classe_ids()))
);
create policy "eleves_insert" on public.eleves for insert with check (auth.uid() is not null);
create policy "eleves_update" on public.eleves for update using (
  is_admin() or created_by = auth.uid() or id in (select eleve_id from public.affectations where classe_id in (select mes_classe_ids()))
);
create policy "eleves_delete" on public.eleves for delete using (is_admin() or created_by = auth.uid());

drop policy if exists "absences_select" on public.absences;
drop policy if exists "absences_write" on public.absences;

create policy "absences_select" on public.absences for select using (
  is_admin() or eleve_id in (select eleve_id from public.affectations where classe_id in (select mes_classe_ids()))
);
create policy "absences_write" on public.absences for all using (
  is_admin() or eleve_id in (select eleve_id from public.affectations where classe_id in (select mes_classe_ids()))
) with check (
  is_admin() or eleve_id in (select eleve_id from public.affectations where classe_id in (select mes_classe_ids()))
);

-- =========================================================
-- Matières : on autorise tous les enseignants connectés à gérer le catalogue
-- (créer/modifier/supprimer), plus seulement l'admin
-- =========================================================
drop policy if exists "matieres_write" on public.matieres;
create policy "matieres_insert" on public.matieres for insert with check (auth.uid() is not null);
create policy "matieres_update" on public.matieres for update using (auth.uid() is not null);
create policy "matieres_delete" on public.matieres for delete using (auth.uid() is not null);
