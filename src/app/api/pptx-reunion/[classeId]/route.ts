import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { positionnerChevauchements, heureVersMinutes, minutesVersHeure } from "@/lib/edt-layout";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

// Couleurs cohérentes avec l'identité visuelle de l'application (palette "ardoise")
const COULEUR_TITRE = "1E3B34";
const COULEUR_ACCENT = "2F5B4F";
const COULEUR_CORAIL = "E0724A";
const COULEUR_TEXTE = "20221F";
const COULEUR_FOND = "FAF7F0";
const COULEUR_CLAIRE = "DFE9E6";

const ORDRE_DU_JOUR = [
  { titre: "Accueil", minutes: 5 },
  { titre: "Présentation enseignant·e, ATSEM", minutes: 3 },
  { titre: "La classe", minutes: 7 },
  { titre: "Emploi du temps", minutes: 10 },
  { titre: "Pédagogie", minutes: 15 },
  { titre: "Vie de classe", minutes: 10 },
  { titre: "Évaluations", minutes: 10 },
  { titre: "Projets", minutes: 10 },
  { titre: "Infos pratiques", minutes: 10 },
  { titre: "Questions", minutes: 10 },
  { titre: "Conclusion", minutes: 5 }
];

function formatDuree(minutesTotal: number) {
  const h = Math.floor(minutesTotal / 60);
  const m = minutesTotal % 60;
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, "0") : ""}` : `${m} min`;
}

function titreSlide(slide: any, texte: string) {
  slide.addText(texte, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: COULEUR_TITRE });
  slide.addShape("rect", { x: 0.5, y: 0.92, w: 1.2, h: 0.04, fill: { color: COULEUR_CORAIL } });
}

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

  const { data: affectationsEleves } = await supabase
    .from("affectations")
    .select("eleves(sexe)")
    .eq("classe_id", params.classeId);

  const nbEleves = affectationsEleves?.length || 0;
  const nbGarcons = (affectationsEleves || []).filter((a: any) => a.eleves?.sexe === "M").length;
  const nbFilles = (affectationsEleves || []).filter((a: any) => a.eleves?.sexe === "F").length;
  const nbNonRenseigne = nbEleves - nbGarcons - nbFilles;

  const { data: creneaux } = await supabase
    .from("emploi_du_temps")
    .select("jour, heure_debut, heure_fin, libelle, niveau, matieres(nom, couleur)")
    .eq("classe_id", params.classeId)
    .order("heure_debut");

  const { data: projetsClasse } = await supabase
    .from("projets_classes")
    .select("projets(titre, avancement)")
    .eq("classe_id", params.classeId);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4_16x9", width: 10, height: 5.63 });
  pptx.layout = "A4_16x9";

  const nomClasse = classe.nom;
  const anneeLibelle = (classe as any).annees_scolaires?.libelle || "";
  const enseignant = profile?.full_name || "";
  const dureeTotale = ORDRE_DU_JOUR.reduce((acc, item) => acc + item.minutes, 0);

  // ========== 1. Titre ==========
  const s1 = pptx.addSlide();
  s1.background = { color: COULEUR_FOND };
  s1.addText("Réunion de rentrée", {
    x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 34, bold: true, color: COULEUR_TITRE, fontFace: "Georgia"
  });
  s1.addText(`${nomClasse} — ${anneeLibelle}`, { x: 0.5, y: 2.4, w: 9, h: 0.6, fontSize: 20, color: COULEUR_ACCENT });
  if (enseignant) {
    s1.addText(enseignant, { x: 0.5, y: 3.0, w: 9, h: 0.5, fontSize: 14, color: COULEUR_TEXTE });
  }

  // ========== 2. Ordre du jour (chrono visuel) ==========
  const s2 = pptx.addSlide();
  s2.background = { color: COULEUR_FOND };
  titreSlide(s2, "Ordre du jour");
  s2.addText(`Durée totale : ${formatDuree(dureeTotale)}`, {
    x: 7.2, y: 0.32, w: 2.3, h: 0.4, fontSize: 13, bold: true, color: "FFFFFF",
    fill: { color: COULEUR_ACCENT }, align: "center", valign: "middle"
  });

  const maxMinutes = Math.max(...ORDRE_DU_JOUR.map((i) => i.minutes));
  const largeurMaxBarre = 4.2;
  const yDepart = 1.15;
  const hauteurLigne = 0.385;

  ORDRE_DU_JOUR.forEach((item, i) => {
    const y = yDepart + i * hauteurLigne;
    s2.addText(item.titre, {
      x: 0.5, y, w: 3.3, h: hauteurLigne - 0.04, fontSize: 12, color: COULEUR_TEXTE, valign: "middle"
    });
    const largeurBarre = Math.max(0.15, (item.minutes / maxMinutes) * largeurMaxBarre);
    s2.addShape("rect", {
      x: 3.9, y: y + 0.07, w: largeurBarre, h: hauteurLigne - 0.18,
      fill: { color: i % 2 === 0 ? COULEUR_ACCENT : COULEUR_CORAIL }, line: { type: "none" }
    });
    s2.addText(`${item.minutes} min`, {
      x: 3.9 + largeurBarre + 0.1, y, w: 1, h: hauteurLigne - 0.04, fontSize: 11, color: COULEUR_TEXTE, valign: "middle"
    });
  });

  // ========== 3. Accueil ==========
  const s3 = pptx.addSlide();
  s3.background = { color: COULEUR_FOND };
  titreSlide(s3, "Accueil");
  s3.addText(
    [
      { text: "Merci d'être présent·e à cette réunion de rentrée.", options: { bullet: true, breakLine: true } },
      { text: "Un moment pour se rencontrer et échanger avant que l'année ne commence.", options: { bullet: true, breakLine: true } },
      { text: "N'hésitez pas à poser vos questions, un temps y sera dédié en fin de séance.", options: { bullet: true } }
    ],
    { x: 0.5, y: 1.3, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.4 }
  );

  // ========== 4. Présentation enseignant·e, ATSEM ==========
  const s4 = pptx.addSlide();
  s4.background = { color: COULEUR_FOND };
  titreSlide(s4, "Présentation de l'équipe");
  s4.addText(
    [
      { text: enseignant ? `Enseignant·e : ${enseignant}` : "Enseignant·e", options: { bullet: true, breakLine: true } },
      { text: "ATSEM / AESH (si applicable)", options: { bullet: true, breakLine: true } },
      { text: "Parcours et expérience", options: { bullet: true } }
    ],
    { x: 0.5, y: 1.3, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.4 }
  );

  // ========== 5. La classe (avec camembert garçons/filles) ==========
  const s5 = pptx.addSlide();
  s5.background = { color: COULEUR_FOND };
  titreSlide(s5, "La classe");
  s5.addText(
    [
      { text: `Niveau(x) : ${classe.niveaux?.join(", ") || "—"}`, options: { bullet: true, breakLine: true } },
      { text: `Nombre d'élèves : ${nbEleves}`, options: { bullet: true, breakLine: true } },
      { text: `Année scolaire : ${anneeLibelle}`, options: { bullet: true } }
    ],
    { x: 0.5, y: 1.3, w: 4, h: 2.5, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.6 }
  );

  if (nbGarcons + nbFilles > 0) {
    s5.addChart(
      pptx.ChartType.pie,
      [{ name: "Répartition", labels: ["Garçons", "Filles"], values: [nbGarcons, nbFilles] }],
      {
        x: 5.0, y: 1.2, w: 4.2, h: 3.2,
        showLegend: true, legendPos: "b", showValue: true, dataLabelFormatCode: "0",
        chartColors: [COULEUR_ACCENT, COULEUR_CORAIL],
        title: "Répartition garçons / filles", showTitle: true, titleColor: COULEUR_TEXTE, titleFontSize: 12
      }
    );
    if (nbNonRenseigne > 0) {
      s5.addText(`${nbNonRenseigne} élève(s) sans sexe renseigné`, {
        x: 5.0, y: 4.5, w: 4.2, h: 0.3, fontSize: 9, italic: true, color: COULEUR_TEXTE, align: "center"
      });
    }
  } else {
    s5.addText("Répartition garçons / filles non renseignée pour le moment.", {
      x: 5.0, y: 2.2, w: 4.2, h: 0.6, fontSize: 12, italic: true, color: COULEUR_TEXTE
    });
  }

  // ========== 6. Emploi du temps (reproduction fidèle du planning visuel) ==========
  const s6 = pptx.addSlide();
  s6.background = { color: COULEUR_FOND };
  titreSlide(s6, "L'emploi du temps de la semaine");

  const niveauxClasse: string[] = classe.niveaux || [];
  const multiniveauEdt = niveauxClasse.length > 1;
  const colonnesNiveau = multiniveauEdt ? [...niveauxClasse, ""] : [""];

  const debutsEdt = (creneaux || []).map((c: any) => heureVersMinutes(c.heure_debut));
  const finsEdt = (creneaux || []).map((c: any) => heureVersMinutes(c.heure_fin));
  let debutPlage = debutsEdt.length ? Math.min(...debutsEdt) : 8 * 60;
  let finPlage = finsEdt.length ? Math.max(...finsEdt) : 18 * 60;
  debutPlage = Math.floor(debutPlage / 60) * 60;
  finPlage = Math.ceil(finPlage / 60) * 60;
  if (finPlage <= debutPlage) finPlage = debutPlage + 60;

  const zoneY = 1.25;
  const zoneHauteur = 3.95;
  const inParMinute = zoneHauteur / (finPlage - debutPlage);

  const axeX = 0.15;
  const axeLargeur = 0.5;
  const grilleX = axeX + axeLargeur;
  const grilleLargeur = 9.7 - grilleX;
  const largeurJour = grilleLargeur / 5;

  // Graduations horaires (toutes les heures) + lignes de fond
  for (let h = debutPlage; h <= finPlage; h += 60) {
    const y = zoneY + (h - debutPlage) * inParMinute;
    s6.addText(minutesVersHeure(h), {
      x: axeX, y: y - 0.08, w: axeLargeur, h: 0.16, fontSize: 7, color: COULEUR_TEXTE, align: "right", valign: "middle"
    });
    s6.addShape("line", {
      x: grilleX, y, w: grilleLargeur, h: 0, line: { color: "E5E0D8", width: 0.75 }
    });
  }

  JOURS.forEach((jour, idx) => {
    const xJour = grilleX + idx * largeurJour;
    s6.addText(jour, {
      x: xJour, y: zoneY - 0.32, w: largeurJour - 0.05, h: 0.24, fontSize: 10, bold: true, color: COULEUR_ACCENT, align: "center"
    });

    colonnesNiveau.forEach((col, colIdx) => {
      const creneauxCol = (creneaux || []).filter((c: any) => c.jour === idx + 1 && (c.niveau || "") === col);
      if (creneauxCol.length === 0) return;

      if (multiniveauEdt) {
        s6.addText(col || "Commun", {
          x: xJour + colIdx * ((largeurJour - 0.05) / colonnesNiveau.length),
          y: zoneY - 0.05, w: (largeurJour - 0.05) / colonnesNiveau.length, h: 0.14,
          fontSize: 5.5, color: COULEUR_TEXTE, align: "center"
        });
      }

      const items = positionnerChevauchements(
        creneauxCol.map((c: any) => ({
          ...c,
          debutMin: heureVersMinutes(c.heure_debut),
          finMin: heureVersMinutes(c.heure_fin)
        }))
      );

      const largeurNiveau = (largeurJour - 0.05) / colonnesNiveau.length;
      const xNiveau = xJour + colIdx * largeurNiveau;

      items.forEach((c: any) => {
        const y = zoneY + (c.debutMin - debutPlage) * inParMinute;
        const h = Math.max((c.finMin - c.debutMin) * inParMinute, 0.16);
        const largeurBloc = Math.max(largeurNiveau / c.totalCols - 0.015, 0.05);
        const xBloc = xNiveau + c.col * (largeurNiveau / c.totalCols);
        const couleurHex = (c.matieres?.couleur || "#3f7264").replace("#", "");
        const label = c.matieres?.nom || c.libelle || "";
        const niveauSuffixe = c.niveau && !multiniveauEdt ? ` (${c.niveau})` : "";

        s6.addShape("rect", {
          x: xBloc, y, w: largeurBloc, h, fill: { color: couleurHex }, line: { type: "none" }
        });
        s6.addText(`${c.heure_debut?.slice(0, 5)}\n${label}${niveauSuffixe}`, {
          x: xBloc + 0.02, y: y + 0.01, w: Math.max(largeurBloc - 0.04, 0.05), h: Math.max(h - 0.02, 0.05),
          fontSize: 5.5, color: "FFFFFF", valign: "top", margin: 0, lineSpacingMultiple: 0.95
        });
      });
    });
  });

  // ========== 7. Pédagogie ==========
  const s7 = pptx.addSlide();
  s7.background = { color: COULEUR_FOND };
  titreSlide(s7, "Pédagogie");
  s7.addText(
    [
      { text: "Objectifs pédagogiques de l'année (programmes officiels du cycle).", options: { bullet: true, breakLine: true } },
      { text: "Méthodes et outils utilisés en classe.", options: { bullet: true, breakLine: true } },
      { text: "Rythme et organisation des apprentissages.", options: { bullet: true } }
    ],
    { x: 0.5, y: 1.3, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.4 }
  );

  // ========== 8. Vie de classe ==========
  const s8 = pptx.addSlide();
  s8.background = { color: COULEUR_FOND };
  titreSlide(s8, "Vie de classe");
  s8.addText(
    [
      { text: "Règles de vie et rituels du quotidien.", options: { bullet: true, breakLine: true } },
      { text: "Responsabilités confiées aux élèves.", options: { bullet: true, breakLine: true } },
      { text: "Climat de classe et gestion des émotions.", options: { bullet: true } }
    ],
    { x: 0.5, y: 1.3, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.4 }
  );

  // ========== 9. Évaluations ==========
  const s9 = pptx.addSlide();
  s9.background = { color: COULEUR_FOND };
  titreSlide(s9, "Évaluations");
  s9.addText(
    [
      { text: "Modalités d'évaluation (par compétence, appréciations).", options: { bullet: true, breakLine: true } },
      { text: "Fréquence et périodes des bilans.", options: { bullet: true, breakLine: true } },
      { text: "Communication des résultats aux familles.", options: { bullet: true } }
    ],
    { x: 0.5, y: 1.3, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.4 }
  );

  // ========== 10. Projets ==========
  const s10 = pptx.addSlide();
  s10.background = { color: COULEUR_FOND };
  titreSlide(s10, "Projets de l'année");
  const listeProjets = (projetsClasse || []).map((p: any) => p.projets?.titre).filter(Boolean);
  s10.addText(
    listeProjets.length > 0
      ? listeProjets.map((t: string) => ({ text: t, options: { bullet: true, breakLine: true } }))
      : [{ text: "Les projets de l'année seront communiqués au fil de l'eau.", options: { bullet: true } }],
    { x: 0.5, y: 1.3, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.6 }
  );

  // ========== 11. Infos pratiques ==========
  const s11 = pptx.addSlide();
  s11.background = { color: COULEUR_FOND };
  titreSlide(s11, "Infos pratiques");
  s11.addText(
    [
      { text: "Horaires d'entrée et de sortie, ponctualité.", options: { bullet: true, breakLine: true } },
      { text: "Fournitures scolaires et matériel à prévoir.", options: { bullet: true, breakLine: true } },
      { text: "Carnet de liaison numérique et autorisations à signer en ligne.", options: { bullet: true } }
    ],
    { x: 0.5, y: 1.3, w: 9, h: 3, fontSize: 16, color: COULEUR_TEXTE, lineSpacingMultiple: 1.4 }
  );

  // ========== 12. Questions ==========
  const s12 = pptx.addSlide();
  s12.background = { color: COULEUR_FOND };
  s12.addText("Questions ?", {
    x: 0.5, y: 2.2, w: 9, h: 1, fontSize: 30, bold: true, color: COULEUR_TITRE, align: "center"
  });

  // ========== 13. Conclusion / Merci ==========
  const s13 = pptx.addSlide();
  s13.background = { color: COULEUR_TITRE };
  s13.addText("Merci pour votre présence", {
    x: 0.5, y: 2.2, w: 9, h: 1, fontSize: 30, bold: true, color: "FFFFFF", align: "center"
  });
  s13.addText("Excellente année scolaire à toutes et tous !", {
    x: 0.5, y: 3.0, w: 9, h: 0.6, fontSize: 16, color: COULEUR_CLAIRE, align: "center"
  });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="reunion-rentree-${nomClasse.replace(/[^a-z0-9]+/gi, "-")}.pptx"`
    }
  });
}
