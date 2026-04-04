import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies, employees } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { getStripe } from "@/lib/billing/stripe";
import { PLAN_TIERS, type PlanTier } from "@/lib/billing/plan";
import type { ApiResponse } from "@/types";

/**
 * GET /api/billing — Return current plan info.
 *
 * Response shape:
 *   { tier, tierLabel, employeeCount, employeeLimit, pricePerEmployeeCents, nextBillingDate }
 */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin");

    const [company] = await db
      .select({
        planTier: companies.planTier,
        planEmployeeLimit: companies.planEmployeeLimit,
        stripeSubscriptionId: companies.stripeSubscriptionId,
        stripeCustomerId: companies.stripeCustomerId,
      })
      .from(companies)
      .where(eq(companies.id, session.companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const tier = (company.planTier ?? "free") as PlanTier;
    const tierDef = PLAN_TIERS[tier] ?? PLAN_TIERS.free;

    // Count active employees (non-terminated)
    const activeEmployees = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.companyId, session.companyId), ne(employees.status, "terminated")));

    const employeeCount = activeEmployees.length;
    const limit = company.planEmployeeLimit ?? tierDef.employeeLimit;

    // Fetch next billing date from Stripe if subscription exists
    let nextBillingDate: string | null = null;
    if (company.stripeSubscriptionId) {
      try {
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
        // In Stripe API 2026-03-25.dahlia, current_period_end lives on subscription items
        const firstItem = subscription.items?.data?.[0];
        if (firstItem?.current_period_end) {
          nextBillingDate = new Date(firstItem.current_period_end * 1000).toISOString();
        }
      } catch {
        // Stripe may be unavailable or subscription deleted — continue without date
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tier,
        tierLabel: tierDef.label,
        employeeCount,
        employeeLimit: limit === Infinity ? -1 : limit,
        pricePerEmployeeCents: tierDef.pricePerEmployeeCents,
        nextBillingDate,
        hasSubscription: !!company.stripeSubscriptionId,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
