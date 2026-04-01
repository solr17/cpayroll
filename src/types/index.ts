/** Citizenship status for CPF determination */
export type CitizenshipStatus = "SC" | "PR1" | "PR2" | "PR3" | "FW";

/** Employment type */
export type EmploymentType = "FT" | "PT" | "CONTRACT" | "LOCUM";

/** Employee status */
export type EmployeeStatus = "active" | "probation" | "terminated";

/** User roles for RBAC */
export type UserRole = "owner" | "admin" | "employee";

/** Pay run lifecycle states */
export type PayRunStatus = "draft" | "calculated" | "reviewed" | "approved" | "paid" | "filed";

/** Allowance item stored in JSON columns */
export interface AllowanceItem {
  name: string;
  amountCents: number;
  isFixed: boolean;
}

/** Deduction item stored in JSON columns */
export interface DeductionItem {
  name: string;
  amountCents: number;
  type: "statutory" | "voluntary" | "loan";
}

/** Bank details stored encrypted */
export interface BankDetails {
  bankName: string;
  branchCode: string;
  accountNumber: string;
  payNowLinked?: string;
}

/** CPF age band boundaries */
export interface CpfAgeBand {
  label: string;
  minAge: number;
  maxAge: number;
}

export const CPF_AGE_BANDS: CpfAgeBand[] = [
  { label: "55 and below", minAge: 0, maxAge: 55 },
  { label: "Above 55 to 60", minAge: 56, maxAge: 60 },
  { label: "Above 60 to 65", minAge: 61, maxAge: 65 },
  { label: "Above 65 to 70", minAge: 66, maxAge: 70 },
  { label: "Above 70", minAge: 71, maxAge: 999 },
];

/** CPF wage ceilings (2026) — read from config in production, constants for reference */
export const CPF_CEILINGS_2026 = {
  owMonthlyCents: 800000, // S$8,000
  annualSalaryCeilingCents: 10200000, // S$102,000
  annualCpfLimitCents: 3774000, // S$37,740
} as const;

/** SDL constants */
export const SDL = {
  rate: 0.0025,
  floorCents: 200, // S$2
  ceilingCents: 1125, // S$11.25
} as const;

/** API response shape */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
