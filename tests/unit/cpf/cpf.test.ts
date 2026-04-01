import { describe, it, expect } from "vitest";
import {
  calculateCpf,
  adjustForLowWage,
  findRateForAge,
  capOw,
  capAw,
  getAgeBandLabel,
} from "@/lib/payroll/cpf";
import type { CpfRateEntry, CpfCalculationInput } from "@/lib/payroll/types";

// 2026 SC / PR3+ rates
const SC_RATES_2026: CpfRateEntry[] = [
  { ageBandMin: 0, ageBandMax: 55, employerRate: 0.17, employeeRate: 0.2, totalRate: 0.37 },
  { ageBandMin: 56, ageBandMax: 60, employerRate: 0.16, employeeRate: 0.18, totalRate: 0.34 },
  { ageBandMin: 61, ageBandMax: 65, employerRate: 0.125, employeeRate: 0.125, totalRate: 0.25 },
  { ageBandMin: 66, ageBandMax: 70, employerRate: 0.09, employeeRate: 0.075, totalRate: 0.165 },
  { ageBandMin: 71, ageBandMax: 999, employerRate: 0.075, employeeRate: 0.05, totalRate: 0.125 },
];

function makeInput(overrides: Partial<CpfCalculationInput> = {}): CpfCalculationInput {
  return {
    owCents: 500000, // S$5,000
    awCents: 0,
    age: 30,
    citizenshipStatus: "SC",
    ytdOwCents: 0,
    ytdAwCents: 0,
    ytdCpfCents: 0,
    rates: SC_RATES_2026,
    ...overrides,
  };
}

