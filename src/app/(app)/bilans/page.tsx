import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import { redirect } from "next/navigation";

const PERIODES = ["P1", "P2", "P3", "P4", "P5"];
const NIVEAUX_LABEL: Record<string, string> = {
  non_acquis: "Non acquis",
  en_cours: "En cours",
  acquis: "Acquis",
  expert: "Expert"
};

async function enregistrerBilan(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  await supabase.from("bilans_periodiques").upsert(
    {
      classe_id: formData.get("classe_id") as string,
      eleve_id: formData.get("eleve_id") as string,
      periode: formData.get("periode") as string,
      appreciation_generale: formData.get("appreciation_generale") as string,
      created_by: user?.id,
      updated_at: new Date().toISOString()
    },
    { onConflict: "eleve_id,periode" }
  );
  redirect(
    `/bilans?classe=${formData.get("classe_id")}&periode=${formData.get("periode")}`
  );
}

export default async function BilansPage({
  searchParams
}: {
  searchParams: { classe?: string; periode?: string };
}) {
  const supabase = createClient();
  const { active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const classeId = searchParams.classe || classes?.[0]?.id;
  const periode = searchParams.periode || "P1";

  const { data: affectationsClasse } = classeId
    ? await supabase.from("affectations").select("eleves(id, nom, prenom)").eq("classe_id", classeId).order("id")
    : { data: [] };
  const eleves = (affectationsClasse || [])
    .map((a: any) => a.eleves)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.nom > b.nom ? 1 : -1));

  const eleveIds = (eleves || []).map((e) => e.id);

  const { data: evaluations } = eleveIds.length
    ? await supabase.from("evaluations").select("eleve_id, niveau, matieres(nom)").in("eleve_id", eleveIds)
    : { data: [] };

  const { data: bilans } = eleveIds.length
    ? await supabase
        .from("bilans_periodiques")
        .select("eleve_id, appreciation_generale")
        .eq("periode", periode)
        .in("eleve_id", eleveIds)
    : { data: [] };

  const bilanParEleve: Record<string, string> = {};
  bilans?.forEach((b: any) => (bilanParEleve[b.eleve_id] = b.appreciation_generale || ""));

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl text-ardoise-800">Bilans périodiques</h1>
        <ClassSelector classes={classes || []} />
        <form action="/bilans" method="get" className="flex items-center gap-2">
          <input type="hidden" name="classe" value={classeId} />
          <select className="input" name="periode" defaultValue={periode}>
            {PERIODES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn-ghost border border-ardoise-200" type="submit">Afficher</button>
        </form>
      </div>

      <div className="space-y-4">
        {eleves?.map((e) => {
          const evalsEleve = evaluations?.filter((ev: any) => ev.eleve_id === e.id) || [];
          const counts: Record<string, number> = {};
          evalsEleve.forEach((ev: any) => (counts[ev.niveau] = (counts[ev.niveau] || 0) + 1));

          return (
            <div key={e.id} className="card">
              <p className="mb-2 font-medium text-ardoise-800">{e.prenom} {e.nom}</p>
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-ardoise-500">
                {Object.keys(NIVEAUX_LABEL).map((k) => (
                  <span key={k}>{NIVEAUX_LABEL[k]} : {counts[k] || 0}</span>
                ))}
                <span className="text-ardoise-300">({evalsEleve.length} évaluation(s) sur la période complète)</span>
              </div>
              <form action={enregistrerBilan} className="space-y-2">
                <input type="hidden" name="classe_id" value={classeId} />
                <input type="hidden" name="eleve_id" value={e.id} />
                <input type="hidden" name="periode" value={periode} />
                <label className="label">Appréciation générale — {periode}</label>
                <textarea
                  className="input"
                  name="appreciation_generale"
                  rows={2}
                  defaultValue={bilanParEleve[e.id] || ""}
                  placeholder="Compétences travaillées, niveau atteint, appréciation générale…"
                />
                <button className="btn-primary text-sm" type="submit">Enregistrer</button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
