import type { AllianceContribution } from "@/features/alliance-contribution/contract";
import { ALL_MEMBERS } from "@/features/alliance-contribution/server/queries";
import { allianceShareOf, boosterOf } from "@/features/alliance-contribution/server/metrics";
import { loadByMember, loadMatrix } from "@/features/alliance-contribution/server/repository";
import { getSqlExecutor } from "@/lib/databricks/sql";
import type { SqlExecutor } from "@/lib/databricks/types";

export async function getAllianceContribution(
  requestId?: string,
  executor: SqlExecutor = getSqlExecutor(),
): Promise<AllianceContribution> {
  const [matrix, byMember] = await Promise.all([
    loadMatrix(executor, requestId),
    loadByMember(executor, requestId),
  ]);

  return {
    status: "ok",
    members: ALL_MEMBERS,
    matrix,
    byMember: byMember.map((r) => ({
      ...r,
      boosterRatio: boosterOf(r.self, r.total),
      allianceShare: allianceShareOf(r.self, r.alliance),
    })),
  };
}
