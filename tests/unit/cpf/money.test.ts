import { describe, it, expect } from "vitest";
import {
  centsToDisplay,
  centsToCurrency,
  displayToCents,
  multiplyByRate,
  prorateCents,
  overtimeHourlyRateCents,
  addCents,
  subtractCents,
} from "@/lib/utils/money";

describe("money utilities", () => {
  describe("centsToDisplay", () => {
    it("formats positive amounts", () => {
      expect(centsToDisplay(123456)).toBe("1,234.56");
      expect(centsToDisplay(100)).toBe("1.00");
      expect(centsToDisplay(5)).toBe("0.05");
      expect(centsToDisplay(0)).toBe("0.00");
    });

    it("formats negative amounts", () => {
      expect(centsToDisplay(-50000)).toBe("-500.00");
    });
  });

  describe("centsToCurrency", () => {
    it("adds S$ prefix", () => {
      expect(centsToCurrency(800000)).toBe("S$8,000.00");
    });
  });

  describe("displayToCents", () => {
    it("parses display strings", () => {
      expect(displayToCents("1,234.56")).toBe(123456);
      expect(displayToCents("8000.00")).toBe(800000);
      expect(displayToCents("0.05")).toBe(5);
    });

    it("handles S$ prefix", () => {
      expect(displayToCents("S$1,234.56")).toBe(123456);
    });
  });

  describe("multiplyByRate", () => {
    it("rounds down for employee CPF (floor)", () => {
      // S$5,000 * 20% = S$1,000.00 — exact
      expect(multiplyByRate(500000, 0.2, "floor")).toBe(100000);
      // S$3,333 * 20% = S$666.60 — floor to S$666
      expect(multiplyByRate(333300, 0.2, "floor")).toBe(66660);
    });

    it("rounds to nearest for total CPF (round)", () => {
      // S$5,000 * 37% = S$1,850.00 — exact
      expect(multiplyByRate(500000, 0.37, "round")).toBe(185000);
    });

    it("rounds up for ceil mode", () => {
      expect(multiplyByRate(100, 0.333, "ceil")).toBe(34);
    });
  });

  describe("prorateCents", () => {
    it("pro-rates by calendar days (floor)", () => {
      // S$5,000 * 15/30 = S$2,500
      expect(prorateCents(500000, 15, 30)).toBe(250000);
      // S$5,000 * 10/31 = S$1,612.90... → floor to S$1,612
      expect(prorateCents(500000, 10, 31)).toBe(161290);
    });
  });

  describe("overtimeHourlyRateCents", () => {
    it("calculates OT rate per MOM formula", () => {
      // S$3,000 / (26 * 8) * 1.5 = S$21.63... → round to S$21.63
      const rate = overtimeHourlyRateCents(300000, 1.5);
      expect(rate).toBe(2163);
    });
  });

  describe("addCents / subtractCents", () => {
    it("adds multiple values", () => {
      expect(addCents(100, 200, 300)).toBe(600);
    });

    it("subtracts", () => {
      expect(subtractCents(1000, 400)).toBe(600);
    });
  });
});
