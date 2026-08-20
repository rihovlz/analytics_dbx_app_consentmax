export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ getServerConfig }, { logger }] = await Promise.all([
      import("@/lib/config/server-config"),
      import("@/lib/logging/logger"),
    ]);
    const config = getServerConfig();
    logger.info({ mode: config.mode, appName: config.appName }, "application configuration validated");
  }
}
