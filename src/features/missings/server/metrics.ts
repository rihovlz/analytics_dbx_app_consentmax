/** Ratio ou null si dénominateur nul. */
export function ratioOf(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

/**
 * Évolution du taux unknown en points de pourcentage : taux du dernier jour − taux N jours avant.
 * null si le dernier jour ou le jour N-avant n'est pas disponible (historique trop court).
 */
export function evolutionOf(series: { day: string; unknownPct: number | null }[], days: number): number | null {
  const sorted = series.filter((p) => p.unknownPct !== null).sort((a, b) => (a.day < b.day ? -1 : 1));
  if (sorted.length === 0) return null;
  const last = sorted[sorted.length - 1]!;
  const lastDate = new Date(`${last.day}T00:00:00Z`).getTime();
  const target = new Date(lastDate - days * 86_400_000).toISOString().slice(0, 10);
  const past = sorted.find((p) => p.day === target);
  return past && past.unknownPct !== null && last.unknownPct !== null ? last.unknownPct - past.unknownPct : null;
}
