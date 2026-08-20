import pino, { type DestinationStream, type Logger } from "pino";

const redactedPaths = [
  "authorization",
  "cookie",
  "token",
  "accessToken",
  "clientSecret",
  "DATABRICKS_TOKEN",
  "DATABRICKS_CLIENT_SECRET",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "config.auth.token",
  "config.auth.clientSecret",
];

export function createLogger(stream?: DestinationStream): Logger {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      redact: { paths: redactedPaths, censor: "[REDACTED]" },
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    stream,
  );
}

export const logger = createLogger();
