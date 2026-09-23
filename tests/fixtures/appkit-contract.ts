import assert from "node:assert/strict";
import { createApp, sql, type WorkspaceClient } from "@databricks/appkit";
import { privateAnalytics } from "../../src/server/analytics-plugin";
import { guardStatementClient } from "../../src/server/workspace-client";
import { analyticsExecution } from "../../src/lib/databricks/appkit-executor";

const calls: unknown[] = [];
const cancels: unknown[] = [];
let failure: "exception" | "status" | "truncated" | undefined;
const client = new Proxy({} as WorkspaceClient, {
  get(_target, name) {
    if (name === "currentUser") return { me: async () => ({ id: "offline" }) };
    if (name === "apiClient") return { request: async () => ({ "x-databricks-org-id": "offline" }) };
    if (name === "statementExecution") return {
      executeStatement: async (input: unknown) => {
        calls.push(input);
        if (failure === "exception") throw new Error("synthetic-private-sql-error");
        if (failure === "status") return { status: { state: "FAILED", error: { message: "synthetic-private-sql-error" } } };
        return { statement_id: "statement", status: { state: "SUCCEEDED" },
          manifest: { truncated: failure === "truncated", schema: { columns: [{ name: "value", type_name: "DOUBLE" }] } }, result: { data_array: [["7"]] } };
      },
      cancelExecution: async (input: unknown) => { cancels.push(input); },
    };
    throw new Error("Unexpected remote access");
  },
});
const app = await createApp({
  plugins: [privateAnalytics(100)], client: guardStatementClient(client), cache: { enabled: false }, disableInternalTelemetry: true,
});
const controller = new AbortController();
const onFinish: Array<() => void> = [];
const result = await analyticsExecution.run({ signal: controller.signal, onFinish }, () =>
  app.analytics.query("SELECT :value AS value", { value: sql.number(7) }, {
    row_limit: 1, disposition: "INLINE", format: "JSON_ARRAY", wait_timeout: "0s",
  }, controller.signal));
assert.deepEqual(result.data, [{ value: "7" }]);
assert.equal(calls.length, 1);
assert.deepEqual(calls[0], {
  statement: "SELECT :value AS value", parameters: [{ name: "value", value: "7", type: "INT" }],
  warehouse_id: "a".repeat(16), catalog: undefined, schema: undefined, wait_timeout: "0s",
  disposition: "INLINE", format: "JSON_ARRAY", byte_limit: undefined, row_limit: 1, on_wait_timeout: "CONTINUE",
});
controller.abort();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(cancels.length, 1);
onFinish.forEach((finish) => finish());
for (failure of ["exception", "status", "truncated"] as const) {
  await assert.rejects(app.analytics.query("SELECT 7"), (error: Error) => {
    assert.doesNotMatch(error.message, /synthetic-private-sql-error/);
    return true;
  });
}
