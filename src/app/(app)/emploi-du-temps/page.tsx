import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import Link from "next/link";
import { redirect } from "next/navigation";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

async function enregistrerCreneau(formData: FormData) {
  "use server";
  const supabase = createClient();
  const id = formData.get("id") as string;
  const classe_id = formData.get("classe_id") as string;
  const payload = {
    classe_id,
    jour: Number(formData.get("jour")),
    heure_debut: formData.get("heure_debut") as string,
    heure_fin: formData.get("heure_fin") as string,
    matiere_id: (formData.get("matiere_id") as string) || null,
    libelle: (formData.get("libelle") as string) || null,
    niveau: (formData.get("niveau") as string) || null
  };

  if (id) {
    await supabase.from("emploi_du_temps").update(payload).eq("id", id);
  } else {
    await supabase.from("emploi_du_temps").insert(payload);
  }
  redirect(`/emploi-du-temps?classe=${classe_id}`);
}

async function supprimerCreneau(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("emploi_du_temps").delete().eq("id", formData.get("id") as string);
  redirect(`/emploi-du-temps?classe=${formData.get("classe_id")}`);
}

export default async function EmploiDuTempsPage({
  searchParams
}: {
  searchParams: { classe?: string; edit?: string };
}) {
  const supabase = createClient();
  const { annees, active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom, niveaux").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const classeId = searchParams.classe || classes?.[0]?.id;
  const classeActuelle = classes?.find((c) => c.id === classeId);
  const niveaux: string[] = classeActuelle?.niveaux || [];
  const multiniveau = niveaux.length > 1;

  const { data: matieres } = await supabase.from("matieres").select("id, nom, couleur").order("nom");

  const { data: creneaux } = classeId
    ? await supabase
        .from("emploi_du_temps")
        .select("id, jour, heure_debut, heure_fin, libelle, matiere_id, niveau, matieres(nom, couleur)")
        .eq("classe_id", classeId)
        .order("heure_debut")
    : { data: [] };

  const creneauAEditer = searchParams.edit ? creneaux?.find((c: any) => c.id === searchParams.edit) : null;
  const colonnes = multiniveau ? [...niveaux, ""] : [""]; // "" = commun / classe entière

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-ardoise-800">Emploi du temps</h1>
        <ClassSelector classes={classes || []} />
      </div>

      {!classeId && <p className="text-sm text-ardoise-400">Crée d'abord une classe.</p>}

      {classeId && (
        <>
          {multiniveau && (
            <p className="mb-4 text-xs text-ardoise-400">
              Classe multi-niveaux : les créneaux "{niveaux.join(" / ")}" s'affichent en colonnes
              séparées côte à côte ; "Commun" = toute la classe en même temps.
            </p>
          )}

          <div className="mb-8 grid grid-cols-5 gap-3">
            {JOURS.map((jour, idx) => (
              <div key={jour} className="card min-h-[220px]">
                <p className="mb-3 font-display text-sm text-ardoise-700">{jour}</p>
                <div className={multiniveau ? "grid gap-2" : ""} style={multiniveau ? { gridTemplateColumns: `repeat(${colonnes.length}, 1fr)` } : undefined}>
                  {colonnes.map((col) => (
                    <div key={col || "commun"}>
                      {multiniveau && (
                        <p className="mb-1 text-[10px] uppercase text-ardoise-400">{col || "Commun"}</p>
                      )}
                      <ul className="space-y-1">
                        {creneaux
                          ?.filter((c: any) => c.jour === idx + 1 && (c.niveau || "") === col)
                          .map((c: any) => (
                            <li
                              key={c.id}
                              className="rounded-md px-2 py-1 text-[11px] text-white"
                              style={{ backgroundColor: c.matieres?.couleur || "#3f7264" }}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span>
                                  {c.heure_debut?.slice(0, 5)}–{c.heure_fin?.slice(0, 5)}
                                  <br />
                                  {c.matieres?.nom || c.libelle}
                                </span>
                                <span className="flex flex-col items-end gap-1">
                                  <Link
                                    href={`/emploi-du-temps?classe=${classeId}&edit=${c.id}`}
                                    className="opacity-80 hover:opacity-100"
                                  >
                                    ✎
                                  </Link>
                                  <form action={supprimerCreneau}>
                                    <input type="hidden" name="id" value={c.id} />
                                    <input type="hidden" name="classe_id" value={classeId} />
                                    <button className="opacity-80 hover:opacity-100" title="Supprimer">✕</button>
                                  </form>
                                </span>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card max-w-md">
            <h2 className="mb-3 font-display text-lg text-ardoise-700">
              {creneauAEditer ? "Modifier le créneau" : "Ajouter un créneau"}
            </h2>
            <form action={enregistrerCreneau} className="space-y-4">
              <input type="hidden" name="classe_id" value={classeId} />
              {creneauAEditer && <input type="hidden" name="id" value={creneauAEditer.id} />}
              <div>
                <label className="label">Jour</label>
                <select className="input" name="jour" defaultValue={creneauAEditer?.jour} required>
                  {JOURS.map((j, idx) => (
                    <option key={j} value={idx + 1}>{j}</option>
                  ))}
                </select>
              </div>
              {multiniveau && (
                <div>
                  <label className="label">Niveau concerné</label>
                  <select className="input" name="niveau" defaultValue={creneauAEditer?.niveau || ""}>
                    <option value="">Commun (toute la classe)</option>
                    {niveaux.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Début</label>
                  <input className="input" type="time" name="heure_debut" defaultValue={creneauAEditer?.heure_debut?.slice(0, 5)} required />
                </div>
                <div>
                  <label className="label">Fin</label>
                  <input className="input" type="time" name="heure_fin" defaultValue={creneauAEditer?.heure_fin?.slice(0, 5)} required />
                </div>
              </div>
              <div>
                <label className="label">Matière</label>
                <select className="input" name="matiere_id" defaultValue={creneauAEditer?.matiere_id || ""}>
                  <option value="">— Choisir —</option>
                  {matieres?.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ardoise-400">
                  <Link href="/matieres" className="underline">Gérer les matières et leurs couleurs</Link>
                </p>
              </div>
              <div>
                <label className="label">Libellé libre (si pas de matière)</label>
                <input className="input" name="libelle" placeholder="ex. Récréation" defaultValue={creneauAEditer?.libelle || ""} />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" type="submit">
                  {creneauAEditer ? "Enregistrer" : "Ajouter"}
                </button>
                {creneauAEditer && (
                  <Link href={`/emploi-du-temps?classe=${classeId}`} className="btn-ghost border border-ardoise-200">
                    Annuler
                  </Link>
                )}
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
