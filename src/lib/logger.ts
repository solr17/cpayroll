import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV !== "production"
    ? {
        transport: { target: "pino/file", options: { destination: 1 } }, // stdout in dev
      }
    : {}),
  redact: {
    paths: [
      "password",
      "passwordHash",
      "secret",
      "totpSecret",
      "nric",
      "nricFin",
      "bankDetails",
      "encrypted",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

export default logger;
export type Logger = typeof logger;
