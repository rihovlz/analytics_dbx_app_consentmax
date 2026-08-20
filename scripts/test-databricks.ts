import { checkConnection } from "../src/features/connection-check/server/service";
import { getServerConfig } from "../src/lib/config/server-config";

async function main(): Promise<void> {
  const config = getServerConfig();
  if (config.mode !== "databricks") {
    throw new Error("Set APP_MODE=databricks and configure local Databricks credentials first.");
  }
  const result = await checkConnection("cli-connection-check");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Connection check failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
});
