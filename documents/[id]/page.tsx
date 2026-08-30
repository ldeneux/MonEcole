import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";
import { envoyerEmail } from "@/lib/send-email";
import CopyLinkButton from "@/components/CopyLinkButton";
import { redirect } from "next/navigation";

async function envoyerA(supabase: any, destinataireId: string, origin: string) {
  const { data: dest } = await supabase
    .from("documents_destinataires")
    .select("id, token, email_destinataire, contacts(prenom), documents(titre)")
    .eq("id", destinataireId)
    .single();

  if (!dest?.email_destinataire) return false;

  const url = `${origin}/lire/${dest.token}`;
  const titre = (dest.documents as any)?.titre || "Document";
  const { envoye } = await envoyerEmail({
    to: dest.email_destinataire,
    subject: `Information : ${titre}`,
    html: `
      <p>Bonjour ${(dest.contacts as any)?.prenom || ""},</p>
      <p>Un document d'information vous concerne : <strong>${titre}</strong>.</p>
      <p><a href="${url}">Cliquez ici pour le consulter</a></p>
      <p style="color:#888;font-size:12px;">Simple information — aucune action de votre part n'est nécessaire.</p>
    `
  });
  await supabase.from("documents_destinataires").update({ email_envoye: envoye }).eq("id", destinataireId);
  return envoye;
}

async function envoyerUn(formData: FormData) {
  "use server";
  const supabase = createClient();
  await envoyerA(supabase, formData.get("destinataire_id") as string, getSiteOrigin());
  redirect(`/documents/${formData.get("document_id")}`);
}

async function envoyerTous(formData: FormData) {
  "use server";
  const supabase = createClient();
  const document_id = formData.get("document_id") as string;
  const origin = getSiteOrigin();

  const { data: destinataires } = await supabase
    .from("documents_destinataires")
    .select("id, email_envoye, email_destinataire")
    .eq("document_id", document_id);

  for (const d of destinataires || []) {
    if (!d.email_envoye && d.email_destinataire) {
      await envoyerA(supabase, d.id, origin);
    }
  }
  redirect(`/documents/${document_id}`);
}

async function modifierDocument(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("documents")
    .update({
      titre: formData.get("titre") as string,
      contenu: formData.get("contenu") as string,
      date_evenement: (formData.get("date_evenement") as string) || null,
      lieu: (formData.get("lieu") as string) || null
    })
    .eq("id", formData.get("document_id") as string);
  redirect(`/documents/${formData.get("document_id")}`);
}

async function ajouterDestinataires(formData: FormData) {
  "use server";
  const supabase = createClient();
  const document_id = formData.get("document_id") as string;
  const combos = formData.getAll("destinataire") as string[];

  for (const combo of combos) {
    const [eleve_id, contact_id] = combo.split(":");
    const { data: lienRow } = await supabase
      .from("eleve_contacts")
      .select("lien, contacts(email)")
      .eq("eleve_id", eleve_id)
      .eq("contact_id", contact_id)
      .single();

    await supabase.from("documents_destinataires").insert({
      document_id,
      eleve_id,
      contact_id,
      lien: lienRow?.lien || null,
      email_destinataire: (lienRow?.contacts as any)?.email || null
    });
  }
  redirect(`/documents/${document_id}`);
}

async function supprimerDestinataire(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("documents_destinataires").delete().eq("id", formData.get("destinataire_id") as string);
  redirect(`/documents/${formData.get("document_id")}`);
}

async function supprimerDocument(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("documents").delete().eq("id", formData.get("id") as string);
  redirect("/documents");
}

