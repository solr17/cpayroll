/**
 * HMAC-SHA256 signed session tokens.
 * Replaces insecure base64 JSON with tamper-proof signed tokens.
 *
 * Format: base64url(payload).base64url(hmac-sha256(payload))
 */

import { createHmac, timingSafeEqual } from "crypto";

interface SessionPayload {
  userId: string;
  role: string;
  companyId: string;
  iat: number; // issued at (epoch seconds)
  exp: number; // expires at (epoch seconds)
}

const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

function getSigningKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET or NEXTAUTH_SECRET must be set");
  return Buffer.from(secret, "utf-8");
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
 * Create a signed session token.
 */
export function createSessionToken(userId: string, role: string, companyId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId,
    role,
    companyId,
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  };

  const payloadStr = base64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const signature = sign(payloadStr);
  return `${payloadStr}.${signature}`;
}

/**
 * Verify and decode a signed session token.
 * Returns null if invalid or expired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const payloadStr = parts[0];
    const providedSig = parts[1];
    if (!payloadStr || !providedSig) return null;

    const expectedSig = sign(payloadStr);

    // Timing-safe comparison to prevent timing attacks
    const sigBuf = fromBase64url(providedSig);
    const expectedBuf = fromBase64url(expectedSig);

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(fromBase64url(payloadStr).toString("utf-8")) as SessionPayload;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}
