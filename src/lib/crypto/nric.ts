import { createHmac } from "crypto";

function getHmacKey(): Buffer {
  const key = process.env.NRIC_HMAC_KEY;
  if (!key) throw new Error("NRIC_HMAC_KEY not set");
  return Buffer.from(key, "hex");
}

/**
 * Hash NRIC/FIN with HMAC-SHA256 for secure lookup.
 * Full NRIC is NEVER stored — only the hash.
 */
export function hashNric(nric: string): string {
  const key = getHmacKey();
  return createHmac("sha256", key).update(nric.toUpperCase().trim()).digest("hex");
}

/**
 * Extract last 4 characters of NRIC for display.
 * e.g., "S1234567A" → "567A"
 */
export function nricLast4(nric: string): string {
  const cleaned = nric.toUpperCase().trim();
  return cleaned.slice(-4);
}

/**
 * Mask NRIC for display: "S1234567A" → "•••••67A"
 * Only last 4 visible.
 */
export function maskNric(nricLast4: string): string {
  return `•••••${nricLast4}`;
}

/**
 * Validate NRIC/FIN format.
 * Singapore NRIC: [STFGM][0-9]{7}[A-Z]
 */
export function isValidNric(nric: string): boolean {
  return /^[STFGM]\d{7}[A-Z]$/i.test(nric.trim());
}
