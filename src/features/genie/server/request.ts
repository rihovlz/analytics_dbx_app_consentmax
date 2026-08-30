import { genieMessageRequestSchema, type GenieMessageRequest } from "@/features/genie/contract";
import { RequestValidationError } from "@/lib/errors/app-error";

const MAX_REQUEST_BODY_BYTES = 64 * 1024;

function forwardedOrigin(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (!host || (protocol !== "http" && protocol !== "https")) {
    return null;
  }
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new RequestValidationError("Genie requests must be same-origin");
  }

  const rawOrigin = request.headers.get("origin")?.trim();
  if (!rawOrigin) {
    return;
  }
  let origin: string;
  try {
    origin = new URL(rawOrigin).origin;
  } catch {
    throw new RequestValidationError("Genie request origin is invalid");
  }
  const acceptedOrigins = new Set([
    new URL(request.url).origin,
    forwardedOrigin(request),
  ].filter((value): value is string => Boolean(value)));
  if (!acceptedOrigins.has(origin)) {
    throw new RequestValidationError("Genie requests must be same-origin");
  }
}

function assertJsonContentType(request: Request): void {
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new RequestValidationError("Genie request content type must be application/json");
  }
}

function assertDeclaredBodySize(request: Request): void {
  const rawContentLength = request.headers.get("content-length")?.trim();
  if (!rawContentLength) {
    return;
  }
  if (!/^\d+$/.test(rawContentLength) || Number(rawContentLength) > MAX_REQUEST_BODY_BYTES) {
    throw new RequestValidationError("Genie request body is too large");
  }
}

async function readBoundedBody(request: Request): Promise<string> {
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RequestValidationError("Genie request body is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new RequestValidationError("Genie request body must use UTF-8");
  }
}

export async function parseGenieMessageRequest(request: Request): Promise<GenieMessageRequest> {
  assertSameOrigin(request);
  assertJsonContentType(request);
  assertDeclaredBodySize(request);

  const serializedBody = await readBoundedBody(request);

  let payload: unknown;
  try {
    payload = JSON.parse(serializedBody);
  } catch {
    throw new RequestValidationError("Genie request body must be valid JSON");
  }
  const parsed = genieMessageRequestSchema.safeParse(payload);
  if (!parsed.success) {
    throw new RequestValidationError("Genie request body does not match the public contract");
  }
  return parsed.data;
}
