import assert from "node:assert/strict";
import test from "node:test";

import { ConfigurationError } from "../src/lib/errors/app-error";
import { parseServerConfig } from "../src/lib/config/server-config";

test("defaults to an explicit credential-free demo mode", () => {
  const config = parseServerConfig({});
  assert.deepEqual(config, {
    mode: "demo",
    appName: "Databricks App",
    appDescription: "A reusable Databricks App",
    logLevel: "info",
  });
});

test("requires local credentials in databricks mode", () => {
  assert.throws(
    () => parseServerConfig({ APP_MODE: "databricks" }),
    (error: unknown) => error instanceof ConfigurationError && error.message.includes("DATABRICKS_HOST"),
  );
});

test("builds local PAT configuration without exposing the URL scheme to the driver", () => {
  const config = parseServerConfig({
    APP_MODE: "databricks",
    DATABRICKS_HOST: "https://dbc.example.cloud.databricks.com",
    DATABRICKS_TOKEN: "local-token",
    DATABRICKS_SQL_WAREHOUSE_ID: "warehouse-id",
    DATABRICKS_CATALOG: "analytics-dev",
    DATABRICKS_SCHEMA: "app_schema",
  });

  assert.equal(config.mode, "databricks");
  if (config.mode === "databricks") {
    assert.equal(config.host, "dbc.example.cloud.databricks.com");
    assert.deepEqual(config.auth, { type: "pat", token: "local-token" });
  }
});

test("uses Databricks Apps OAuth credentials at runtime", () => {
  const config = parseServerConfig({
    APP_MODE: "databricks",
    DATABRICKS_APP_NAME: "my-app",
    DATABRICKS_HOST: "https://dbc.example.cloud.databricks.com",
    DATABRICKS_CLIENT_ID: "client-id",
    DATABRICKS_CLIENT_SECRET: "client-secret",
    DATABRICKS_SQL_WAREHOUSE_ID: "warehouse-id",
    DATABRICKS_CATALOG: "analytics",
    DATABRICKS_SCHEMA: "app_schema",
  });

  assert.equal(config.mode, "databricks");
  if (config.mode === "databricks") {
    assert.deepEqual(config.auth, {
      type: "oauth-m2m",
      clientId: "client-id",
      clientSecret: "client-secret",
    });
  }
});
