import { createServiceClient } from "@/lib/supabase/service";
import { genererPdfSignature } from "@/lib/generate-pdf";
import SignaturePad from "@/components/SignaturePad";
import { redirect } from "next/navigation";

async function signerDemande(formData: FormData) {
  "use server";
  const token = formData.get("token") as string;
  const nom_signataire = (formData.get("nom_signataire") as string || "").trim();
  const signature_data = formData.get("signature_data") as string;

  if (!nom_signataire || !signature_data) {
    redirect(`/signer/${token}?error=${encodeURIComponent("Merci de renseigner votre nom et de signer avant de valider.")}`);
  }

  const supabase = createServiceClient();

  const { data: demande } = await supabase
    .from("demandes_signature")
    .select("id, classe_id, eleve_id, titre, contenu, statut, eleves(nom, prenom)")
    .eq("token", token)
    .single();

  if (!demande) {
    redirect(`/signer/${token}?error=${encodeURIComponent("Lien invalide.")}`);
  }
  if (demande.statut === "signe") {
    redirect(`/signer/${token}`);
  }

  const dateSignature = new Date();
  const nomEleve = `${(demande.eleves as any)?.prenom || ""} ${(demande.eleves as any)?.nom || ""}`.trim();

  const pdfBytes = await genererPdfSignature({
    titre: demande.titre,
    contenu: demande.contenu,
    nomEleve,
    nomSignataire: nom_signataire,
    dateSignature,
    signatureDataUrl: signature_data
  });

  const pdfPath = `${demande.classe_id}/${demande.eleve_id}/${demande.id}.pdf`;
  await supabase.storage.from("signatures").upload(pdfPath, Buffer.from(pdfBytes), {
    contentType: "application/pdf",
    upsert: true
  });

  await supabase
    .from("demandes_signature")
    .update({
      statut: "signe",
      nom_signataire,
      signature_data,
      signe_le: dateSignature.toISOString(),
      pdf_path: pdfPath
    })
    .eq("id", demande.id);

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
  const { data: demande } = await supabase
    .from("demandes_signature")
    .select("id, titre, contenu, statut, nom_signataire, signe_le, eleves(nom, prenom), classes(nom)")
    .eq("token", params.token)
    .single();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ardoise-900 px-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-center font-display text-2xl text-craie">Classe — Autorisation</h1>

        <div className="card">
          {!demande && (
            <p className="text-sm text-red-600">
              Ce lien n'est pas valide. Contacte l'enseignant·e pour obtenir un nouveau lien.
            </p>
          )}

          {demande && demande.statut === "signe" && (
            <div>
              <p className="mb-2 font-display text-lg text-ardoise-700">✓ Déjà signé</p>
              <p className="text-sm text-ardoise-600">
                Cette autorisation a été signée par <strong>{demande.nom_signataire}</strong> le{" "}
                {demande.signe_le && new Date(demande.signe_le).toLocaleDateString("fr-FR")}.
              </p>
              <p className="mt-2 text-xs text-ardoise-400">
                Vous pouvez fermer cette page. L'enseignant·e a reçu une copie du document signé.
              </p>
            </div>
          )}

          {demande && demande.statut !== "signe" && (
            <>
              <h2 className="mb-1 font-display text-lg text-ardoise-800">{demande.titre}</h2>
              <p className="mb-4 text-xs text-ardoise-400">
                Concerne : {(demande.eleves as any)?.prenom} {(demande.eleves as any)?.nom} —{" "}
                {(demande.classes as any)?.nom}
              </p>
              <p className="mb-6 whitespace-pre-wrap text-sm text-ardoise-700">{demande.contenu}</p>

              {searchParams.error && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
              )}

              <form action={signerDemande} className="space-y-4">
                <input type="hidden" name="token" value={params.token} />
                <div>
                  <label className="label">Votre nom et prénom</label>
                  <input className="input" name="nom_signataire" required />
                </div>
                <div>
                  <label className="label">Signature</label>
                  <SignaturePad inputName="signature_data" />
                </div>
                <button className="btn-primary w-full" type="submit">
                  Signer et valider
                </button>
                <p className="text-center text-[11px] text-ardoise-400">
                  En signant, vous confirmez avoir lu et accepté le contenu ci-dessus.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
