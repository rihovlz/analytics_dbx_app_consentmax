import type IOperation from "@databricks/sql/dist/contracts/IOperation";

import { getServerConfig, type DatabricksConfig } from "@/lib/config/server-config";
import { connectDatabricks } from "@/lib/databricks/client";
import type { SqlExecutor, SqlQueryOptions } from "@/lib/databricks/types";
import { ConfigurationError, SqlQueryError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class DatabricksSqlExecutor implements SqlExecutor {
  constructor(private readonly config: DatabricksConfig) {}

  async query<T>({
    name,
    statement,
    parameters = [],
    rowSchema,
    requestId,
    maxRows = 1_000,
  }: SqlQueryOptions<T>): Promise<T[]> {
    const queryLog = logger.child({ queryName: name, requestId });
    const startedAt = performance.now();
    const client = await connectDatabricks(this.config);
    let session: Awaited<ReturnType<typeof client.openSession>> | undefined;
    let operation: IOperation | undefined;

    try {
      session = await withTimeout(
        client.openSession({ initialCatalog: this.config.catalog, initialSchema: this.config.schema }),
        this.config.timeoutMs,
      );
      operation = await withTimeout(
        session.executeStatement(statement, {
          runAsync: true,
          maxRows,
          ordinalParameters: parameters,
          queryTags: { application: this.config.appName, query_name: name, request_id: requestId },
        }),
        this.config.timeoutMs,
      );
      const rawRows = await withTimeout(operation.fetchAll({ maxRows }), this.config.timeoutMs);
      const rows = rawRows.map((row) => rowSchema.parse(row));
      queryLog.info(
        { durationMs: performance.now() - startedAt, rowCount: rows.length },
        "SQL query completed",
      );
      return rows;
    } catch (error) {
      if (operation) await operation.cancel().catch(() => undefined);
      queryLog.error(
        {
          errorName: error instanceof Error ? error.name : "UnknownError",
          durationMs: performance.now() - startedAt,
        },
        "SQL query failed",
      );
      throw new SqlQueryError(name, { cause: error });
    } finally {
      if (operation) await operation.close().catch(() => undefined);
      if (session) await session.close().catch(() => undefined);
      await client.close().catch(() => undefined);
    }
  }
}

export function getSqlExecutor(): SqlExecutor {
  const config = getServerConfig();
  if (config.mode !== "databricks") {
    throw new ConfigurationError("SQL execution is disabled in demo mode");
  }
  return new DatabricksSqlExecutor(config);
}
