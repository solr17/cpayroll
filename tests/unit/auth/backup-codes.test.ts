import { describe, it, expect } from "vitest";
import { generateBackupCodes, hashBackupCode, verifyBackupCode } from "@/lib/auth/backup-codes";

describe("generateBackupCodes", () => {
  it("returns the requested number of codes", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
  });

  it("returns codes in XXXX-XXXX format", () => {
    const codes = generateBackupCodes(5);
    const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    for (const code of codes) {
      expect(code).toMatch(pattern);
    }
  });

  it("returns all unique codes", () => {
    const codes = generateBackupCodes(20);
    const unique = new Set(codes);
    expect(unique.size).toBe(20);
  });

  it("returns only uppercase alphanumeric characters", () => {
    const codes = generateBackupCodes(10);
    for (const code of codes) {
      const withoutDash = code.replace("-", "");
      expect(withoutDash).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it("returns 0 codes when count is 0", () => {
    const codes = generateBackupCodes(0);
    expect(codes).toHaveLength(0);
  });

  it("returns 1 code when count is 1", () => {
    const codes = generateBackupCodes(1);
    expect(codes).toHaveLength(1);
  });
});

describe("hashBackupCode", () => {
  it("returns a hex string", () => {
    const hash = hashBackupCode("ABCD-1234");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic — same input gives same hash", () => {
    const hash1 = hashBackupCode("ABCD-1234");
    const hash2 = hashBackupCode("ABCD-1234");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = hashBackupCode("ABCD-1234");
    const hash2 = hashBackupCode("WXYZ-5678");
    expect(hash1).not.toBe(hash2);
  });

  it("normalises to uppercase before hashing (case insensitive)", () => {
    const hash1 = hashBackupCode("abcd-1234");
    const hash2 = hashBackupCode("ABCD-1234");
    expect(hash1).toBe(hash2);
  });

  it("trims whitespace before hashing", () => {
    const hash1 = hashBackupCode("  ABCD-1234  ");
    const hash2 = hashBackupCode("ABCD-1234");
    expect(hash1).toBe(hash2);
  });
});

describe("verifyBackupCode", () => {
  it("returns valid=true for a correct code and removes it from remaining", () => {
    const code = "ABCD-1234";
    const hashed = [hashBackupCode(code), hashBackupCode("WXYZ-5678")];
    const result = verifyBackupCode(code, hashed);
    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining).not.toContain(hashBackupCode(code));
  });

  it("returns valid=false for an invalid code and keeps remaining unchanged", () => {
    const hashed = [hashBackupCode("ABCD-1234")];
    const result = verifyBackupCode("WRONG-CODE", hashed);
    expect(result.valid).toBe(false);
    expect(result.remaining).toEqual(hashed);
  });

  it("is case insensitive when verifying", () => {
    const code = "ABCD-1234";
    const hashed = [hashBackupCode(code)];
    const result = verifyBackupCode("abcd-1234", hashed);
    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(0);
  });

  it("used code cannot be reused", () => {
    const code = "ABCD-1234";
    const hashed = [hashBackupCode(code)];
    const first = verifyBackupCode(code, hashed);
    expect(first.valid).toBe(true);

    const second = verifyBackupCode(code, first.remaining);
    expect(second.valid).toBe(false);
    expect(second.remaining).toHaveLength(0);
  });

  it("returns valid=false for empty hashed codes array", () => {
    const result = verifyBackupCode("ABCD-1234", []);
    expect(result.valid).toBe(false);
    expect(result.remaining).toEqual([]);
  });

  it("does not mutate the original hashed codes array", () => {
    const code = "ABCD-1234";
    const hashed = [hashBackupCode(code), hashBackupCode("WXYZ-5678")];
    const originalLength = hashed.length;
    verifyBackupCode(code, hashed);
    expect(hashed).toHaveLength(originalLength);
  });
});
