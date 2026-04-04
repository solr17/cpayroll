import { z } from "zod";

/**
 * Environment variable validation.
 * Validates required vars at import time — app fails fast with clear errors.
 */

/** Treat empty strings as undefined (env vars are "" when set but blank in .env) */
const optionalUrl = z
  .union([z.string().url(), z.literal("")])
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalStr = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const envSchema = z.object({
  // === REQUIRED in all environments ===
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "ENCRYPTION_KEY must be 64 hex characters (32 bytes)"),
  NRIC_HMAC_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "NRIC_HMAC_KEY must be 64 hex characters (32 bytes)"),

  // === OPTIONAL — features degrade gracefully ===
  NEXTAUTH_URL: z.string().url().optional().default("http://localhost:3000"),

  // Redis (rate limiting — falls back to in-memory)
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalStr,

  // Stripe (billing — disabled if not set)
  STRIPE_SECRET_KEY: optionalStr,
  STRIPE_WEBHOOK_SECRET: optionalStr,
  NEXT_PUBLIC_STRIPE_PRICE_PRO: optionalStr,
  NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE: optionalStr,

  // Email (logs to console if not set)
  SMTP_HOST: optionalStr,
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: optionalStr,
  SMTP_PASS: optionalStr,
  SMTP_FROM: optionalStr,

  // Sentry (disabled if not set)
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_DSN: optionalUrl,

  // PostHog (disabled if not set)
  NEXT_PUBLIC_POSTHOG_KEY: optionalStr,
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,

  // Bank APIs (disabled if not set)
  DBS_RAPID_CLIENT_ID: optionalStr,
  DBS_RAPID_CLIENT_SECRET: optionalStr,
  DBS_RAPID_BASE_URL: optionalUrl,
  DBS_RAPID_DEBIT_ACCOUNT: optionalStr,

  // S3/Storage (optional)
  S3_ENDPOINT: optionalStr,
  S3_BUCKET: optionalStr,
  S3_ACCESS_KEY: optionalStr,
  S3_SECRET_KEY: optionalStr,
  S3_REGION: z.string().optional().default("ap-southeast-1"),

  // Cron
  CRON_SECRET: optionalStr,

  // Logging
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .optional()
    .default("info"),

  // App
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  NEXT_PUBLIC_APP_URL: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .default("http://localhost:3000")
    .transform((v) => (v === "" ? "http://localhost:3000" : v)),
  DEMO_MODE: optionalStr,
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // Skip validation during build (Next.js runs module code during build)
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return process.env as unknown as Env;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    console.error(`\nEnvironment validation failed:\n${errors.join("\n")}\n`);
    // In development, warn but don't crash (some vars may not be needed for current work)
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required environment variables");
    }
  }

  return (result.success ? result.data : process.env) as Env;
}

export const env = validateEnv();
