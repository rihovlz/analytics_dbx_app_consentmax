import { z } from "zod";

import { HISTO_SOURCE, MISSING_SOURCE, historyQuery, missingRowsQuery } from "@/features/missings/server/queries";
import { quoteQualifiedIdentifier } from "@/lib/databricks/identifiers";
import type { SqlExecutor } from "@/lib/databricks/types";

const coerceNum = z.preprocess((v) => (typeof v === "bigint" ? Number(v) : v), z.coerce.number());

const missingRowSchema = z.object({
  member: z.string(),
  self: coerceNum,
  unknown: coerceNum,
});
const historyRowSchema = z.object({
  day: z.string(),
  member: z.string(),
  unknown_pct: z.preprocess((v) => (v === null ? null : typeof v === "bigint" ? Number(v) : v), z.coerce.number().nullable()),
});

export async function loadMissingRows(executor: SqlExecutor, requestId?: string) {
  const rows = await executor.query({
    name: "missings-rows",
    statement: missingRowsQuery,
    parameters: { source: quoteQualifiedIdentifier(MISSING_SOURCE) },
    rowSchema: missingRowSchema,
    requestId,
    maxRows: 50,
    waitTimeoutSeconds: 10,
  });
  return rows;
}

export async function loadUnknownHistory(executor: SqlExecutor, requestId?: string) {
  const rows = await executor.query({
    name: "missings-history",
    statement: historyQuery,
    parameters: { histoSource: quoteQualifiedIdentifier(HISTO_SOURCE) },
    rowSchema: historyRowSchema,
    requestId,
    maxRows: 2000,
    waitTimeoutSeconds: 10,
  });
  return rows.map((r) => ({ day: r.day, member: r.member, unknownPct: r.unknown_pct }));
}
