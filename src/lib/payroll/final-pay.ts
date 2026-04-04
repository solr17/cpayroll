/**
 * Final Pay Calculator — Singapore Employment Act compliant.
 *
 * Calculates termination entitlements:
 * 1. Leave encashment (unused annual leave x daily rate)
 * 2. Pro-rated AWS (13th month, by completed months in final year)
 * 3. Notice period payment (if not served, per EA service tiers)
 * 4. Retrenchment benefit (2 weeks per year of service)
 *
 * All monetary values are integer cents. No floats for money.
 */

import { addCents } from "@/lib/utils/money";

// ─── Types ───────────────────────────────────────────────────────

export interface FinalPayBreakdownItem {
  label: string;
  amountCents: number;
  description: string;
}

export interface FinalPayInput {
  employeeId: string;
  terminationDate: string; // YYYY-MM-DD
  hireDate: string; // YYYY-MM-DD
  basicSalaryCents: number;
  awsMonths: number; // from salary record, typically 1 for 13th month
  unusedLeaveDays: number;
  noticePeriodServed: boolean;
  isRetrenchment: boolean;
}

export interface FinalPayResult {
  leaveEncashmentCents: number;
  proRatedAwsCents: number;
  noticePeriodPayCents: number;
  retrenchmentBenefitCents: number;
  totalFinalPayCents: number;
  breakdown: FinalPayBreakdownItem[];
  noticePeriodDays: number;
  yearsOfService: number;
  completedMonthsInYear: number;
  dailyRateCents: number;
}

// ─── Helper: parse date safely ───────────────────────────────────

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return d;
}

// ─── Core calculations ───────────────────────────────────────────

/**
 * Daily rate per Employment Act: basic salary / 26 working days.
 * Rounded to nearest cent (Math.round).
 */
export function calculateDailyRate(basicSalaryCents: number): number {
  if (basicSalaryCents <= 0) return 0;
  return Math.round(basicSalaryCents / 26);
}

/**
 * Notice period in days per Employment Act S.10(3):
 * - Less than 26 weeks service: 1 day
 * - 26 weeks to less than 2 years: 1 week (7 days)
 * - 2 years to less than 5 years: 2 weeks (14 days)
 * - 5 years or more: 4 weeks (28 days)
 */
export function calculateNoticePeriod(hireDate: string, terminationDate: string): number {
  const hire = parseDate(hireDate);
  const term = parseDate(terminationDate);

  const diffMs = term.getTime() - hire.getTime();
  if (diffMs < 0) return 0;

  const diffWeeks = diffMs / (7 * 24 * 60 * 60 * 1000);

  if (diffWeeks < 26) return 1;

  const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);

  if (diffYears < 2) return 7;
  if (diffYears < 5) return 14;
  return 28;
}

/**
 * Leave encashment: unused annual leave days x daily rate.
 * Per Employment Act S.20, unused leave must be paid out on termination.
 */
export function calculateLeaveEncashment(dailyRateCents: number, unusedDays: number): number {
  if (unusedDays <= 0 || dailyRateCents <= 0) return 0;
  // For partial days (e.g. 0.5), multiply and round to nearest cent
  return Math.round(dailyRateCents * unusedDays);
}

/**
 * Pro-rated AWS (13th month salary).
 * Formula: (completed months in final year / 12) x basicSalary x awsMonths
 * Uses completed calendar months from Jan 1 (or hire date if later) to termination date.
 */
export function calculateProRatedAws(
  basicSalaryCents: number,
  awsMonths: number,
  hireDate: string,
  terminationDate: string,
): number {
  if (awsMonths <= 0 || basicSalaryCents <= 0) return 0;

  const term = parseDate(terminationDate);
  const hire = parseDate(hireDate);

  // Start of the final calendar year
  const yearStart = new Date(term.getFullYear(), 0, 1);

  // Effective start for the final year: later of Jan 1 or hire date
  const effectiveStart = hire > yearStart ? hire : yearStart;

  // If effective start is after termination, no AWS due
  if (effectiveStart > term) return 0;

  // Count completed months from effective start to termination
  let months =
    (term.getFullYear() - effectiveStart.getFullYear()) * 12 +
    (term.getMonth() - effectiveStart.getMonth());

  // If the termination day is at/past the start day-of-month, count current month
  if (term.getDate() >= effectiveStart.getDate()) {
    months += 1;
  }

  if (months <= 0) return 0;
  if (months > 12) months = 12;

  // Pro-rated AWS in integer cents
  return Math.round((basicSalaryCents * awsMonths * months) / 12);
}

/**
 * Notice period pay: daily rate x notice period days.
 * Only applicable when employer terminates without notice period being served.
 */
export function calculateNoticePeriodPay(
  dailyRateCents: number,
  noticePeriodDays: number,
  noticePeriodServed: boolean,
): number {
  if (noticePeriodServed || noticePeriodDays <= 0 || dailyRateCents <= 0) return 0;
  return dailyRateCents * noticePeriodDays;
}

/**
 * Retrenchment benefit: 2 weeks pay per year of service (common practice).
 * No statutory minimum in Singapore, but 2 weeks/year is the standard.
 * Uses daily rate x 14 days x completed years (pro-rated for partial years).
 */
