import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const LIENS = ["mère", "père", "tuteur", "tutrice", "parent", "autre"];

async function modifierContact(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase
    .from("contacts")
    .update({
      nom: formData.get("nom") as string,
      prenom: formData.get("prenom") as string,
      telephone: (formData.get("telephone") as string) || null,
      email: (formData.get("email") as string) || null,
      adresse: (formData.get("adresse") as string) || null
    })
    .eq("id", formData.get("contact_id") as string);
  redirect("/contacts");
}

async function supprimerContact(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("contacts").delete().eq("id", formData.get("contact_id") as string);
  redirect("/contacts");
}

export default async function ContactsPage({ searchParams }: { searchParams: { edit?: string; q?: string } }) {
  const supabase = createClient();

  const { data: contactsBruts } = await supabase
    .from("contacts")
    .select("id, nom, prenom, telephone, email, adresse, eleve_contacts(lien, contact_principal, eleves(id, nom, prenom))")
    .order("nom");

  const recherche = (searchParams.q || "").toLowerCase().trim();
  const contacts = (contactsBruts || []).filter((c) => {
    if (!recherche) return true;
    return (
      c.nom.toLowerCase().includes(recherche) ||
      c.prenom.toLowerCase().includes(recherche) ||
      (c.email || "").toLowerCase().includes(recherche) ||
      c.eleve_contacts?.some((ec: any) => `${ec.eleves?.prenom} ${ec.eleves?.nom}`.toLowerCase().includes(recherche))
    );
  });

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 font-display text-3xl text-ardoise-800">Contacts</h1>
      <p className="mb-6 text-sm text-ardoise-500">
        Répertoire de tous les parents et tuteurs enregistrés. Pour lier un nouveau
        contact à un élève, passe par la fiche de l'élève concerné.
      </p>

      <form action="/contacts" method="get" className="mb-6">
        <input className="input max-w-sm" type="text" name="q" placeholder="Rechercher un contact ou un élève…" defaultValue={searchParams.q} />
      </form>

      <div className="space-y-3">
        {contacts.map((c) =>
          searchParams.edit === c.id ? (
            <form key={c.id} action={modifierContact} className="card space-y-3">
              <input type="hidden" name="contact_id" value={c.id} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input text-sm" name="prenom" defaultValue={c.prenom} required placeholder="Prénom" />
                <input className="input text-sm" name="nom" defaultValue={c.nom} required placeholder="Nom" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="input text-sm" name="telephone" defaultValue={c.telephone || ""} placeholder="Téléphone" />
                <input className="input text-sm" type="email" name="email" defaultValue={c.email || ""} placeholder="Email" />
              </div>
              <input className="input text-sm" name="adresse" defaultValue={c.adresse || ""} placeholder="Adresse" />
              <div className="flex gap-2">
                <button className="btn-primary text-xs" type="submit">Enregistrer</button>
                <Link href="/contacts" className="btn-ghost border border-ardoise-200 text-xs">Annuler</Link>
              </div>
            </form>
          ) : (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-ardoise-800">{c.prenom} {c.nom}</p>
                  <p className="text-xs text-ardoise-500">
                    {c.telephone || "—"} {c.email ? `· ${c.email}` : ""}
                  </p>
                  {c.adresse && <p className="text-xs text-ardoise-400">{c.adresse}</p>}
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <Link href={`/contacts?edit=${c.id}`} className="text-ardoise-600 underline">Modifier</Link>
                  <form action={supprimerContact}>
                    <input type="hidden" name="contact_id" value={c.id} />
                    <button className="text-red-500 underline" type="submit">Supprimer</button>
                  </form>
                </div>
              </div>
              {c.eleve_contacts && c.eleve_contacts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.eleve_contacts.map((ec: any, i: number) => (
                    <Link
                      key={i}
                      href={`/eleves/${ec.eleves?.id}`}
                      className="rounded-full bg-ardoise-100 px-2 py-1 text-xs text-ardoise-600 hover:bg-ardoise-200"
                    >
                      {ec.lien}{ec.contact_principal ? " (principal)" : ""} de {ec.eleves?.prenom} {ec.eleves?.nom}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        {contacts.length === 0 && (
          <p className="text-sm text-ardoise-400">Aucun contact trouvé.</p>
        )}
      </div>
    </div>
  );
}
