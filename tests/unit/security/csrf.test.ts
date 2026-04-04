import { describe, it, expect, beforeAll } from "vitest";

// Set env var before importing the module (it reads NEXTAUTH_SECRET at import time)
beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-minimum-32-chars-long!!";
});

// Dynamic import so the env var is set first
let generateCsrfToken: (sessionToken: string) => string;
let validateCsrfToken: (token: string, sessionToken: string) => boolean;

beforeAll(async () => {
  const mod = await import("@/lib/security/csrf");
  generateCsrfToken = mod.generateCsrfToken;
  validateCsrfToken = mod.validateCsrfToken;
});

describe("generateCsrfToken", () => {
  it("returns a hex string", () => {
    const token = generateCsrfToken("session-abc-123");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same session token", () => {
    const token1 = generateCsrfToken("session-abc-123");
    const token2 = generateCsrfToken("session-abc-123");
    expect(token1).toBe(token2);
  });

  it("produces different tokens for different session tokens", () => {
    const token1 = generateCsrfToken("session-abc-123");
    const token2 = generateCsrfToken("session-xyz-789");
    expect(token1).not.toBe(token2);
  });
});

describe("validateCsrfToken", () => {
  it("returns true for a valid token", () => {
    const sessionToken = "session-abc-123";
    const csrf = generateCsrfToken(sessionToken);
    expect(validateCsrfToken(csrf, sessionToken)).toBe(true);
  });

  it("returns false for a wrong CSRF token", () => {
    const sessionToken = "session-abc-123";
    const wrongToken = "a".repeat(64);
    expect(validateCsrfToken(wrongToken, sessionToken)).toBe(false);
  });

  it("returns false for an empty CSRF token", () => {
    expect(validateCsrfToken("", "session-abc-123")).toBe(false);
  });

  it("returns false when session token differs", () => {
    const csrf = generateCsrfToken("session-abc-123");
    expect(validateCsrfToken(csrf, "session-different")).toBe(false);
  });

  it("returns false for non-hex input", () => {
    expect(validateCsrfToken("not-a-hex-string", "session-abc-123")).toBe(false);
  });

  it("returns false for token with wrong length", () => {
    const csrf = generateCsrfToken("session-abc-123");
    expect(validateCsrfToken(csrf.slice(0, 32), "session-abc-123")).toBe(false);
  });
});
