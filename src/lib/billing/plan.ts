import { db } from "@/lib/db";
import { companies, employees } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";

/**
 * Plan tier definitions.
 *
 * Pricing (per employee per month, in integer cents):
 *   - free:       $0, up to 5 employees
 *   - pro:        $5 (500 cents), up to 50 employees
 *   - enterprise: $8 (800 cents), unlimited employees
 */
export const PLAN_TIERS = {
  free: { label: "Free", pricePerEmployeeCents: 0, employeeLimit: 5 },
  pro: { label: "Pro", pricePerEmployeeCents: 500, employeeLimit: 50 },
  enterprise: { label: "Enterprise", pricePerEmployeeCents: 800, employeeLimit: Infinity },
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

export function isValidPlanTier(tier: string): tier is PlanTier {
  return tier === "free" || tier === "pro" || tier === "enterprise";
}

/**
 * Check whether the company can add another employee.
 * Counts active + probation employees (excludes terminated).
 */
export async function checkEmployeeLimit(
  companyId: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const [company] = await db
    .select({
      planTier: companies.planTier,
      planEmployeeLimit: companies.planEmployeeLimit,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const tier = (company.planTier ?? "free") as PlanTier;
  const limit = company.planEmployeeLimit ?? PLAN_TIERS[tier]?.employeeLimit ?? 5;

  const activeEmployees = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.companyId, companyId), ne(employees.status, "terminated")));

  const current = activeEmployees.length;

  return {
    allowed: current < limit,
    current,
    limit: limit === Infinity ? -1 : limit, // -1 signals unlimited
  };
}