export function calculateRetrenchmentBenefit(
  basicSalaryCents: number,
  hireDate: string,
  terminationDate: string,
): number {
  const hire = parseDate(hireDate);
  const term = parseDate(terminationDate);

  const diffMs = term.getTime() - hire.getTime();
  if (diffMs <= 0) return 0;

  // Years of service (including partial years, pro-rated)
  const yearsOfService = diffMs / (365.25 * 24 * 60 * 60 * 1000);

  const dailyRate = calculateDailyRate(basicSalaryCents);

  // 2 weeks (14 days) per year of service
  return Math.round(dailyRate * 14 * yearsOfService);
}

/**
 * Calculate years of service between two dates.
 */
export function calculateYearsOfService(hireDate: string, terminationDate: string): number {
  const hire = parseDate(hireDate);
  const term = parseDate(terminationDate);
  const diffMs = term.getTime() - hire.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (365.25 * 24 * 60 * 60 * 1000)) * 100) / 100;
}

/**
 * Count completed months in the termination year for AWS pro-ration.
 */
export function calculateCompletedMonthsInYear(hireDate: string, terminationDate: string): number {
  const term = parseDate(terminationDate);
  const hire = parseDate(hireDate);
  const yearStart = new Date(term.getFullYear(), 0, 1);
  const effectiveStart = hire > yearStart ? hire : yearStart;

  if (effectiveStart > term) return 0;

  let months =
    (term.getFullYear() - effectiveStart.getFullYear()) * 12 +
    (term.getMonth() - effectiveStart.getMonth());

  if (term.getDate() >= effectiveStart.getDate()) {
    months += 1;
  }

  return Math.min(months, 12);
}

// ─── Main orchestrator ───────────────────────────────────────────

/**
 * Calculate complete final pay for a terminated employee.
 * Combines leave encashment, pro-rated AWS, notice period pay,
 * and retrenchment benefit into a single result.
 */
export function calculateFinalPay(input: FinalPayInput): FinalPayResult {
  const {
    basicSalaryCents,
    awsMonths,
    unusedLeaveDays,
    hireDate,
    terminationDate,
    noticePeriodServed,
    isRetrenchment,
  } = input;

  const dailyRateCents = calculateDailyRate(basicSalaryCents);
  const noticePeriodDays = calculateNoticePeriod(hireDate, terminationDate);
  const yearsOfService = calculateYearsOfService(hireDate, terminationDate);
  const completedMonthsInYear = calculateCompletedMonthsInYear(hireDate, terminationDate);

  // 1. Leave encashment
  const leaveEncashmentCents = calculateLeaveEncashment(dailyRateCents, unusedLeaveDays);

  // 2. Pro-rated AWS
  const proRatedAwsCents = calculateProRatedAws(
    basicSalaryCents,
    awsMonths,
    hireDate,
    terminationDate,
  );

  // 3. Notice period pay (only if not served)
  const noticePeriodPayCents = calculateNoticePeriodPay(
    dailyRateCents,
    noticePeriodDays,
    noticePeriodServed,
  );

  // 4. Retrenchment benefit (only if retrenchment)
  const retrenchmentBenefitCents = isRetrenchment
    ? calculateRetrenchmentBenefit(basicSalaryCents, hireDate, terminationDate)
    : 0;

  // Total
  const totalFinalPayCents = addCents(
    leaveEncashmentCents,
    proRatedAwsCents,
    noticePeriodPayCents,
    retrenchmentBenefitCents,
  );

  // Build breakdown
  const breakdown: FinalPayBreakdownItem[] = [];

  if (leaveEncashmentCents > 0) {
    breakdown.push({
      label: "Leave Encashment",
      amountCents: leaveEncashmentCents,
      description: `${unusedLeaveDays} unused day(s) x S$${(dailyRateCents / 100).toFixed(2)}/day`,
    });
  }

  if (proRatedAwsCents > 0) {
    breakdown.push({
      label: "Pro-Rated AWS (13th Month)",
      amountCents: proRatedAwsCents,
      description: `${completedMonthsInYear}/12 months x S$${(basicSalaryCents / 100).toFixed(2)} x ${awsMonths} month(s)`,
    });
  }

  if (noticePeriodPayCents > 0) {
    breakdown.push({
      label: "Notice Period Pay",
      amountCents: noticePeriodPayCents,
      description: `${noticePeriodDays} day(s) x S$${(dailyRateCents / 100).toFixed(2)}/day (notice not served)`,
    });
  }

  if (retrenchmentBenefitCents > 0) {
    breakdown.push({
      label: "Retrenchment Benefit",
      amountCents: retrenchmentBenefitCents,
      description: `2 weeks per year x ${yearsOfService.toFixed(2)} year(s) of service`,
    });
  }

  return {
    leaveEncashmentCents,
    proRatedAwsCents,
    noticePeriodPayCents,
    retrenchmentBenefitCents,
    totalFinalPayCents,
    breakdown,
    noticePeriodDays,
    yearsOfService,
    completedMonthsInYear,
    dailyRateCents,
  };
}
