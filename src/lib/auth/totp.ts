/**
 * TOTP (Time-based One-Time Password) implementation per RFC 6238.
 * Uses Node.js crypto — no external library needed.
 */

import crypto from "crypto";

const TOTP_PERIOD = 30; // 30-second time step
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";

/**
 * Base32 encoding/decoding helpers.
 */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/[=\s]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]!);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Generate a random TOTP secret (base32 encoded, 20 bytes / 160 bits).
 */
export function generateTotpSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generate an otpauth URI for QR code scanning.
 */
export function generateTotpUri(secret: string, email: string, issuer: string): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Generate HOTP value for a given counter.
 */
function generateHotp(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  const hmac = crypto.createHmac(TOTP_ALGORITHM, secret);
  hmac.update(counterBuf);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1]! & 0x0f;
  const code =
    ((hash[offset]! & 0x7f) << 24) |
    ((hash[offset + 1]! & 0xff) << 16) |
    ((hash[offset + 2]! & 0xff) << 8) |
    (hash[offset + 3]! & 0xff);

  const otp = code % Math.pow(10, TOTP_DIGITS);
  return String(otp).padStart(TOTP_DIGITS, "0");
}

/**
 * Verify a TOTP token.
 * Allows 1 time step drift (previous/current/next period).
 */
export function verifyTotp(secret: string, token: string): boolean {
  if (!token || token.length !== TOTP_DIGITS) return false;

  const secretBuffer = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000);
  const currentCounter = BigInt(Math.floor(now / TOTP_PERIOD));

  // Check current, previous, and next time steps (drift window of 1)
  for (let i = -1; i <= 1; i++) {
    const counter = currentCounter + BigInt(i);
    const expected = generateHotp(secretBuffer, counter);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}
