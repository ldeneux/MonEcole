import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import { redirect } from "next/navigation";

async function enregistrerEntree(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  await supabase.from("cahier_journal").upsert(
    {
      classe_id: formData.get("classe_id") as string,
      date: formData.get("date") as string,
      creneau_id: formData.get("creneau_id") as string,
      matiere_id: (formData.get("matiere_id") as string) || null,
      contenu: formData.get("contenu") as string,
      materiel: (formData.get("materiel") as string) || null,
      remarques: (formData.get("remarques") as string) || null,
      created_by: user?.id
    },
    { onConflict: "classe_id,date,creneau_id" }
  );

  redirect(
    `/cahier-journal?classe=${formData.get("classe_id")}&date=${formData.get("date")}`
  );
}

export default async function CahierJournalPage({
  searchParams
}: {
  searchParams: { classe?: string; date?: string };
}) {
  const supabase = createClient();
  const { active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const classeId = searchParams.classe || classes?.[0]?.id;
  const date = searchParams.date || new Date().toISOString().slice(0, 10);
  const jourNum = new Date(date + "T12:00:00").getDay(); // 1..5 attendu

  const { data: creneaux } = classeId
    ? await supabase
        .from("emploi_du_temps")
        .select("id, heure_debut, heure_fin, libelle, matiere_id, matieres(nom)")
        .eq("classe_id", classeId)
        .eq("jour", jourNum)
        .order("heure_debut")
    : { data: [] };

  const { data: entrees } = classeId
    ? await supabase.from("cahier_journal").select("*").eq("classe_id", classeId).eq("date", date)
    : { data: [] };

  const entreeParCreneau: Record<string, any> = {};
  entrees?.forEach((e: any) => (entreeParCreneau[e.creneau_id] = e));

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl text-ardoise-800">Cahier journal</h1>
        <ClassSelector classes={classes || []} />
        <form action="/cahier-journal" method="get" className="flex items-center gap-2">
          <input type="hidden" name="classe" value={classeId} />
          <input className="input" type="date" name="date" defaultValue={date} />
          <button className="btn-ghost border border-ardoise-200" type="submit">Afficher</button>
        </form>
      </div>

      {(jourNum < 1 || jourNum > 5) && (
        <p className="mb-4 text-sm text-corail">
          Ce jour n'est pas un jour de classe (dans l'emploi du temps, jours = Lundi à Vendredi).
        </p>
      )}

      {(!creneaux || creneaux.length === 0) && (
        <p className="text-sm text-ardoise-400">
          Aucun créneau dans l'emploi du temps pour ce jour. Ajoute-les dans "Emploi du temps"
          — le cahier journal se préremplit ensuite automatiquement à partir de ces créneaux.
        </p>
      )}

      <div className="space-y-4">
        {creneaux?.map((c: any) => {
          const entree = entreeParCreneau[c.id];
          return (
            <div key={c.id} className="card">
              <p className="mb-3 text-sm font-medium text-ardoise-700">
                {c.heure_debut?.slice(0, 5)}–{c.heure_fin?.slice(0, 5)} · {c.matieres?.nom || c.libelle}
              </p>
              <form action={enregistrerEntree} className="space-y-3">
                <input type="hidden" name="classe_id" value={classeId} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="creneau_id" value={c.id} />
                <input type="hidden" name="matiere_id" value={c.matiere_id || ""} />
                <div>
                  <label className="label">Contenu de la séance</label>
                  <textarea
                    className="input"
                    name="contenu"
                    rows={3}
                    defaultValue={entree?.contenu || ""}
                    placeholder="Déroulé, activités, objectifs travaillés…"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Matériel</label>
                    <input className="input" name="materiel" defaultValue={entree?.materiel || ""} />
                  </div>
                  <div>
                    <label className="label">Remarques</label>
                    <input className="input" name="remarques" defaultValue={entree?.remarques || ""} />
                  </div>
                </div>
                <button className="btn-primary" type="submit">
                  {entree ? "Mettre à jour" : "Enregistrer"}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
