import type {
  GenieMessageRequest,
  GenieMessageStatus,
  GenieQueryResult,
  GenieStreamEvent,
} from "@/features/genie/contract";
import { buildGenieMessageContent } from "@/features/genie/context";
import {
  createDemoGenieMessageResult,
  DEMO_GENIE_MESSAGE_ID,
  DEMO_GENIE_QUERY_RESULT,
  DEMO_GENIE_STATUS_SEQUENCE,
} from "@/features/genie/demo-fixtures";
import { GenieError, toGenieError, toGenieStreamErrorEvent } from "@/features/genie/server/errors";
import type {
  GenieClient,
  GenieRemoteMessage,
  GenieRemoteQueryAttachment,
} from "@/features/genie/server/types";

const TERMINAL_STATUSES = new Set<GenieMessageStatus>([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "QUERY_RESULT_EXPIRED",
]);

const PERMISSION_ERROR_TYPES = new Set([
  "WAREHOUSE_ACCESS_MISSING_EXCEPTION",
  "CUSTOMER_UNAUTHORIZED",
  "CUSTOMER_UNAUTHORIZED_EXCEPTION",
  "PERMISSION_DENIED",
  "PERMISSION_DENIED_EXCEPTION",
]);

export type GeniePollingOptions = {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  maxReadRetries: number;
  timeoutMs: number;
};

const DEFAULT_POLLING_OPTIONS: GeniePollingOptions = {
  initialDelayMs: 1_000,
  maxDelayMs: 5_000,
  multiplier: 1.6,
  maxReadRetries: 5,
  timeoutMs: 10 * 60_000,
};

type StreamDependencies = {
  client: GenieClient;
  spaceId: string;
  requestId: string;
  signal?: AbortSignal;
  polling?: Partial<GeniePollingOptions>;
  now?: () => number;
  random?: () => number;
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
  onError?: (error: GenieError) => void;
  onComplete?: (summary: { queryResultCount: number }) => void;
};

type DemoDependencies = {
  requestId: string;
  signal?: AbortSignal;
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
  statusDelayMs?: number;
  onError?: (error: GenieError) => void;
  onComplete?: (summary: { queryResultCount: number }) => void;
};

function createAbortError(): GenieError {
  return new GenieError("Genie stream was cancelled", "GENIE_CANCELLED", 409, false);
}

