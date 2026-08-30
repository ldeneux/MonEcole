import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

async function affecterExistant(formData: FormData) {
  "use server";
  const supabase = createClient();
  const classe_id = formData.get("classe_id") as string;
  const { data: classe } = await supabase.from("classes").select("annee_id").eq("id", classe_id).single();
  await supabase.from("affectations").upsert(
    {
      eleve_id: formData.get("eleve_id") as string,
      classe_id,
      annee_id: classe?.annee_id,
      niveau: (formData.get("niveau") as string) || null
    },
    { onConflict: "eleve_id,annee_id" }
  );
  redirect(`/classes/${classe_id}`);
}

async function retirerAffectation(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("affectations").delete().eq("id", formData.get("affectation_id") as string);
  redirect(`/classes/${formData.get("classe_id")}`);
}

export default async function ClasseDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: classe } = await supabase
    .from("classes")
    .select("id, nom, niveaux, annee_id, annees_scolaires(libelle)")
    .eq("id", params.id)
    .single();
  if (!classe) redirect("/classes");

  const { data: affectations } = await supabase
    .from("affectations")
    .select("id, niveau, eleves(id, nom, prenom)")
    .eq("classe_id", params.id);

  const eleveIdsAffectes = new Set((affectations || []).map((a: any) => a.eleves?.id));

  // Élèves visibles par l'utilisateur mais pas encore affectés à CETTE classe pour son année
  const { data: tousLesEleves } = await supabase.from("eleves").select("id, nom, prenom").order("nom");
  const disponibles = (tousLesEleves || []).filter((e) => !eleveIdsAffectes.has(e.id));

  const multiniveau = (classe.niveaux?.length || 0) > 1;

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-3xl text-ardoise-800">{classe.nom}</h1>
        <Link href={`/classes?edit=${classe.id}`} className="text-sm text-ardoise-600 underline">
          Modifier la classe
        </Link>
      </div>
      <p className="mb-6 text-sm text-ardoise-500">
        {classe.niveaux?.join(" · ")} · {(classe as any).annees_scolaires?.libelle}
      </p>

      <div className="mb-8 card max-w-md">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Affecter un·e élève existant·e</h2>
        <form action={affecterExistant} className="space-y-3">
          <input type="hidden" name="classe_id" value={classe.id} />
          <select className="input" name="eleve_id" required>
            <option value="">Choisir un élève de l'annuaire…</option>
            {disponibles.map((e) => (
              <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
            ))}
          </select>
          {multiniveau && (
            <select className="input" name="niveau">
              <option value="">Niveau…</option>
              {classe.niveaux?.map((n: string) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
          <button className="btn-primary w-full" type="submit">Affecter à cette classe</button>
        </form>
        <p className="mt-2 text-xs text-ardoise-400">
          L'élève n'existe pas encore ? <Link href="/eleves" className="underline">Crée-le dans l'annuaire</Link>, puis reviens l'affecter ici.
        </p>
      </div>

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Élèves affectés ({affectations?.length ?? 0})</h2>
      <div className="space-y-2">
        {affectations?.map((a: any) => (
          <div key={a.id} className="card flex items-center justify-between">
            <Link href={`/eleves/${a.eleves?.id}`} className="text-sm font-medium text-ardoise-800 hover:underline">
              {a.eleves?.prenom} {a.eleves?.nom} {a.niveau ? `(${a.niveau})` : ""}
            </Link>
            <form action={retirerAffectation}>
              <input type="hidden" name="affectation_id" value={a.id} />
              <input type="hidden" name="classe_id" value={classe.id} />
              <button className="text-xs text-red-500 underline" type="submit">Retirer de la classe</button>
            </form>
          </div>
        ))}
        {(!affectations || affectations.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucun élève affecté à cette classe pour l'instant.</p>
        )}
      </div>
    </div>
  );
}
