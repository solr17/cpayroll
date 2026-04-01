import { describe, it, expect, vi } from "vitest";

// Mock env before importing
vi.stubEnv("NRIC_HMAC_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

import { hashNric, nricLast4, maskNric, isValidNric } from "@/lib/crypto/nric";

describe("NRIC utilities", () => {
  describe("hashNric", () => {
    it("produces consistent hash for same NRIC", () => {
      const hash1 = hashNric("S1234567A");
      const hash2 = hashNric("S1234567A");
      expect(hash1).toBe(hash2);
    });

    it("produces different hash for different NRIC", () => {
      const hash1 = hashNric("S1234567A");
      const hash2 = hashNric("S1234567B");
      expect(hash1).not.toBe(hash2);
    });

    it("is case-insensitive", () => {
      expect(hashNric("s1234567a")).toBe(hashNric("S1234567A"));
    });

    it("returns hex string", () => {
      const hash = hashNric("S1234567A");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("nricLast4", () => {
    it("extracts last 4 characters", () => {
      expect(nricLast4("S1234567A")).toBe("567A");
    });
  });

  describe("maskNric", () => {
    it("masks with dots and shows last 4", () => {
      expect(maskNric("567A")).toBe("•••••567A");
    });
  });

  describe("isValidNric", () => {
    it("accepts valid NRIC formats", () => {
      expect(isValidNric("S1234567A")).toBe(true);
      expect(isValidNric("T9876543Z")).toBe(true);
      expect(isValidNric("F1234567X")).toBe(true);
      expect(isValidNric("G5678901K")).toBe(true);
      expect(isValidNric("M1234567L")).toBe(true);
    });

    it("rejects invalid formats", () => {
      expect(isValidNric("1234567A")).toBe(false);
      expect(isValidNric("S123456A")).toBe(false);
      expect(isValidNric("S12345678A")).toBe(false);
      expect(isValidNric("X1234567A")).toBe(false);
      expect(isValidNric("")).toBe(false);
    });
  });
});