export function sleepWithAbort(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    function onAbort(): void {
      clearTimeout(timer);
      reject(createAbortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function statusEvent(status: GenieMessageStatus): GenieStreamEvent {
  return { type: "status", data: { status } };
}

type ReadRetryContext = {
  deadline: number;
  initialDelayMs: number;
  maxDelayMs: number;
  maxReadRetries: number;
  multiplier: number;
  now: () => number;
  random: () => number;
  signal?: AbortSignal;
  sleep: (delayMs: number, signal?: AbortSignal) => Promise<void>;
};

function retryWaitMs(error: GenieError, delayMs: number, random: () => number): number {
  if (error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }
  const randomValue = Math.max(0, Math.min(1, random()));
  return Math.max(1, Math.round(delayMs * (0.8 + randomValue * 0.4)));
}

async function readWithRetry<T>(
  operation: () => Promise<T>,
  context: ReadRetryContext,
): Promise<T> {
  let delayMs = context.initialDelayMs;
  let retries = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      const normalized = toGenieError(error);
      if (!normalized.retryOnRead || retries >= context.maxReadRetries) {
        throw normalized;
      }
      const remainingMs = context.deadline - context.now();
      if (remainingMs <= 0) {
        throw new GenieError("Genie read-retry deadline exceeded", "GENIE_TIMEOUT", 504, true);
      }
      const waitMs = Math.min(remainingMs, retryWaitMs(normalized, delayMs, context.random));
      await context.sleep(waitMs, context.signal);
      retries += 1;
      delayMs = Math.min(context.maxDelayMs, Math.ceil(delayMs * context.multiplier));
      if (context.now() >= context.deadline) {
        throw new GenieError("Genie read-retry deadline exceeded", "GENIE_TIMEOUT", 504, true);
      }
    }
  }
}

function failureForMessage(message: GenieRemoteMessage): GenieError {
  if (message.status === "CANCELLED") {
    return new GenieError("Genie cancelled the message", "GENIE_CANCELLED", 409, false);
  }
  if (message.status === "QUERY_RESULT_EXPIRED") {
    return new GenieError("Genie query result expired", "GENIE_RESULT_EXPIRED", 410, true);
  }
  const errorType = message.errorType?.toUpperCase() ?? "";
  if (
    PERMISSION_ERROR_TYPES.has(errorType)
    || errorType.includes("ACCESS_MISSING")
    || errorType.includes("UNAUTHORIZED")
    || errorType.includes("PERMISSION_DENIED")
  ) {
    return new GenieError("Genie or warehouse permission missing", "GENIE_PERMISSION_DENIED", 403, false);
  }
  return new GenieError("Genie failed to produce a response", "GENIE_UNAVAILABLE", 502, true);
}

async function loadQueryResult(
  client: GenieClient,
  spaceId: string,
  message: GenieRemoteMessage,
  attachment: GenieRemoteQueryAttachment,
  signal?: AbortSignal,
): Promise<GenieQueryResult | null> {
  const result = await client.getQueryResult({
    spaceId,
    conversationId: message.conversationId,
    messageId: message.messageId,
    attachmentId: attachment.attachmentId,
    signal,
  });

  if (result.state === "PENDING" || result.state === "RUNNING" || result.state === "STATE_UNSPECIFIED") {
    return null;
  }
  if (result.state === "CANCELED") {
    throw new GenieError("Genie query execution was cancelled", "GENIE_CANCELLED", 409, false);
  }
  if (result.state === "CLOSED") {
    throw new GenieError("Genie query result is no longer available", "GENIE_RESULT_EXPIRED", 410, true);
  }
  if (result.state === "FAILED") {
    throw new GenieError("Genie query execution failed", "GENIE_UNAVAILABLE", 502, true);
  }

  return {
    attachmentId: attachment.attachmentId,
    statementId: result.statementId ?? attachment.statementId,
    title: attachment.title,
    description: attachment.description,
    sql: attachment.sql,
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rowCount,
    truncated: result.truncated,
  };
}

async function loadAvailableQueryResults(
  client: GenieClient,
  spaceId: string,
  message: GenieRemoteMessage,
  emittedAttachmentIds: Set<string>,
  retryContext: ReadRetryContext,
): Promise<GenieQueryResult[]> {
  if (message.status !== "EXECUTING_QUERY" && message.status !== "COMPLETED") {
    return [];
  }

  const ready: GenieQueryResult[] = [];
  for (const attachment of message.queryAttachments) {
    if (emittedAttachmentIds.has(attachment.attachmentId)) {
      continue;
    }
    const result = await readWithRetry(
      () => loadQueryResult(client, spaceId, message, attachment, retryContext.signal),
      retryContext,
    );
    if (result) {
      emittedAttachmentIds.add(attachment.attachmentId);
      ready.push(result);
    }
  }
  return ready;
}

export async function* streamGenieMessage(
  request: GenieMessageRequest,
  dependencies: StreamDependencies,
): AsyncGenerator<GenieStreamEvent> {
  const polling = { ...DEFAULT_POLLING_OPTIONS, ...dependencies.polling };
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const sleep = dependencies.sleep ?? sleepWithAbort;
  const deadline = now() + polling.timeoutMs;
  const readRetryContext: ReadRetryContext = {
    deadline,
    initialDelayMs: polling.initialDelayMs,
    maxDelayMs: polling.maxDelayMs,
    maxReadRetries: polling.maxReadRetries,
    multiplier: polling.multiplier,
    now,
    random,
    signal: dependencies.signal,
    sleep,
  };

  try {
    let message = await dependencies.client.submitMessage({
      spaceId: dependencies.spaceId,
      content: buildGenieMessageContent(request.content, request.context),
      conversationId: request.conversationId,
      signal: dependencies.signal,
    });
    yield {
      type: "message_start",
      data: { conversationId: message.conversationId, messageId: message.messageId },
    };

    const emittedAttachmentIds = new Set<string>();
    let previousStatus: GenieMessageStatus | undefined;
    let delayMs = polling.initialDelayMs;

    while (true) {
      if (dependencies.signal?.aborted) {
        throw createAbortError();
      }
      if (message.status !== previousStatus) {
        yield statusEvent(message.status);
        previousStatus = message.status;
      }

      const queryResults = await loadAvailableQueryResults(
        dependencies.client,
        dependencies.spaceId,
        message,
        emittedAttachmentIds,
        readRetryContext,
      );
      for (const queryResult of queryResults) {
        yield { type: "query_result", data: queryResult };
      }

      if (TERMINAL_STATUSES.has(message.status)) {
        if (message.status !== "COMPLETED") {
          throw failureForMessage(message);
        }
        const hasPendingQueryResults = message.queryAttachments.some(
          (attachment) => !emittedAttachmentIds.has(attachment.attachmentId),
        );
        if (hasPendingQueryResults) {
          if (now() >= deadline) {
            throw new GenieError("Genie query-result polling deadline exceeded", "GENIE_TIMEOUT", 504, true);
          }
          await sleep(delayMs, dependencies.signal);
          delayMs = Math.min(polling.maxDelayMs, Math.ceil(delayMs * polling.multiplier));
          continue;
        }
        yield {
          type: "message_result",
          data: {
            conversationId: message.conversationId,
            messageId: message.messageId,
            answer: message.answer,
            suggestedQuestions: message.suggestedQuestions,
            queryAttachmentIds: message.queryAttachments.map((attachment) => attachment.attachmentId),
          },
        };
        dependencies.onComplete?.({ queryResultCount: emittedAttachmentIds.size });
        return;
      }

      if (now() >= deadline) {
        throw new GenieError("Genie polling deadline exceeded", "GENIE_TIMEOUT", 504, true);
      }
      await sleep(delayMs, dependencies.signal);
      delayMs = Math.min(polling.maxDelayMs, Math.ceil(delayMs * polling.multiplier));
      message = await readWithRetry(
        () => dependencies.client.getMessage({
          spaceId: dependencies.spaceId,
          conversationId: message.conversationId,
          messageId: message.messageId,
          signal: dependencies.signal,
        }),
        readRetryContext,
      );
    }
  } catch (error) {
    const normalized = toGenieError(error);
    dependencies.onError?.(normalized);
    yield toGenieStreamErrorEvent(normalized, dependencies.requestId);
  }
}

export async function* streamDemoGenieMessage(
  request: GenieMessageRequest,
  dependencies: DemoDependencies,
): AsyncGenerator<GenieStreamEvent> {
  const sleep = dependencies.sleep ?? sleepWithAbort;
  const statusDelayMs = dependencies.statusDelayMs ?? 180;
  const conversationId = request.conversationId ?? "11111111111111111111111111111111";

  try {
    yield {
      type: "message_start",
      data: { conversationId, messageId: DEMO_GENIE_MESSAGE_ID },
    };
    for (const status of DEMO_GENIE_STATUS_SEQUENCE) {
      if (statusDelayMs > 0) {
        await sleep(statusDelayMs, dependencies.signal);
      }
      yield statusEvent(status);
      if (status === "EXECUTING_QUERY") {
        yield { type: "query_result", data: DEMO_GENIE_QUERY_RESULT };
      }
    }
    yield { type: "message_result", data: createDemoGenieMessageResult(conversationId) };
    dependencies.onComplete?.({ queryResultCount: 1 });
  } catch (error) {
    const normalized = toGenieError(error);
    dependencies.onError?.(normalized);
    yield toGenieStreamErrorEvent(normalized, dependencies.requestId);
  }
}
