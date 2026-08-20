import { NextResponse } from "next/server";

import { normalizeError } from "@/lib/errors/app-error";
import { createRequestContext, type RequestContext } from "@/lib/logging/request-context";

type ApiHandler<T> = (request: Request, context: RequestContext) => Promise<T> | T;

export function withApiRoute<T>(handler: ApiHandler<T>) {
  return async function apiRoute(request: Request): Promise<NextResponse> {
    const context = createRequestContext(request);
    const startedAt = performance.now();

    try {
      const result = await handler(request, context);
      context.log.info(
        { method: request.method, path: new URL(request.url).pathname, durationMs: performance.now() - startedAt },
        "request completed",
      );
      return NextResponse.json(result, { headers: { "x-request-id": context.requestId } });
    } catch (error) {
      const normalized = normalizeError(error);
      context.log.error(
        {
          errorName: normalized.name,
          code: normalized.code,
          method: request.method,
          path: new URL(request.url).pathname,
          durationMs: performance.now() - startedAt,
        },
        "request failed",
      );
      return NextResponse.json(
        { error: { code: normalized.code, message: normalized.userMessage, requestId: context.requestId } },
        { status: normalized.status, headers: { "x-request-id": context.requestId } },
      );
    }
  };
}
