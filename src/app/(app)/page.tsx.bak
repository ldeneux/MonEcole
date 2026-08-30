import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import CopyLinkButton from "@/components/CopyLinkButton";
import { redirect } from "next/navigation";

const MODELES = [
  {
    titre: "Autorisation droit à l'image",
    contenu:
      "J'autorise l'enseignant·e à prendre des photos ou vidéos de mon enfant dans le cadre des activités de classe, et à les utiliser pour le cahier de vie de la classe, le blog de l'école ou une exposition interne à l'établissement. Cette autorisation ne concerne pas une diffusion publique sur internet en dehors du cadre scolaire."
  },
  {
    titre: "Autorisation de sortie scolaire",
    contenu:
      "J'autorise mon enfant à participer à la sortie scolaire organisée par sa classe. J'ai pris connaissance des horaires, du lieu et des modalités de transport."
  }
];

async function creerDemande(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("demandes_signature").insert({
    classe_id: formData.get("classe_id") as string,
    eleve_id: formData.get("eleve_id") as string,
    sortie_id: (formData.get("sortie_id") as string) || null,
    titre: formData.get("titre") as string,
    contenu: formData.get("contenu") as string,
    created_by: user?.id
  });

  if (error) {
    redirect(`/autorisations?classe=${formData.get("classe_id")}&error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/autorisations?classe=${formData.get("classe_id")}`);
}

async function supprimerDemande(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("demandes_signature").delete().eq("id", formData.get("id") as string);
  redirect(`/autorisations?classe=${formData.get("classe_id")}`);
}

export default async function AutorisationsPage({
  searchParams
}: {
  searchParams: { classe?: string; error?: string };
}) {
  const supabase = createClient();
  const { active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const classeId = searchParams.classe || classes?.[0]?.id;

  const { data: affectationsClasse } = classeId
    ? await supabase.from("affectations").select("eleves(id, nom, prenom)").eq("classe_id", classeId)
    : { data: [] };
  const eleves = (affectationsClasse || [])
    .map((a: any) => a.eleves)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.nom > b.nom ? 1 : -1));

  const { data: sorties } = classeId
    ? await supabase.from("sorties_scolaires").select("id, titre").eq("classe_id", classeId).order("date_sortie", { ascending: false })
    : { data: [] };

  const { data: demandes } = classeId
    ? await supabase
        .from("demandes_signature")
        .select("id, titre, statut, nom_signataire, signe_le, pdf_path, token, eleves(nom, prenom)")
        .eq("classe_id", classeId)
        .order("created_at", { ascending: false })
    : { data: [] };

  // URLs de téléchargement signées pour les PDF déjà générés
  const pdfUrls: Record<string, string> = {};
  for (const d of demandes || []) {
    if (d.pdf_path) {
      const { data } = await supabase.storage.from("signatures").createSignedUrl(d.pdf_path, 60 * 10);
      if (data?.signedUrl) pdfUrls[d.id] = data.signedUrl;
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl text-ardoise-800">Autorisations (signature électronique)</h1>
        <ClassSelector classes={classes || []} />
      </div>

      {searchParams.error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      {classeId && (
        <div className="mb-8 card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Nouvelle demande</h2>
          <form action={creerDemande} className="space-y-4">
            <input type="hidden" name="classe_id" value={classeId} />
            <div>
              <label className="label">Élève concerné</label>
              <select className="input" name="eleve_id" required>
                <option value="">Choisir…</option>
                {eleves.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
                ))}
              </select>
            </div>
            {sorties && sorties.length > 0 && (
              <div>
                <label className="label">Lier à une sortie (optionnel)</label>
                <select className="input" name="sortie_id">
                  <option value="">—</option>
                  {sorties.map((s) => (
                    <option key={s.id} value={s.id}>{s.titre}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Modèles (à copier-coller dans les champs ci-dessous)</label>
              {MODELES.map((m) => (
                <details key={m.titre} className="mt-1">
                  <summary className="cursor-pointer text-xs text-ardoise-600 underline">{m.titre}</summary>
                  <p className="mt-1 rounded bg-ardoise-50 p-2 text-xs text-ardoise-600">{m.contenu}</p>
                </details>
              ))}
            </div>
            <div>
              <label className="label">Titre de la demande</label>
              <input className="input" name="titre" placeholder="ex. Autorisation droit à l'image" required />
            </div>
            <div>
              <label className="label">Texte de l'autorisation</label>
              <textarea className="input" name="contenu" rows={4} required />
            </div>
            <button className="btn-primary w-full" type="submit">Créer la demande</button>
          </form>
        </div>
      )}

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Demandes en cours</h2>
      <div className="space-y-2">
        {(!demandes || demandes.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucune demande pour cette classe.</p>
        )}
        {demandes?.map((d: any) => (
          <div key={d.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ardoise-800">{d.titre}</p>
                <p className="text-xs text-ardoise-400">
                  {d.eleves?.prenom} {d.eleves?.nom}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs text-white ${
                  d.statut === "signe" ? "bg-ardoise-600" : "bg-corail"
                }`}
              >
                {d.statut === "signe" ? "✓ Signé" : "En attente"}
              </span>
            </div>

            {d.statut === "signe" ? (
              <p className="mt-2 text-xs text-ardoise-500">
                Signé par {d.nom_signataire} le {d.signe_le && new Date(d.signe_le).toLocaleDateString("fr-FR")}
                {pdfUrls[d.id] && (
                  <>
                    {" · "}
                    <a href={pdfUrls[d.id]} target="_blank" rel="noreferrer" className="underline text-ardoise-700">
                      Télécharger le PDF signé
                    </a>
                  </>
                )}
              </p>
            ) : (
              <div className="mt-2">
                <CopyLinkButton token={d.token} />
              </div>
            )}

            <form action={supprimerDemande} className="mt-2">
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="classe_id" value={classeId} />
              <button className="text-xs text-red-500 underline" type="submit">Supprimer</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
