/**
 * Envoi d'email via l'API Resend (https://resend.com), sans SDK supplémentaire.
 * Nécessite la variable d'environnement RESEND_API_KEY (côté serveur uniquement).
 * Si elle n'est pas configurée, l'envoi est simplement ignoré (le lien reste
 * disponible pour un envoi manuel par l'enseignant·e) plutôt que de faire
 * planter la création de la campagne.
 */
export async function envoyerEmail({
  to,
  subject,
  html
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ envoye: boolean; erreur?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { envoye: false, erreur: "RESEND_API_KEY non configurée" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Classe <onboarding@resend.dev>",
        to: [to],
        subject,
        html
      })
    });
    if (!res.ok) {
      return { envoye: false, erreur: await res.text() };
    }
    return { envoye: true };
  } catch (e: any) {
    return { envoye: false, erreur: e?.message || "Erreur inconnue" };
  }
}
