import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import { redirect } from "next/navigation";

async function ajouterLivre(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const classe_id = formData.get("classe_id") as string;
  const isbn = (formData.get("isbn") as string)?.replace(/[^0-9Xx]/g, "");
  let titre = (formData.get("titre") as string) || "";
  let auteur = (formData.get("auteur") as string) || "";
  let resume = "";
  let couverture_url = "";

  // Recherche automatique des informations du livre via l'ISBN (Open Library, gratuit, sans clé API)
  if (isbn) {
    try {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const info = data[`ISBN:${isbn}`];
      if (info) {
        titre = titre || info.title || "";
        auteur = auteur || info.authors?.map((a: any) => a.name).join(", ") || "";
        resume = info.excerpts?.[0]?.text || info.notes || "";
        couverture_url = info.cover?.medium || "";
      }
    } catch {
      // Si l'API est indisponible, on garde les champs saisis manuellement.
    }
  }

  if (!titre) {
    redirect(
      `/coin-lecture?classe=${classe_id}&error=${encodeURIComponent(
        "Aucune information trouvée pour cet ISBN — renseigne le titre manuellement."
      )}`
    );
  }

  await supabase.from("livres").insert({
    classe_id,
    isbn: isbn || null,
    titre,
    auteur: auteur || null,
    resume: resume || null,
    couverture_url: couverture_url || null,
    created_by: user?.id
  });

  redirect(`/coin-lecture?classe=${classe_id}`);
}

async function modifierLivre(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("livres")
    .update({
      titre: formData.get("titre") as string,
      auteur: (formData.get("auteur") as string) || null
    })
    .eq("id", formData.get("id") as string);
  redirect(`/coin-lecture?classe=${formData.get("classe_id")}`);
}

async function supprimerLivre(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("livres").delete().eq("id", formData.get("id") as string);
  redirect(`/coin-lecture?classe=${formData.get("classe_id")}`);
}

async function emprunter(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("emprunts").insert({
    livre_id: formData.get("livre_id") as string,
    eleve_id: formData.get("eleve_id") as string,
    date_emprunt: formData.get("date_emprunt") as string
  });
  redirect(`/coin-lecture?classe=${formData.get("classe_id")}`);
}

async function retourner(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("emprunts")
    .update({ date_retour: new Date().toISOString().slice(0, 10) })
    .eq("id", formData.get("emprunt_id") as string);
  redirect(`/coin-lecture?classe=${formData.get("classe_id")}`);
}

export default async function CoinLecturePage({
  searchParams
}: {
  searchParams: { classe?: string; error?: string; edit?: string };
}) {
  const supabase = createClient();
  const { active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const classeId = searchParams.classe || classes?.[0]?.id;

  const { data: affectationsClasse } = classeId
    ? await supabase.from("affectations").select("eleves(id, nom, prenom)").eq("classe_id", classeId).order("id")
    : { data: [] };
  const eleves = (affectationsClasse || [])
    .map((a: any) => a.eleves)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.nom > b.nom ? 1 : -1));

  const { data: livres } = classeId
    ? await supabase
        .from("livres")
        .select("id, isbn, titre, auteur, resume, couverture_url, emprunts(id, eleve_id, date_emprunt, date_retour, eleves(prenom, nom))")
        .eq("classe_id", classeId)
        .order("titre")
    : { data: [] };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-ardoise-800">Coin lecture</h1>
        <ClassSelector classes={classes || []} />
      </div>

      {searchParams.error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      {classeId && (
        <div className="mb-8 card max-w-md">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Ajouter un livre</h2>
          <form action={ajouterLivre} className="space-y-4">
            <input type="hidden" name="classe_id" value={classeId} />
            <div>
              <label className="label">ISBN (recherche automatique du titre/auteur)</label>
              <input className="input" name="isbn" placeholder="ex. 9782070612758" />
            </div>
            <div>
              <label className="label">Titre (si pas trouvé automatiquement)</label>
              <input className="input" name="titre" />
            </div>
            <div>
              <label className="label">Auteur</label>
              <input className="input" name="auteur" />
            </div>
            <button className="btn-primary w-full" type="submit">Ajouter au catalogue</button>
          </form>
        </div>
      )}

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Catalogue ({livres?.length ?? 0})</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {livres?.map((l: any) => {
          const empruntEnCours = l.emprunts?.find((e: any) => !e.date_retour);
          if (searchParams.edit === l.id) {
            return (
              <form key={l.id} action={modifierLivre} className="card space-y-2">
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="classe_id" value={classeId} />
                <input className="input text-sm" name="titre" defaultValue={l.titre} required />
                <input className="input text-sm" name="auteur" defaultValue={l.auteur || ""} placeholder="Auteur" />
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" type="submit">Enregistrer</button>
                  <a href={`/coin-lecture?classe=${classeId}`} className="btn-ghost border border-ardoise-200 text-xs">Annuler</a>
                </div>
              </form>
            );
          }
          return (
            <div key={l.id} className="card flex gap-3">
              {l.couverture_url && (
                <img src={l.couverture_url} alt={l.titre} className="h-24 w-16 rounded object-cover" />
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-ardoise-800">{l.titre}</p>
                    <p className="text-xs text-ardoise-500">{l.auteur}</p>
                  </div>
                  <div className="flex gap-2 text-xs shrink-0">
                    <a href={`/coin-lecture?classe=${classeId}&edit=${l.id}`} className="text-ardoise-600 underline">Modifier</a>
                    <form action={supprimerLivre}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="classe_id" value={classeId} />
                      <button className="text-red-500 underline" type="submit">Suppr.</button>
                    </form>
                  </div>
                </div>
                {empruntEnCours ? (
                  <div className="mt-2 text-xs">
                    <p className="text-corail">
                      Emprunté par {empruntEnCours.eleves?.prenom} {empruntEnCours.eleves?.nom} le{" "}
                      {new Date(empruntEnCours.date_emprunt).toLocaleDateString("fr-FR")}
                    </p>
                    <form action={retourner}>
                      <input type="hidden" name="emprunt_id" value={empruntEnCours.id} />
                      <input type="hidden" name="classe_id" value={classeId} />
                      <button className="mt-1 text-xs underline text-ardoise-600" type="submit">
                        Marquer comme rendu
                      </button>
                    </form>
                  </div>
                ) : (
                  <form action={emprunter} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="livre_id" value={l.id} />
                    <input type="hidden" name="classe_id" value={classeId} />
                    <input type="hidden" name="date_emprunt" value={new Date().toISOString().slice(0, 10)} />
                    <select className="input text-xs" name="eleve_id" required>
                      <option value="">Emprunter à…</option>
                      {eleves?.map((e) => (
                        <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
                      ))}
                    </select>
                    <button className="btn-ghost border border-ardoise-200 text-xs" type="submit">OK</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
