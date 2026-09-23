import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "@databricks/appkit";
import { z } from "zod";
import type { DatabricksConfig } from "@/lib/config/server-config";
import type { SqlExecutor, SqlParameter, SqlQueryOptions } from "./types";
import { SqlQueryError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

type Marker = ReturnType<typeof sql.string | typeof sql.number | typeof sql.boolean | typeof sql.timestamp>;
export type AnalyticsQuery = (
  statement: string, parameters: Record<string, Marker>, options: Record<string, unknown>, signal: AbortSignal,
) => Promise<unknown>;
export const analyticsExecution = new AsyncLocalStorage<{ signal: AbortSignal; onFinish: Array<() => void> }>();
let runtimeQuery: AnalyticsQuery | undefined;
export function configureAnalytics(query: AnalyticsQuery) { runtimeQuery = query; }
export function getAnalyticsQuery() { return runtimeQuery; }

// Tokenize literals/comments so a '?' in SQL text never becomes a parameter.
export function bindOrdinalParameters(statement: string, values: SqlParameter[]) {
  let index = 0;
  const parameters: Record<string, Marker> = {};
  const converted = statement.replace(/'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|`(?:``|[^`])*`|--[^\r\n]*|\/\*[\s\S]*?\*\/|\?/g, (token) => {
    if (token !== "?") return token;
    if (index >= values.length) throw new Error("Missing SQL parameter");
    const key = `valiuz_p${index}`;
    const value = values[index++];
    if (value === null || value === undefined) throw new Error("Null parameters require the driver adapter");
    parameters[key] = value instanceof Date ? sql.timestamp(value)
      : typeof value === "bigint" ? sql.bigint(value)
      : typeof value === "number" ? sql.number(value)
      : typeof value === "boolean" ? sql.boolean(value)
      : sql.string(value);
    return `:${key}`;
  });
  if (index !== values.length || /:valiuz_p\d+/.test(statement)) throw new Error("Invalid SQL parameter count or reserved name");
  return { statement: converted, parameters };
}

const resultSchema = z.object({ data: z.array(z.unknown()), next_chunk_index: z.number().optional() });

export class AppKitSqlExecutor implements SqlExecutor {
  constructor(private readonly config: DatabricksConfig, private readonly analytics: AnalyticsQuery,
    private readonly driver: SqlExecutor) {}

  async query<T>(options: SqlQueryOptions<T>): Promise<T[]> {
    const { name, maxRows = 1_000, rowSchema, requestId } = options;
    const queryLog = logger.child({ queryName: name, requestId });
    const startedAt = performance.now();
    const controller = new AbortController();
    const onFinish: Array<() => void> = [];
    let timer: NodeJS.Timeout | undefined;
    try {
      if (!name || !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 100_000) throw new Error("Invalid query bounds");
      const sqlPrefix = options.statement.replace(/^(?:\s|--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*/, "");
      if (!/^(SELECT|WITH)\b/i.test(sqlPrefix)) throw new Error("Analytics executor accepts reads only");
      // Select known compatibility exceptions before submission; never retry a native failure.
      if (options.transport === "driver" || options.parameters?.some((value) => value == null)) {
        return await this.driver.query(options);
      }
      const bound = bindOrdinalParameters(options.statement, options.parameters ?? []);
      const result = await Promise.race([
        analyticsExecution.run({ signal: controller.signal, onFinish }, () => this.analytics(
          bound.statement, bound.parameters, {
            catalog: this.config.catalog, schema: this.config.schema,
            row_limit: maxRows, byte_limit: 8 * 1024 * 1024,
            disposition: "INLINE", format: "JSON_ARRAY", wait_timeout: "0s",
          }, controller.signal,
        )),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error("SQL deadline exceeded")); }, this.config.timeoutMs);
        }),
      ]);
      const parsed = resultSchema.parse(result);
      if (parsed.data.length > maxRows || parsed.next_chunk_index !== undefined) throw new Error("SQL result exceeded the inline bound");
      const rows = parsed.data.map((row) => rowSchema.parse(row));
      queryLog.info({ durationMs: performance.now() - startedAt, rowCount: rows.length }, "SQL query completed");
      return rows;
    } catch {
      controller.abort();
      queryLog.error({ durationMs: performance.now() - startedAt }, "SQL query failed");
      throw new SqlQueryError(name);
    } finally {
      clearTimeout(timer);
      onFinish.forEach((finish) => finish());
    }
  }
}
