/**
 * CSRF token generation and validation.
 * Uses HMAC of session token with a server secret.
 */

import crypto from "crypto";

const CSRF_SECRET =
  process.env.CSRF_SECRET ?? process.env.NEXTAUTH_SECRET ?? "clinicpay-csrf-default-secret";

/**
 * Generate a CSRF token from a session token.
 * The token is an HMAC-SHA256 of the session token using a server-side secret.
 */
export function generateCsrfToken(sessionToken: string): string {
  return crypto.createHmac("sha256", CSRF_SECRET).update(sessionToken).digest("hex");
}

/**
 * Validate a CSRF token against a session token.
 * Recomputes the HMAC and compares using timing-safe comparison.
 */
export function validateCsrfToken(token: string, sessionToken: string): boolean {
  const expected = generateCsrfToken(sessionToken);
  if (token.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
