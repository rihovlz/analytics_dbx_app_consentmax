import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { expressErrorHandler, expressRoute } from "../src/lib/http/express-adapter";
import { withApiRoute } from "../src/lib/http/with-api-route";
import { parseGenieMessageRequest } from "../src/features/genie/server/request";
import { userStateRoutes } from "../src/features/user-state/server/route";
import { MemoryUserStateRepository } from "../src/features/user-state/server/repository";
import { UserStateService } from "../src/features/user-state/server/service";

test("Express preserves safe JSON errors, raw byte bounds, parameters and private headers", async () => {
  const app = express();
  app.post("/genie", expressRoute(withApiRoute(async (request) => parseGenieMessageRequest(request))));
  app.get("/failure", expressRoute(withApiRoute(() => { throw new Error("secret error"); })));
  const personal = userStateRoutes(() => ({
    config: { mode: "databricks", appId: "test", origin: "https://example.invalid" },
    service: new UserStateService(new MemoryUserStateRepository()),
  }));
  app.get("/personal/:id", expressRoute(personal.get));
  app.use(expressErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const failure = await fetch(base + "/failure", { headers: { "x-request-id": "test-safe" } });
    assert.equal(failure.status, 500);
    const payload = await failure.text();
    assert.match(payload, /test-safe/);
    assert.doesNotMatch(payload, /secret error/);
    for (const body of ["{", JSON.stringify({ content: "x".repeat(70_000) })]) {
      const response = await fetch(base + "/genie", { method: "POST", headers: { "content-type": "application/json" }, body });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, "INVALID_REQUEST");
    }
    const response = await fetch(base + "/personal/missing");
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await response.json()).error.code, "USER_STATE_AUTH_REQUIRED");
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
