import { mock } from "node:test";
import * as appkit from "@databricks/appkit";

// Exercise the real entrypoint while refusing all unexpected workspace calls.
const client = new Proxy({} as appkit.WorkspaceClient, {
  get(_target, name) {
    if (name === "currentUser") return { me: async () => ({ id: "offline" }) };
    if (name === "apiClient") return { request: async () => ({ "x-databricks-org-id": "offline" }) };
    throw new Error(`Unexpected workspace service: ${String(name)}`);
  },
});
mock.module("@databricks/appkit", {
  namedExports: { ...appkit, createWorkspaceClient: () => client },
});
await import("../../src/server/index");
