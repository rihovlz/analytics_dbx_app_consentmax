import type { Missings } from "@/features/missings/contract";
import { evolutionOf, ratioOf } from "@/features/missings/server/metrics";
import { loadMissingRows, loadUnknownHistory } from "@/features/missings/server/repository";
import { getSqlExecutor } from "@/lib/databricks/sql";
import type { SqlExecutor } from "@/lib/databricks/types";

export async function getMissings(requestId?: string, executor: SqlExecutor = getSqlExecutor()): Promise<Missings> {
  const [raw, history] = await Promise.all([
    loadMissingRows(executor, requestId),
    loadUnknownHistory(executor, requestId),
  ]);

  // Ligne VLZ affichée dans le tableau, exclue du % global comme dans l'image de référence.
  const withoutVlz = raw.filter((r) => r.member !== "VLZ");
  const globalUnknown = withoutVlz.reduce((a, r) => a + r.unknown, 0);
  const globalSelf = withoutVlz.reduce((a, r) => a + r.self, 0);

  return {
    status: "ok",
    globalUnknownPct: ratioOf(globalUnknown, globalSelf),
    rows: raw.map((r) => {
      const series = history.filter((h) => h.member === r.member);
      return {
        member: r.member,
        self: r.self,
        unknown: r.unknown,
        unknownPctSelf: ratioOf(r.unknown, r.self),
        evolution30: evolutionOf(series, 30),
        evolution60: evolutionOf(series, 60),
        evolution90: evolutionOf(series, 90),
      };
    }),
    history,
  };
}
