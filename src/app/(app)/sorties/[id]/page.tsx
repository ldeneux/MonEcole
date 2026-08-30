import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function modifierSortie(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("sorties_scolaires")
    .update({
      titre: formData.get("titre") as string,
      lieu: (formData.get("lieu") as string) || null,
      date_sortie: formData.get("date_sortie") as string,
      heure_debut: (formData.get("heure_debut") as string) || null,
      heure_fin: (formData.get("heure_fin") as string) || null,
      objectifs: (formData.get("objectifs") as string) || null
    })
    .eq("id", formData.get("sortie_id") as string);
  redirect(`/sorties/${formData.get("sortie_id")}`);
}

async function supprimerCetteSortie(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("sorties_scolaires").delete().eq("id", formData.get("sortie_id") as string);
  redirect("/sorties");
}

async function majParticipant(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("sorties_participants")
    .update({
      autorisation: formData.get("autorisation") === "on",
      fiche_sanitaire: formData.get("fiche_sanitaire") === "on",
      assurance: formData.get("assurance") === "on"
    })
    .eq("id", formData.get("participant_id") as string);
  redirect(`/sorties/${formData.get("sortie_id")}`);
}

async function ajouterAccompagnateur(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("sorties_accompagnateurs").insert({
    sortie_id: formData.get("sortie_id") as string,
    nom: formData.get("nom") as string,
    role: (formData.get("role") as string) || null
  });
  redirect(`/sorties/${formData.get("sortie_id")}`);
}

export default async function SortieDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const supabase = createClient();
  const { data: sortie } = await supabase
    .from("sorties_scolaires")
    .select("id, titre, lieu, date_sortie, heure_debut, heure_fin, objectifs, classes(nom)")
    .eq("id", params.id)
    .single();
  if (!sortie) redirect("/sorties");

  const { data: participants } = await supabase
    .from("sorties_participants")
    .select("id, autorisation, fiche_sanitaire, assurance, eleves(id, nom, prenom)")
    .eq("sortie_id", params.id);

  const { data: accompagnateurs } = await supabase
    .from("sorties_accompagnateurs")
    .select("id, nom, role")
    .eq("sortie_id", params.id);

  return (
    <div className="max-w-3xl">
      {searchParams.edit ? (
        <div className="mb-6 card max-w-lg">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Modifier la sortie</h2>
          <form action={modifierSortie} className="space-y-4">
            <input type="hidden" name="sortie_id" value={sortie.id} />
            <div>
              <label className="label">Titre</label>
              <input className="input" name="titre" defaultValue={sortie.titre} required />
            </div>
            <div>
              <label className="label">Lieu</label>
              <input className="input" name="lieu" defaultValue={sortie.lieu || ""} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" name="date_sortie" defaultValue={sortie.date_sortie} required />
              </div>
              <div>
                <label className="label">Début</label>
                <input className="input" type="time" name="heure_debut" defaultValue={sortie.heure_debut?.slice(0, 5) || ""} />
              </div>
              <div>
                <label className="label">Fin</label>
                <input className="input" type="time" name="heure_fin" defaultValue={sortie.heure_fin?.slice(0, 5) || ""} />
              </div>
            </div>
            <div>
              <label className="label">Objectifs pédagogiques</label>
              <textarea className="input" name="objectifs" rows={2} defaultValue={sortie.objectifs || ""} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">Enregistrer</button>
              <a href={`/sorties/${sortie.id}`} className="btn-ghost border border-ardoise-200">Annuler</a>
            </div>
          </form>
        </div>
      ) : (
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="mb-1 font-display text-3xl text-ardoise-800">{sortie.titre}</h1>
            <p className="text-sm text-ardoise-500">
              {(sortie as any).classes?.nom} · {new Date(sortie.date_sortie).toLocaleDateString("fr-FR")}
              {sortie.lieu ? ` · ${sortie.lieu}` : ""}
            </p>
            {sortie.objectifs && <p className="mt-2 text-sm text-ardoise-600">{sortie.objectifs}</p>}
          </div>
          <div className="flex shrink-0 gap-3 text-xs">
            <a href={`/sorties/${sortie.id}?edit=1`} className="text-ardoise-600 underline">Modifier</a>
            <form action={supprimerCetteSortie}>
              <input type="hidden" name="sortie_id" value={sortie.id} />
              <button className="text-red-500 underline" type="submit">Supprimer</button>
            </form>
          </div>
        </div>
      )}

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Documents par élève</h2>
      <div className="mb-8 space-y-2">
        {participants
          ?.sort((a: any, b: any) => (a.eleves.nom > b.eleves.nom ? 1 : -1))
          .map((p: any) => (
            <form
              key={p.id}
              action={majParticipant}
              className="card flex flex-wrap items-center justify-between gap-3"
            >
              <input type="hidden" name="participant_id" value={p.id} />
              <input type="hidden" name="sortie_id" value={sortie.id} />
              <span className="text-sm font-medium text-ardoise-800">
                {p.eleves.prenom} {p.eleves.nom}
              </span>
              <div className="flex gap-4 text-xs text-ardoise-600">
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="autorisation" defaultChecked={p.autorisation} /> Autorisation
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="fiche_sanitaire" defaultChecked={p.fiche_sanitaire} /> Fiche sanitaire
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="assurance" defaultChecked={p.assurance} /> Assurance
                </label>
              </div>
              <button className="btn-ghost border border-ardoise-200 text-xs" type="submit">
                Mettre à jour
              </button>
            </form>
          ))}
      </div>

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Accompagnateurs</h2>
      <ul className="mb-4 space-y-1 text-sm text-ardoise-700">
        {accompagnateurs?.length === 0 && <li className="text-ardoise-400">Aucun accompagnateur ajouté.</li>}
        {accompagnateurs?.map((a) => (
          <li key={a.id}>{a.nom}{a.role ? ` — ${a.role}` : ""}</li>
        ))}
      </ul>
      <form action={ajouterAccompagnateur} className="card flex max-w-md flex-wrap items-end gap-3">
        <input type="hidden" name="sortie_id" value={sortie.id} />
        <div className="flex-1">
          <label className="label">Nom</label>
          <input className="input" name="nom" required />
        </div>
        <div className="flex-1">
          <label className="label">Rôle</label>
          <input className="input" name="role" placeholder="Parent, ATSEM…" />
        </div>
        <button className="btn-primary" type="submit">Ajouter</button>
      </form>
    </div>
  );
}
