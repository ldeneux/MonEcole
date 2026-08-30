"use client";

import { useEffect, useState } from "react";

export default function CopyLinkButton({ token }: { token: string }) {
  const [copie, setCopie] = useState(false);
  const [lien, setLien] = useState("");

  useEffect(() => {
    setLien(`${window.location.origin}/signer/${token}`);
  }, [token]);

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // silencieux : le lien reste affiché, l'utilisateur peut le sélectionner à la main
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input className="input text-xs" readOnly value={lien} onFocus={(e) => e.target.select()} />
      <button type="button" onClick={copier} className="btn-ghost shrink-0 border border-ardoise-200 text-xs">
        {copie ? "Copié !" : "Copier le lien"}
      </button>
    </div>
  );
}
