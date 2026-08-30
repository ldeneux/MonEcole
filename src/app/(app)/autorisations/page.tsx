import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import Link from "next/link";
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

async function creerCampagne(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const classe_id = formData.get("classe_id") as string;
  const titre = formData.get("titre") as string;
  const contenu = formData.get("contenu") as string;
  const sortie_id = (formData.get("sortie_id") as string) || null;
  const combos = formData.getAll("destinataire") as string[];

  if (combos.length === 0) {
    redirect(`/autorisations?classe=${classe_id}&error=${encodeURIComponent("Sélectionne au moins un destinataire.")}`);
  }

  const { data: demande, error } = await supabase
    .from("demandes_signature")
    .insert({ classe_id, titre, contenu, sortie_id, created_by: user?.id })
    .select()
    .single();

  if (error || !demande) {
    redirect(`/autorisations?classe=${classe_id}&error=${encodeURIComponent(error?.message || "Erreur")}`);
  }

  for (const combo of combos) {
    const [eleve_id, contact_id] = combo.split(":");
    const { data: lienRow } = await supabase
      .from("eleve_contacts")
      .select("lien, contacts(email)")
      .eq("eleve_id", eleve_id)
      .eq("contact_id", contact_id)
      .single();

    await supabase.from("demandes_signature_destinataires").insert({
      demande_id: demande.id,
      eleve_id,
      contact_id,
      lien: lienRow?.lien || null,
      email_destinataire: (lienRow?.contacts as any)?.email || null
    });
  }

  // Créée, mais PAS envoyée : l'envoi se fait séparément depuis la page de la campagne
  redirect(`/autorisations/${demande.id}`);
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
    ? await supabase
        .from("affectations")
        .select("eleves(id, nom, prenom, eleve_contacts(contact_id, lien, contact_principal, contacts(nom, prenom, email)))")
        .eq("classe_id", classeId)
    : { data: [] };
  const eleves = (affectationsClasse || [])
    .map((a: any) => a.eleves)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.nom > b.nom ? 1 : -1));

  const { data: sorties } = classeId
    ? await supabase.from("sorties_scolaires").select("id, titre").eq("classe_id", classeId).order("date_sortie", { ascending: false })
    : { data: [] };

  const { data: campagnes } = classeId
    ? await supabase
        .from("demandes_signature")
        .select("id, titre, created_at, demandes_signature_destinataires(statut, reponse, email_envoye)")
        .eq("classe_id", classeId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl text-ardoise-800">Autorisations (signature électronique)</h1>
        <ClassSelector classes={classes || []} />
      </div>

      {searchParams.error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      {classeId && (
        <div className="mb-8 card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Nouvelle campagne d'autorisation</h2>
          <p className="mb-3 text-xs text-ardoise-400">
            La campagne est d'abord créée sans être envoyée — tu pourras relire,
            modifier et choisir quand l'envoyer depuis sa page dédiée.
          </p>
          <form action={creerCampagne} className="space-y-4">
            <input type="hidden" name="classe_id" value={classeId} />

            <div>
              <label className="label">Modèles (à copier-coller ci-dessous)</label>
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
              <label className="label">Destinataires</label>
              <p className="mb-2 text-xs text-ardoise-400">
                Tu pourras en ajouter ou en retirer après la création.
              </p>
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-ardoise-100 p-3">
                {eleves.map((e: any) => (
                  <div key={e.id}>
                    <p className="text-sm font-medium text-ardoise-800">{e.prenom} {e.nom}</p>
                    {(!e.eleve_contacts || e.eleve_contacts.length === 0) && (
                      <p className="text-xs text-ardoise-400">
                        Aucun contact enregistré —{" "}
                        <Link href={`/eleves/${e.id}`} className="underline">en ajouter un</Link>.
                      </p>
                    )}
                    {e.eleve_contacts?.map((c: any) => (
                      <label key={c.contact_id} className="ml-3 flex items-center gap-2 text-xs text-ardoise-600">
                        <input
                          type="checkbox"
                          name="destinataire"
                          value={`${e.id}:${c.contact_id}`}
                          defaultChecked={c.contact_principal}
                        />
                        {c.lien} — {c.contacts?.prenom} {c.contacts?.nom}
                        {c.contacts?.email ? ` (${c.contacts.email})` : " — pas d'email, lien à copier manuellement"}
                      </label>
                    ))}
                  </div>
                ))}
                {eleves.length === 0 && (
                  <p className="text-sm text-ardoise-400">Aucun élève affecté à cette classe.</p>
                )}
              </div>
            </div>

            <button className="btn-primary w-full" type="submit">Créer la campagne</button>
          </form>
        </div>
      )}

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Campagnes</h2>
      <div className="space-y-2">
        {(!campagnes || campagnes.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucune campagne pour cette classe.</p>
        )}
        {campagnes?.map((c: any) => {
          const total = c.demandes_signature_destinataires?.length || 0;
          const repondu = c.demandes_signature_destinataires?.filter((d: any) => d.statut === "repondu").length || 0;
          const envoyes = c.demandes_signature_destinataires?.filter((d: any) => d.email_envoye).length || 0;
          const oui = c.demandes_signature_destinataires?.filter((d: any) => d.reponse === "oui").length || 0;
          const non = c.demandes_signature_destinataires?.filter((d: any) => d.reponse === "non").length || 0;
          return (
            <Link key={c.id} href={`/autorisations/${c.id}`} className="card block hover:opacity-80">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ardoise-800">{c.titre}</p>
                <p className="text-xs text-ardoise-500">{repondu}/{total} réponses</p>
              </div>
              <p className="text-xs text-ardoise-400">
                {new Date(c.created_at).toLocaleDateString("fr-FR")} · {envoyes}/{total} envoyés · {oui} oui · {non} non
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
