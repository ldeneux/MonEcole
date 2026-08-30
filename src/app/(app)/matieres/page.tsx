import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

async function creerMatiere(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { error } = await supabase.from("matieres").insert({
    nom: formData.get("nom") as string,
    couleur: (formData.get("couleur") as string) || "#3f7264"
  });
  if (error) {
    redirect(`/matieres?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/matieres");
}

async function modifierMatiere(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("matieres")
    .update({ nom: formData.get("nom") as string, couleur: formData.get("couleur") as string })
    .eq("id", formData.get("id") as string);
  redirect("/matieres");
}

async function supprimerMatiere(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { error } = await supabase.from("matieres").delete().eq("id", formData.get("id") as string);
  if (error) {
    redirect(
      `/matieres?error=${encodeURIComponent(
        "Impossible de supprimer : cette matière est utilisée dans l'emploi du temps, le cahier journal ou des évaluations."
      )}`
    );
  }
  redirect("/matieres");
}

export default async function MatieresPage({
  searchParams
}: {
  searchParams: { error?: string; edit?: string };
}) {
  const supabase = createClient();
  const { data: matieres } = await supabase.from("matieres").select("id, nom, couleur").order("nom");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-display text-3xl text-ardoise-800">Matières</h1>

      {searchParams.error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      <div className="mb-8 space-y-2">
        {matieres?.map((m) =>
          searchParams.edit === m.id ? (
            <form key={m.id} action={modifierMatiere} className="card flex items-center gap-3">
              <input type="hidden" name="id" value={m.id} />
              <input className="input flex-1" name="nom" defaultValue={m.nom} required />
              <input className="h-9 w-14 rounded" type="color" name="couleur" defaultValue={m.couleur} />
              <button className="btn-primary text-xs" type="submit">Enregistrer</button>
              <Link href="/matieres" className="btn-ghost border border-ardoise-200 text-xs">Annuler</Link>
            </form>
          ) : (
            <div key={m.id} className="card flex items-center justify-between">
              <span className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: m.couleur }} />
                {m.nom}
              </span>
              <span className="flex gap-3 text-xs">
                <Link href={`/matieres?edit=${m.id}`} className="text-ardoise-600 underline">Modifier</Link>
                <form action={supprimerMatiere}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-red-500 underline" type="submit">Supprimer</button>
                </form>
              </span>
            </div>
          )
        )}
      </div>

      <div className="card max-w-sm">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Ajouter une matière</h2>
        <form action={creerMatiere} className="flex items-center gap-3">
          <input className="input flex-1" name="nom" placeholder="ex. Anglais" required />
          <input className="h-9 w-14 rounded" type="color" name="couleur" defaultValue="#3f7264" />
          <button className="btn-primary text-sm" type="submit">Ajouter</button>
        </form>
      </div>
    </div>
  );
}
