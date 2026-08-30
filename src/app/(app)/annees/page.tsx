import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

async function creerAnnee(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("annees_scolaires").insert({
    libelle: formData.get("libelle") as string,
    date_debut: formData.get("date_debut") as string,
    date_fin: formData.get("date_fin") as string,
    created_by: user?.id
  });
  if (error) {
    redirect(`/annees?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/annees");
}

async function modifierAnnee(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("annees_scolaires")
    .update({
      libelle: formData.get("libelle") as string,
      date_debut: formData.get("date_debut") as string,
      date_fin: formData.get("date_fin") as string
    })
    .eq("id", formData.get("id") as string);
  redirect("/annees");
}

async function supprimerAnnee(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { error } = await supabase.from("annees_scolaires").delete().eq("id", formData.get("id") as string);
  if (error) {
    redirect(
      `/annees?error=${encodeURIComponent(
        "Impossible de supprimer : des classes existent encore pour cette année."
      )}`
    );
  }
  redirect("/annees");
}

export default async function AnneesPage({
  searchParams
}: {
  searchParams: { error?: string; edit?: string };
}) {
  const supabase = createClient();
  const { data: annees } = await supabase
    .from("annees_scolaires")
    .select("id, libelle, date_debut, date_fin, classes(count)")
    .order("date_debut", { ascending: false });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-display text-3xl text-ardoise-800">Années scolaires</h1>
      <p className="mb-6 text-sm text-ardoise-500">
        C'est le point d'entrée de toute l'application : chaque classe, et donc les élèves qui
        y sont affectés, dépend d'une année scolaire précise. Choisis l'année active dans le
        menu de gauche.
      </p>

      {searchParams.error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      <div className="mb-8 space-y-2">
        {annees?.map((a: any) =>
          searchParams.edit === a.id ? (
            <form key={a.id} action={modifierAnnee} className="card space-y-2">
              <input type="hidden" name="id" value={a.id} />
              <input className="input text-sm" name="libelle" defaultValue={a.libelle} required />
              <div className="grid grid-cols-2 gap-3">
                <input className="input text-sm" type="date" name="date_debut" defaultValue={a.date_debut} required />
                <input className="input text-sm" type="date" name="date_fin" defaultValue={a.date_fin} required />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" type="submit">Enregistrer</button>
                <Link href="/annees" className="btn-ghost border border-ardoise-200 text-xs">Annuler</Link>
              </div>
            </form>
          ) : (
            <div key={a.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-ardoise-800">{a.libelle}</p>
                <p className="text-xs text-ardoise-400">
                  {new Date(a.date_debut).toLocaleDateString("fr-FR")} → {new Date(a.date_fin).toLocaleDateString("fr-FR")}
                  {" · "}{a.classes?.[0]?.count ?? 0} classe(s)
                </p>
              </div>
              <span className="flex gap-3 text-xs">
                <Link href={`/annees?edit=${a.id}`} className="text-ardoise-600 underline">Modifier</Link>
                <form action={supprimerAnnee}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-red-500 underline" type="submit">Supprimer</button>
                </form>
              </span>
            </div>
          )
        )}
        {(!annees || annees.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucune année scolaire pour l'instant — crées-en une ci-dessous.</p>
        )}
      </div>

      <div className="card max-w-md">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Créer une année scolaire</h2>
        <form action={creerAnnee} className="space-y-4">
          <div>
            <label className="label">Libellé</label>
            <input className="input" name="libelle" placeholder="ex. 2026-2027" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Début</label>
              <input className="input" type="date" name="date_debut" required />
            </div>
            <div>
              <label className="label">Fin</label>
              <input className="input" type="date" name="date_fin" required />
            </div>
          </div>
          <button className="btn-primary w-full" type="submit">Créer</button>
        </form>
      </div>
    </div>
  );
}
