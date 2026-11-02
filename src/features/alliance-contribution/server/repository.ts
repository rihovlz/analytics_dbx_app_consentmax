import { z } from "zod";

import { byMemberQuery, matrixQuery } from "@/features/alliance-contribution/server/queries";
import { quoteQualifiedIdentifier } from "@/lib/databricks/identifiers";
import type { SqlExecutor } from "@/lib/databricks/types";

const coerceNum = z.preprocess((v) => (typeof v === "bigint" ? Number(v) : v), z.coerce.number());

const matrixRowSchema = z.object({ collector: z.string(), recipient: z.string(), opt_in: coerceNum });
const byMemberRowSchema = z.object({
  member: z.string(),
  self_opt_in: coerceNum,
  alliance_opt_in: coerceNum,
  total_opt_in: coerceNum,
});

export const SOURCE = "prd-consent.analytics.stat_consent_members";

export async function loadMatrix(executor: SqlExecutor, requestId?: string) {
  const rows = await executor.query({
    name: "alliance-contribution-matrix",
    statement: matrixQuery,
    parameters: { source: quoteQualifiedIdentifier(SOURCE) },
    rowSchema: matrixRowSchema,
    requestId,
    maxRows: 400,
    waitTimeoutSeconds: 10,
  });
  return rows.map((r) => ({ collector: r.collector, recipient: r.recipient, optIn: r.opt_in }));
}

export async function loadByMember(executor: SqlExecutor, requestId?: string) {
  const rows = await executor.query({
    name: "alliance-contribution-by-member",
    statement: byMemberQuery,
    parameters: { source: quoteQualifiedIdentifier(SOURCE) },
    rowSchema: byMemberRowSchema,
    requestId,
    maxRows: 50,
    waitTimeoutSeconds: 10,
  });
  return rows.map((r) => ({
    member: r.member,
    self: r.self_opt_in,
    alliance: r.alliance_opt_in,
    total: r.total_opt_in,
  }));
}
