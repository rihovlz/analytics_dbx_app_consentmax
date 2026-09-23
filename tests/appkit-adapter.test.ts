import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { z } from "zod";
import { AppKitSqlExecutor, bindOrdinalParameters } from "../src/lib/databricks/appkit-executor";
import type { DatabricksConfig } from "../src/lib/config/server-config";
import type { SqlExecutor } from "../src/lib/databricks/types";

const config: DatabricksConfig = {
  mode: "databricks", appName: "test", appDescription: "", supportContact: { name: "test", slackUrl: "https://valiuz.slack.com" },
  logLevel: "error", host: "example.invalid", warehouseId: "a".repeat(16), catalog: "dev-dtm-operating", schema: "test",
  timeoutMs: 15, auth: { type: "pat", token: "synthetic" },
};
const rowSchema = z.object({ value: z.number() });
const query = { name: "bounded-read", statement: "SELECT ? AS value", parameters: [7], rowSchema, maxRows: 1 };
const noDriver: SqlExecutor = { async query() { throw new Error("Driver must not be used"); } };

test("ordinal binding preserves SQL literals, comments and values without interpolation", () => {
  const result = bindOrdinalParameters("SELECT '?', `?`, \"?\", ? -- ?\n /* ? */ WHERE x = ?", ["x'; DROP TABLE y --", 4]);
  assert.equal(result.statement, "SELECT '?', `?`, \"?\", :valiuz_p0 -- ?\n /* ? */ WHERE x = :valiuz_p1");
  assert.equal(result.parameters.valiuz_p0.value, "x'; DROP TABLE y --");
  assert.equal(result.parameters.valiuz_p1.value, "4");
  assert.throws(() => bindOrdinalParameters("SELECT ?", []));
  assert.throws(() => bindOrdinalParameters("SELECT 1", [1]));
});

test("AppKit adapter binds values, enforces row validation and rejects excess rows", async () => {
  const executor = new AppKitSqlExecutor(config, async (statement, parameters, options, signal) => {
    assert.equal(statement, "SELECT :valiuz_p0 AS value");
    assert.equal(parameters.valiuz_p0.value, "7");
    assert.equal(options.row_limit, 1);
    assert.equal(options.disposition, "INLINE");
    assert.equal(options.catalog, "dev-dtm-operating");
    assert.ok(signal instanceof AbortSignal);
    return { data: [{ value: 7 }] };
  }, noDriver);
  assert.deepEqual(await executor.query(query), [{ value: 7 }]);
  for (const data of [[{ value: "invalid" }], [{ value: 1 }, { value: 2 }]]) {
    const invalid = new AppKitSqlExecutor(config, async () => ({ data }), noDriver);
    await assert.rejects(invalid.query(query), { code: "SQL_QUERY_FAILED" });
  }
  await assert.rejects(executor.query({ ...query, statement: "DELETE FROM test" }), { code: "SQL_QUERY_FAILED" });
});

test("deadline aborts native execution and never retries or falls back", async () => {
  let calls = 0;
  let signal: AbortSignal | undefined;
  const executor = new AppKitSqlExecutor(config, async (_sql, _params, _options, abort) => {
    calls++; signal = abort;
    return new Promise(() => {});
  }, noDriver);
  await assert.rejects(executor.query(query), { code: "SQL_QUERY_FAILED" });
  assert.equal(calls, 1);
  assert.equal(signal?.aborted, true);
});

test("null and exact STRING exceptions select the driver before submission", async () => {
  let calls = 0;
  const driver: SqlExecutor = { async query(options) { calls++; return [options.rowSchema.parse({ value: 8 })]; } };
  const executor = new AppKitSqlExecutor(config, async () => { throw new Error("Must not submit"); }, driver);
  await executor.query({ ...query, parameters: [null] });
  await executor.query({ ...query, transport: "driver" });
  assert.equal(calls, 2);
  await assert.rejects(executor.query({ ...query, transport: "driver", maxRows: 0 }), { code: "SQL_QUERY_FAILED" });
  await assert.rejects(executor.query({ ...query, parameters: [null], statement: "DELETE FROM test WHERE x = ?" }), { code: "SQL_QUERY_FAILED" });
  assert.equal(calls, 2);
});

test("installed AppKit analytics passes the offline package contract", () => {
  execFileSync(process.execPath, ["--import", "tsx", "tests/fixtures/appkit-contract.ts"], {
    encoding: "utf8", timeout: 30_000,
    env: { ...process.env, NODE_ENV: "test", DATABRICKS_HOST: "https://example.invalid", DATABRICKS_WAREHOUSE_ID: "a".repeat(16),
      OTEL_EXPORTER_OTLP_ENDPOINT: "" },
  });
});
