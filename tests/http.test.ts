import assert from "node:assert/strict";
import test from "node:test";

import { GenieError } from "../src/features/genie/server/errors";
import { withApiRoute } from "../src/lib/http/with-api-route";

test("passes a streaming response through the shared API wrapper", async () => {
  const route = withApiRoute(() => new Response("event: status\ndata: {}\n\n", {
    headers: { "content-type": "text/event-stream" },
  }));

  const response = await route(new Request("http://localhost/api/stream"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.ok(response.headers.get("x-request-id"));
  assert.equal(await response.text(), "event: status\ndata: {}\n\n");
});

test("forwards dynamic route context without changing the JSON envelope", async () => {
  const route = withApiRoute<{ alias: string }, { params: Promise<{ alias: string }> }>(
    async (_request, _context, routeContext) => routeContext.params,
  );

  const response = await route(
    new Request("http://localhost/api/genie/sales"),
    { params: Promise.resolve({ alias: "sales" }) },
  );

  assert.deepEqual(await response.json(), { alias: "sales" });
  assert.ok(response.headers.get("x-request-id"));
});

test("preserves safe retry metadata for a pre-stream concurrency rejection", async () => {
  const route = withApiRoute(() => {
    throw new GenieError("limit reached", "GENIE_UNAVAILABLE", 429, true, {
      retryAfterMs: 5_000,
    });
  });

  const response = await route(new Request("http://localhost/api/genie/sales/messages"));
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "5");
  assert.equal(payload.error.retryable, true);
  assert.equal(payload.error.code, "GENIE_UNAVAILABLE");
  assert.ok(payload.error.requestId);
});
