import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";
import { envoyerEmail } from "@/lib/send-email";
import CopyLinkButton from "@/components/CopyLinkButton";
import { redirect } from "next/navigation";

async function envoyerA(supabase: any, destinataireId: string, origin: string) {
  const { data: dest } = await supabase
    .from("demandes_signature_destinataires")
    .select("id, token, email_destinataire, contacts(prenom), demandes_signature(titre)")
    .eq("id", destinataireId)
    .single();

  if (!dest?.email_destinataire) return false;

  const url = `${origin}/signer/${dest.token}`;
  const titre = (dest.demandes_signature as any)?.titre || "Autorisation";
  const { envoye } = await envoyerEmail({
    to: dest.email_destinataire,
    subject: `Autorisation à signer : ${titre}`,
    html: `
      <p>Bonjour ${(dest.contacts as any)?.prenom || ""},</p>
      <p>Une autorisation concernant votre enfant nécessite votre signature : <strong>${titre}</strong>.</p>
      <p><a href="${url}">Cliquez ici pour lire le document et donner votre réponse</a></p>
      <p style="color:#888;font-size:12px;">Ce lien est personnel, à usage unique.</p>
    `
  });
  await supabase.from("demandes_signature_destinataires").update({ email_envoye: envoye }).eq("id", destinataireId);
  return envoye;
}

async function envoyerUn(formData: FormData) {
  "use server";
  const supabase = createClient();
  await envoyerA(supabase, formData.get("destinataire_id") as string, getSiteOrigin());
  redirect(`/autorisations/${formData.get("demande_id")}`);
}

async function envoyerTous(formData: FormData) {
  "use server";
  const supabase = createClient();
  const demande_id = formData.get("demande_id") as string;
  const origin = getSiteOrigin();

  const { data: destinataires } = await supabase
    .from("demandes_signature_destinataires")
    .select("id, email_envoye, email_destinataire")
    .eq("demande_id", demande_id);

  for (const d of destinataires || []) {
    if (!d.email_envoye && d.email_destinataire) {
      await envoyerA(supabase, d.id, origin);
    }
  }
  redirect(`/autorisations/${demande_id}`);
}

async function modifierCampagne(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("demandes_signature")
    .update({
      titre: formData.get("titre") as string,
      contenu: formData.get("contenu") as string
    })
    .eq("id", formData.get("demande_id") as string);
  redirect(`/autorisations/${formData.get("demande_id")}`);
}

async function ajouterDestinataires(formData: FormData) {
  "use server";
  const supabase = createClient();
  const demande_id = formData.get("demande_id") as string;
  const combos = formData.getAll("destinataire") as string[];

  for (const combo of combos) {
    const [eleve_id, contact_id] = combo.split(":");
    const { data: lienRow } = await supabase
      .from("eleve_contacts")
      .select("lien, contacts(email)")
      .eq("eleve_id", eleve_id)
      .eq("contact_id", contact_id)
      .single();

    await supabase.from("demandes_signature_destinataires").insert({
      demande_id,
      eleve_id,
      contact_id,
      lien: lienRow?.lien || null,
      email_destinataire: (lienRow?.contacts as any)?.email || null
    });
  }
  redirect(`/autorisations/${demande_id}`);
}

async function supprimerDestinataire(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("demandes_signature_destinataires").delete().eq("id", formData.get("destinataire_id") as string);
  redirect(`/autorisations/${formData.get("demande_id")}`);
}

async function supprimerCampagne(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("demandes_signature").delete().eq("id", formData.get("id") as string);
  redirect("/autorisations");
}

