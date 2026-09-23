import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../src/server/routes/health/route";

test("health endpoint is shallow and returns the public contract", async () => {
  const response = await GET(new Request("http://localhost/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  assert.ok(response.headers.get("x-request-id"));
});
