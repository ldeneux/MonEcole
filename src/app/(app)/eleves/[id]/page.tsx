import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const LIENS = ["mère", "père", "tuteur", "tutrice", "parent", "autre"];

async function modifierEleve(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("eleves")
    .update({
      nom: formData.get("nom") as string,
      prenom: formData.get("prenom") as string,
      date_naissance: (formData.get("date_naissance") as string) || null
    })
    .eq("id", formData.get("eleve_id") as string);
  redirect(`/eleves/${formData.get("eleve_id")}`);
}

async function supprimerEleve(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("eleves").delete().eq("id", formData.get("eleve_id") as string);
  redirect("/eleves");
}

async function ajouterAffectation(formData: FormData) {
  "use server";
  const supabase = createClient();
  const classe_id = formData.get("classe_id") as string;
  const supabaseAdmin = supabase;
  const { data: classe } = await supabaseAdmin.from("classes").select("annee_id").eq("id", classe_id).single();
  await supabase.from("affectations").upsert(
    {
      eleve_id: formData.get("eleve_id") as string,
      classe_id,
      annee_id: classe?.annee_id,
      niveau: (formData.get("niveau") as string) || null
    },
    { onConflict: "eleve_id,annee_id" }
  );
  redirect(`/eleves/${formData.get("eleve_id")}`);
}

async function supprimerAffectation(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("affectations").delete().eq("id", formData.get("affectation_id") as string);
  redirect(`/eleves/${formData.get("eleve_id")}`);
}

async function creerEtLierContact(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: contact } = await supabase
    .from("contacts")
    .insert({
      nom: formData.get("nom") as string,
      prenom: formData.get("prenom") as string,
      telephone: (formData.get("telephone") as string) || null,
      email: (formData.get("email") as string) || null,
      adresse: (formData.get("adresse") as string) || null,
      created_by: user?.id
    })
    .select()
    .single();

  if (contact) {
    await supabase.from("eleve_contacts").insert({
      eleve_id: formData.get("eleve_id") as string,
      contact_id: contact.id,
      lien: formData.get("lien") as string,
      contact_principal: formData.get("contact_principal") === "on"
    });
  }
  redirect(`/eleves/${formData.get("eleve_id")}`);
}

async function delierContact(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("eleve_contacts").delete().eq("id", formData.get("lien_id") as string);
  redirect(`/eleves/${formData.get("eleve_id")}`);
}

async function ajouterAbsence(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  await supabase.from("absences").insert({
    eleve_id: formData.get("eleve_id") as string,
    date: formData.get("date") as string,
    motif: (formData.get("motif") as string) || null,
    created_by: user?.id
  });
  redirect(`/eleves/${formData.get("eleve_id")}`);
}

async function supprimerAbsence(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("absences").delete().eq("id", formData.get("absence_id") as string);
  redirect(`/eleves/${formData.get("eleve_id")}`);
}

