import { describe, it, expect, vi } from "vitest";

process.env.NEXTAUTH_SECRET = "test-secret-minimum-32-chars-long!!";

import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";

describe("createSessionToken", () => {
  it("returns a string with a dot separator", () => {
    const token = createSessionToken("user-1", "admin", "company-1");
    expect(token).toContain(".");
    expect(token.split(".")).toHaveLength(2);
  });

  it("encodes userId, role, and companyId in the payload", () => {
    const token = createSessionToken("user-1", "admin", "company-1");
    const payloadStr = token.split(".")[0]!;
    const padded = payloadStr.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    expect(payload.userId).toBe("user-1");
    expect(payload.role).toBe("admin");
    expect(payload.companyId).toBe("company-1");
  });

  it("includes iat and exp timestamps in payload", () => {
    const token = createSessionToken("user-1", "admin", "company-1");
    const payloadStr = token.split(".")[0]!;
    const padded = payloadStr.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("sets expiry 8 hours from now", () => {
    const token = createSessionToken("user-1", "admin", "company-1");
    const payloadStr = token.split(".")[0]!;
    const padded = payloadStr.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
  });
});

describe("verifySessionToken", () => {
  it("returns the payload for a valid token", () => {
    const token = createSessionToken("user-1", "admin", "company-1");
    const result = verifySessionToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-1");
    expect(result!.role).toBe("admin");
    expect(result!.companyId).toBe("company-1");
  });

  it("returns null for an expired token", () => {
    const realNow = Date.now();
    // Create token 9 hours in the past so it's already expired
    vi.spyOn(Date, "now").mockReturnValue(realNow - 9 * 60 * 60 * 1000);
    const token = createSessionToken("user-1", "admin", "company-1");
    vi.spyOn(Date, "now").mockReturnValue(realNow);
    const result = verifySessionToken(token);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("returns null for a tampered signature", () => {
    const token = createSessionToken("user-1", "admin", "company-1");
    const parts = token.split(".");
    const tampered = parts[0] + ".AAAA" + parts[1]!.slice(4);
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("returns null for a modified payload", () => {
    const token = createSessionToken("user-1", "admin", "company-1");
    const parts = token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({
        userId: "hacker",
        role: "admin",
        companyId: "company-1",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 99999,
      }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(verifySessionToken(fakePayload + "." + parts[1])).toBeNull();
  });

  it("returns null for a malformed string without dot", () => {
    expect(verifySessionToken("nodothere")).toBeNull();
  });

  it("returns null for a string with too many dots", () => {
    expect(verifySessionToken("a.b.c")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifySessionToken("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(verifySessionToken("!!!garbage!!!")).toBeNull();
  });
});
