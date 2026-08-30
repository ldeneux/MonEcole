import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAnneeActive } from "@/lib/annee-active";
import AnneeSelector from "@/components/AnneeSelector";
import { changerAnnee } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const { annees, active } = await getAnneeActive();

  const nav = [
    { href: "/dashboard", label: "Aujourd'hui" },
    { href: "/classes", label: "Classes" },
    { href: "/eleves", label: "Élèves (annuaire)" },
    { href: "/matieres", label: "Matières" },
    { href: "/emploi-du-temps", label: "Emploi du temps" },
    { href: "/cahier-journal", label: "Cahier journal" },
    { href: "/notes", label: "Notes & évaluations" },
    { href: "/bilans", label: "Bilans périodiques" },
    { href: "/coin-lecture", label: "Coin lecture" },
    { href: "/carnet-de-liaison", label: "Carnet de liaison" },
    { href: "/autorisations", label: "Autorisations (signatures)" },
    { href: "/sorties", label: "Sorties scolaires" },
    { href: "/projets", label: "Projets d'école" }
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col justify-between bg-ardoise-800 px-4 py-6 text-craie">
        <div>
          <div className="mb-4 px-2">
            <p className="font-display text-2xl">Classe</p>
            <p className="text-xs text-ardoise-300">
              {profile?.full_name || user.email} · {profile?.role === "admin" ? "Admin" : "Enseignant·e"}
            </p>
          </div>

          <div className="mb-6 rounded-lg border border-ardoise-600 bg-ardoise-900/40 px-2 py-3">
            <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-ardoise-300">
              Année scolaire
            </p>
            <AnneeSelector annees={annees} currentId={active?.id || ""} action={changerAnnee} />
            <Link href="/annees" className="mt-1.5 block px-1 text-[11px] text-ardoise-300 underline">
              Gérer les années scolaires
            </Link>
          </div>

          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-ardoise-100 hover:bg-ardoise-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action="/api/logout" method="post">
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-ardoise-300 hover:bg-ardoise-700">
            Se déconnecter
          </button>
        </form>
      </aside>
      <main className="flex-1 bg-craie px-8 py-8">{children}</main>
    </div>
  );
}
