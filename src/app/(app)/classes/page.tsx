import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAnneeActive } from "@/lib/annee-active";

async function creerClasse(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const nom = formData.get("nom") as string;
  const annee_id = formData.get("annee_id") as string;
  const niveaux = (formData.get("niveaux") as string)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: classe, error: erreurClasse } = await supabase
    .from("classes")
    .insert({ nom, niveaux, annee_id, created_by: user?.id })
    .select()
    .single();

  if (erreurClasse || !classe) {
    redirect(`/classes?error=${encodeURIComponent(erreurClasse?.message || "Impossible de créer la classe.")}`);
  }

  const { error: erreurCp } = await supabase
    .from("classe_professeurs")
    .insert({ classe_id: classe.id, professeur_id: user?.id });

  if (erreurCp) {
    redirect(`/classes?error=${encodeURIComponent(erreurCp.message)}`);
  }

  redirect("/classes");
}

async function modifierClasse(formData: FormData) {
  "use server";
  const supabase = createClient();
  const niveaux = (formData.get("niveaux") as string)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await supabase
    .from("classes")
    .update({ nom: formData.get("nom") as string, niveaux })
    .eq("id", formData.get("classe_id") as string);
  redirect("/classes");
}

async function supprimerClasse(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { error } = await supabase.from("classes").delete().eq("id", formData.get("classe_id") as string);
  if (error) {
    redirect(`/classes?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/classes");
}

export default async function ClassesPage({
  searchParams
}: {
  searchParams: { error?: string; edit?: string };
}) {
  const supabase = createClient();
  const { active } = await getAnneeActive();

  const { data: classes } = active
    ? await supabase
        .from("classes")
        .select("id, nom, niveaux, affectations(count)")
        .eq("annee_id", active.id)
        .order("nom")
    : { data: [] };

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 font-display text-3xl text-ardoise-800">Classes</h1>
      <p className="mb-6 text-sm text-ardoise-500">
        Année scolaire : <strong>{active?.libelle || "aucune sélectionnée"}</strong>
      </p>

      {searchParams.error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      {!active && (
        <p className="mb-6 text-sm text-ardoise-500">
          Crée d'abord une <Link href="/annees" className="underline">année scolaire</Link> pour pouvoir créer des classes.
        </p>
      )}

      {active && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes?.map((c: any) =>
              searchParams.edit === c.id ? (
                <form key={c.id} action={modifierClasse} className="card space-y-2">
                  <input type="hidden" name="classe_id" value={c.id} />
                  <input className="input text-sm" name="nom" defaultValue={c.nom} required />
                  <input className="input text-sm" name="niveaux" defaultValue={c.niveaux?.join(", ")} />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" type="submit">Enregistrer</button>
                    <Link href="/classes" className="btn-ghost border border-ardoise-200 text-xs">Annuler</Link>
                  </div>
                </form>
              ) : (
                <div key={c.id} className="card">
                  <Link href={`/classes/${c.id}`} className="block hover:opacity-80">
                    <p className="font-display text-lg text-ardoise-700">{c.nom}</p>
                    <p className="text-xs text-ardoise-400">{c.niveaux?.join(" · ")}</p>
                    <p className="mt-2 text-xs text-ardoise-400">{c.affectations?.[0]?.count ?? 0} élève(s)</p>
                  </Link>
                  <div className="mt-3 flex gap-3 text-xs">
                    <Link href={`/classes?edit=${c.id}`} className="text-ardoise-600 underline">Modifier</Link>
                    <form action={supprimerClasse}>
                      <input type="hidden" name="classe_id" value={c.id} />
                      <button className="text-red-500 underline" type="submit">Supprimer</button>
                    </form>
                  </div>
                </div>
              )
            )}
            {(!classes || classes.length === 0) && (
              <p className="text-sm text-ardoise-400">Aucune classe pour cette année scolaire.</p>
            )}
          </div>

          <div className="card max-w-md">
            <h2 className="mb-3 font-display text-lg text-ardoise-700">
              Créer une classe pour {active.libelle}
            </h2>
            <form action={creerClasse} className="space-y-4">
              <input type="hidden" name="annee_id" value={active.id} />
              <div>
                <label className="label">Nom de la classe</label>
                <input className="input" name="nom" placeholder="ex. CE1-CE2 A" required />
              </div>
              <div>
                <label className="label">Niveaux (séparés par des virgules)</label>
                <input className="input" name="niveaux" placeholder="CE1, CE2" />
              </div>
              <button className="btn-primary w-full" type="submit">Créer</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