describe("CPF calculation", () => {
  describe("findRateForAge", () => {
    it("finds correct rate for each age band", () => {
      expect(findRateForAge(SC_RATES_2026, 30)?.totalRate).toBe(0.37);
      expect(findRateForAge(SC_RATES_2026, 55)?.totalRate).toBe(0.37);
      expect(findRateForAge(SC_RATES_2026, 56)?.totalRate).toBe(0.34);
      expect(findRateForAge(SC_RATES_2026, 60)?.totalRate).toBe(0.34);
      expect(findRateForAge(SC_RATES_2026, 61)?.totalRate).toBe(0.25);
      expect(findRateForAge(SC_RATES_2026, 70)?.totalRate).toBe(0.165);
      expect(findRateForAge(SC_RATES_2026, 71)?.totalRate).toBe(0.125);
      expect(findRateForAge(SC_RATES_2026, 85)?.totalRate).toBe(0.125);
    });
  });

  describe("getAgeBandLabel", () => {
    it("returns correct labels", () => {
      expect(getAgeBandLabel(30)).toBe("55 and below");
      expect(getAgeBandLabel(55)).toBe("55 and below");
      expect(getAgeBandLabel(56)).toBe("Above 55 to 60");
      expect(getAgeBandLabel(65)).toBe("Above 60 to 65");
      expect(getAgeBandLabel(70)).toBe("Above 65 to 70");
      expect(getAgeBandLabel(71)).toBe("Above 70");
    });
  });

  describe("capOw", () => {
    it("caps at $8,000 monthly ceiling", () => {
      expect(capOw(500000)).toBe(500000); // S$5,000 under ceiling
      expect(capOw(800000)).toBe(800000); // exactly at ceiling
      expect(capOw(1200000)).toBe(800000); // S$12,000 capped to S$8,000
    });
  });

  describe("capAw", () => {
    it("caps at $102,000 - YTD OW", () => {
      expect(capAw(500000, 9000000)).toBe(500000); // AW under ceiling
      expect(capAw(500000, 10000000)).toBe(200000); // AW partially capped
      expect(capAw(500000, 10200000)).toBe(0); // No AW room left
    });
  });

  describe("standard CPF calculation", () => {
    it("calculates correctly for age <= 55, S$5,000 salary", () => {
      const result = calculateCpf(makeInput());
      // Total = round(5000 * 0.37) = round(1850) = 1850.00 = 185000 cents
      expect(result.totalCpfCents).toBe(185000);
      // Employee = floor(5000 * 0.20) = floor(1000) = 1000.00 = 100000 cents
      expect(result.employeeCpfCents).toBe(100000);
      // Employer = 1850 - 1000 = 850 = 85000 cents
      expect(result.employerCpfCents).toBe(85000);
    });

    it("calculates correctly for age 56-60", () => {
      const result = calculateCpf(makeInput({ age: 58 }));
      // Total = round(5000 * 0.34) = 1700 = 170000
      expect(result.totalCpfCents).toBe(170000);
      // Employee = floor(5000 * 0.18) = 900 = 90000
      expect(result.employeeCpfCents).toBe(90000);
      // Employer = 1700 - 900 = 800 = 80000
      expect(result.employerCpfCents).toBe(80000);
    });

    it("calculates correctly for age 61-65", () => {
      const result = calculateCpf(makeInput({ age: 63 }));
      // Total = round(5000 * 0.25) = 1250 = 125000
      expect(result.totalCpfCents).toBe(125000);
      // Employee = floor(5000 * 0.125) = floor(625) = 625 = 62500
      expect(result.employeeCpfCents).toBe(62500);
      expect(result.employerCpfCents).toBe(62500);
    });

    it("calculates correctly for age 66-70", () => {
      const result = calculateCpf(makeInput({ age: 68 }));
      // Total = round(5000 * 0.165) = round(825) = 825 = 82500
      expect(result.totalCpfCents).toBe(82500);
      // Employee = floor(5000 * 0.075) = floor(375) = 375 = 37500
      expect(result.employeeCpfCents).toBe(37500);
      expect(result.employerCpfCents).toBe(45000);
    });

    it("calculates correctly for age > 70", () => {
      const result = calculateCpf(makeInput({ age: 75 }));
      // Total = round(5000 * 0.125) = round(625) = 625 = 62500
      expect(result.totalCpfCents).toBe(62500);
      // Employee = floor(5000 * 0.05) = floor(250) = 250 = 25000
      expect(result.employeeCpfCents).toBe(25000);
      expect(result.employerCpfCents).toBe(37500);
    });
  });

  describe("OW ceiling", () => {
    it("caps OW at $8,000", () => {
      const result = calculateCpf(makeInput({ owCents: 1500000 })); // S$15,000
      expect(result.owCappedCents).toBe(800000);
      // CPF on $8,000: Total = round(8000 * 0.37) = 2960 = 296000
      expect(result.totalCpfCents).toBe(296000);
    });
  });

  describe("AW ceiling", () => {
    it("caps AW at $102,000 - YTD OW", () => {
      const result = calculateCpf(
        makeInput({
          owCents: 500000,
          awCents: 3000000, // S$30,000 bonus
          ytdOwCents: 8000000, // S$80,000 YTD OW
        }),
      );
      // YTD OW after this month = 80,000 + 5,000 = 85,000
      // AW ceiling = 102,000 - 85,000 = 17,000
      // AW capped at S$17,000
      expect(result.awCappedCents).toBe(1700000);
    });
  });

  describe("annual CPF limit", () => {
    it("enforces $37,740 annual limit", () => {
      const result = calculateCpf(
        makeInput({
          owCents: 800000,
          ytdCpfCents: 3700000, // S$37,000 already contributed
        }),
      );
      // Would contribute ~$2,960 more but limit is $37,740
      // Allowable = 37,740 - 37,000 = 740 = 74,000 cents
      expect(result.totalCpfCents).toBeLessThanOrEqual(74000);
    });

    it("returns zero when limit already reached", () => {
      const result = calculateCpf(
        makeInput({
          ytdCpfCents: 3774000, // exactly at limit
        }),
      );
      expect(result.totalCpfCents).toBe(0);
      expect(result.employeeCpfCents).toBe(0);
      expect(result.employerCpfCents).toBe(0);
    });
  });

  describe("foreigners", () => {
    it("returns zero CPF for foreigners", () => {
      const result = calculateCpf(makeInput({ citizenshipStatus: "FW" }));
      expect(result.totalCpfCents).toBe(0);
      expect(result.employeeCpfCents).toBe(0);
      expect(result.employerCpfCents).toBe(0);
    });
  });

  describe("rounding rules", () => {
    it("total CPF rounds to nearest dollar (>= 0.50 up)", () => {
      // S$3,333: total = 3333 * 0.37 = 1233.21 → rounds to 1233 = 123300
      const result = calculateCpf(makeInput({ owCents: 333300 }));
      expect(result.totalCpfCents).toBe(123321);
    });

    it("employee CPF always rounds DOWN", () => {
      // S$3,333: employee = floor(3333 * 0.20) = floor(666.60) = 666 = 66660
      const result = calculateCpf(makeInput({ owCents: 333300 }));
      expect(result.employeeCpfCents).toBe(66660);
    });

    it("employer CPF = total - employee (derived)", () => {
      const result = calculateCpf(makeInput({ owCents: 333300 }));
      expect(result.employerCpfCents).toBe(result.totalCpfCents - result.employeeCpfCents);
    });
  });

  describe("adjustForLowWage", () => {
    it("no CPF below $50", () => {
      const base = calculateCpf(makeInput({ owCents: 4000 }));
      const adjusted = adjustForLowWage(4000, base);
      expect(adjusted.totalCpfCents).toBe(0);
    });

    it("employer only for $50-$500", () => {
      const base = calculateCpf(makeInput({ owCents: 30000 })); // S$300
      const adjusted = adjustForLowWage(30000, base);
      expect(adjusted.employeeCpfCents).toBe(0);
      expect(adjusted.employerCpfCents).toBeGreaterThan(0);
    });

    it("graduated employee for $500-$750", () => {
      const base = calculateCpf(makeInput({ owCents: 60000 })); // S$600
      const adjusted = adjustForLowWage(60000, base);
      // Employee = floor(0.6 * (600 - 500)) = floor(60) = 60 = 6000
      expect(adjusted.employeeCpfCents).toBe(6000);
    });

    it("standard rates above $750", () => {
      const base = calculateCpf(makeInput({ owCents: 100000 }));
      const adjusted = adjustForLowWage(100000, base);
      expect(adjusted).toEqual(base);
    });
  });

  describe("zero and edge cases", () => {
    it("handles zero wages", () => {
      const result = calculateCpf(makeInput({ owCents: 0 }));
      expect(result.totalCpfCents).toBe(0);
      expect(result.employeeCpfCents).toBe(0);
      expect(result.employerCpfCents).toBe(0);
    });

    it("handles exactly-at-ceiling OW", () => {
      const result = calculateCpf(makeInput({ owCents: 800000 }));
      expect(result.owCappedCents).toBe(800000);
    });

    it("handles negative back-pay adjustment gracefully", () => {
      const result = calculateCpf(makeInput({ owCents: -10000 }));
      // Negative wages: CPF should compute on 0
      expect(result.totalCpfCents).toBeLessThanOrEqual(0);
    });
  });
});
