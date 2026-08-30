import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";
import { envoyerEmail } from "@/lib/send-email";
import CopyLinkButton from "@/components/CopyLinkButton";
import { redirect } from "next/navigation";

async function renvoyerEmail(formData: FormData) {
  "use server";
  const supabase = createClient();
  const id = formData.get("destinataire_id") as string;
  const demande_id = formData.get("demande_id") as string;

  const { data: dest } = await supabase
    .from("demandes_signature_destinataires")
    .select("token, email_destinataire, contacts(prenom), demandes_signature(titre)")
    .eq("id", id)
    .single();

  if (dest?.email_destinataire) {
    const origin = getSiteOrigin();
    const url = `${origin}/signer/${dest.token}`;
    const titre = (dest.demandes_signature as any)?.titre || "Autorisation";
    const { envoye } = await envoyerEmail({
      to: dest.email_destinataire,
      subject: `Rappel — Autorisation à signer : ${titre}`,
      html: `
        <p>Bonjour ${(dest.contacts as any)?.prenom || ""},</p>
        <p>Petit rappel : une autorisation nécessite toujours votre signature : <strong>${titre}</strong>.</p>
        <p><a href="${url}">Cliquez ici pour lire le document et donner votre réponse</a></p>
      `
    });
    await supabase.from("demandes_signature_destinataires").update({ email_envoye: envoye }).eq("id", id);
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

export default async function CampagneDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: campagne } = await supabase
    .from("demandes_signature")
    .select("id, titre, contenu, classe_id, classes(nom)")
    .eq("id", params.id)
    .single();
  if (!campagne) redirect("/autorisations");

  const { data: destinataires } = await supabase
    .from("demandes_signature_destinataires")
    .select("id, lien, statut, reponse, nom_signataire, signe_le, pdf_path, email_destinataire, email_envoye, token, eleves(nom, prenom)")
    .eq("demande_id", params.id)
    .order("created_at");

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

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-ardoise-800">{campagne.titre}</h1>
          <p className="text-sm text-ardoise-500">{(campagne as any).classes?.nom}</p>
        </div>
        <form action={supprimerCampagne}>
          <input type="hidden" name="id" value={campagne.id} />
          <button className="text-xs text-red-500 underline" type="submit">Supprimer la campagne</button>
        </form>
      </div>
      <p className="my-4 whitespace-pre-wrap text-sm text-ardoise-600">{campagne.contenu}</p>

      <div className="mb-6 flex gap-4 text-sm text-ardoise-600">
        <span><strong>{repondu}</strong>/{total} ont répondu</span>
        <span className="text-ardoise-400">·</span>
        <span className="text-ardoise-700">{oui} oui</span>
        <span className="text-corail">{non} non</span>
      </div>

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Tableau de synthèse</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ardoise-200 text-left text-xs uppercase text-ardoise-400">
              <th className="py-2 pr-3">Enfant</th>
              <th className="py-2 pr-3">Contact</th>
              <th className="py-2 pr-3">Rôle</th>
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
                        <form action={renvoyerEmail}>
                          <input type="hidden" name="destinataire_id" value={d.id} />
                          <input type="hidden" name="demande_id" value={campagne.id} />
                          <button className="text-ardoise-600 underline" type="submit">Relancer</button>
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
    </div>
  );
}
