"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Classe = { id: string; nom: string };

export default function ClassSelector({ classes }: { classes: Classe[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("classe") || classes[0]?.id || "";

  function onChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("classe", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (classes.length === 0) {
    return <p className="text-sm text-ardoise-400">Aucune classe pour l'instant.</p>;
  }

  return (
    <select
      className="input max-w-xs"
      value={current}
      onChange={(e) => onChange(e.target.value)}
    >
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nom}
        </option>
      ))}
    </select>
  );
}
