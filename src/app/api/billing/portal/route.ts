import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { getStripe } from "@/lib/billing/stripe";
import { logAudit } from "@/lib/audit/log";
import type { ApiResponse } from "@/types";

/**
 * POST /api/billing/portal — Create a Stripe Customer Portal session.
 *
 * Returns: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");

    const [company] = await db
      .select({
        id: companies.id,
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

    if (!company.stripeCustomerId) {
      return NextResponse.json(
        {
          success: false,
          error: "No active subscription. Please subscribe to a plan first.",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const origin = request.headers.get("origin") ?? request.nextUrl.origin;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: `${origin}/billing`,
    });

    await logAudit({
      userId: session.id,
      action: "billing_portal_opened",
      entityType: "company",
      entityId: company.id,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { url: portalSession.url },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
