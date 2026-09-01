import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import Link from "next/link";
import { redirect } from "next/navigation";

async function creerSortie(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const classe_id = formData.get("classe_id") as string;

  const { data: sortie } = await supabase
    .from("sorties_scolaires")
    .insert({
      classe_id,
      titre: formData.get("titre") as string,
      lieu: (formData.get("lieu") as string) || null,
      date_sortie: formData.get("date_sortie") as string,
      date_fin: (formData.get("date_fin") as string) || (formData.get("date_sortie") as string),
      avec_nuitee: formData.get("avec_nuitee") === "on",
      heure_debut: (formData.get("heure_debut") as string) || null,
      heure_fin: (formData.get("heure_fin") as string) || null,
      objectifs: (formData.get("objectifs") as string) || null,
      created_by: user?.id
    })
    .select()
    .single();

  if (sortie) {
    const { data: affectationsClasse } = await supabase
      .from("affectations")
      .select("eleve_id")
      .eq("classe_id", classe_id);
    if (affectationsClasse && affectationsClasse.length > 0) {
      await supabase
        .from("sorties_participants")
        .insert(affectationsClasse.map((a) => ({ sortie_id: sortie.id, eleve_id: a.eleve_id })));
    }
    redirect(`/sorties/${sortie.id}`);
  }
  redirect(`/sorties?classe=${classe_id}`);
}

async function supprimerSortie(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("sorties_scolaires").delete().eq("id", formData.get("id") as string);
  redirect(`/sorties?classe=${formData.get("classe_id")}`);
}

export default async function SortiesPage({ searchParams }: { searchParams: { classe?: string } }) {
  const supabase = createClient();
  const { active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const classeId = searchParams.classe || classes?.[0]?.id;

  const { data: sorties } = classeId
    ? await supabase
        .from("sorties_scolaires")
        .select("id, titre, lieu, date_sortie, date_fin, avec_nuitee, sorties_participants(autorisation, fiche_sanitaire, assurance)")
        .eq("classe_id", classeId)
        .order("date_sortie", { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-ardoise-800">Sorties scolaires</h1>
        <ClassSelector classes={classes || []} />
      </div>

      <div className="mb-8 space-y-3">
        {(!sorties || sorties.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucune sortie créée pour cette classe.</p>
        )}
        {sorties?.map((s: any) => {
          const total = s.sorties_participants?.length || 0;
          const complet = s.sorties_participants?.filter(
            (p: any) => p.autorisation && p.fiche_sanitaire && p.assurance
          ).length || 0;
          return (
            <div key={s.id} className="card">
              <Link href={`/sorties/${s.id}`} className="block hover:opacity-80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ardoise-800">{s.titre}</p>
                    <p className="text-xs text-ardoise-400">
                      {new Date(s.date_sortie).toLocaleDateString("fr-FR")}
                      {s.date_fin && s.date_fin !== s.date_sortie && ` → ${new Date(s.date_fin).toLocaleDateString("fr-FR")}`}
                      {s.avec_nuitee && " · avec nuitée"}
                      {s.lieu ? ` · ${s.lieu}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-ardoise-500">
                    {complet}/{total} dossiers complets
                  </p>
                </div>
              </Link>
              <form action={supprimerSortie} className="mt-2">
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="classe_id" value={classeId} />
                <button className="text-xs text-red-500 underline" type="submit">Supprimer la sortie</button>
              </form>
            </div>
          );
        })}
      </div>

      {classeId && (
        <div className="card max-w-md">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Créer une sortie</h2>
          <form action={creerSortie} className="space-y-4">
            <input type="hidden" name="classe_id" value={classeId} />
            <div>
              <label className="label">Titre</label>
              <input className="input" name="titre" required />
            </div>
            <div>
              <label className="label">Lieu</label>
              <input className="input" name="lieu" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Date de début</label>
                <input className="input" type="date" name="date_sortie" required />
              </div>
              <div>
                <label className="label">Date de fin (si plusieurs jours)</label>
                <input className="input" type="date" name="date_fin" />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm text-ardoise-600">
                <input type="checkbox" name="avec_nuitee" /> Avec nuitée
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Heure de départ</label>
                <input className="input" type="time" name="heure_debut" />
              </div>
              <div>
                <label className="label">Heure de retour</label>
                <input className="input" type="time" name="heure_fin" />
              </div>
            </div>
            <div>
              <label className="label">Objectifs pédagogiques</label>
              <textarea className="input" name="objectifs" rows={2} />
            </div>
            <button className="btn-primary w-full" type="submit">
              Créer (les élèves de la classe sont ajoutés automatiquement)
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
