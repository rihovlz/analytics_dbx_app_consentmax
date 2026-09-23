import { createApp } from "@databricks/appkit";
import { getServerConfig } from "@/lib/config/server-config";
import { logger } from "@/lib/logging/logger";
import { registerRoutes } from "./routes";
import { disabledVariants, valiuzServer } from "./http-policy";
import { configureAnalytics } from "@/lib/databricks/appkit-executor";
import { privateAnalytics } from "./analytics-plugin";
import { createRuntimeClient } from "./workspace-client";

const config = getServerConfig();
if (config.mode === "databricks") process.env.DATABRICKS_WAREHOUSE_ID = config.warehouseId;
const port = Number(process.env.DATABRICKS_APP_PORT ?? process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid application port");

await createApp({
  plugins: [
    valiuzServer({ port, host: process.env.APP_HOST ?? "0.0.0.0", bodyLimit: "64kb", telemetry: false,
      ...(process.env.NODE_ENV === "production" ? { staticPath: "dist/client" } : {}) }),
    disabledVariants(),
    ...(config.mode === "databricks" ? [privateAnalytics(config.timeoutMs)] : []),
  ],
  client: createRuntimeClient(config),
  cache: { enabled: false },
  disableInternalTelemetry: true,
  onPluginsReady(appkit) {
    if (config.mode === "databricks") configureAnalytics((...args) => appkit.analytics.query(...args));
    appkit.server.extend(registerRoutes);
  },
}).catch(() => {
  // Upstream authentication errors may carry request headers in their cause.
  logger.fatal({ code: "APPKIT_STARTUP_FAILED" }, "AppKit startup failed; validate the runtime configuration and identity");
  process.exit(1);
});
logger.info({ mode: config.mode, appName: config.appName }, "application configuration validated");