export default async function CampagneDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const supabase = createClient();

  const { data: campagne } = await supabase
    .from("demandes_signature")
    .select("id, titre, contenu, classe_id, classes(nom)")
    .eq("id", params.id)
    .single();
  if (!campagne) redirect("/autorisations");

  const { data: destinataires } = await supabase
    .from("demandes_signature_destinataires")
    .select("id, eleve_id, contact_id, lien, statut, reponse, nom_signataire, signe_le, pdf_path, email_destinataire, email_envoye, token, eleves(nom, prenom)")
    .eq("demande_id", params.id)
    .order("created_at");

  const idsExistants = new Set((destinataires || []).map((d) => `${d.eleve_id}:${d.contact_id}`));

  const { data: affectationsClasse } = await supabase
    .from("affectations")
    .select("eleves(id, nom, prenom, eleve_contacts(contact_id, lien, contacts(nom, prenom, email)))")
    .eq("classe_id", campagne.classe_id);
  const tousLesEleves = (affectationsClasse || []).map((a: any) => a.eleves).filter(Boolean);

  const pdfUrls: Record<string, string> = {};
  for (const d of destinataires || []) {
    if (d.pdf_path) {
      const { data } = await supabase.storage.from("signatures").createSignedUrl(d.pdf_path, 60 * 10);
      if (data?.signedUrl) pdfUrls[d.id] = data.signedUrl;
    }
  }

  const total = destinataires?.length || 0;
  const repondu = destinataires?.filter((d) => d.statut === "repondu").length || 0;
  const oui = destinataires?.filter((d) => d.reponse === "oui").length || 0;
  const non = destinataires?.filter((d) => d.reponse === "non").length || 0;
  const nonEnvoyes = destinataires?.filter((d) => !d.email_envoye && d.email_destinataire).length || 0;

  return (
    <div className="max-w-4xl">
      {searchParams.edit ? (
        <div className="mb-6 card max-w-lg">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Modifier la campagne</h2>
          <form action={modifierCampagne} className="space-y-4">
            <input type="hidden" name="demande_id" value={campagne.id} />
            <div>
              <label className="label">Titre</label>
              <input className="input" name="titre" defaultValue={campagne.titre} required />
            </div>
            <div>
              <label className="label">Texte de l'autorisation</label>
              <textarea className="input" name="contenu" rows={4} defaultValue={campagne.contenu} required />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">Enregistrer</button>
              <a href={`/autorisations/${campagne.id}`} className="btn-ghost border border-ardoise-200">Annuler</a>
            </div>
          </form>
        </div>
      ) : (
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl text-ardoise-800">{campagne.titre}</h1>
            <p className="text-sm text-ardoise-500">{(campagne as any).classes?.nom}</p>
          </div>
          <div className="flex shrink-0 gap-3 text-xs">
            <a href={`/autorisations/${campagne.id}?edit=1`} className="text-ardoise-600 underline">Modifier</a>
            <form action={supprimerCampagne}>
              <input type="hidden" name="id" value={campagne.id} />
              <button className="text-red-500 underline" type="submit">Supprimer la campagne</button>
            </form>
          </div>
        </div>
      )}
      {!searchParams.edit && <p className="my-4 whitespace-pre-wrap text-sm text-ardoise-600">{campagne.contenu}</p>}

      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-ardoise-600">
        <span><strong>{repondu}</strong>/{total} ont répondu</span>
        <span className="text-ardoise-400">·</span>
        <span className="text-ardoise-700">{oui} oui</span>
        <span className="text-corail">{non} non</span>
        {nonEnvoyes > 0 && (
          <form action={envoyerTous}>
            <input type="hidden" name="demande_id" value={campagne.id} />
            <button className="btn-primary text-xs" type="submit">
              Envoyer maintenant ({nonEnvoyes} en attente d'envoi)
            </button>
          </form>
        )}
      </div>

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Tableau de synthèse</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ardoise-200 text-left text-xs uppercase text-ardoise-400">
              <th className="py-2 pr-3">Enfant</th>
              <th className="py-2 pr-3">Contact</th>
              <th className="py-2 pr-3">Rôle</th>
              <th className="py-2 pr-3">Envoi</th>
              <th className="py-2 pr-3">Réponse</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Lien / PDF</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {destinataires?.map((d: any) => (
              <tr key={d.id} className="border-b border-ardoise-100">
                <td className="py-2 pr-3">{d.eleves?.prenom} {d.eleves?.nom}</td>
                <td className="py-2 pr-3">{d.nom_signataire || d.email_destinataire || "—"}</td>
                <td className="py-2 pr-3">{d.lien || "—"}</td>
                <td className="py-2 pr-3 text-xs">
                  {d.email_destinataire ? (d.email_envoye ? "✓ Envoyé" : "Pas encore") : "Pas d'email"}
                </td>
                <td className="py-2 pr-3">
                  {d.statut === "repondu" ? (
                    <span className={d.reponse === "oui" ? "text-ardoise-700" : "text-corail"}>
                      {d.reponse === "oui" ? "✓ Oui" : "✗ Non"}
                    </span>
                  ) : (
                    <span className="text-ardoise-400">En attente</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs text-ardoise-400">
                  {d.signe_le ? new Date(d.signe_le).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="py-2 pr-3">
                  {d.statut === "repondu" && pdfUrls[d.id] ? (
                    <a href={pdfUrls[d.id]} target="_blank" rel="noreferrer" className="text-xs underline text-ardoise-700">
                      PDF
                    </a>
                  ) : (
                    <div className="w-48">
                      <CopyLinkButton token={d.token} />
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {d.statut !== "repondu" && (
                    <div className="flex gap-2">
                      {d.email_destinataire && (
                        <form action={envoyerUn}>
                          <input type="hidden" name="destinataire_id" value={d.id} />
                          <input type="hidden" name="demande_id" value={campagne.id} />
                          <button className="text-ardoise-600 underline" type="submit">
                            {d.email_envoye ? "Relancer" : "Envoyer"}
                          </button>
                        </form>
                      )}
                      <form action={supprimerDestinataire}>
                        <input type="hidden" name="destinataire_id" value={d.id} />
                        <input type="hidden" name="demande_id" value={campagne.id} />
                        <button className="text-red-500 underline" type="submit">Retirer</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!destinataires || destinataires.length === 0) && (
          <p className="mt-4 text-sm text-ardoise-400">Aucun destinataire pour cette campagne.</p>
        )}
      </div>

      <div className="mt-8 card max-w-lg">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Ajouter un destinataire</h2>
        <form action={ajouterDestinataires} className="space-y-3">
          <input type="hidden" name="demande_id" value={campagne.id} />
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-ardoise-100 p-3">
            {tousLesEleves.map((e: any) => (
              <div key={e.id}>
                <p className="text-sm font-medium text-ardoise-800">{e.prenom} {e.nom}</p>
                {e.eleve_contacts?.map((c: any) => {
                  const deja = idsExistants.has(`${e.id}:${c.contact_id}`);
                  return (
                    <label key={c.contact_id} className="ml-3 flex items-center gap-2 text-xs text-ardoise-600">
                      <input type="checkbox" name="destinataire" value={`${e.id}:${c.contact_id}`} disabled={deja} />
                      {c.lien} — {c.contacts?.prenom} {c.contacts?.nom}
                      {deja ? " (déjà dans la campagne)" : c.contacts?.email ? ` (${c.contacts.email})` : " — pas d'email"}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <button className="btn-primary text-sm" type="submit">Ajouter à la campagne</button>
        </form>
      </div>
    </div>
  );
}
