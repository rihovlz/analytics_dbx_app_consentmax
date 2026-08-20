import assert from "node:assert/strict";
import test from "node:test";

import { AppError, DatabricksError, normalizeError } from "../src/lib/errors/app-error";

test("preserves typed application errors", () => {
  const error = new DatabricksError("technical detail");
  assert.equal(normalizeError(error), error);
  assert.equal(error.status, 503);
  assert.doesNotMatch(error.userMessage, /technical detail/);
});

test("normalizes unknown failures with a safe user message", () => {
  const error = normalizeError(new Error("sensitive implementation detail"));
  assert.ok(error instanceof AppError);
  assert.equal(error.code, "UNEXPECTED_ERROR");
  assert.doesNotMatch(error.userMessage, /sensitive/);
});
