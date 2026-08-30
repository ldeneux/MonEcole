import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import Link from "next/link";
import { redirect } from "next/navigation";

const AVANCEMENT_LABEL: Record<string, string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "Terminé"
};

async function creerProjet(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: projet } = await supabase
    .from("projets")
    .insert({
      titre: formData.get("titre") as string,
      objectifs: (formData.get("objectifs") as string) || null,
      planning: (formData.get("planning") as string) || null,
      created_by: user?.id
    })
    .select()
    .single();

  const classeIds = formData.getAll("classe_ids") as string[];
  if (projet && classeIds.length > 0) {
    await supabase
      .from("projets_classes")
      .insert(classeIds.map((classe_id) => ({ projet_id: projet.id, classe_id })));
  }

  redirect(projet ? `/projets/${projet.id}` : "/projets");
}

async function supprimerProjet(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("projets").delete().eq("id", formData.get("id") as string);
  redirect("/projets");
}

export default async function ProjetsPage() {
  const supabase = createClient();
  const { active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const { data: projets } = await supabase
    .from("projets")
    .select("id, titre, avancement, projets_classes(classes(nom))")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-display text-3xl text-ardoise-800">Projets d'école</h1>

      <div className="mb-8 space-y-3">
        {(!projets || projets.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucun projet créé pour l'instant.</p>
        )}
        {projets?.map((p: any) => (
          <div key={p.id} className="card">
            <Link href={`/projets/${p.id}`} className="block hover:opacity-80">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ardoise-800">{p.titre}</p>
                <span className="text-xs text-ardoise-500">{AVANCEMENT_LABEL[p.avancement]}</span>
              </div>
              <p className="text-xs text-ardoise-400">
                {p.projets_classes?.map((pc: any) => pc.classes?.nom).join(" · ") || "Aucune classe associée"}
              </p>
            </Link>
            <form action={supprimerProjet} className="mt-2">
              <input type="hidden" name="id" value={p.id} />
              <button className="text-xs text-red-500 underline" type="submit">Supprimer</button>
            </form>
          </div>
        ))}
      </div>

      <div className="card max-w-md">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Créer un projet</h2>
        <form action={creerProjet} className="space-y-4">
          <div>
            <label className="label">Titre</label>
            <input className="input" name="titre" required />
          </div>
          <div>
            <label className="label">Objectifs pédagogiques</label>
            <textarea className="input" name="objectifs" rows={2} />
          </div>
          <div>
            <label className="label">Planning</label>
            <textarea className="input" name="planning" rows={2} />
          </div>
          <div>
            <label className="label">Classes impliquées</label>
            <div className="space-y-1">
              {classes?.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-ardoise-600">
                  <input type="checkbox" name="classe_ids" value={c.id} />
                  {c.nom}
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary w-full" type="submit">Créer le projet</button>
        </form>
      </div>
    </div>
  );
}
