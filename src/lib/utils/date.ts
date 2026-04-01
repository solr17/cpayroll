import { format, differenceInYears, startOfMonth, addMonths, getDaysInMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const SG_TIMEZONE = "Asia/Singapore";

/** Get current date in Singapore timezone */
export function nowSG(): Date {
  return toZonedTime(new Date(), SG_TIMEZONE);
}

/** Format date for display: "25 Mar 2026" */
export function formatDateSG(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd MMM yyyy");
}

/** Format date for ISO: "2026-03-25" */
export function formatDateISO(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy-MM-dd");
}

/**
 * Get employee's age band for CPF calculation.
 * Age is determined as of the 1st of the given month.
 * Rate changes apply from the 1st of the month AFTER the birthday month.
 */
export function getAgeBandForMonth(dob: Date | string, month: Date | string): number {
  const dobDate = typeof dob === "string" ? new Date(dob) : dob;
  const monthDate = typeof month === "string" ? new Date(month) : month;
  const firstOfMonth = startOfMonth(monthDate);
  return differenceInYears(firstOfMonth, dobDate);
}

/**
 * Determine the month from which a new CPF rate applies after a birthday.
 * If birthday is 15 March, new rate applies from 1 April.
 */
export function rateChangeEffectiveMonth(birthday: Date | string): Date {
  const bday = typeof birthday === "string" ? new Date(birthday) : birthday;
  return startOfMonth(addMonths(bday, 1));
}

/** Get number of calendar days in a given month */
export function daysInMonth(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return getDaysInMonth(d);
}

/**
 * Calculate pro-rated days for mid-month join/leave.
 * Returns { daysWorked, totalDays } for the given month.
 */
export function prorationDays(
  monthStart: Date,
  monthEnd: Date,
  joinDate?: Date | null,
  leaveDate?: Date | null,
): { daysWorked: number; totalDays: number } {
  const totalDays = getDaysInMonth(monthStart);
  let start = monthStart;
  let end = monthEnd;

  if (joinDate && joinDate > monthStart) {
    start = joinDate;
  }
  if (leaveDate && leaveDate < monthEnd) {
    end = leaveDate;
  }

  const daysWorked = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );

  return { daysWorked, totalDays };
}
