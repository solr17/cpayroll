export async function register() {
  // Environment validation (non-fatal — just warns)
  try {
    await import("@/lib/env");
  } catch {
    // Validation logged its own errors — don't crash the app
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      await import("../sentry.server.config");
    } catch {
      // Sentry init may fail if DSN not configured — that's fine
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    try {
      await import("../sentry.edge.config");
    } catch {
      // Sentry init may fail if DSN not configured — that's fine
    }
  }
}
