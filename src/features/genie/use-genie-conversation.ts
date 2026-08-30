"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  GenieConversationMessage,
  GenieConversationSnapshot,
  GenieDashboardContext,
  GenieMessageStatus,
  GeniePublicErrorCode,
  GenieQueryResult,
  GenieStreamEvent,
} from "@/features/genie/contract";

export type GenieClientError = {
  code: GeniePublicErrorCode;
  message: string;
  requestId?: string;
  retryable: boolean;
  submissionMayHaveStarted?: boolean;
};

export type GenieUiMessage = GenieConversationMessage & {
  serverMessageId?: string;
  trackingStopped?: boolean;
  statusHistory: GenieMessageStatus[];
  queryResults: GenieQueryResult[];
  suggestedQuestions: string[];
  context?: GenieDashboardContext;
  error?: GenieClientError;
};

export type GenieSessionConversation = {
  localId: string;
  conversationId: string | null;
  messages: GenieUiMessage[];
  trackingStopped: boolean;
  startedAt: string;
  updatedAt: string;
};

type SendMessageOptions = {
  context?: GenieDashboardContext;
};

function requiresNewConversation(session: GenieSessionConversation) {
  return session.trackingStopped || Boolean(session.messages.at(-1)?.error?.submissionMayHaveStarted);
}

function createLocalId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptySession(): GenieSessionConversation {
  const createdAt = new Date().toISOString();
  return {
    localId: createLocalId("conversation"),
    conversationId: null,
    messages: [],
    trackingStopped: false,
    startedAt: createdAt,
    updatedAt: createdAt,
  };
}

const genieStatuses = new Set<GenieMessageStatus>([
  "SUBMITTED",
  "FETCHING_METADATA",
  "FILTERING_CONTEXT",
  "ASKING_AI",
  "PENDING_WAREHOUSE",
  "EXECUTING_QUERY",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "QUERY_RESULT_EXPIRED",
]);

const genieErrorCodes = new Set<GeniePublicErrorCode>([
  "INVALID_REQUEST",
  "UNKNOWN_SPACE",
  "GENIE_AUTH_REQUIRED",
  "GENIE_PERMISSION_DENIED",
  "GENIE_TIMEOUT",
  "GENIE_CANCELLED",
  "GENIE_RESULT_EXPIRED",
  "GENIE_UNAVAILABLE",
  "UNEXPECTED_ERROR",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isQueryResult(value: unknown): value is GenieQueryResult {
  if (!isRecord(value)) {
    return false;
  }
  const validColumns = Array.isArray(value.columns) && value.columns.every((column) =>
    isRecord(column) && typeof column.name === "string" && typeof column.type === "string",
  );
  const validRows = Array.isArray(value.rows) && value.rows.every((row) =>
    Array.isArray(row) && row.every((cell) =>
      cell === null || typeof cell === "string" || typeof cell === "boolean" || (typeof cell === "number" && Number.isFinite(cell)),
    ),
  );
  return (
    typeof value.attachmentId === "string" &&
    (value.statementId === null || typeof value.statementId === "string") &&
    (value.title === null || typeof value.title === "string") &&
    (value.description === null || typeof value.description === "string") &&
    (value.sql === null || typeof value.sql === "string") &&
    validColumns &&
    validRows &&
    typeof value.rowCount === "number" &&
    Number.isInteger(value.rowCount) &&
    value.rowCount >= 0 &&
    typeof value.truncated === "boolean"
  );
}

function isGenieStreamEvent(value: unknown): value is GenieStreamEvent {
  if (!isRecord(value) || !isRecord(value.data)) {
    return false;
  }
  const data = value.data;

  switch (value.type) {
    case "message_start":
      return typeof data.conversationId === "string" && typeof data.messageId === "string";
    case "status":
      return typeof data.status === "string" && genieStatuses.has(data.status as GenieMessageStatus);
    case "message_result":
      return (
        typeof data.conversationId === "string" &&
        typeof data.messageId === "string" &&
        (data.answer === null || typeof data.answer === "string") &&
        isStringArray(data.suggestedQuestions) &&
        isStringArray(data.queryAttachmentIds)
      );
    case "query_result":
      return isQueryResult(data);
    case "error":
      return (
        typeof data.code === "string" &&
        genieErrorCodes.has(data.code as GeniePublicErrorCode) &&
        typeof data.message === "string" &&
        typeof data.requestId === "string" &&
        typeof data.retryable === "boolean"
      );
    default:
      return false;
  }
}

function parseSseBlock(block: string): GenieStreamEvent | null {
  let eventName = "";
  const dataLines: string[] = [];

  block.split("\n").forEach((rawLine) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  });

  const serializedData = dataLines.join("\n");
  if (!serializedData || serializedData === "[DONE]") {
    return null;
  }

  let parsedData: unknown;
  try {
    parsedData = JSON.parse(serializedData);
  } catch {
    throw new Error("Invalid Genie event payload");
  }
  if (isGenieStreamEvent(parsedData)) {
    return parsedData;
  }
  const combinedEvent = { type: eventName, data: parsedData };
  if (isGenieStreamEvent(combinedEvent)) {
    return combinedEvent;
  }
  throw new Error("Unexpected Genie event contract");
}

async function consumeGenieStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: GenieStreamEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex >= 0) {
        const event = parseSseBlock(buffer.slice(0, separatorIndex));
        buffer = buffer.slice(separatorIndex + 2);
        if (event) {
          onEvent(event);
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode();
    const trailingEvent = parseSseBlock(buffer);
    if (trailingEvent) {
      onEvent(trailingEvent);
    }
  } finally {
    reader.releaseLock();
  }
}

