import { db } from "@/lib/db";
import { leaveBalances, employees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** Leave type as defined in leaveTypeEnum */
export type LeaveType =
  | "annual"
  | "sick_outpatient"
  | "sick_hospitalisation"
  | "maternity"
  | "paternity"
  | "childcare"
  | "compassionate"
  | "unpaid"
  | "other";

/**
 * Calculate annual leave entitlement per Singapore MOM Employment Act.
 * Year 1 of service: 7 days.
 * +1 day per additional year of service, capped at 14 days (year 8+).
 */
export function calculateAnnualEntitlement(hireDate: string, year: number): number {
  const hire = new Date(hireDate + "T00:00:00");
  const hireYear = hire.getFullYear();

  // Years of completed service at the start of the given year
  const yearsOfService = year - hireYear;

  if (yearsOfService < 1) {
    // Not yet completed first year — pro-rate not applied here,
    // return 7 days (company can pro-rate separately if desired)
    return 7;
  }

  // Year 1: 7 days, Year 2: 8, ... Year 8+: 14
  return Math.min(7 + (yearsOfService - 1) + 1, 14);
}

/**
 * Returns default MOM entitlements for all leave types for a given year.
 */
export function getDefaultEntitlements(hireDate: string, year: number): Record<LeaveType, number> {
  return {
    annual: calculateAnnualEntitlement(hireDate, year),
    sick_outpatient: 14,
    sick_hospitalisation: 60, // inclusive of outpatient
    maternity: 112, // 16 weeks = 112 calendar days
    paternity: 14, // 2 weeks
    childcare: 6,
    compassionate: 3,
    unpaid: 0, // no statutory limit, tracked as 0 entitlement
    other: 0,
  };
}

/**
 * Initialize leave balance records for an employee for a given year.
 * Only creates records that don't already exist (idempotent).
 */
export async function initializeBalances(
  employeeId: string,
  companyId: string,
  year: number,
): Promise<void> {
  // Verify employee belongs to this company
  const [employee] = await db
    .select({ id: employees.id, hireDate: employees.hireDate })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)))
    .limit(1);

  if (!employee) {
    throw new Error("Employee not found or does not belong to this company");
  }

  const entitlements = getDefaultEntitlements(employee.hireDate, year);

  // Check which balances already exist
  const existing = await db
    .select({ leaveType: leaveBalances.leaveType })
    .from(leaveBalances)
    .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year)));

  const existingTypes = new Set(existing.map((e: { leaveType: string }) => e.leaveType));

  const toInsert = (Object.entries(entitlements) as [LeaveType, number][])
    .filter(([type]) => !existingTypes.has(type))
    .map(([type, days]) => ({
      employeeId,
      year,
      leaveType: type as LeaveType,
      entitlementDays: String(days),
      usedDays: "0",
      carryOverDays: "0",
      adjustmentDays: "0",
    }));

  if (toInsert.length > 0) {
    await db.insert(leaveBalances).values(toInsert);
  }
}
