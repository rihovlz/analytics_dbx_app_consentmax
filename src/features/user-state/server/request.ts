import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError, RequestValidationError } from "@/lib/errors/app-error";
import type { UserStateConfig } from "./config";

export function resolveOwner(request: Request, config: UserStateConfig): string {
  // No owner field, query argument, email fallback or client-selected demo identity.
  const raw = config.mode === "demo" ? "local-demo-user" : request.headers.get("x-forwarded-user");
  if (!raw?.trim() || raw.length > 512 || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw new AppError("Missing proxy identity", "USER_STATE_AUTH_REQUIRED", 401,
      "Connectez-vous à l’application pour accéder à vos analyses.");
  }
  return createHash("sha256").update(JSON.stringify([config.appId, raw])).digest("hex");
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new RequestValidationError("Invalid personal state payload");
  return parsed.data;
}

export async function readMutation(request: Request, config: UserStateConfig): Promise<unknown> {
  if (request.headers.get("origin") !== config.origin
    || request.headers.get("sec-fetch-site") === "cross-site"
    || request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new RequestValidationError("Personal state mutations require same-origin JSON");
  }
  if (!request.body) throw new RequestValidationError("Missing personal state payload");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16 * 1024) {
        await reader.cancel().catch(() => undefined);
        throw new RequestValidationError("Personal state payload exceeds 16 KiB");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new RequestValidationError("Invalid personal state JSON");
  }
}
