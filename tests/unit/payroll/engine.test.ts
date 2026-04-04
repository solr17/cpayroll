import { describe, it, expect } from "vitest";
import { calculateEmployeePayroll } from "@/lib/payroll/engine";
import type { EmployeePayrollInput, CpfRateEntry } from "@/lib/payroll/types";

const SC_RATES: CpfRateEntry[] = [
  { ageBandMin: 0, ageBandMax: 55, employerRate: 0.17, employeeRate: 0.2, totalRate: 0.37 },
  { ageBandMin: 56, ageBandMax: 60, employerRate: 0.16, employeeRate: 0.18, totalRate: 0.34 },
  { ageBandMin: 61, ageBandMax: 65, employerRate: 0.125, employeeRate: 0.125, totalRate: 0.25 },
  { ageBandMin: 66, ageBandMax: 70, employerRate: 0.09, employeeRate: 0.075, totalRate: 0.165 },
  { ageBandMin: 71, ageBandMax: 999, employerRate: 0.075, employeeRate: 0.05, totalRate: 0.125 },
];

function makeInput(overrides: Partial<EmployeePayrollInput> = {}): EmployeePayrollInput {
  return {
    employeeId: "emp-1",
    basicSalaryCents: 500000,
    fixedAllowances: [],
    otEligible: false,
    otRateMultiplier: 1.5,
    citizenshipStatus: "SC",
    age: 30,
    dob: "1996-01-15",
    hireDate: "2024-01-01",
    terminationDate: null,
    fwlRateCents: 0,
    shgFundType: "CDAC",
    shgOptedOut: false,
    variableItems: {
      otHours: 0,
      bonusCents: 0,
      commissionCents: 0,
      awsCents: 0,
      reimbursementCents: 0,
      additionalAllowances: [],
      additionalDeductions: [],
      unpaidLeaveDays: 0,
    },
    ytdOwCents: 0,
    ytdAwCents: 0,
    ytdCpfCents: 0,
    periodStart: "2026-03-01",
    periodEnd: "2026-03-31",
    totalDaysInMonth: 31,
    rates: SC_RATES,
    ...overrides,
  };
}

describe("payroll engine", () => {
  describe("basic payroll", () => {
    it("calculates full month for SC age 30, S$5,000", () => {
      const result = calculateEmployeePayroll(makeInput());

      expect(result.proratedBasicCents).toBe(500000);
      expect(result.grossPayCents).toBe(500000);
      expect(result.owCents).toBe(500000);
      expect(result.awCents).toBe(0);

      // CPF: 37% total
      expect(result.cpf.totalCpfCents).toBe(185000);
      expect(result.cpf.employeeCpfCents).toBe(100000);
      expect(result.cpf.employerCpfCents).toBe(85000);

      // SDL: 5000 * 0.0025 = 12.50 → ceiling 11.25
      expect(result.sdl.sdlCents).toBe(1125);

      // FWL: 0 for SC
      expect(result.fwl.fwlCents).toBe(0);

      // SHG: CDAC for $5,000 wages = $3.00
      expect(result.shg.fundType).toBe("CDAC");
      expect(result.shg.contributionCents).toBe(300);

      // Net = 5000 - 1000 (employee CPF) - 3 (CDAC) = 3997
      expect(result.netPayCents).toBe(399700);

      // Employer cost = 5000 + 850 + 11.25 = 5861.25
      expect(result.employerTotalCostCents).toBe(586125);
    });
  });

  describe("allowances", () => {
    it("includes fixed allowances in OW and gross", () => {
      const result = calculateEmployeePayroll(
        makeInput({
          fixedAllowances: [
            { name: "Transport", amountCents: 50000, isFixed: true },
            { name: "Meal", amountCents: 30000, isFixed: true },
          ],
        }),
      );

      expect(result.fixedAllowancesCents).toBe(80000);
      expect(result.grossPayCents).toBe(580000);
      expect(result.owCents).toBe(580000);
    });
  });

  describe("overtime", () => {
    it("calculates OT pay for eligible employees", () => {
      const result = calculateEmployeePayroll(
        makeInput({
          otEligible: true,
          variableItems: {
            otHours: 10,
            bonusCents: 0,
            commissionCents: 0,
            awsCents: 0,
            reimbursementCents: 0,
            additionalAllowances: [],
            additionalDeductions: [],
            unpaidLeaveDays: 0,
          },
        }),
      );

      // OT rate: 5000 / (26 * 8) * 1.5 = 36.06 → 3606 cents/hr
      // Hmm let's check: 500000 / 208 * 1.5 = 3605.77 → round = 3606
      // 10 hours: 3606 * 10 = 36060 → but it uses Math.round(hourlyRate * hours)
      expect(result.otPayCents).toBeGreaterThan(0);
      expect(result.otHours).toBe(10);
    });

    it("skips OT for ineligible employees", () => {
      const result = calculateEmployeePayroll(
        makeInput({
          otEligible: false,
          variableItems: {
            otHours: 10,
            bonusCents: 0,
            commissionCents: 0,
            awsCents: 0,
            reimbursementCents: 0,
            additionalAllowances: [],
            additionalDeductions: [],
            unpaidLeaveDays: 0,
          },
        }),
      );

      expect(result.otPayCents).toBe(0);
    });
  });

  describe("bonuses and AW", () => {
    it("classifies bonus as AW", () => {
      const result = calculateEmployeePayroll(
        makeInput({
          variableItems: {
            otHours: 0,
            bonusCents: 200000,
            commissionCents: 0,
            awsCents: 0,
            reimbursementCents: 0,
            additionalAllowances: [],
            additionalDeductions: [],
            unpaidLeaveDays: 0,
          },
        }),
      );

      expect(result.awCents).toBe(200000);
      expect(result.grossPayCents).toBe(700000);
      // CPF computed on OW + AW
      expect(result.cpf.totalCpfCents).toBeGreaterThan(185000);
    });
  });

  describe("unpaid leave", () => {
    it("deducts unpaid leave from gross", () => {
      const result = calculateEmployeePayroll(
        makeInput({
          variableItems: {
            otHours: 0,
            bonusCents: 0,
            commissionCents: 0,
            awsCents: 0,
            reimbursementCents: 0,
            additionalAllowances: [],
            additionalDeductions: [],
            unpaidLeaveDays: 5,
          },
        }),
      );

      // 5/31 * 5000 = 806.45 → floor = 806 = 80645 cents
      expect(result.unpaidLeaveDeductionCents).toBeGreaterThan(0);
      expect(result.grossPayCents).toBeLessThan(500000);
    });
  });

  describe("mid-month joiner", () => {
    it("pro-rates salary for mid-month hire", () => {
      const result = calculateEmployeePayroll(
        makeInput({
          hireDate: "2026-03-15",
        }),
      );

      // 15 Mar to 31 Mar = 17 days out of 31
      expect(result.proratedBasicCents).toBeLessThan(500000);
      expect(result.grossPayCents).toBeLessThan(500000);
    });
  });

  describe("foreign worker", () => {
    it("no CPF, has FWL for foreign worker", () => {
      const result = calculateEmployeePayroll(
        makeInput({
          citizenshipStatus: "FW",
          fwlRateCents: 40000,
        }),
      );

      expect(result.cpf.totalCpfCents).toBe(0);
      expect(result.cpf.employeeCpfCents).toBe(0);
      expect(result.fwl.fwlCents).toBe(40000);
      // Net = gross (no CPF deduction)
      expect(result.netPayCents).toBe(500000);
      // Employer cost includes FWL
      expect(result.employerTotalCostCents).toBe(500000 + 1125 + 40000);
    });
  });
});
