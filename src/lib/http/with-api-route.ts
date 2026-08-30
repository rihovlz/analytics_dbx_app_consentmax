import { NextResponse } from "next/server";

import { normalizeError, type AppError } from "@/lib/errors/app-error";
import { createRequestContext, type RequestContext } from "@/lib/logging/request-context";

type ApiHandler<T, TRouteContext> = (
  request: Request,
  context: RequestContext,
  routeContext: TRouteContext,
) => Promise<T | Response> | T | Response;

type WrappedApiRoute<TRouteContext> = TRouteContext extends undefined
  ? (request: Request) => Promise<Response>
  : (request: Request, routeContext: TRouteContext) => Promise<Response>;

function attachRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function publicErrorMetadata(error: AppError): { retryable?: boolean; retryAfterMs?: number } {
  const candidate = error as AppError & { retryable?: unknown; retryAfterMs?: unknown };
  return {
    ...(typeof candidate.retryable === "boolean" ? { retryable: candidate.retryable } : {}),
    ...(typeof candidate.retryAfterMs === "number" && Number.isFinite(candidate.retryAfterMs)
      ? { retryAfterMs: Math.max(0, candidate.retryAfterMs) }
      : {}),
  };
}

export function withApiRoute<T, TRouteContext = undefined>(
  handler: ApiHandler<T, TRouteContext>,
): WrappedApiRoute<TRouteContext> {
  const apiRoute = async (request: Request, routeContext?: TRouteContext): Promise<Response> => {
    const context = createRequestContext(request);
    const startedAt = performance.now();

    try {
      const result = await handler(request, context, routeContext as TRouteContext);
      context.log.info(
        { method: request.method, path: new URL(request.url).pathname, durationMs: performance.now() - startedAt },
        "request completed",
      );
      if (result instanceof Response) {
        return attachRequestId(result, context.requestId);
      }
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
      const metadata = publicErrorMetadata(normalized);
      const headers = new Headers({ "x-request-id": context.requestId });
      if (metadata.retryAfterMs !== undefined) {
        headers.set("retry-after", String(Math.ceil(metadata.retryAfterMs / 1_000)));
      }
      return NextResponse.json(
        {
          error: {
            code: normalized.code,
            message: normalized.userMessage,
            requestId: context.requestId,
            ...(metadata.retryable !== undefined ? { retryable: metadata.retryable } : {}),
          },
        },
        { status: normalized.status, headers },
      );
    }
  };

  return apiRoute as WrappedApiRoute<TRouteContext>;
}
