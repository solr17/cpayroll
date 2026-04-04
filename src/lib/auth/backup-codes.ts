/**
 * 2FA Backup Codes — generate, hash, and verify one-time-use backup codes.
 * Uses Node.js crypto — no external library needed.
 */

import crypto from "crypto";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const HALF_LENGTH = 4;

/**
 * Generate `count` random backup codes in XXXX-XXXX format (uppercase alphanumeric).
 * Returns plaintext codes — the caller must hash before storing.
 */
export function generateBackupCodes(count: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let left = "";
    let right = "";
    for (let j = 0; j < HALF_LENGTH; j++) {
      left += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
      right += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    }
    codes.push(`${left}-${right}`);
  }
  return codes;
}

/**
 * Hash a single backup code with SHA-256.
 * Normalises to uppercase and strips whitespace before hashing so the user
 * can type the code in any case.
 */
export function hashBackupCode(code: string): string {
  const normalised = code.trim().toUpperCase();
  return crypto.createHash("sha256").update(normalised).digest("hex");
}

/**
 * Verify a plaintext backup code against an array of hashed codes.
 * Returns `{ valid: true, remaining }` with the matched hash removed,
 * or `{ valid: false, remaining }` with the original array unchanged.
 */
export function verifyBackupCode(
  code: string,
  hashedCodes: string[],
): { valid: boolean; remaining: string[] } {
  const hash = hashBackupCode(code);
  const idx = hashedCodes.indexOf(hash);

  if (idx === -1) {
    return { valid: false, remaining: hashedCodes };
  }

  const remaining = [...hashedCodes];
  remaining.splice(idx, 1);
  return { valid: true, remaining };
}