export default async function EleveDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: eleve } = await supabase.from("eleves").select("*").eq("id", params.id).single();
  if (!eleve) redirect("/eleves");

  const { data: classes } = await supabase
    .from("classes")
    .select("id, nom, niveaux, annees_scolaires(libelle)")
    .order("nom");

  const { data: affectations } = await supabase
    .from("affectations")
    .select("id, niveau, classes(id, nom, niveaux), annees_scolaires(libelle)")
    .eq("eleve_id", params.id)
    .order("created_at", { ascending: false });

  const { data: contacts } = await supabase
    .from("eleve_contacts")
    .select("id, lien, contact_principal, contacts(id, nom, prenom, telephone, email, adresse)")
    .eq("eleve_id", params.id);

  const { data: absences } = await supabase
    .from("absences")
    .select("id, date, motif")
    .eq("eleve_id", params.id)
    .order("date", { ascending: false });

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-display text-3xl text-ardoise-800">{eleve.prenom} {eleve.nom}</h1>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Informations</h2>
          <form action={modifierEleve} className="space-y-3">
            <input type="hidden" name="eleve_id" value={eleve.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Prénom</label>
                <input className="input" name="prenom" defaultValue={eleve.prenom} required />
              </div>
              <div>
                <label className="label">Nom</label>
                <input className="input" name="nom" defaultValue={eleve.nom} required />
              </div>
            </div>
            <div>
              <label className="label">Date de naissance</label>
              <input className="input" type="date" name="date_naissance" defaultValue={eleve.date_naissance || ""} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary text-sm" type="submit">Enregistrer</button>
              <form action={supprimerEleve}>
                <input type="hidden" name="eleve_id" value={eleve.id} />
                <button className="btn-ghost border border-red-200 text-sm text-red-600" type="submit">
                  Supprimer l'élève
                </button>
              </form>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Affectations (classe par année)</h2>
          <ul className="mb-3 space-y-2 text-sm">
            {affectations?.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between">
                <span>
                  {a.classes?.nom}{a.niveau ? ` (${a.niveau})` : ""} — {a.annees_scolaires?.libelle}
                </span>
                <form action={supprimerAffectation}>
                  <input type="hidden" name="affectation_id" value={a.id} />
                  <input type="hidden" name="eleve_id" value={eleve.id} />
                  <button className="text-xs text-red-500 underline" type="submit">Retirer</button>
                </form>
              </li>
            ))}
            {(!affectations || affectations.length === 0) && (
              <li className="text-ardoise-400">Aucune affectation.</li>
            )}
          </ul>
          <form action={ajouterAffectation} className="space-y-2">
            <input type="hidden" name="eleve_id" value={eleve.id} />
            <select className="input text-sm" name="classe_id" required>
              <option value="">Affecter à une classe…</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nom} ({c.annees_scolaires?.libelle})</option>
              ))}
            </select>
            <input className="input text-sm" name="niveau" placeholder="Niveau précis (ex. CE1, si classe multi-niveaux)" />
            <button className="btn-ghost border border-ardoise-200 text-sm w-full" type="submit">
              Affecter / mettre à jour pour cette année
            </button>
          </form>
        </div>
      </div>

      <div className="mb-6 card">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Contacts (parents, tuteurs…)</h2>
        <ul className="mb-4 space-y-2 text-sm">
          {contacts?.map((c: any) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>
                <strong>{c.lien}</strong>{c.contact_principal ? " · principal" : ""} — {c.contacts?.prenom} {c.contacts?.nom}
                {c.contacts?.telephone ? ` · ${c.contacts.telephone}` : ""}
                {c.contacts?.email ? ` · ${c.contacts.email}` : ""}
              </span>
              <form action={delierContact}>
                <input type="hidden" name="lien_id" value={c.id} />
                <input type="hidden" name="eleve_id" value={eleve.id} />
                <button className="text-xs text-red-500 underline" type="submit">Retirer</button>
              </form>
            </li>
          ))}
          {(!contacts || contacts.length === 0) && (
            <li className="text-ardoise-400">Aucun contact enregistré.</li>
          )}
        </ul>
        <details>
          <summary className="cursor-pointer text-sm text-ardoise-600">Ajouter un contact</summary>
          <form action={creerEtLierContact} className="mt-3 space-y-3">
            <input type="hidden" name="eleve_id" value={eleve.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Prénom</label>
                <input className="input" name="prenom" required />
              </div>
              <div>
                <label className="label">Nom</label>
                <input className="input" name="nom" required />
              </div>
            </div>
            <div>
              <label className="label">Lien avec l'élève</label>
              <select className="input" name="lien">
                {LIENS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Téléphone</label>
                <input className="input" name="telephone" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" name="email" />
              </div>
            </div>
            <div>
              <label className="label">Adresse</label>
              <input className="input" name="adresse" />
            </div>
            <label className="flex items-center gap-2 text-sm text-ardoise-600">
              <input type="checkbox" name="contact_principal" /> Contact principal
            </label>
            <button className="btn-primary text-sm" type="submit">Ajouter le contact</button>
          </form>
        </details>
      </div>

      <div className="card">
        <h2 className="mb-3 font-display text-lg text-ardoise-700">Absences</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {absences?.map((a) => (
            <li key={a.id} className="flex items-center justify-between">
              <span>{new Date(a.date).toLocaleDateString("fr-FR")}{a.motif ? ` — ${a.motif}` : ""}</span>
              <form action={supprimerAbsence}>
                <input type="hidden" name="absence_id" value={a.id} />
                <input type="hidden" name="eleve_id" value={eleve.id} />
                <button className="text-xs text-red-500 underline" type="submit">Supprimer</button>
              </form>
            </li>
          ))}
          {(!absences || absences.length === 0) && <li className="text-ardoise-400">Aucune absence.</li>}
        </ul>
        <form action={ajouterAbsence} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="eleve_id" value={eleve.id} />
          <input className="input" type="date" name="date" required />
          <input className="input" name="motif" placeholder="Motif (optionnel)" />
          <button className="btn-ghost border border-ardoise-200 text-sm" type="submit">Déclarer</button>
        </form>
      </div>
    </div>
  );
}
