import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import Link from "next/link";
import { redirect } from "next/navigation";

async function creerEleve(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: eleve, error } = await supabase
    .from("eleves")
    .insert({
      nom: formData.get("nom") as string,
      prenom: formData.get("prenom") as string,
      date_naissance: (formData.get("date_naissance") as string) || null,
      sexe: (formData.get("sexe") as string) || null,
      created_by: user?.id
    })
    .select()
    .single();

  if (error || !eleve) {
    redirect(`/eleves?error=${encodeURIComponent(error?.message || "Erreur lors de la création.")}`);
  }

  const classe_id = formData.get("classe_id") as string;
  if (classe_id) {
    const { data: classe } = await supabase.from("classes").select("annee_id").eq("id", classe_id).single();
    if (classe) {
      await supabase.from("affectations").insert({ eleve_id: eleve.id, classe_id, annee_id: classe.annee_id });
    }
  }

  redirect(`/eleves/${eleve.id}`);
}

export default async function ElevesPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const { active } = await getAnneeActive();

  const { data: eleves } = await supabase
    .from("eleves")
    .select("id, nom, prenom, date_naissance, affectations(niveau, classes(nom), annees_scolaires(libelle))")
    .order("nom");

  const { data: classes } = active
    ? await supabase
        .from("classes")
        .select("id, nom, niveaux, annee_id, annees_scolaires(libelle)")
        .eq("annee_id", active.id)
        .order("nom")
    : { data: [] };

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 font-display text-3xl text-ardoise-800">Élèves (annuaire de l'école)</h1>

      {searchParams.error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      <div className="mb-8 card max-w-lg">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Ajouter un·e élève</h2>
        <form action={creerEleve} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom</label>
              <input className="input" name="prenom" required />
            </div>
            <div>
              <label className="label">Nom</label>
              <input className="input" name="nom" required />
            </div>
          </div>
          <div>
            <label className="label">Date de naissance</label>
            <input className="input" type="date" name="date_naissance" />
          </div>
          <div>
            <label className="label">Sexe</label>
            <select className="input" name="sexe">
              <option value="">Non renseigné</option>
              <option value="M">Garçon</option>
              <option value="F">Fille</option>
            </select>
          </div>
          <div>
            <label className="label">Affecter directement à une classe (optionnel)</label>
            <select className="input" name="classe_id">
              <option value="">— À affecter plus tard —</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.nom} ({c.annees_scolaires?.libelle})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-ardoise-400">
            Tu pourras affiner le niveau précis (si classe multi-niveaux) et gérer les
            affectations et les contacts depuis la fiche de l'élève.
          </p>
          <button className="btn-primary w-full" type="submit">Ajouter</button>
        </form>
      </div>

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Liste ({eleves?.length ?? 0})</h2>
      <div className="space-y-2">
        {eleves?.map((e: any) => {
          const affectationActuelle = e.affectations?.[e.affectations.length - 1];
          return (
            <Link key={e.id} href={`/eleves/${e.id}`} className="card flex items-center justify-between hover:border-ardoise-300">
              <span className="font-medium text-ardoise-800">{e.prenom} {e.nom}</span>
              <span className="text-xs text-ardoise-500">
                {affectationActuelle
                  ? `${affectationActuelle.classes?.nom}${affectationActuelle.niveau ? ` (${affectationActuelle.niveau})` : ""} · ${affectationActuelle.annees_scolaires?.libelle}`
                  : "Non affecté·e"}
              </span>
            </Link>
          );
        })}
        {(!eleves || eleves.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucun élève enregistré pour l'instant.</p>
        )}
      </div>
    </div>
  );
}
