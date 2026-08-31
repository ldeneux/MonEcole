import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import Link from "next/link";
import { redirect } from "next/navigation";

const MODELES = [
  {
    titre: "Réunion de présentation parents-professeurs (rentrée)",
    contenu:
      "Une réunion de présentation de la classe se tiendra en début d'année scolaire. Ce sera l'occasion de vous présenter le fonctionnement de la classe, les objectifs pédagogiques de l'année et de répondre à vos questions. Votre présence est vivement recommandée."
  }
];

async function creerDocument(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const classe_id = formData.get("classe_id") as string;
  const titre = formData.get("titre") as string;
  const contenu = formData.get("contenu") as string;
  const date_evenement = (formData.get("date_evenement") as string) || null;
  const lieu = (formData.get("lieu") as string) || null;
  const combos = formData.getAll("destinataire") as string[];

  if (combos.length === 0) {
    redirect(`/documents?classe=${classe_id}&error=${encodeURIComponent("Sélectionne au moins un destinataire.")}`);
  }

  const { data: document, error } = await supabase
    .from("documents")
    .insert({ classe_id, titre, contenu, date_evenement, lieu, created_by: user?.id })
    .select()
    .single();

  if (error || !document) {
    redirect(`/documents?classe=${classe_id}&error=${encodeURIComponent(error?.message || "Erreur")}`);
  }

  for (const combo of combos) {
    const [eleve_id, contact_id] = combo.split(":");
    const { data: lienRow } = await supabase
      .from("eleve_contacts")
      .select("lien, contacts(email)")
      .eq("eleve_id", eleve_id)
      .eq("contact_id", contact_id)
      .single();

    await supabase.from("documents_destinataires").insert({
      document_id: document.id,
      eleve_id,
      contact_id,
      lien: lienRow?.lien || null,
      email_destinataire: (lienRow?.contacts as any)?.email || null
    });
  }

  redirect(`/documents/${document.id}`);
}

export default async function DocumentsPage({
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

  const { data: documents } = classeId
    ? await supabase
        .from("documents")
        .select("id, titre, date_evenement, created_at, documents_destinataires(email_envoye, lu)")
        .eq("classe_id", classeId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl text-ardoise-800">Documents (information)</h1>
        <ClassSelector classes={classes || []} />
        {classeId && (
          <a
            href={`/api/pptx-reunion/${classeId}`}
            className="btn-ghost border border-ardoise-200 text-sm"
          >
            📊 Générer la présentation PowerPoint (réunion de rentrée)
          </a>
        )}
      </div>
      <p className="mb-6 text-sm text-ardoise-500">
        Pour informer les familles sans rien leur demander en retour (réunion,
        info pratique…) — contrairement aux Autorisations, aucune signature
        ni réponse n'est requise du parent.
      </p>

      {searchParams.error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}

      {classeId && (
        <div className="mb-8 card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Nouveau document</h2>
          <form action={creerDocument} className="space-y-4">
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
              <label className="label">Titre</label>
              <input className="input" name="titre" placeholder="ex. Réunion de rentrée" required />
            </div>
            <div>
              <label className="label">Contenu</label>
              <textarea className="input" name="contenu" rows={4} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date/heure de l'événement (optionnel)</label>
                <input className="input" type="datetime-local" name="date_evenement" />
              </div>
              <div>
                <label className="label">Lieu (optionnel)</label>
                <input className="input" name="lieu" />
              </div>
            </div>

            <div>
              <label className="label">Destinataires</label>
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

            <button className="btn-primary w-full" type="submit">Créer le document</button>
          </form>
        </div>
      )}

      <h2 className="mb-3 font-display text-lg text-ardoise-700">Documents envoyés</h2>
      <div className="space-y-2">
        {(!documents || documents.length === 0) && (
          <p className="text-sm text-ardoise-400">Aucun document pour cette classe.</p>
        )}
        {documents?.map((d: any) => {
          const total = d.documents_destinataires?.length || 0;
          const lus = d.documents_destinataires?.filter((x: any) => x.lu).length || 0;
          const envoyes = d.documents_destinataires?.filter((x: any) => x.email_envoye).length || 0;
          return (
            <Link key={d.id} href={`/documents/${d.id}`} className="card block hover:opacity-80">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ardoise-800">{d.titre}</p>
                <p className="text-xs text-ardoise-500">{lus}/{total} lus</p>
              </div>
              <p className="text-xs text-ardoise-400">
                {new Date(d.created_at).toLocaleDateString("fr-FR")} · {envoyes}/{total} envoyés
                {d.date_evenement && ` · Événement le ${new Date(d.date_evenement).toLocaleDateString("fr-FR")}`}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
