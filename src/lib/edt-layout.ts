// Calcule la position (colonne / nombre de colonnes) de créneaux qui se
// chevauchent dans le temps, pour un affichage type "agenda" où les
// créneaux simultanés apparaissent côte à côte plutôt qu'empilés.

export type CreneauBrut = {
  id: string;
  debutMin: number; // minutes depuis minuit
  finMin: number;
};

export type CreneauPositionne<T> = T & { col: number; totalCols: number };

export function positionnerChevauchements<T extends CreneauBrut>(items: T[]): CreneauPositionne<T>[] {
  const n = items.length;
  if (n === 0) return [];

  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Regroupe en "clusters" tout ce qui se chevauche, même indirectement
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (items[i].debutMin < items[j].finMin && items[j].debutMin < items[i].finMin) {
        union(i, j);
      }
    }
  }

  const clusters: Record<number, number[]> = {};
  for (let i = 0; i < n; i++) {
    const racine = find(i);
    (clusters[racine] ||= []).push(i);
  }

  const colDeItem: number[] = new Array(n).fill(0);
  const totalColsDeItem: number[] = new Array(n).fill(1);

  Object.values(clusters).forEach((indices) => {
    const tries = [...indices].sort((a, b) => items[a].debutMin - items[b].debutMin);
    const finColonnes: number[] = []; // fin actuelle de chaque colonne active
    tries.forEach((idx) => {
      let col = finColonnes.findIndex((fin) => fin <= items[idx].debutMin);
      if (col === -1) {
        col = finColonnes.length;
        finColonnes.push(items[idx].finMin);
      } else {
        finColonnes[col] = items[idx].finMin;
      }
      colDeItem[idx] = col;
    });
    const total = finColonnes.length;
    indices.forEach((idx) => (totalColsDeItem[idx] = total));
  });

  return items.map((item, idx) => ({ ...item, col: colDeItem[idx], totalCols: totalColsDeItem[idx] }));
}

export function heureVersMinutes(heure: string): number {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesVersHeure(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
