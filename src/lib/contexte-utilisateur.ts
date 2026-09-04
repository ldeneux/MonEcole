import { createClient } from "@/lib/supabase/server";

export type ContexteUtilisateur = {
  role: "admin" | "professeur" | "eleve" | null;
  eleveId: string | null;
  classeId: string | null; // classe de l'élève, pour l'année la plus récente où il est affecté
};

export async function getContexteUtilisateur(): Promise<ContexteUtilisateur> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { role: null, eleveId: null, classeId: null };

  const { data: profile } = await supabase.from("profiles").select("role, eleve_id").eq("id", user.id).single();

  if (profile?.role !== "eleve" || !profile.eleve_id) {
    return { role: (profile?.role as any) || null, eleveId: null, classeId: null };
  }

  const { data: affectation } = await supabase
    .from("affectations")
    .select("classe_id")
    .eq("eleve_id", profile.eleve_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { role: "eleve", eleveId: profile.eleve_id, classeId: affectation?.classe_id || null };
}
