import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AnneeScolaire = { id: string; libelle: string; date_debut: string; date_fin: string };

export async function getAnneeActive(): Promise<{ annees: AnneeScolaire[]; active: AnneeScolaire | null }> {
  const supabase = createClient();
  const { data: annees } = await supabase
    .from("annees_scolaires")
    .select("id, libelle, date_debut, date_fin")
    .order("date_debut", { ascending: false });

  const cookieId = cookies().get("annee_id")?.value;
  const active = (annees || []).find((a) => a.id === cookieId) || annees?.[0] || null;

  return { annees: annees || [], active };
}
