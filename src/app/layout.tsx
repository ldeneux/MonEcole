import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classe — Cahier de bord numérique",
  description: "Application de gestion de classe"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body">{children}</body>
    </html>
  );
}
