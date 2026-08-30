import { createServiceClient } from "@/lib/supabase/service";
import { genererPdfSignature } from "@/lib/generate-pdf";
import SignaturePad from "@/components/SignaturePad";
import { redirect } from "next/navigation";

async function repondreDemande(formData: FormData) {
  "use server";
  const token = formData.get("token") as string;
  const nom_signataire = ((formData.get("nom_signataire") as string) || "").trim();
  const signature_data = formData.get("signature_data") as string;
  const reponse = formData.get("reponse") as string;

  if (!nom_signataire || !signature_data || (reponse !== "oui" && reponse !== "non")) {
    redirect(
      `/signer/${token}?error=${encodeURIComponent(
        "Merci de choisir une réponse, de renseigner votre nom et de signer avant de valider."
      )}`
    );
  }

  const supabase = createServiceClient();

  const { data: destinataire } = await supabase
    .from("demandes_signature_destinataires")
    .select("id, eleve_id, lien, statut, demandes_signature(id, classe_id, titre, contenu), eleves(nom, prenom)")
    .eq("token", token)
    .single();

  if (!destinataire) {
    redirect(`/signer/${token}?error=${encodeURIComponent("Lien invalide.")}`);
  }
  if (destinataire.statut === "repondu") {
    redirect(`/signer/${token}`);
  }

  const demande = destinataire.demandes_signature as any;
  const dateSignature = new Date();
  const nomEleve = `${(destinataire.eleves as any)?.prenom || ""} ${(destinataire.eleves as any)?.nom || ""}`.trim();

  const pdfBytes = await genererPdfSignature({
    titre: demande.titre,
    contenu: demande.contenu,
    nomEleve,
    nomSignataire: nom_signataire,
    role: destinataire.lien,
    reponse: reponse as "oui" | "non",
    dateSignature,
    signatureDataUrl: signature_data
  });

  const pdfPath = `${demande.classe_id}/${destinataire.eleve_id}/${destinataire.id}.pdf`;
  await supabase.storage.from("signatures").upload(pdfPath, Buffer.from(pdfBytes), {
    contentType: "application/pdf",
    upsert: true
  });

  await supabase
    .from("demandes_signature_destinataires")
    .update({
      statut: "repondu",
      reponse,
      nom_signataire,
      signature_data,
      signe_le: dateSignature.toISOString(),
      pdf_path: pdfPath
    })
    .eq("id", destinataire.id);

  redirect(`/signer/${token}`);
}

export default async function SignerPage({
  params,
  searchParams
}: {
  params: { token: string };
  searchParams: { error?: string };
}) {
  const supabase = createServiceClient();
  const { data: destinataire } = await supabase
    .from("demandes_signature_destinataires")
    .select(
      "id, lien, statut, reponse, nom_signataire, signe_le, eleves(nom, prenom), demandes_signature(titre, contenu, classes(nom))"
    )
    .eq("token", params.token)
    .single();

  const demande = destinataire?.demandes_signature as any;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ardoise-900 px-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-center font-display text-2xl text-craie">Classe — Autorisation</h1>

        <div className="card">
          {!destinataire && (
            <p className="text-sm text-red-600">
              Ce lien n'est pas valide. Contacte l'enseignant·e pour obtenir un nouveau lien.
            </p>
          )}

          {destinataire && destinataire.statut === "repondu" && (
            <div>
              <p className="mb-2 font-display text-lg text-ardoise-700">
                {destinataire.reponse === "oui" ? "✓ Autorisation donnée" : "✗ Autorisation refusée"}
              </p>
              <p className="text-sm text-ardoise-600">
                Réponse enregistrée par <strong>{destinataire.nom_signataire}</strong>
                {destinataire.lien ? ` (${destinataire.lien})` : ""} le{" "}
                {destinataire.signe_le && new Date(destinataire.signe_le).toLocaleDateString("fr-FR")}.
              </p>
              <p className="mt-2 text-xs text-ardoise-400">
                Vous pouvez fermer cette page. L'enseignant·e a reçu une copie du document signé.
              </p>
            </div>
          )}

          {destinataire && destinataire.statut !== "repondu" && (
            <>
              <h2 className="mb-1 font-display text-lg text-ardoise-800">{demande?.titre}</h2>
              <p className="mb-4 text-xs text-ardoise-400">
                Concerne : {(destinataire.eleves as any)?.prenom} {(destinataire.eleves as any)?.nom} —{" "}
                {demande?.classes?.nom}
                {destinataire.lien ? ` · Vous répondez en tant que : ${destinataire.lien}` : ""}
              </p>
              <p className="mb-6 whitespace-pre-wrap text-sm text-ardoise-700">{demande?.contenu}</p>

              {searchParams.error && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
              )}

              <form action={repondreDemande} className="space-y-4">
                <input type="hidden" name="token" value={params.token} />

                <div>
                  <label className="label">Votre réponse</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-ardoise-200 px-3 py-3 text-sm has-[:checked]:border-ardoise-600 has-[:checked]:bg-ardoise-50">
                      <input type="radio" name="reponse" value="oui" required />
                      J'autorise
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-ardoise-200 px-3 py-3 text-sm has-[:checked]:border-corail has-[:checked]:bg-red-50">
                      <input type="radio" name="reponse" value="non" required />
                      Je n'autorise pas
                    </label>
                  </div>
                </div>

                <div>
                  <label className="label">Votre nom et prénom</label>
                  <input className="input" name="nom_signataire" required />
                </div>
                <div>
                  <label className="label">Signature</label>
                  <SignaturePad inputName="signature_data" />
                </div>
                <button className="btn-primary w-full" type="submit">
                  Valider ma réponse
                </button>
                <p className="text-center text-[11px] text-ardoise-400">
                  En signant, vous confirmez avoir lu le contenu ci-dessus et donnez la réponse
                  sélectionnée, qu'il s'agisse d'un accord ou d'un refus.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
