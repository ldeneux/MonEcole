import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function genererPdfSignature({
  titre,
  contenu,
  nomEleve,
  nomSignataire,
  role,
  reponse,
  dateSignature,
  signatureDataUrl
}: {
  titre: string;
  contenu: string;
  nomEleve: string;
  nomSignataire: string;
  role?: string | null;
  reponse: "oui" | "non";
  dateSignature: Date;
  signatureDataUrl: string; // "data:image/png;base64,...."
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 en points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marge = 50;
  let y = 780;

  page.drawText(titre, { x: marge, y, size: 18, font: fontBold, color: rgb(0.15, 0.2, 0.18) });
  y -= 30;

  page.drawText(`Élève concerné : ${nomEleve}`, { x: marge, y, size: 11, font });
  y -= 30;

  // Découpage simple du texte en lignes pour tenir dans la largeur de la page
  const largeurMax = 495;
  const taillePolice = 11;
  const mots = contenu.split(/\s+/);
  let ligne = "";
  const lignes: string[] = [];
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (font.widthOfTextAtSize(essai, taillePolice) > largeurMax) {
      lignes.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne) lignes.push(ligne);

  for (const l of lignes) {
    if (y < 260) break; // sécurité anti-débordement pour un texte très long
    page.drawText(l, { x: marge, y, size: taillePolice, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 16;
  }

  y -= 30;
  const libelleReponse = reponse === "oui" ? "AUTORISE" : "N'AUTORISE PAS";
  const couleurReponse = reponse === "oui" ? rgb(0.18, 0.4, 0.28) : rgb(0.75, 0.25, 0.2);
  page.drawText(
    `Réponse : ${libelleReponse}${role ? ` (${role})` : ""}`,
    { x: marge, y, size: 13, font: fontBold, color: couleurReponse }
  );
  y -= 24;
  page.drawText(
    `Signé électroniquement par : ${nomSignataire}`,
    { x: marge, y, size: 11, font: fontBold }
  );
  y -= 18;
  page.drawText(
    `Le ${dateSignature.toLocaleDateString("fr-FR")} à ${dateSignature.toLocaleTimeString("fr-FR")}`,
    { x: marge, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) }
  );
  y -= 20;

  // Image de la signature
  const base64 = signatureDataUrl.split(",")[1] || "";
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  const image = await pdfDoc.embedPng(bytes);
  const dims = image.scaleToFit(220, 100);
  y -= dims.height;
  page.drawImage(image, { x: marge, y, width: dims.width, height: dims.height });
  page.drawRectangle({
    x: marge - 5,
    y: y - 5,
    width: dims.width + 10,
    height: dims.height + 10,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1
  });

  page.drawText(
    "Document généré et signé électroniquement via l'application Classe.",
    { x: marge, y: 40, size: 8, font, color: rgb(0.6, 0.6, 0.6) }
  );

  return pdfDoc.save();
}
