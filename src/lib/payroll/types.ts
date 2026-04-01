import type { CitizenshipStatus } from "@/types";

/** CPF rate entry from the config table */
export interface CpfRateEntry {
  employerRate: number;
  employeeRate: number;
  totalRate: number;
  ageBandMin: number;
  ageBandMax: number;
}

/** Input for CPF calculation */
export interface CpfCalculationInput {
  owCents: number;
  awCents: number;
  age: number;
  citizenshipStatus: CitizenshipStatus;
  ytdOwCents: number;
  ytdAwCents: number;
  ytdCpfCents: number;
  rates: CpfRateEntry[];
}

/** Output of CPF calculation */
export interface CpfCalculationResult {
  owCappedCents: number;
  awCappedCents: number;
  employerCpfCents: number;
  employeeCpfCents: number;
  totalCpfCents: number;
  ageBand: string;
  employerRate: number;
  employeeRate: number;
  totalRate: number;
}

/** SDL calculation result */
export interface SdlResult {
  sdlCents: number;
}

/** FWL calculation result */
export interface FwlResult {
  fwlCents: number;
}

/** Allowance item */
export interface PayrollAllowance {
  name: string;
  amountCents: number;
  isFixed: boolean;
}

/** Deduction item */
export interface PayrollDeduction {
  name: string;
  amountCents: number;
}

/** Variable pay items entered per pay run */
export interface VariablePayItems {
  otHours: number;
  bonusCents: number;
  commissionCents: number;
  awsCents: number;
  reimbursementCents: number;
  additionalAllowances: PayrollAllowance[];
  additionalDeductions: PayrollDeduction[];
  unpaidLeaveDays: number;
}

/** Full employee payroll input for one month */
export interface EmployeePayrollInput {
  employeeId: string;
  basicSalaryCents: number;
  fixedAllowances: PayrollAllowance[];
  otEligible: boolean;
  otRateMultiplier: number;
  citizenshipStatus: CitizenshipStatus;
  age: number;
  dob: string;
  hireDate: string;
  terminationDate: string | null;
  fwlRateCents: number;
  variableItems: VariablePayItems;
  ytdOwCents: number;
  ytdAwCents: number;
  ytdCpfCents: number;
  periodStart: string;
  periodEnd: string;
  totalDaysInMonth: number;
  rates: CpfRateEntry[];
}

/** Full payroll result for one employee */
export interface EmployeePayrollResult {
  employeeId: string;
  basicSalaryCents: number;
  proratedBasicCents: number;
  fixedAllowancesCents: number;
  otPayCents: number;
  otHours: number;
  bonusCents: number;
  commissionCents: number;
  awsCents: number;
  reimbursementCents: number;
  unpaidLeaveDeductionCents: number;
  grossPayCents: number;
  owCents: number;
  awCents: number;
  cpf: CpfCalculationResult;
  sdl: SdlResult;
  fwl: FwlResult;
  otherDeductionsCents: number;
  netPayCents: number;
  employerTotalCostCents: number;
  allowancesDetail: PayrollAllowance[];
  deductionsDetail: PayrollDeduction[];
}
