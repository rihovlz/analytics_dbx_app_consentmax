import type { GenieStreamEvent } from "@/features/genie/contract";

const encoder = new TextEncoder();
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const heartbeat = encoder.encode(": heartbeat\n\n");

export function encodeGenieSseEvent(event: GenieStreamEvent): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function createGenieSseResponse(
  events: AsyncIterable<GenieStreamEvent>,
  requestId: string,
  abortController?: AbortController,
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
): Response {
  let cancelled = false;
  let iterator: AsyncIterator<GenieStreamEvent> | undefined;
  let closePromise: Promise<void> | undefined;

  function closeIterator(): Promise<void> {
    if (!iterator?.return) {
      return Promise.resolve();
    }
    closePromise ??= Promise.resolve(iterator.return()).then(
      () => undefined,
      () => undefined,
    );
    return closePromise;
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      iterator = events[Symbol.asyncIterator]();
      let pendingEvent = iterator.next();
      try {
        while (!cancelled) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const next = await Promise.race([
            pendingEvent.then((result) => ({ kind: "event" as const, result })),
            new Promise<{ kind: "heartbeat" }>((resolve) => {
              timer = setTimeout(() => resolve({ kind: "heartbeat" }), heartbeatIntervalMs);
            }),
          ]);
          if (timer) {
            clearTimeout(timer);
          }
          if (cancelled) {
            return;
          }
          if (next.kind === "heartbeat") {
            controller.enqueue(heartbeat);
            continue;
          }
          if (next.result.done) {
            break;
          }
          controller.enqueue(encodeGenieSseEvent(next.result.value));
          pendingEvent = iterator.next();
        }
        if (!cancelled) {
          controller.close();
        }
      } catch (error) {
        if (!cancelled) {
          controller.error(error);
        }
      } finally {
        await closeIterator();
      }
    },
    async cancel() {
      cancelled = true;
      abortController?.abort();
      await closeIterator();
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-store, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
      "x-request-id": requestId,
    },
  });
}
