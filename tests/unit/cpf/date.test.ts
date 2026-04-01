import { describe, it, expect } from "vitest";
import {
  getAgeBandForMonth,
  rateChangeEffectiveMonth,
  daysInMonth,
  prorationDays,
} from "@/lib/utils/date";

describe("date utilities", () => {
  describe("getAgeBandForMonth", () => {
    it("calculates age correctly as of 1st of month", () => {
      // Born 1970-03-15, checking March 2026 → age 55 (as of 1st March)
      expect(getAgeBandForMonth("1970-03-15", "2026-03-01")).toBe(55);
      // Born 1970-03-15, checking April 2026 → age 56 (as of 1st April)
      expect(getAgeBandForMonth("1970-03-15", "2026-04-01")).toBe(56);
    });

    it("handles year boundaries", () => {
      // Born 1970-12-25, checking Dec 2025 → age 55
      expect(getAgeBandForMonth("1970-12-25", "2025-12-01")).toBe(54);
      // Born 1970-12-25, checking Jan 2026 → age 55
      expect(getAgeBandForMonth("1970-12-25", "2026-01-01")).toBe(55);
    });
  });

  describe("rateChangeEffectiveMonth", () => {
    it("returns 1st of the month after birthday", () => {
      const result = rateChangeEffectiveMonth("2026-03-15");
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(3); // April (0-indexed)
      expect(result.getDate()).toBe(1);
    });

    it("handles December birthday → January next year", () => {
      const result = rateChangeEffectiveMonth("2025-12-20");
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0); // January
    });
  });

  describe("daysInMonth", () => {
    it("returns correct days", () => {
      expect(daysInMonth("2026-01-01")).toBe(31);
      expect(daysInMonth("2026-02-01")).toBe(28);
      expect(daysInMonth("2024-02-01")).toBe(29); // leap year
      expect(daysInMonth("2026-04-01")).toBe(30);
    });
  });

  describe("prorationDays", () => {
    it("returns full month for no join/leave", () => {
      const result = prorationDays(new Date("2026-03-01"), new Date("2026-03-31"));
      expect(result.daysWorked).toBe(31);
      expect(result.totalDays).toBe(31);
    });

    it("pro-rates for mid-month joiner", () => {
      const result = prorationDays(
        new Date("2026-03-01"),
        new Date("2026-03-31"),
        new Date("2026-03-15"),
      );
      expect(result.daysWorked).toBe(17); // 15th to 31st inclusive
      expect(result.totalDays).toBe(31);
    });

    it("pro-rates for mid-month leaver", () => {
      const result = prorationDays(
        new Date("2026-03-01"),
        new Date("2026-03-31"),
        null,
        new Date("2026-03-10"),
      );
      expect(result.daysWorked).toBe(10); // 1st to 10th inclusive
      expect(result.totalDays).toBe(31);
    });
  });
});
