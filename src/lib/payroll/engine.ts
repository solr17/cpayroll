/**
 * Payroll Calculation Engine — Full pipeline.
 *
 * For each employee:
 * 1. Gross Pay Assembly (basic + allowances + OT + bonuses - unpaid leave)
 * 2. Wage Classification (OW vs AW)
 * 3. CPF Calculation
 * 4. SDL Calculation
 * 5. FWL Calculation
 * 6. Net Pay = Gross - Employee CPF - other deductions
 * 7. Employer Total Cost = Gross + Employer CPF + SDL + FWL
 */

import type { EmployeePayrollInput, EmployeePayrollResult } from "./types";
import { calculateCpf, adjustForLowWage } from "./cpf";
import { calculateSdl } from "./sdl";
import { calculateFwl } from "./fwl";
import { calculateShg } from "./shg";
import { prorateCents, overtimeHourlyRateCents, addCents, subtractCents } from "@/lib/utils/money";

/**
 * Count working days (exclude Saturdays, Sundays, and public holidays)
 * between two dates inclusive.
 */
function countWorkingDays(start: Date, end: Date, publicHolidayDates: string[]): number {
  const holidaySet = new Set(publicHolidayDates);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    const dateStr = current.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function calculateEmployeePayroll(input: EmployeePayrollInput): EmployeePayrollResult {
  const {
    employeeId,
    basicSalaryCents,
    fixedAllowances,
    otEligible,
    otRateMultiplier,
    citizenshipStatus,
    age,
    hireDate,
    terminationDate,
    fwlRateCents,
    shgFundType,
    shgOptedOut,
    variableItems,
    ytdOwCents,
    ytdAwCents,
    ytdCpfCents,
    periodStart,
    periodEnd,
    totalDaysInMonth,
    rates,
    prorationMethod = "calendar",
    publicHolidayDates = [],
  } = input;

  // === Step 1: Gross Pay Assembly ===

  // Pro-rate basic salary for mid-month join/leave
  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);
  const hireDateObj = new Date(hireDate);
  const termDateObj = terminationDate ? new Date(terminationDate) : null;

  // Determine effective start/end for this employee in the period
  const effectiveStart = hireDateObj > periodStartDate ? hireDateObj : periodStartDate;
  const effectiveEnd = termDateObj && termDateObj < periodEndDate ? termDateObj : periodEndDate;

  let daysWorked: number;
  let totalProrationDays: number;

  if (prorationMethod === "working") {
    // Working-day proration: exclude weekends and public holidays
    totalProrationDays = countWorkingDays(periodStartDate, periodEndDate, publicHolidayDates);
    daysWorked = countWorkingDays(effectiveStart, effectiveEnd, publicHolidayDates);
  } else {
    // Calendar-day proration (default)
    totalProrationDays = totalDaysInMonth;
    if (hireDateObj > periodStartDate) {
      daysWorked = Math.max(
        0,
        Math.floor((periodEndDate.getTime() - hireDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      );
    } else {
      daysWorked = totalDaysInMonth;
    }
    if (termDateObj && termDateObj < periodEndDate) {
      const startForCalc = hireDateObj > periodStartDate ? hireDateObj : periodStartDate;
      daysWorked = Math.max(
        0,
        Math.floor((termDateObj.getTime() - startForCalc.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      );
    }
  }

  const proratedBasicCents =
    daysWorked < totalProrationDays
      ? prorateCents(basicSalaryCents, daysWorked, totalProrationDays)
      : basicSalaryCents;

  // Fixed allowances (pro-rated same as basic if mid-month)
  const fixedAllowancesCents = fixedAllowances.reduce((sum, a) => {
    const amount =
      daysWorked < totalProrationDays
        ? prorateCents(a.amountCents, daysWorked, totalProrationDays)
        : a.amountCents;
    return sum + amount;
  }, 0);

  // Overtime
  let otPayCents = 0;
  if (otEligible && variableItems.otHours > 0) {
    const hourlyRate = overtimeHourlyRateCents(basicSalaryCents, otRateMultiplier);
    otPayCents = Math.round(hourlyRate * variableItems.otHours);
  }

  // Unpaid leave deduction
  const unpaidLeaveDeductionCents =
    variableItems.unpaidLeaveDays > 0
      ? prorateCents(basicSalaryCents, variableItems.unpaidLeaveDays, totalProrationDays)
      : 0;

  // Gross pay
  const grossPayCents =
    addCents(
      proratedBasicCents,
      fixedAllowancesCents,
      otPayCents,
      variableItems.bonusCents,
      variableItems.commissionCents,
      variableItems.awsCents,
      variableItems.reimbursementCents,
    ) - unpaidLeaveDeductionCents;

  // Additional allowances from variable items
  const allAllowances = [
    ...fixedAllowances.map((a) => ({
      ...a,
      amountCents:
        daysWorked < totalProrationDays
          ? prorateCents(a.amountCents, daysWorked, totalProrationDays)
          : a.amountCents,
    })),
    ...variableItems.additionalAllowances,
  ];

  // === Step 2: Wage Classification ===
  // OW = basic salary + fixed monthly allowances (ordinary, recurring)
  const owCents = proratedBasicCents + fixedAllowancesCents;

  // AW = bonuses, AWS, commissions, ad-hoc payments
  const awCents = addCents(
    variableItems.bonusCents,
    variableItems.commissionCents,
    variableItems.awsCents,
  );

  // === Step 3: CPF ===
  let cpf = calculateCpf({
    owCents,
    awCents,
    age,
    citizenshipStatus,
    ytdOwCents,
    ytdAwCents,
    ytdCpfCents,
    rates,
  });

  // Adjust for low-wage employees
  cpf = adjustForLowWage(owCents, cpf);

  // === Step 4: SDL ===
  const sdl = calculateSdl(grossPayCents);

  // === Step 5: FWL ===
  const fwl = calculateFwl(citizenshipStatus, fwlRateCents);

  // === Step 5b: SHG ===
  // SHG only applies to SC and PR employees (not foreigners)
  const shgApplies = citizenshipStatus !== "FW";
  const shg = shgApplies
    ? calculateShg(shgFundType, grossPayCents, shgOptedOut)
    : { fundType: shgFundType, contributionCents: 0 };

  // === Step 6: Net Pay ===
  const otherDeductionsCents = variableItems.additionalDeductions.reduce(
    (sum, d) => sum + d.amountCents,
    0,
  );

  const netPayCents = subtractCents(
    grossPayCents,
    addCents(cpf.employeeCpfCents, shg.contributionCents, otherDeductionsCents),
  );

  // === Step 7: Employer Total Cost ===
  const employerTotalCostCents = addCents(
    grossPayCents,
    cpf.employerCpfCents,
    sdl.sdlCents,
    fwl.fwlCents,
  );

  return {
    employeeId,
    daysWorked,
    basicSalaryCents,
    proratedBasicCents,
    fixedAllowancesCents,
    otPayCents,
    otHours: variableItems.otHours,
    bonusCents: variableItems.bonusCents,
    commissionCents: variableItems.commissionCents,
    awsCents: variableItems.awsCents,
    reimbursementCents: variableItems.reimbursementCents,
    unpaidLeaveDeductionCents,
    grossPayCents,
    owCents,
    awCents,
    cpf,
    sdl,
    fwl,
    shg,
    otherDeductionsCents,
    netPayCents,
    employerTotalCostCents,
    allowancesDetail: allAllowances,
    deductionsDetail: variableItems.additionalDeductions,
  };
}
