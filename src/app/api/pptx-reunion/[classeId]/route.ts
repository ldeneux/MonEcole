import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

// Couleurs cohérentes avec l'identité visuelle de l'application (palette "ardoise")
const COULEUR_TITRE = "1E3B34";
const COULEUR_ACCENT = "2F5B4F";
const COULEUR_TEXTE = "20221F";
const COULEUR_FOND = "FAF7F0";

export async function GET(request: Request, { params }: { params: { classeId: string } }) {
  const supabase = createClient();

  // Cette route API n'est PAS couverte par le middleware d'authentification
  // (les routes /api sont exclues de son matcher) : on vérifie donc la
  // session nous-mêmes ici pour ne jamais exposer ces données publiquement.
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: classe } = await supabase
    .from("classes")
    .select("id, nom, niveaux, annees_scolaires(libelle)")
    .eq("id", params.classeId)
    .single();

  if (!classe) {
    return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
  }

  const { count: nbEleves } = await supabase
    .from("affectations")
    .select("id", { count: "exact", head: true })
    .eq("classe_id", params.classeId);

  const { data: creneaux } = await supabase
    .from("emploi_du_temps")
    .select("jour, heure_debut, heure_fin, libelle, niveau, matieres(nom)")
    .eq("classe_id", params.classeId)
    .order("heure_debut");

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4_16x9", width: 10, height: 5.63 });
  pptx.layout = "A4_16x9";

  const nomClasse = classe.nom;
  const anneeLibelle = (classe as any).annees_scolaires?.libelle || "";
  const enseignant = profile?.full_name || "";

  // ---------- Diapo 1 : titre ----------
  const s1 = pptx.addSlide();
  s1.background = { color: COULEUR_FOND };
  s1.addText("Réunion de rentrée", {
    x: 0.5, y: 1.6, w: 9, h: 1, fontSize: 34, bold: true, color: COULEUR_TITRE, fontFace: "Georgia"
  });
  s1.addText(`${nomClasse} — ${anneeLibelle}`, {
    x: 0.5, y: 2.5, w: 9, h: 0.6, fontSize: 20, color: COULEUR_ACCENT
  });
  if (enseignant) {
    s1.addText(enseignant, { x: 0.5, y: 3.1, w: 9, h: 0.5, fontSize: 14, color: COULEUR_TEXTE });
  }

  // ---------- Diapo 2 : bienvenue ----------
  const s2 = pptx.addSlide();
  s2.background = { color: COULEUR_FOND };
  s2.addText("Bienvenue", { x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 26, bold: true, color: COULEUR_TITRE });
  s2.addText(
    [
      { text: "Merci d'être présent·e à cette réunion de rentrée.", options: { bullet: true, breakLine: true } },
      { text: "Objectif : vous présenter le fonctionnement de la classe pour cette année.", options: { bullet: true, breakLine: true } },
      { text: "N'hésitez pas à poser vos questions à tout moment.", options: { bullet: true } }
    ],
    { x: 0.5, y: 1.4, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.4 }
  );

  // ---------- Diapo 3 : la classe en chiffres ----------
  const s3 = pptx.addSlide();
  s3.background = { color: COULEUR_FOND };
  s3.addText("La classe en quelques chiffres", { x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 26, bold: true, color: COULEUR_TITRE });
  const lignesInfo = [
    `Niveau(x) : ${classe.niveaux?.join(", ") || "—"}`,
    `Nombre d'élèves : ${nbEleves ?? "—"}`,
    `Année scolaire : ${anneeLibelle}`
  ];
  s3.addText(
    lignesInfo.map((l) => ({ text: l, options: { bullet: true, breakLine: true } })),
    { x: 0.5, y: 1.4, w: 9, h: 2.5, fontSize: 18, color: COULEUR_TEXTE, lineSpacingMultiple: 1.6 }
  );

  // ---------- Diapo 4 : emploi du temps ----------
  const s4 = pptx.addSlide();
  s4.background = { color: COULEUR_FOND };
  s4.addText("L'emploi du temps de la semaine", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: COULEUR_TITRE });

  const largeurColonne = 9 / 5;
  JOURS.forEach((jour, idx) => {
    const x = 0.5 + idx * largeurColonne;
    s4.addText(jour, {
      x, y: 1.0, w: largeurColonne - 0.1, h: 0.35, fontSize: 13, bold: true, color: COULEUR_ACCENT, align: "center"
    });

    const creneauxJour = (creneaux || []).filter((c: any) => c.jour === idx + 1);
    const texte =
      creneauxJour.length > 0
        ? creneauxJour.map((c: any) => {
            const label = c.matieres?.nom || c.libelle || "";
            const niveauSuffixe = c.niveau ? ` (${c.niveau})` : "";
            return {
              text: `${c.heure_debut?.slice(0, 5)}–${c.heure_fin?.slice(0, 5)}\n${label}${niveauSuffixe}`,
              options: { breakLine: true }
            };
          })
        : [{ text: "—", options: {} }];

    s4.addText(texte, {
      x, y: 1.4, w: largeurColonne - 0.1, h: 3.6, fontSize: 9, color: COULEUR_TEXTE, valign: "top"
    });
  });

  // ---------- Diapo 5 : communication ----------
  const s5 = pptx.addSlide();
  s5.background = { color: COULEUR_FOND };
  s5.addText("Comment communiquer avec moi", { x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 26, bold: true, color: COULEUR_TITRE });
  s5.addText(
    [
      { text: "Carnet de liaison numérique pour les messages courants.", options: { bullet: true, breakLine: true } },
      { text: "Autorisations et documents d'information envoyés par email avec un lien personnel.", options: { bullet: true, breakLine: true } },
      { text: "Pour toute urgence, contactez le secrétariat de l'école.", options: { bullet: true } }
    ],
    { x: 0.5, y: 1.4, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.4 }
  );

  // ---------- Diapo 6 : merci ----------
  const s6 = pptx.addSlide();
  s6.background = { color: COULEUR_TITRE };
  s6.addText("Merci pour votre présence", {
    x: 0.5, y: 2.2, w: 9, h: 1, fontSize: 30, bold: true, color: "FFFFFF", align: "center"
  });
  s6.addText("Excellente année scolaire à toutes et tous !", {
    x: 0.5, y: 3.0, w: 9, h: 0.6, fontSize: 16, color: "DFE9E6", align: "center"
  });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="reunion-rentree-${nomClasse.replace(/[^a-z0-9]+/gi, "-")}.pptx"`
    }
  });
}
