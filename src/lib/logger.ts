import pino from "pino";

const VALID_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];
const level = VALID_LEVELS.includes(process.env.LOG_LEVEL ?? "") ? process.env.LOG_LEVEL! : "info";

const logger = pino({
  level,
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
