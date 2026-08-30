import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import { redirect } from "next/navigation";

const NIVEAUX: Record<string, { label: string; couleur: string }> = {
  non_acquis: { label: "Non acquis", couleur: "#c94f4f" },
  en_cours: { label: "En cours", couleur: "#c98a2b" },
  acquis: { label: "Acquis", couleur: "#3f9b6b" },
  expert: { label: "Expert", couleur: "#2f5b4f" }
};

async function enregistrerEvaluation(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const id = formData.get("id") as string;
  const payload = {
    classe_id: formData.get("classe_id") as string,
    eleve_id: formData.get("eleve_id") as string,
    matiere_id: (formData.get("matiere_id") as string) || null,
    competence_id: (formData.get("competence_id") as string) || null,
    date: formData.get("date") as string,
    niveau: formData.get("niveau") as string,
    commentaire: (formData.get("commentaire") as string) || null,
    created_by: user?.id
  };
  if (id) {
    await supabase.from("evaluations").update(payload).eq("id", id);
  } else {
    await supabase.from("evaluations").insert(payload);
  }
  redirect(`/notes?classe=${formData.get("classe_id")}&eleve=${formData.get("eleve_id")}`);
}

async function supprimerEvaluation(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("evaluations").delete().eq("id", formData.get("id") as string);
  redirect(`/notes?classe=${formData.get("classe_id")}&eleve=${formData.get("eleve_id")}`);
}

export default async function NotesPage({
  searchParams
}: {
  searchParams: { classe?: string; eleve?: string; edit?: string };
}) {
  const supabase = createClient();
  const { active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const classeId = searchParams.classe || classes?.[0]?.id;

  const { data: affectationsClasse } = classeId
    ? await supabase.from("affectations").select("eleves(id, nom, prenom)").eq("classe_id", classeId).order("id")
    : { data: [] };
  const eleves = (affectationsClasse || [])
    .map((a: any) => a.eleves)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.nom > b.nom ? 1 : -1));
  const eleveId = searchParams.eleve || eleves?.[0]?.id;

  const { data: matieres } = await supabase.from("matieres").select("id, nom").order("nom");
  const { data: competences } = await supabase
    .from("competences")
    .select("id, libelle, matiere_id")
    .order("libelle");

  const { data: evaluations } = eleveId
    ? await supabase
        .from("evaluations")
        .select("id, date, niveau, commentaire, matieres(nom), competences(libelle)")
        .eq("eleve_id", eleveId)
        .order("date", { ascending: false })
    : { data: [] };

  const evaluationAEditer = searchParams.edit ? evaluations?.find((e: any) => e.id === searchParams.edit) : null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl text-ardoise-800">Notes & évaluations</h1>
        <ClassSelector classes={classes || []} />
      </div>

      {classeId && (
        <form action="/notes" method="get" className="mb-6 flex items-center gap-3">
          <input type="hidden" name="classe" value={classeId} />
          <label className="label mb-0">Élève</label>
          <select className="input max-w-xs" name="eleve" defaultValue={eleveId}>
            {eleves?.map((e) => (
              <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
            ))}
          </select>
          <button className="btn-ghost border border-ardoise-200" type="submit">Afficher</button>
        </form>
      )}

      {eleveId && (
        <>
          <div className="mb-8 card">
            <h2 className="mb-3 font-display text-lg text-ardoise-700">
              {evaluationAEditer ? "Modifier l'évaluation" : "Nouvelle évaluation"}
            </h2>
            <form action={enregistrerEvaluation} className="space-y-4">
              <input type="hidden" name="classe_id" value={classeId} />
              <input type="hidden" name="eleve_id" value={eleveId} />
              {evaluationAEditer && <input type="hidden" name="id" value={evaluationAEditer.id} />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Matière</label>
                  <select className="input" name="matiere_id" defaultValue={evaluationAEditer?.matiere_id || ""}>
                    <option value="">—</option>
                    {matieres?.map((m) => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Compétence</label>
                  <select className="input" name="competence_id" defaultValue={evaluationAEditer?.competence_id || ""}>
                    <option value="">—</option>
                    {competences?.map((c) => (
                      <option key={c.id} value={c.id}>{c.libelle}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Date</label>
                  <input className="input" type="date" name="date" defaultValue={evaluationAEditer?.date || new Date().toISOString().slice(0, 10)} required />
                </div>
                <div>
                  <label className="label">Niveau</label>
                  <select className="input" name="niveau" defaultValue={evaluationAEditer?.niveau} required>
                    {Object.entries(NIVEAUX).map(([key, v]) => (
                      <option key={key} value={key}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Commentaire</label>
                <input className="input" name="commentaire" defaultValue={evaluationAEditer?.commentaire || ""} />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" type="submit">{evaluationAEditer ? "Enregistrer" : "Ajouter"}</button>
                {evaluationAEditer && (
                  <a href={`/notes?classe=${classeId}&eleve=${eleveId}`} className="btn-ghost border border-ardoise-200">
                    Annuler
                  </a>
                )}
              </div>
            </form>
          </div>

          <h2 className="mb-3 font-display text-lg text-ardoise-700">Historique</h2>
          <div className="space-y-2">
            {(!evaluations || evaluations.length === 0) && (
              <p className="text-sm text-ardoise-400">Aucune évaluation enregistrée.</p>
            )}
            {evaluations?.map((e: any) => (
              <div key={e.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ardoise-800">
                    {e.matieres?.nom} {e.competences?.libelle ? `— ${e.competences.libelle}` : ""}
                  </p>
                  {e.commentaire && <p className="text-xs text-ardoise-500">{e.commentaire}</p>}
                  <div className="mt-1 flex gap-2 text-xs">
                    <a href={`/notes?classe=${classeId}&eleve=${eleveId}&edit=${e.id}`} className="text-ardoise-600 underline">
                      Modifier
                    </a>
                    <form action={supprimerEvaluation}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="classe_id" value={classeId} />
                      <input type="hidden" name="eleve_id" value={eleveId} />
                      <button className="text-red-500 underline" type="submit">Supprimer</button>
                    </form>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className="rounded-full px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: NIVEAUX[e.niveau]?.couleur }}
                  >
                    {NIVEAUX[e.niveau]?.label}
                  </span>
                  <p className="mt-1 text-xs text-ardoise-400">
                    {new Date(e.date).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