export default async function DocumentDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const supabase = createClient();

  const { data: document } = await supabase
    .from("documents")
    .select("id, titre, contenu, date_evenement, lieu, classe_id, classes(nom)")
    .eq("id", params.id)
    .single();
  if (!document) redirect("/documents");

  const { data: destinataires } = await supabase
    .from("documents_destinataires")
    .select("id, eleve_id, contact_id, lien, email_destinataire, email_envoye, lu, lu_le, token, eleves(nom, prenom)")
    .eq("document_id", params.id)
    .order("created_at");

  const idsExistants = new Set((destinataires || []).map((d) => `${d.eleve_id}:${d.contact_id}`));

  const { data: affectationsClasse } = await supabase
    .from("affectations")
    .select("eleves(id, nom, prenom, eleve_contacts(contact_id, lien, contacts(nom, prenom, email)))")
    .eq("classe_id", document.classe_id);
  const tousLesEleves = (affectationsClasse || []).map((a: any) => a.eleves).filter(Boolean);

  const total = destinataires?.length || 0;
  const lus = destinataires?.filter((d) => d.lu).length || 0;
  const nonEnvoyes = destinataires?.filter((d) => !d.email_envoye && d.email_destinataire).length || 0;

  return (
    <div className="max-w-4xl">
      {searchParams.edit ? (
        <div className="mb-6 card max-w-lg">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Modifier le document</h2>
          <form action={modifierDocument} className="space-y-4">
            <input type="hidden" name="document_id" value={document.id} />
            <div>
              <label className="label">Titre</label>
              <input className="input" name="titre" defaultValue={document.titre} required />
            </div>
            <div>
              <label className="label">Contenu</label>
              <textarea className="input" name="contenu" rows={4} defaultValue={document.contenu} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date/heure de l'événement</label>
                <input
                  className="input"
                  type="datetime-local"
                  name="date_evenement"
                  defaultValue={document.date_evenement ? document.date_evenement.slice(0, 16) : ""}
                />
              </div>
              <div>
                <label className="label">Lieu</label>
                <input className="input" name="lieu" defaultValue={document.lieu || ""} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">Enregistrer</button>
              <a href={`/documents/${document.id}`} className="btn-ghost border border-ardoise-200">Annuler</a>
            </div>
          </form>
        </div>
      ) : (
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl text-ardoise-800">{document.titre}</h1>
            <p className="text-sm text-ardoise-500">
              {(document as any).classes?.nom}
              {document.date_evenement && ` · ${new Date(document.date_evenement).toLocaleString("fr-FR")}`}
              {document.lieu && ` · ${document.lieu}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-3 text-xs">
            <a href={`/documents/${document.id}?edit=1`} className="text-ardoise-600 underline">Modifier</a>
            <form action={supprimerDocument}>
              <input type="hidden" name="id" value={document.id} />
              <button className="text-red-500 underline" type="submit">Supprimer</button>
            </form>
          </div>
        </div>
      )}
      {!searchParams.edit && <p className="my-4 whitespace-pre-wrap text-sm text-ardoise-600">{document.contenu}</p>}

      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-ardoise-600">
        <span><strong>{lus}</strong>/{total} ont consulté le document</span>
        {nonEnvoyes > 0 && (
          <form action={envoyerTous}>
            <input type="hidden" name="document_id" value={document.id} />
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
              <th className="py-2 pr-3">Lu</th>
              <th className="py-2 pr-3">Lien</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {destinataires?.map((d: any) => (
              <tr key={d.id} className="border-b border-ardoise-100">
                <td className="py-2 pr-3">{d.eleves?.prenom} {d.eleves?.nom}</td>
                <td className="py-2 pr-3">{d.email_destinataire || "—"}</td>
                <td className="py-2 pr-3">{d.lien || "—"}</td>
                <td className="py-2 pr-3 text-xs">
                  {d.email_destinataire ? (d.email_envoye ? "✓ Envoyé" : "Pas encore") : "Pas d'email"}
                </td>
                <td className="py-2 pr-3">
                  {d.lu ? (
                    <span className="text-ardoise-700">✓ {d.lu_le && new Date(d.lu_le).toLocaleDateString("fr-FR")}</span>
                  ) : (
                    <span className="text-ardoise-400">Pas encore</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <div className="w-48">
                    <CopyLinkButton token={d.token} />
                  </div>
                </td>
                <td className="py-2 pr-3 text-xs">
                  <div className="flex gap-2">
                    {d.email_destinataire && (
                      <form action={envoyerUn}>
                        <input type="hidden" name="destinataire_id" value={d.id} />
                        <input type="hidden" name="document_id" value={document.id} />
                        <button className="text-ardoise-600 underline" type="submit">
                          {d.email_envoye ? "Relancer" : "Envoyer"}
                        </button>
                      </form>
                    )}
                    <form action={supprimerDestinataire}>
                      <input type="hidden" name="destinataire_id" value={d.id} />
                      <input type="hidden" name="document_id" value={document.id} />
                      <button className="text-red-500 underline" type="submit">Retirer</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!destinataires || destinataires.length === 0) && (
          <p className="mt-4 text-sm text-ardoise-400">Aucun destinataire pour ce document.</p>
        )}
      </div>

      <div className="mt-8 card max-w-lg">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Ajouter un destinataire</h2>
        <form action={ajouterDestinataires} className="space-y-3">
          <input type="hidden" name="document_id" value={document.id} />
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
                      {deja ? " (déjà destinataire)" : c.contacts?.email ? ` (${c.contacts.email})` : " — pas d'email"}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <button className="btn-primary text-sm" type="submit">Ajouter</button>
        </form>
      </div>
    </div>
  );
}