function fallbackError(message: string, retryable = true): GenieClientError {
  return {
    code: "GENIE_UNAVAILABLE",
    message,
    retryable,
  };
}

export function applyPostDispatchRetryPolicy(
  error: GenieClientError,
  requestMayHaveSubmitted: boolean,
): GenieClientError {
  return requestMayHaveSubmitted
    ? { ...error, retryable: false, submissionMayHaveStarted: true }
    : error;
}

async function readHttpError(response: Response): Promise<GenieClientError> {
  try {
    const payload = await response.json() as {
      error?: { code?: GeniePublicErrorCode; message?: string; requestId?: string; retryable?: boolean };
    };
    if (payload.error?.message) {
      const publicCode = payload.error.code && genieErrorCodes.has(payload.error.code)
        ? payload.error.code
        : "GENIE_UNAVAILABLE";
      return {
        code: publicCode,
        message: payload.error.message,
        requestId: payload.error.requestId,
        retryable: payload.error.retryable ?? (response.status === 429 || response.status >= 500),
      };
    }
  } catch {
    // The public fallback below deliberately hides an unreadable upstream response.
  }
  return fallbackError(
    "Genie est momentanément indisponible. Réessayez dans quelques instants.",
    response.status === 429 || response.status >= 500,
  );
}

export function useGenieConversation(alias: string) {
  const [initialSession] = useState(createEmptySession);
  const [sessions, setSessions] = useState<GenieSessionConversation[]>([initialSession]);
  const [activeSessionId, setActiveSessionId] = useState(initialSession.localId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStatus, setActiveStatus] = useState<GenieMessageStatus | null>(null);
  const [error, setError] = useState<GenieClientError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stoppedControllerRef = useRef<AbortController | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.localId === activeSessionId) ?? sessions[0]!,
    [activeSessionId, sessions],
  );

  const updateSession = useCallback((
    sessionId: string,
    updater: (session: GenieSessionConversation) => GenieSessionConversation,
  ) => {
    setSessions((currentSessions) => currentSessions.map((session) =>
      session.localId === sessionId ? updater(session) : session,
    ));
  }, []);

  const stopTracking = useCallback(() => {
    const abortController = abortControllerRef.current;
    if (!abortController) {
      return;
    }
    stoppedControllerRef.current = abortController;
    updateSession(activeSessionId, (session) => ({
      ...session,
      trackingStopped: true,
      updatedAt: new Date().toISOString(),
      messages: session.messages.map((message, index) =>
        message.role === "assistant" && index === session.messages.length - 1
          ? { ...message, trackingStopped: true }
          : message,
      ),
    }));
    abortController.abort();
  }, [activeSessionId, updateSession]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const sendMessage = useCallback(async (content: string, options: SendMessageOptions = {}) => {
    const normalizedContent = content.trim();
    if (!normalizedContent || isStreaming || requiresNewConversation(activeSession)) {
      return;
    }

    const sessionId = activeSession.localId;
    const conversationId = activeSession.conversationId;
    const now = new Date().toISOString();
    const assistantMessageId = createLocalId("assistant");
    const userMessage: GenieUiMessage = {
      id: createLocalId("user"),
      role: "user",
      content: normalizedContent,
      statusHistory: [],
      queryResults: [],
      suggestedQuestions: [],
      context: options.context,
      createdAt: now,
    };
    const assistantMessage: GenieUiMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "SUBMITTED",
      statusHistory: ["SUBMITTED"],
      queryResults: [],
      suggestedQuestions: [],
      createdAt: now,
    };

    updateSession(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, userMessage, assistantMessage],
      updatedAt: now,
    }));
    setError(null);
    setActiveStatus("SUBMITTED");
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let messageResultReceived = false;
    let streamErrorReceived = false;
    let requestMayHaveSubmitted = false;
    let expectedAttachmentIds: string[] = [];
    const receivedAttachmentIds = new Set<string>();

    function updateAssistant(updater: (message: GenieUiMessage) => GenieUiMessage) {
      updateSession(sessionId, (session) => ({
        ...session,
        messages: session.messages.map((message) => message.id === assistantMessageId ? updater(message) : message),
        updatedAt: new Date().toISOString(),
      }));
    }

    try {
      const requestBody = JSON.stringify({
        content: normalizedContent,
        conversationId: conversationId ?? undefined,
        context: options.context,
      });
      requestMayHaveSubmitted = true;
      const response = await fetch(`/api/genie/${encodeURIComponent(alias)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: requestBody,
        signal: abortController.signal,
      });

      if (!response.ok) {
        requestMayHaveSubmitted = false;
        throw await readHttpError(response);
      }
      if (!response.body) {
        throw fallbackError("La réponse de Genie ne peut pas être lue. Réessayez.");
      }

      await consumeGenieStream(response.body, (event) => {
        switch (event.type) {
          case "message_start":
            updateSession(sessionId, (session) => ({
              ...session,
              conversationId: event.data.conversationId,
              updatedAt: new Date().toISOString(),
              messages: session.messages.map((message) => message.id === assistantMessageId
                ? { ...message, serverMessageId: event.data.messageId }
                : message),
            }));
            break;
          case "status":
            setActiveStatus(event.data.status);
            updateAssistant((message) => ({
              ...message,
              status: event.data.status,
              statusHistory: message.statusHistory.at(-1) === event.data.status
                ? message.statusHistory
                : [...message.statusHistory, event.data.status],
            }));
            break;
          case "message_result":
            messageResultReceived = true;
            expectedAttachmentIds = event.data.queryAttachmentIds;
            updateSession(sessionId, (session) => ({
              ...session,
              conversationId: event.data.conversationId,
              updatedAt: new Date().toISOString(),
              messages: session.messages.map((message) => message.id === assistantMessageId
                ? {
                    ...message,
                    serverMessageId: event.data.messageId,
                    content: event.data.answer ?? "",
                    suggestedQuestions: event.data.suggestedQuestions,
                  }
                : message),
            }));
            break;
          case "query_result":
            receivedAttachmentIds.add(event.data.attachmentId);
            updateAssistant((message) => ({
              ...message,
              queryResults: message.queryResults.some((result) => result.attachmentId === event.data.attachmentId)
                ? message.queryResults
                : [...message.queryResults, event.data],
            }));
            break;
          case "error": {
            streamErrorReceived = true;
            const streamError = applyPostDispatchRetryPolicy({
              code: event.data.code,
              message: event.data.message,
              requestId: event.data.requestId,
              retryable: event.data.retryable,
            }, requestMayHaveSubmitted);
            setError(streamError);
            setActiveStatus("FAILED");
            updateAssistant((message) => ({
              ...message,
              status: "FAILED",
              statusHistory: message.statusHistory.at(-1) === "FAILED"
                ? message.statusHistory
                : [...message.statusHistory, "FAILED"],
              error: streamError,
            }));
            break;
          }
        }
      });

      if (!streamErrorReceived && !messageResultReceived) {
        throw fallbackError("La réponse de Genie est incomplète. Réessayez dans quelques instants.");
      }
      if (!streamErrorReceived && expectedAttachmentIds.some((attachmentId) => !receivedAttachmentIds.has(attachmentId))) {
        throw fallbackError("Certaines données de la réponse sont incomplètes. Réessayez dans quelques instants.");
      }
      if (!streamErrorReceived) {
        setActiveStatus("COMPLETED");
        updateAssistant((message) => ({
          ...message,
          status: "COMPLETED",
          statusHistory: message.statusHistory.at(-1) === "COMPLETED"
            ? message.statusHistory
            : [...message.statusHistory, "COMPLETED"],
        }));
      }
    } catch (caughtError) {
      if (abortController.signal.aborted) {
        if (stoppedControllerRef.current === abortController) {
          setActiveStatus(null);
          updateAssistant((message) => ({ ...message, trackingStopped: true }));
        }
      } else {
        const rawClientError = caughtError && typeof caughtError === "object" && "code" in caughtError
          ? caughtError as GenieClientError
          : fallbackError("Impossible de joindre Genie. Vérifiez votre connexion puis réessayez.");
        const clientError = applyPostDispatchRetryPolicy(rawClientError, requestMayHaveSubmitted);
        setError(clientError);
        setActiveStatus("FAILED");
        updateAssistant((message) => ({
          ...message,
          status: "FAILED",
          statusHistory: message.statusHistory.at(-1) === "FAILED"
            ? message.statusHistory
            : [...message.statusHistory, "FAILED"],
          error: clientError,
        }));
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      if (stoppedControllerRef.current === abortController) {
        stoppedControllerRef.current = null;
      }
      setIsStreaming(false);
    }
  }, [activeSession, alias, isStreaming, updateSession]);

  const newConversation = useCallback(() => {
    if (abortControllerRef.current) {
      return;
    }
    const session = createEmptySession();
    setSessions((currentSessions) => [...currentSessions, session]);
    setActiveSessionId(session.localId);
    setActiveStatus(null);
    setError(null);
  }, []);

  const resumeConversation = useCallback((localId: string) => {
    if (abortControllerRef.current || !sessions.some((session) => session.localId === localId)) {
      return;
    }
    setActiveSessionId(localId);
    setActiveStatus(null);
    setError(null);
  }, [sessions]);

  const clearHistory = useCallback(() => {
    if (abortControllerRef.current) {
      return;
    }
    const session = createEmptySession();
    setSessions([session]);
    setActiveSessionId(session.localId);
    setActiveStatus(null);
    setError(null);
  }, []);

  const createSnapshot = useCallback((): GenieConversationSnapshot => ({
    alias,
    conversationId: activeSession.conversationId,
    messages: activeSession.messages.map(({ id, serverMessageId, role, content, status, queryResults, createdAt }) => ({
      id: serverMessageId ?? id,
      role,
      content,
      status,
      queryResults,
      createdAt,
    })),
    savedAt: new Date().toISOString(),
  }), [activeSession, alias]);

  return {
    messages: activeSession.messages,
    conversationId: activeSession.conversationId,
    sessions,
    activeSessionId,
    activeStatus,
    error,
    isStreaming,
    trackingStopped: activeSession.trackingStopped,
    requiresNewConversation: requiresNewConversation(activeSession),
    sendMessage,
    stopTracking,
    newConversation,
    resumeConversation,
    clearHistory,
    createSnapshot,
  };
}
