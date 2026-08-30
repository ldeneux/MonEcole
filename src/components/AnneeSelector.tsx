"use client";

import { useRef } from "react";

type Annee = { id: string; libelle: string };

export default function AnneeSelector({
  annees,
  currentId,
  action
}: {
  annees: Annee[];
  currentId: string;
  action: (formData: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (annees.length === 0) {
    return <p className="text-xs text-ardoise-300">Aucune année scolaire créée.</p>;
  }

  return (
    <form ref={formRef} action={action}>
      <select
        name="annee_id"
        defaultValue={currentId}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full rounded-lg border border-ardoise-600 bg-ardoise-700 px-2 py-1.5 text-sm text-craie"
      >
        {annees.map((a) => (
          <option key={a.id} value={a.id}>{a.libelle}</option>
        ))}
      </select>
    </form>
  );
}
