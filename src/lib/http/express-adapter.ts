import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { RequestValidationError } from "@/lib/errors/app-error";
import { withApiRoute } from "./with-api-route";

export function expressRoute(handler: (request: Request) => Promise<Response>): RequestHandler;
export function expressRoute<T extends Record<string, string>>(
  handler: (request: Request, route: { params: Promise<T> }) => Promise<Response>,
): RequestHandler;
export function expressRoute<T extends Record<string, string>>(
  handler: (request: Request, route: { params: Promise<T> }) => Promise<Response>,
): RequestHandler {
  return (req, res, next) => {
    const controller = new AbortController();
    const onClose = () => { if (!res.writableFinished) controller.abort(); };
    res.once("close", onClose);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const request = new Request(new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`), {
      method: req.method, headers, signal: controller.signal,
      ...(hasBody ? { body: Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: "half" } : {}),
    } as RequestInit);

    void (async () => {
      const response = await handler(request, { params: Promise.resolve(req.params as T) });
      res.status(response.status);
      response.headers.forEach((value, name) => res.setHeader(name, value));
      res.setHeader("cache-control", response.headers.get("cache-control") ?? "no-store");
      if (!response.body || req.method === "HEAD") {
        await response.body?.cancel();
        res.end();
        return;
      }
      res.flushHeaders();
      await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), res);
    })().catch((error) => {
      if (controller.signal.aborted || res.headersSent) res.destroy();
      else next(error);
    }).finally(() => res.off("close", onClose));
  };
}

// Includes parser and transport errors in the same safe envelope as feature handlers.
export const expressErrorHandler: ErrorRequestHandler = (_error, req, res, next) => {
  if (res.headersSent) { next(_error); return; }
  const request = new Request(`http://localhost${req.originalUrl}`, {
    method: req.method,
    headers: { "x-request-id": String(req.headers["x-request-id"] ?? "") },
  });
  void withApiRoute(() => { throw new RequestValidationError("Invalid HTTP request"); })(request)
    .then(async (response) => {
      response.headers.forEach((value, name) => res.setHeader(name, value));
      res.setHeader("cache-control", "no-store");
      res.status(response.status).send(await response.text());
    }).catch(next);
};
