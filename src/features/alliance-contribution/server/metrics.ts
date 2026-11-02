/** Booster = total / self ; null si self = 0 (affiché « — »). */
export function boosterOf(self: number, total: number): number | null {
  return self > 0 ? total / self : null;
}

/** % booster alliance = alliance / self ; null si self = 0. */
export function allianceShareOf(self: number, alliance: number): number | null {
  return self > 0 ? alliance / self : null;
}
