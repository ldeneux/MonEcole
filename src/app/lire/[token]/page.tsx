import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";

async function marquerLu(formData: FormData) {
  "use server";
  const token = formData.get("token") as string;
  const supabase = createServiceClient();
  await supabase
    .from("documents_destinataires")
    .update({ lu: true, lu_le: new Date().toISOString() })
    .eq("token", token);
  redirect(`/lire/${token}`);
}

export default async function LirePage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();
  const { data: destinataire } = await supabase
    .from("documents_destinataires")
    .select(
      "id, lu, lu_le, documents(titre, contenu, date_evenement, lieu, classes(nom))"
    )
    .eq("token", params.token)
    .single();

  const document = destinataire?.documents as any;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ardoise-900 px-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-center font-display text-2xl text-craie">Classe — Information</h1>

        <div className="card">
          {!destinataire && (
            <p className="text-sm text-red-600">
              Ce lien n'est pas valide. Contacte l'enseignant·e si besoin.
            </p>
          )}

          {destinataire && (
            <>
              <h2 className="mb-1 font-display text-lg text-ardoise-800">{document?.titre}</h2>
              <p className="mb-4 text-xs text-ardoise-400">
                {document?.classes?.nom}
                {document?.date_evenement && ` · ${new Date(document.date_evenement).toLocaleString("fr-FR")}`}
                {document?.lieu && ` · ${document.lieu}`}
              </p>
              <p className="mb-6 whitespace-pre-wrap text-sm text-ardoise-700">{document?.contenu}</p>

              {destinataire.lu ? (
                <p className="text-xs text-ardoise-400">
                  Vous avez consulté ce document
                  {destinataire.lu_le && ` le ${new Date(destinataire.lu_le).toLocaleDateString("fr-FR")}`}.
                </p>
              ) : (
                <form action={marquerLu}>
                  <input type="hidden" name="token" value={params.token} />
                  <button className="btn-ghost border border-ardoise-200 text-xs" type="submit">
                    Marquer comme lu (optionnel)
                  </button>
                </form>
              )}
              <p className="mt-4 text-center text-[11px] text-ardoise-400">
                Simple information — aucune action de votre part n'est requise.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
