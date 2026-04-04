import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { getStripe } from "@/lib/billing/stripe";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const checkoutSchema = z.object({
  priceId: z.string().min(1, "priceId is required"),
});

/**
 * POST /api/billing/checkout — Create a Stripe Checkout session for upgrading.
 *
 * Body: { priceId: string }
 * Returns: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { priceId } = parsed.data;

    const [company] = await db
      .select({
        id: companies.id,
        name: companies.name,
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

    const stripe = getStripe();

    // Create or reuse Stripe customer
    let customerId = company.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: company.name,
        metadata: { company_id: company.id },
      });
      customerId = customer.id;

      await db
        .update(companies)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(companies.id, company.id));
    }

    const origin = request.headers.get("origin") ?? request.nextUrl.origin;

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?status=success`,
      cancel_url: `${origin}/billing?status=cancelled`,
      metadata: { company_id: company.id },
    });

    await logAudit({
      userId: session.id,
      action: "billing_checkout_created",
      entityType: "company",
      entityId: company.id,
      newValue: { priceId, checkoutSessionId: checkoutSession.id },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { url: checkoutSession.url },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
