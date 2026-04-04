/**
 * HMAC-SHA256 signed password reset tokens.
 * Same pattern as session-token.ts — base64url(payload).base64url(hmac).
 *
 * Tokens expire after 1 hour.
 */

import { createHmac, timingSafeEqual } from "crypto";

interface ResetPayload {
  userId: string;
  exp: number; // expires at (epoch ms)
}

const RESET_TOKEN_DURATION_MS = 60 * 60 * 1000; // 1 hour

function getSigningKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET or NEXTAUTH_SECRET must be set");
  // Use a different context string so reset tokens can't be confused with session tokens
  return Buffer.from(`password-reset:${secret}`, "utf-8");
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function sign(payload: string): string {
  const hmac = createHmac("sha256", getSigningKey());
  hmac.update(payload);
  return base64url(hmac.digest());
}

/**
 * Create a signed password reset token for a user.
 * Token is valid for 1 hour.
 */
export function createResetToken(userId: string): string {
  const payload: ResetPayload = {
    userId,
    exp: Date.now() + RESET_TOKEN_DURATION_MS,
  };

  const payloadStr = base64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const signature = sign(payloadStr);
  return `${payloadStr}.${signature}`;
}

/**
 * Verify and decode a password reset token.
 * Returns { userId } if valid, or null if invalid/expired.
 */
export function verifyResetToken(token: string): { userId: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const payloadStr = parts[0]!;
    const providedSig = parts[1]!;
    const expectedSig = sign(payloadStr);

    // Timing-safe comparison to prevent timing attacks
    const sigBuf = fromBase64url(providedSig);
    const expectedBuf = fromBase64url(expectedSig);

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(fromBase64url(payloadStr).toString("utf-8")) as ResetPayload;

    // Check expiry
    if (payload.exp < Date.now()) return null;

    return { userId: payload.userId };
  } catch {
    return null;
  }
}
