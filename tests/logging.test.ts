import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import { createLogger } from "../src/lib/logging/logger";

test("redacts credentials from structured logs", () => {
  let output = "";
  const stream = new Writable({ write: (chunk, _encoding, callback) => { output += chunk.toString(); callback(); } });
  const testLogger = createLogger(stream);

  testLogger.info({ token: "secret-token", config: { auth: { clientSecret: "secret-client" } } }, "safe message");

  assert.doesNotMatch(output, /secret-token|secret-client/);
  assert.match(output, /\[REDACTED\]/);
  assert.match(output, /safe message/);
});
