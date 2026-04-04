import type { NextRequest } from "next/server";
import logger from "@/lib/logger";

/**
 * Log an HTTP request with method, path, status, duration, and client IP.
 *
 * Query parameters that might contain tokens (e.g. "token", "secret", "key")
 * are redacted from the logged path.
 *
 * This is a helper that route handlers can optionally call — it is NOT
 * middleware, so it does not add overhead to every request.
 */
export function logRequest(
  request: NextRequest,
  response: { status: number },
  durationMs: number,
): void {
  const url = new URL(request.url);

  // Redact sensitive query params
  const sensitiveParams = ["token", "secret", "key", "password", "code"];
  for (const param of sensitiveParams) {
    if (url.searchParams.has(param)) {
      url.searchParams.set(param, "[REDACTED]");
    }
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const logData = {
    method: request.method,
    path: url.pathname + (url.search ? url.search : ""),
    status: response.status,
    durationMs: Math.round(durationMs),
    ip,
  };

  if (response.status >= 500) {
    logger.error(logData, "Request failed");
  } else if (response.status >= 400) {
    logger.warn(logData, "Request error");
  } else {
    logger.info(logData, "Request completed");
  }
}
