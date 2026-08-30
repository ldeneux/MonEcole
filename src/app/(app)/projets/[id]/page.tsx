import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const AVANCEMENT_OPTIONS = [
  { value: "a_venir", label: "À venir" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" }
];

async function majAvancement(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("projets")
    .update({ avancement: formData.get("avancement") as string })
    .eq("id", formData.get("projet_id") as string);
  redirect(`/projets/${formData.get("projet_id")}`);
}

async function ajouterClasse(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("projets_classes").insert({
    projet_id: formData.get("projet_id") as string,
    classe_id: formData.get("classe_id") as string
  });
  redirect(`/projets/${formData.get("projet_id")}`);
}

async function retirerClasse(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("projets_classes")
    .delete()
    .eq("projet_id", formData.get("projet_id") as string)
    .eq("classe_id", formData.get("classe_id") as string);
  redirect(`/projets/${formData.get("projet_id")}`);
}

async function modifierProjet(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("projets")
    .update({
      titre: formData.get("titre") as string,
      objectifs: (formData.get("objectifs") as string) || null,
      planning: (formData.get("planning") as string) || null
    })
    .eq("id", formData.get("projet_id") as string);
  redirect(`/projets/${formData.get("projet_id")}`);
}

async function supprimerProjet(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("projets").delete().eq("id", formData.get("projet_id") as string);
  redirect("/projets");
}

export default async function ProjetDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const supabase = createClient();
  const { data: projet } = await supabase
    .from("projets")
    .select("id, titre, objectifs, planning, avancement")
    .eq("id", params.id)
    .single();
  if (!projet) redirect("/projets");

  const { data: classesAssociees } = await supabase
    .from("projets_classes")
    .select("classe_id, classes(id, nom)")
    .eq("projet_id", params.id);

  const { data: toutesLesClasses } = await supabase.from("classes").select("id, nom").order("nom");
  const idsAssocies = new Set((classesAssociees || []).map((c: any) => c.classe_id));
  const classesDisponibles = (toutesLesClasses || []).filter((c) => !idsAssocies.has(c.id));

  const classeIds = (classesAssociees || []).map((c: any) => c.classe_id);
  const { data: cahierCommun } = classeIds.length
    ? await supabase
        .from("cahier_journal")
        .select("date, contenu, classes(nom)")
        .in("classe_id", classeIds)
        .order("date", { ascending: false })
        .limit(10)
    : { data: [] };

  return (
    <div className="max-w-3xl">
      {searchParams.edit ? (
        <div className="mb-6 card max-w-lg">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Modifier le projet</h2>
          <form action={modifierProjet} className="space-y-4">
            <input type="hidden" name="projet_id" value={projet.id} />
            <div>
              <label className="label">Titre</label>
              <input className="input" name="titre" defaultValue={projet.titre} required />
            </div>
            <div>
              <label className="label">Objectifs pédagogiques</label>
              <textarea className="input" name="objectifs" rows={2} defaultValue={projet.objectifs || ""} />
            </div>
            <div>
              <label className="label">Planning</label>
              <textarea className="input" name="planning" rows={2} defaultValue={projet.planning || ""} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">Enregistrer</button>
              <a href={`/projets/${projet.id}`} className="btn-ghost border border-ardoise-200">Annuler</a>
            </div>
          </form>
        </div>
      ) : (
        <div className="mb-1 flex items-start justify-between">
          <h1 className="font-display text-3xl text-ardoise-800">{projet.titre}</h1>
          <div className="flex shrink-0 gap-3 text-xs">
            <a href={`/projets/${projet.id}?edit=1`} className="text-ardoise-600 underline">Modifier</a>
            <form action={supprimerProjet}>
              <input type="hidden" name="projet_id" value={projet.id} />
              <button className="text-red-500 underline" type="submit">Supprimer</button>
            </form>
          </div>
        </div>
      )}

      <form action={majAvancement} className="mb-6 mt-2 flex items-center gap-2">
        <input type="hidden" name="projet_id" value={projet.id} />
        <label className="label mb-0">Avancement</label>
        <select className="input max-w-xs" name="avancement" defaultValue={projet.avancement}>
          {AVANCEMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button className="btn-ghost border border-ardoise-200" type="submit">Mettre à jour</button>
      </form>

      {projet.objectifs && (
        <div className="mb-4 card">
          <p className="label">Objectifs</p>
          <p className="text-sm text-ardoise-700">{projet.objectifs}</p>
        </div>
      )}
      {projet.planning && (
        <div className="mb-4 card">
          <p className="label">Planning</p>
          <p className="text-sm text-ardoise-700">{projet.planning}</p>
        </div>
      )}

      <div className="mb-8 card">
        <p className="label">Classes impliquées</p>
        <ul className="mb-3 text-sm text-ardoise-700">
          {classesAssociees?.map((c: any) => (
            <li key={c.classe_id} className="flex items-center justify-between">
              <span>{c.classes?.nom}</span>
              <form action={retirerClasse}>
                <input type="hidden" name="projet_id" value={projet.id} />
                <input type="hidden" name="classe_id" value={c.classe_id} />
                <button className="text-xs text-red-500 underline" type="submit">Retirer</button>
              </form>
            </li>
          ))}
        </ul>
        {classesDisponibles.length > 0 && (
          <form action={ajouterClasse} className="flex items-center gap-2">
            <input type="hidden" name="projet_id" value={projet.id} />
            <select className="input max-w-xs text-sm" name="classe_id" required>
              <option value="">Ajouter une classe…</option>
              {classesDisponibles.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
            <button className="btn-ghost border border-ardoise-200 text-xs" type="submit">Ajouter</button>
          </form>
        )}
      </div>

      <h2 className="mb-3 font-display text-lg text-ardoise-700">
        Cahier journal commun (10 dernières entrées, toutes classes impliquées)
      </h2>
      <div className="space-y-2">
        {(!cahierCommun || cahierCommun.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucune entrée de cahier journal pour ces classes.</p>
        )}
        {cahierCommun?.map((c: any, i: number) => (
          <div key={i} className="card text-sm">
            <p className="text-xs text-ardoise-400">
              {new Date(c.date).toLocaleDateString("fr-FR")} — {c.classes?.nom}
            </p>
            <p className="text-ardoise-700">{c.contenu}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
