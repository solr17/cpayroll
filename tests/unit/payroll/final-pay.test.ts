import { describe, it, expect } from "vitest";
import {
  calculateDailyRate,
  calculateNoticePeriod,
  calculateLeaveEncashment,
  calculateProRatedAws,
  calculateRetrenchmentBenefit,
  calculateYearsOfService,
  calculateCompletedMonthsInYear,
  calculateFinalPay,
  calculateNoticePeriodPay,
} from "@/lib/payroll/final-pay";

describe("Final Pay Calculator", () => {
  // ─── Daily Rate ────────────────────────────────────────────────

  describe("calculateDailyRate", () => {
    it("calculates daily rate as basic / 26 (rounded)", () => {
      // S$3,000 = 300000 cents → 300000 / 26 = 11538.46... → 11538
      expect(calculateDailyRate(300000)).toBe(11538);
    });

    it("rounds to nearest cent", () => {
      // S$5,000 = 500000 cents → 500000 / 26 = 19230.769... → 19231
      expect(calculateDailyRate(500000)).toBe(19231);
    });

    it("returns 0 for zero salary", () => {
      expect(calculateDailyRate(0)).toBe(0);
    });

    it("returns 0 for negative salary", () => {
      expect(calculateDailyRate(-100000)).toBe(0);
    });
  });

  // ─── Notice Period ─────────────────────────────────────────────

  describe("calculateNoticePeriod", () => {
    it("returns 1 day for less than 26 weeks service", () => {
      // 25 weeks = ~175 days
      expect(calculateNoticePeriod("2025-01-01", "2025-06-01")).toBe(1);
    });

    it("returns 7 days for 26 weeks to less than 2 years", () => {
      expect(calculateNoticePeriod("2025-01-01", "2025-12-01")).toBe(7);
    });

    it("returns 14 days for 2 to less than 5 years", () => {
      expect(calculateNoticePeriod("2022-01-01", "2025-01-01")).toBe(14);
    });

    it("returns 28 days for 5+ years", () => {
      expect(calculateNoticePeriod("2018-01-01", "2025-01-01")).toBe(28);
    });

    it("returns 0 if termination is before hire", () => {
      expect(calculateNoticePeriod("2025-06-01", "2025-01-01")).toBe(0);
    });
  });

  // ─── Leave Encashment ──────────────────────────────────────────

  describe("calculateLeaveEncashment", () => {
    it("calculates leave encashment correctly", () => {
      const dailyRate = 11538; // cents
      expect(calculateLeaveEncashment(dailyRate, 10)).toBe(115380);
    });

    it("handles partial days (0.5)", () => {
      const dailyRate = 11538;
      expect(calculateLeaveEncashment(dailyRate, 0.5)).toBe(5769);
    });

    it("returns 0 for zero unused days", () => {
      expect(calculateLeaveEncashment(11538, 0)).toBe(0);
    });

    it("returns 0 for negative unused days", () => {
      expect(calculateLeaveEncashment(11538, -2)).toBe(0);
    });
  });

  // ─── Pro-Rated AWS ─────────────────────────────────────────────

  describe("calculateProRatedAws", () => {
    it("calculates pro-rated AWS for partial year", () => {
      // Employee worked Jan-Jun (6 months), basic S$3000, 1 month AWS
      // (6/12) * 300000 * 1 = 150000
      const result = calculateProRatedAws(300000, 1, "2024-01-01", "2025-06-15");
      expect(result).toBe(150000);
    });

    it("calculates full AWS for entire year", () => {
      // Employee worked full year, basic S$3000, 1 month AWS
      // (12/12) * 300000 * 1 = 300000
      const result = calculateProRatedAws(300000, 1, "2024-01-01", "2025-12-31");
      expect(result).toBe(300000);
    });

    it("returns 0 when awsMonths is 0", () => {
      expect(calculateProRatedAws(300000, 0, "2024-01-01", "2025-06-15")).toBe(0);
    });

    it("handles mid-year hire", () => {
      // Hired July 2025, terminated October 2025 → 4 months
      // (4/12) * 300000 * 1 = 100000
      const result = calculateProRatedAws(300000, 1, "2025-07-01", "2025-10-31");
      expect(result).toBe(100000);
    });

    it("handles 2 months AWS", () => {
      // 6 months worked, 2 AWS months
      // (6/12) * 300000 * 2 = 300000
      const result = calculateProRatedAws(300000, 2, "2024-01-01", "2025-06-15");
      expect(result).toBe(300000);
    });
  });

  // ─── Notice Period Pay ─────────────────────────────────────────

  describe("calculateNoticePeriodPay", () => {
    it("calculates notice pay when not served", () => {
      expect(calculateNoticePeriodPay(11538, 14, false)).toBe(11538 * 14);
    });

    it("returns 0 when notice period served", () => {
      expect(calculateNoticePeriodPay(11538, 14, true)).toBe(0);
    });

    it("returns 0 when days is 0", () => {
      expect(calculateNoticePeriodPay(11538, 0, false)).toBe(0);
    });
  });

  // ─── Retrenchment Benefit ──────────────────────────────────────

  describe("calculateRetrenchmentBenefit", () => {
    it("calculates 2 weeks per year for 3 years service", () => {
      const dailyRate = calculateDailyRate(300000); // 11538
      const result = calculateRetrenchmentBenefit(300000, "2022-01-01", "2025-01-01");
      // ~3 years * 14 days * 11538 cents/day
      const expected = Math.round(dailyRate * 14 * 3);
      // Allow small tolerance for leap year
      expect(result).toBeGreaterThan(expected - 5000);
      expect(result).toBeLessThan(expected + 5000);
    });

    it("returns 0 for negative service length", () => {
      expect(calculateRetrenchmentBenefit(300000, "2025-06-01", "2025-01-01")).toBe(0);
    });
  });

  // ─── Years of Service ──────────────────────────────────────────

  describe("calculateYearsOfService", () => {
    it("calculates years correctly", () => {
      const years = calculateYearsOfService("2020-01-01", "2025-01-01");
      expect(years).toBeGreaterThan(4.9);
      expect(years).toBeLessThan(5.1);
    });

    it("returns 0 for same-day", () => {
      expect(calculateYearsOfService("2025-01-01", "2025-01-01")).toBe(0);
    });
  });

  // ─── Completed Months in Year ──────────────────────────────────

  describe("calculateCompletedMonthsInYear", () => {
    it("counts months for full-year employee", () => {
      expect(calculateCompletedMonthsInYear("2024-01-01", "2025-06-15")).toBe(6);
    });

    it("counts months for mid-year hire", () => {
      expect(calculateCompletedMonthsInYear("2025-04-01", "2025-09-30")).toBe(6);
    });

    it("caps at 12", () => {
      expect(calculateCompletedMonthsInYear("2020-01-01", "2025-12-31")).toBe(12);
    });
  });

  // ─── Full Final Pay Calculation ────────────────────────────────

  describe("calculateFinalPay", () => {
    it("calculates complete final pay with all components", () => {
      const result = calculateFinalPay({
        employeeId: "test-123",
        terminationDate: "2025-06-30",
        hireDate: "2022-01-01",
        basicSalaryCents: 500000, // S$5,000
        awsMonths: 1,
        unusedLeaveDays: 10,
        noticePeriodServed: false,
        isRetrenchment: true,
      });

      // Daily rate: 500000 / 26 = 19231 (rounded)
      expect(result.dailyRateCents).toBe(19231);

      // Leave encashment: 10 * 19231 = 192310
      expect(result.leaveEncashmentCents).toBe(192310);

      // Pro-rated AWS: 6/12 * 500000 = 250000
      expect(result.proRatedAwsCents).toBe(250000);

      // Notice period: 2-5 years = 14 days, not served
      expect(result.noticePeriodDays).toBe(14);
      expect(result.noticePeriodPayCents).toBe(19231 * 14);

      // Retrenchment: ~3.5 years * 14 days * 19231
      expect(result.retrenchmentBenefitCents).toBeGreaterThan(0);

      // Total should be sum of all components
      expect(result.totalFinalPayCents).toBe(
        result.leaveEncashmentCents +
          result.proRatedAwsCents +
          result.noticePeriodPayCents +
          result.retrenchmentBenefitCents,
      );

      // Should have 4 breakdown items
      expect(result.breakdown).toHaveLength(4);
    });

    it("excludes notice pay when served", () => {
      const result = calculateFinalPay({
        employeeId: "test-123",
        terminationDate: "2025-06-30",
        hireDate: "2022-01-01",
        basicSalaryCents: 500000,
        awsMonths: 1,
        unusedLeaveDays: 5,
        noticePeriodServed: true,
        isRetrenchment: false,
      });

      expect(result.noticePeriodPayCents).toBe(0);
      expect(result.retrenchmentBenefitCents).toBe(0);
      // Only leave encashment and pro-rated AWS
      expect(result.breakdown).toHaveLength(2);
    });

    it("handles zero unused leave and zero AWS", () => {
      const result = calculateFinalPay({
        employeeId: "test-123",
        terminationDate: "2025-06-30",
        hireDate: "2024-01-01",
        basicSalaryCents: 300000,
        awsMonths: 0,
        unusedLeaveDays: 0,
        noticePeriodServed: true,
        isRetrenchment: false,
      });

      expect(result.leaveEncashmentCents).toBe(0);
      expect(result.proRatedAwsCents).toBe(0);
      expect(result.noticePeriodPayCents).toBe(0);
      expect(result.retrenchmentBenefitCents).toBe(0);
      expect(result.totalFinalPayCents).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it("all monetary values are integer cents (no floats)", () => {
      const result = calculateFinalPay({
        employeeId: "test-123",
        terminationDate: "2025-09-15",
        hireDate: "2020-03-15",
        basicSalaryCents: 350000,
        awsMonths: 1,
        unusedLeaveDays: 7.5,
        noticePeriodServed: false,
        isRetrenchment: true,
      });

      expect(Number.isInteger(result.leaveEncashmentCents)).toBe(true);
      expect(Number.isInteger(result.proRatedAwsCents)).toBe(true);
      expect(Number.isInteger(result.noticePeriodPayCents)).toBe(true);
      expect(Number.isInteger(result.retrenchmentBenefitCents)).toBe(true);
      expect(Number.isInteger(result.totalFinalPayCents)).toBe(true);
      expect(Number.isInteger(result.dailyRateCents)).toBe(true);
    });

    it("breakdown descriptions are descriptive", () => {
      const result = calculateFinalPay({
        employeeId: "test-123",
        terminationDate: "2025-06-30",
        hireDate: "2022-01-01",
        basicSalaryCents: 500000,
        awsMonths: 1,
        unusedLeaveDays: 10,
        noticePeriodServed: false,
        isRetrenchment: true,
      });

      const labels = result.breakdown.map((b) => b.label);
      expect(labels).toContain("Leave Encashment");
      expect(labels).toContain("Pro-Rated AWS (13th Month)");
      expect(labels).toContain("Notice Period Pay");
      expect(labels).toContain("Retrenchment Benefit");

      // Each item should have a description
      result.breakdown.forEach((item) => {
        expect(item.description.length).toBeGreaterThan(0);
      });
    });
  });
});
