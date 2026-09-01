import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";
import ClassSelector from "@/components/ClassSelector";
import Link from "next/link";
import { redirect } from "next/navigation";
import { positionnerChevauchements, heureVersMinutes, minutesVersHeure } from "@/lib/edt-layout";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const PX_PAR_MINUTE = 2;

async function enregistrerCreneau(formData: FormData) {
  "use server";
  const supabase = createClient();
  const id = formData.get("id") as string;
  const classe_id = formData.get("classe_id") as string;
  const base = {
    classe_id,
    jour: Number(formData.get("jour")),
    heure_debut: formData.get("heure_debut") as string,
    heure_fin: formData.get("heure_fin") as string,
    matiere_id: (formData.get("matiere_id") as string) || null,
    libelle: (formData.get("libelle") as string) || null
  };

  if (id) {
    // Édition : un seul créneau, un seul niveau
    const niveau = (formData.get("niveau") as string) || null;
    await supabase.from("emploi_du_temps").update({ ...base, niveau }).eq("id", id);
  } else {
    // Création : si plusieurs niveaux sont cochés, on crée une ligne par niveau
    const niveaux = formData.getAll("niveaux") as string[];
    if (niveaux.length > 0) {
      await supabase.from("emploi_du_temps").insert(niveaux.map((niveau) => ({ ...base, niveau })));
    } else {
      await supabase.from("emploi_du_temps").insert({ ...base, niveau: null });
    }
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
  const { active } = await getAnneeActive();
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

  // ---------- Calcul de la plage horaire affichée (arrondie à l'heure) ----------
  const tous = creneaux || [];
  const debuts = tous.map((c: any) => heureVersMinutes(c.heure_debut));
  const fins = tous.map((c: any) => heureVersMinutes(c.heure_fin));
  let debutPlage = debuts.length ? Math.min(...debuts) : 8 * 60;
  let finPlage = fins.length ? Math.max(...fins) : 18 * 60;
  debutPlage = Math.floor(debutPlage / 60) * 60;
  finPlage = Math.ceil(finPlage / 60) * 60;
  if (finPlage <= debutPlage) finPlage = debutPlage + 60;
  const hauteurTotale = (finPlage - debutPlage) * PX_PAR_MINUTE;

  const heuresAxe: number[] = [];
  for (let h = debutPlage; h <= finPlage; h += 60) heuresAxe.push(h);

  const fondQuadrillage = {
    backgroundImage: `repeating-linear-gradient(to bottom, #e5e0d8 0px, #e5e0d8 1px, transparent 1px, transparent ${15 * PX_PAR_MINUTE}px)`
  };

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

          <div className="mb-8 overflow-x-auto">
            <div className="flex" style={{ minWidth: 760 }}>
              {/* Axe des horaires */}
              <div className="relative shrink-0" style={{ width: 46, height: hauteurTotale + 28 }}>
                {heuresAxe.map((h) => (
                  <div
                    key={h}
                    className="absolute right-1 -translate-y-1/2 text-[10px] text-ardoise-400"
                    style={{ top: 28 + (h - debutPlage) * PX_PAR_MINUTE }}
                  >
                    {minutesVersHeure(h)}
                  </div>
                ))}
              </div>

              {JOURS.map((jour, idx) => (
                <div key={jour} className="min-w-0 flex-1 px-1">
                  <p className="mb-1 h-6 text-center font-display text-sm text-ardoise-700">{jour}</p>
                  <div className="flex gap-0.5" style={{ height: hauteurTotale }}>
                    {colonnes.map((col) => {
                      const creneauxCol = (creneaux || []).filter(
                        (c: any) => c.jour === idx + 1 && (c.niveau || "") === col
                      );
                      const items = positionnerChevauchements(
                        creneauxCol.map((c: any) => ({
                          ...c,
                          debutMin: heureVersMinutes(c.heure_debut),
                          finMin: heureVersMinutes(c.heure_fin)
                        }))
                      );

                      return (
                        <div key={col || "commun"} className="relative min-w-0 flex-1">
                          {multiniveau && (
                            <p className="mb-0.5 truncate text-center text-[9px] uppercase text-ardoise-400">
                              {col || "Commun"}
                            </p>
                          )}
                          <div className="relative rounded-sm border border-ardoise-100 bg-white" style={{ height: hauteurTotale, ...fondQuadrillage }}>
                            {items.map((c: any) => {
                              const top = (c.debutMin - debutPlage) * PX_PAR_MINUTE;
                              const hauteur = Math.max((c.finMin - c.debutMin) * PX_PAR_MINUTE, 22);
                              const largeurPct = 100 / c.totalCols;
                              const gauchePct = c.col * largeurPct;
                              const label = c.matieres?.nom || c.libelle || "";
                              return (
                                <div
                                  key={c.id}
                                  className="absolute overflow-hidden rounded-sm px-1 py-0.5 text-[9px] leading-tight text-white"
                                  style={{
                                    top,
                                    height: hauteur,
                                    left: `${gauchePct}%`,
                                    width: `calc(${largeurPct}% - 2px)`,
                                    backgroundColor: c.matieres?.couleur || "#3f7264"
                                  }}
                                  title={`${c.heure_debut?.slice(0, 5)}–${c.heure_fin?.slice(0, 5)} · ${label}`}
                                >
                                  <div className="flex items-start justify-between gap-0.5">
                                    <span className="truncate">
                                      {c.heure_debut?.slice(0, 5)}–{c.heure_fin?.slice(0, 5)}
                                      <br />
                                      {label}
                                    </span>
                                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                                      <Link href={`/emploi-du-temps?classe=${classeId}&edit=${c.id}`} className="opacity-80 hover:opacity-100">
                                        ✎
                                      </Link>
                                      <form action={supprimerCreneau}>
                                        <input type="hidden" name="id" value={c.id} />
                                        <input type="hidden" name="classe_id" value={classeId} />
                                        <button className="opacity-80 hover:opacity-100">✕</button>
                                      </form>
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
              {multiniveau && creneauAEditer && (
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
              {multiniveau && !creneauAEditer && (
                <div>
                  <label className="label">Niveaux concernés</label>
                  <p className="mb-1 text-xs text-ardoise-400">
                    Coche un ou plusieurs niveaux pour créer un créneau identique pour chacun.
                    Ne rien cocher = commun à toute la classe.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {niveaux.map((n) => (
                      <label key={n} className="flex items-center gap-1 text-sm text-ardoise-600">
                        <input type="checkbox" name="niveaux" value={n} />
                        {n}
                      </label>
                    ))}
                  </div>
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
