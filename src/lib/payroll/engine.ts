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
import { prorateCents, overtimeHourlyRateCents, addCents, subtractCents } from "@/lib/utils/money";

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
    variableItems,
    ytdOwCents,
    ytdAwCents,
    ytdCpfCents,
    periodStart,
    periodEnd,
    totalDaysInMonth,
    rates,
  } = input;

  // === Step 1: Gross Pay Assembly ===

  // Pro-rate basic salary for mid-month join/leave
  let daysWorked = totalDaysInMonth;
  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);
  const hireDateObj = new Date(hireDate);
  const termDateObj = terminationDate ? new Date(terminationDate) : null;

  if (hireDateObj > periodStartDate) {
    daysWorked = Math.max(
      0,
      Math.floor((periodEndDate.getTime() - hireDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
  }
  if (termDateObj && termDateObj < periodEndDate) {
    const startForCalc = hireDateObj > periodStartDate ? hireDateObj : periodStartDate;
    daysWorked = Math.max(
      0,
      Math.floor((termDateObj.getTime() - startForCalc.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
  }

  const proratedBasicCents =
    daysWorked < totalDaysInMonth
      ? prorateCents(basicSalaryCents, daysWorked, totalDaysInMonth)
      : basicSalaryCents;

  // Fixed allowances (pro-rated same as basic if mid-month)
  const fixedAllowancesCents = fixedAllowances.reduce((sum, a) => {
    const amount =
      daysWorked < totalDaysInMonth
        ? prorateCents(a.amountCents, daysWorked, totalDaysInMonth)
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
      ? prorateCents(basicSalaryCents, variableItems.unpaidLeaveDays, totalDaysInMonth)
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
        daysWorked < totalDaysInMonth
          ? prorateCents(a.amountCents, daysWorked, totalDaysInMonth)
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

  // === Step 6: Net Pay ===
  const otherDeductionsCents = variableItems.additionalDeductions.reduce(
    (sum, d) => sum + d.amountCents,
    0,
  );

  const netPayCents = subtractCents(
    grossPayCents,
    addCents(cpf.employeeCpfCents, otherDeductionsCents),
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
    otherDeductionsCents,
    netPayCents,
    employerTotalCostCents,
    allowancesDetail: allAllowances,
    deductionsDetail: variableItems.additionalDeductions,
  };
}
