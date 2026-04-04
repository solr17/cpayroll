import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.NEXTAUTH_SECRET = "test-secret-minimum-32-chars-long!!";

import { createResetToken, verifyResetToken } from "@/lib/auth/reset-token";

describe("createResetToken", () => {
  it("returns a string with a dot separator", () => {
    const token = createResetToken("user-123");
    expect(token).toContain(".");
    expect(token.split(".")).toHaveLength(2);
  });

  it("contains the userId in the payload", () => {
    const token = createResetToken("user-123");
    const payloadStr = token.split(".")[0]!;
    // Decode base64url payload
    const padded = payloadStr.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    expect(payload.userId).toBe("user-123");
  });

  it("includes an expiry timestamp in the payload", () => {
    const token = createResetToken("user-123");
    const payloadStr = token.split(".")[0]!;
    const padded = payloadStr.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it("produces different tokens for different user IDs", () => {
    const token1 = createResetToken("user-123");
    const token2 = createResetToken("user-456");
    expect(token1).not.toBe(token2);
  });
});

describe("verifyResetToken", () => {
  it("returns userId for a valid token", () => {
    const token = createResetToken("user-123");
    const result = verifyResetToken(token);
    expect(result).toEqual({ userId: "user-123" });
  });

  it("returns null for an expired token", () => {
    // Mock Date.now to be in the past when creating, then restore to "future"
    const realNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(realNow - 2 * 60 * 60 * 1000); // 2 hours ago
    const token = createResetToken("user-123");
    vi.spyOn(Date, "now").mockReturnValue(realNow); // restore to now (past expiry)
    const result = verifyResetToken(token);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("returns null for a tampered token", () => {
    const token = createResetToken("user-123");
    const parts = token.split(".");
    // Tamper with the signature
    const tampered = parts[0] + ".AAAA" + parts[1]!.slice(4);
    expect(verifyResetToken(tampered)).toBeNull();
  });

  it("returns null for a malformed token without dot", () => {
    expect(verifyResetToken("nodothere")).toBeNull();
  });

  it("returns null for a malformed token with too many dots", () => {
    expect(verifyResetToken("a.b.c")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifyResetToken("")).toBeNull();
  });

  it("returns null for a token with modified payload", () => {
    const token = createResetToken("user-123");
    const parts = token.split(".");
    // Replace payload with a different one
    const fakePayload = Buffer.from(JSON.stringify({ userId: "hacker", exp: Date.now() + 999999 }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const fakeToken = fakePayload + "." + parts[1];
    expect(verifyResetToken(fakeToken)).toBeNull();
  });

  it("returns null for completely garbage input", () => {
    expect(verifyResetToken("!!!garbage!!!")).toBeNull();
  });
});
