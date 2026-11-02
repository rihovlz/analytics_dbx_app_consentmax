import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

test("Databricks startup needs no Genie configuration and removed APIs return safe 404s", { timeout: 30_000 }, async () => {
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (/^(DATABRICKS_|GENIE_|USER_STATE_)/.test(name)) delete env[name];
  }
  const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/fixtures/startup-without-genie.ts"], {
    env: { ...env, NODE_ENV: "test", APP_MODE: "databricks", APP_HOST: "127.0.0.1", PORT: String(port),
      DATABRICKS_HOST: "https://example.invalid", DATABRICKS_TOKEN: "synthetic",
      DATABRICKS_SQL_WAREHOUSE_ID: "a".repeat(16), DATABRICKS_CATALOG: "dev-dtm-operating", DATABRICKS_SCHEMA: "test",
      OTEL_EXPORTER_OTLP_ENDPOINT: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(child.exitCode, null, output);
      ready = await fetch(`${origin}/api/health`).then((r) => r.ok).catch(() => false);
      if (ready) break;
      await setTimeout(100);
    }
    assert.ok(ready, output);
    for (const [path, method] of [["messages", "POST"], ["session", "GET"]]) {
      const response = await fetch(`${origin}/api/genie/sales/${path}`, { method });
      assert.equal(response.status, 404);
      const body = await response.json();
      assert.equal(body.error.code, "NOT_FOUND");
      assert.ok(body.error.requestId);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
    assert.equal((await fetch(`${origin}/api/config`).then((r) => r.json())).mode, "databricks");
  } finally {
    child.kill("SIGTERM");
    await closed;
  }
});
