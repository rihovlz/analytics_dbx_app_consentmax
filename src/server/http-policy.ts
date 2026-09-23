import { Plugin, server, toPlugin, type PluginManifest } from "@databricks/appkit";
import express, { type Application } from "express";

export function valiuzServer(options: Parameters<typeof server>[0]) {
  const definition = server(options);
  class ValiuzServer extends definition.plugin {
    override async setup() {
      await super.setup();
      // Compatibility exception for 0.76.1: extend() runs after express.json(),
      // and the raw-body hook accepts only exact paths, not dynamic personal IDs.
      // Install the standard Express raw parser first; all runtime implementation stays upstream.
      const app = Reflect.get(this, "serverApplication") as Application;
      if (typeof app?.use !== "function") throw new Error("Unsupported AppKit server middleware contract");
      app.use("/api", express.raw({ type: () => true, limit: "64kb", inflate: false }));
    }
  }
  return { ...definition, plugin: ValiuzServer };
}

// Explicit registration replaces AppKit's automatic development recorder.
// That recorder writes local files through HTTP, outside the feature contracts.
class DisabledVariants extends Plugin {
  static manifest: PluginManifest<"uiVariants"> = {
    name: "uiVariants", displayName: "Disabled variant recorder", description: "No generic mutation routes",
    resources: { required: [], optional: [] }, devOnly: true,
  };
  injectRoutes() {}
}
export const disabledVariants = toPlugin(DisabledVariants);
