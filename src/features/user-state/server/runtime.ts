import "server-only";

import { getSqlExecutor } from "@/lib/databricks/sql";
import { resolveUserStateConfig } from "./config";
import { MemoryUserStateRepository, SqlUserStateRepository } from "./repository";
import { UserStateService } from "./service";

// Next.js can compile API routes separately. Share only the explicit local demo.
const demoGlobal = globalThis as typeof globalThis & { userStateDemo?: MemoryUserStateRepository };
export function userStateRuntime(requestId: string) {
  const config = resolveUserStateConfig();
  const repository = config.mode === "demo"
    ? (demoGlobal.userStateDemo ??= new MemoryUserStateRepository())
    : new SqlUserStateRepository(getSqlExecutor(), config.appId, config.tables!, requestId);
  return { config, service: new UserStateService(repository) };
}
