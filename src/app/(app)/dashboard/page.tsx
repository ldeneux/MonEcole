import { createClient } from "@/lib/supabase/server";
import { getAnneeActive } from "@/lib/annee-active";

function jourFr(n: number) {
  return ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"][n - 1];
}

export default async function DashboardPage() {
  const supabase = createClient();
  const today = new Date();
  const jourNum = today.getDay(); // 0=dim
  const isSchoolDay = jourNum >= 1 && jourNum <= 5;
  const todayStr = today.toISOString().slice(0, 10);

  const { active } = await getAnneeActive();
  const { data: classes } = active
    ? await supabase.from("classes").select("id, nom").eq("annee_id", active.id).order("nom")
    : { data: [] };
  const classeIds = (classes || []).map((c) => c.id);

  const [{ data: edt }, { data: journal }, { data: messages }, { data: sorties }] =
    await Promise.all([
      isSchoolDay
        ? supabase
            .from("emploi_du_temps")
            .select("id, jour, heure_debut, heure_fin, libelle, classe_id, matieres(nom, couleur)")
            .in("classe_id", classeIds.length ? classeIds : ["00000000-0000-0000-0000-000000000000"])
            .eq("jour", jourNum)
            .order("heure_debut")
        : { data: [] },
      supabase
        .from("cahier_journal")
        .select("id, contenu, classe_id, classes(nom)")
        .in("classe_id", classeIds.length ? classeIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("date", todayStr),
      supabase
        .from("messages_liaison")
        .select("id, titre, created_at, classes(nom)")
        .in("classe_id", classeIds.length ? classeIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("sorties_scolaires")
        .select("id, titre, date_sortie, classes(nom)")
        .in("classe_id", classeIds.length ? classeIds : ["00000000-0000-0000-0000-000000000000"])
        .gte("date_sortie", todayStr)
        .order("date_sortie")
        .limit(5)
    ]);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 font-display text-3xl text-ardoise-800">
        {isSchoolDay ? jourFr(jourNum) : "Bon week-end"}
      </h1>
      <p className="mb-8 text-sm text-ardoise-500">
        {today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Séances du jour</h2>
          {!isSchoolDay && <p className="text-sm text-ardoise-400">Pas de classe aujourd'hui.</p>}
          {isSchoolDay && (!edt || edt.length === 0) && (
            <p className="text-sm text-ardoise-400">Aucun créneau renseigné pour aujourd'hui.</p>
          )}
          <ul className="space-y-2">
            {edt?.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  {s.heure_debut?.slice(0, 5)}–{s.heure_fin?.slice(0, 5)} · {s.matieres?.nom || s.libelle}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Cahier journal — aujourd'hui</h2>
          {(!journal || journal.length === 0) && (
            <p className="text-sm text-ardoise-400">Rien de rempli pour aujourd'hui.</p>
          )}
          <ul className="space-y-2">
            {journal?.map((j: any) => (
              <li key={j.id} className="text-sm">
                <span className="font-medium">{j.classes?.nom} — </span>
                {j.contenu.slice(0, 80)}
                {j.contenu.length > 80 ? "…" : ""}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Derniers messages du carnet</h2>
          {(!messages || messages.length === 0) && (
            <p className="text-sm text-ardoise-400">Aucun message récent.</p>
          )}
          <ul className="space-y-2">
            {messages?.map((m: any) => (
              <li key={m.id} className="text-sm">
                <span className="font-medium">{m.classes?.nom} — </span>
                {m.titre}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="mb-3 font-display text-lg text-ardoise-700">Prochaines sorties</h2>
          {(!sorties || sorties.length === 0) && (
            <p className="text-sm text-ardoise-400">Aucune sortie programmée.</p>
          )}
          <ul className="space-y-2">
            {sorties?.map((s: any) => (
              <li key={s.id} className="text-sm">
                {new Date(s.date_sortie).toLocaleDateString("fr-FR")} — {s.titre} ({s.classes?.nom})
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
