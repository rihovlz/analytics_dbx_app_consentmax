import "server-only";

import type { Logger } from "pino";

import type { GenieMessageRequest } from "@/features/genie/contract";
import { createDatabricksGenieClient } from "@/features/genie/server/client";
import {
  genieConcurrencyLimiter,
  releaseConcurrencySlot,
  resolveGenieConcurrencyLimits,
} from "@/features/genie/server/concurrency";
import { resolveGenieRuntimeConfiguration } from "@/features/genie/server/config";
import { resolveGenieRequestIdentity } from "@/features/genie/server/obo-auth";
import {
  streamDemoGenieMessage,
  streamGenieMessage,
} from "@/features/genie/server/service";
import { createGenieSseResponse } from "@/features/genie/server/sse";

export async function createGenieMessageResponse(
  request: Request,
  alias: string,
  body: GenieMessageRequest,
  requestId: string,
  log?: Logger,
): Promise<Response> {
  const configuration = resolveGenieRuntimeConfiguration(alias);
  const abortController = new AbortController();
  const signal = AbortSignal.any([request.signal, abortController.signal]);
  const startedAt = performance.now();
  const logCompletion = ({ queryResultCount }: { queryResultCount: number }) => log?.info(
    { alias, queryResultCount, durationMs: performance.now() - startedAt },
    "Genie stream completed",
  );
  const logFailure = (error: { name: string; code: string; retryable: boolean }) => log?.error(
    {
      errorName: error.name,
      code: error.code,
      alias,
      retryable: error.retryable,
      durationMs: performance.now() - startedAt,
    },
    "Genie stream failed",
  );

  if (configuration.mode === "demo") {
    log?.info({ alias, authType: "demo" }, "Genie stream started");
    return createGenieSseResponse(
      streamDemoGenieMessage(body, {
        requestId,
        signal,
        onError: logFailure,
        onComplete: logCompletion,
      }),
      requestId,
      abortController,
    );
  }

  const identity = await resolveGenieRequestIdentity(request, configuration);
  const release = genieConcurrencyLimiter.acquire(
    identity.userId,
    resolveGenieConcurrencyLimits(),
  );
  log?.info({ alias, authType: identity.authType }, "Genie stream started");
  try {
    const client = createDatabricksGenieClient({
      workspaceUrl: configuration.workspaceUrl,
      accessToken: identity.accessToken,
    });
    return createGenieSseResponse(
      releaseConcurrencySlot(streamGenieMessage(body, {
        client,
        spaceId: configuration.space.spaceId,
        requestId,
        signal,
        onError: logFailure,
        onComplete: logCompletion,
      }), release),
      requestId,
      abortController,
    );
  } catch (error) {
    release();
    throw error;
  }
}
