-- A executer dans Supabase > SQL Editor pour corriger l'erreur
-- "server-side exception" lors de la création d'une classe.
drop policy if exists "annees_write" on public.annees_scolaires;

create policy "annees_insert" on public.annees_scolaires
  for insert with check (auth.uid() is not null);

create policy "annees_update" on public.annees_scolaires
  for update using (public.is_admin());

create policy "annees_delete" on public.annees_scolaires
  for delete using (public.is_admin());
