import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import { redirect } from "next/navigation";

async function envoyerMessage(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const classe_id = formData.get("classe_id") as string;
  const eleve_id = (formData.get("eleve_id") as string) || null;
  const necessite_signature = formData.get("necessite_signature") === "on";

  const { data: message } = await supabase
    .from("messages_liaison")
    .insert({
      classe_id,
      eleve_id,
      auteur_id: user?.id,
      titre: formData.get("titre") as string,
      contenu: formData.get("contenu") as string,
      necessite_signature
    })
    .select()
    .single();

  if (message && necessite_signature) {
    let idsEleves: string[] = [];
    if (eleve_id) {
      idsEleves = [eleve_id];
    } else {
      const { data: affectationsClasse } = await supabase
        .from("affectations")
        .select("eleve_id")
        .eq("classe_id", classe_id);
      idsEleves = (affectationsClasse || []).map((a) => a.eleve_id);
    }
    if (idsEleves.length > 0) {
      await supabase
        .from("messages_liaison_reponses")
        .insert(idsEleves.map((id) => ({ message_id: message.id, eleve_id: id })));
    }
  }

  redirect(`/carnet-de-liaison?classe=${classe_id}`);
}

async function marquerSigne(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("messages_liaison_reponses")
    .update({ signe: true, signe_at: new Date().toISOString() })
    .eq("id", formData.get("reponse_id") as string);
  redirect(`/carnet-de-liaison?classe=${formData.get("classe_id")}`);
}

async function supprimerMessage(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("messages_liaison").delete().eq("id", formData.get("id") as string);
  redirect(`/carnet-de-liaison?classe=${formData.get("classe_id")}`);
}

export default async function CarnetLiaisonPage({
  searchParams
}: {
  searchParams: { classe?: string };
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

  const { data: messages } = classeId
    ? await supabase
        .from("messages_liaison")
        .select("id, titre, contenu, necessite_signature, created_at, eleves(prenom, nom), messages_liaison_reponses(id, signe, eleves(prenom, nom))")
        .eq("classe_id", classeId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-ardoise-800">Carnet de liaison</h1>
        <ClassSelector classes={classes || []} />
      </div>

      {classeId && (
        <div className="mb-8 card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Nouveau message</h2>
          <form action={envoyerMessage} className="space-y-4">
            <input type="hidden" name="classe_id" value={classeId} />
            <div>
              <label className="label">Destinataire</label>
              <select className="input" name="eleve_id">
                <option value="">Toute la classe</option>
                {eleves?.map((e) => (
                  <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Titre</label>
              <input className="input" name="titre" required />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input" name="contenu" rows={3} required />
            </div>
            <label className="flex items-center gap-2 text-sm text-ardoise-600">
              <input type="checkbox" name="necessite_signature" />
              Nécessite une signature des parents
            </label>
            <button className="btn-primary" type="submit">Envoyer</button>
          </form>
        </div>
      )}

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Historique</h2>
      <div className="space-y-4">
        {(!messages || messages.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucun message envoyé pour l'instant.</p>
        )}
        {messages?.map((m: any) => (
          <div key={m.id} className="card">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-medium text-ardoise-800">{m.titre}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-ardoise-400">
                  {new Date(m.created_at).toLocaleDateString("fr-FR")}
                </p>
                <form action={supprimerMessage}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="classe_id" value={classeId} />
                  <button className="text-xs text-red-500 underline" type="submit">Supprimer</button>
                </form>
              </div>
            </div>
            <p className="mb-2 text-xs text-ardoise-400">
              {m.eleves ? `${m.eleves.prenom} ${m.eleves.nom}` : "Toute la classe"}
            </p>
            <p className="mb-3 text-sm text-ardoise-700">{m.contenu}</p>
            {m.necessite_signature && (
              <div>
                <p className="label">Signatures</p>
                <ul className="space-y-1 text-sm">
                  {m.messages_liaison_reponses?.map((r: any) => (
                    <li key={r.id} className="flex items-center justify-between">
                      <span>{r.eleves?.prenom} {r.eleves?.nom}</span>
                      {r.signe ? (
                        <span className="text-xs text-ardoise-500">✓ Signé</span>
                      ) : (
                        <form action={marquerSigne}>
                          <input type="hidden" name="reponse_id" value={r.id} />
                          <input type="hidden" name="classe_id" value={classeId} />
                          <button className="text-xs text-corail underline" type="submit">
                            Marquer signé
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
