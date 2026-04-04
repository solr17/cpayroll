import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/billing/stripe";
import { PLAN_TIERS, isValidPlanTier } from "@/lib/billing/plan";
import { logAudit } from "@/lib/audit/log";
import type Stripe from "stripe";
import logger from "@/lib/logger";
import type { ApiResponse } from "@/types";

/**
 * Map a Stripe Price ID to a plan tier.
 * In production, configure these via env vars or a lookup table.
 * For now, we read the price metadata field "plan_tier".
 */
function tierFromSubscription(subscription: Stripe.Subscription): {
  tier: string;
  limit: number;
} {
  // Try the first item's price metadata
  const item = subscription.items.data[0];
  const tierMeta = item?.price?.metadata?.plan_tier;

  if (tierMeta && isValidPlanTier(tierMeta)) {
    const def = PLAN_TIERS[tierMeta];
    return {
      tier: tierMeta,
      limit: def.employeeLimit === Infinity ? 999999 : def.employeeLimit,
    };
  }

  // Fallback: default to pro
  return { tier: "pro", limit: 50 };
}

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events. This route is in PUBLIC_PATHS
 * (no auth required). Signature verification via STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { success: false, error: "Webhook not configured" } satisfies ApiResponse,
      { status: 500 },
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { success: false, error: "Missing stripe-signature header" } satisfies ApiResponse,
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    logger.error({ err: message }, "Stripe webhook signature verification failed");
    return NextResponse.json({ success: false, error: "Invalid signature" } satisfies ApiResponse, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const companyId = session.metadata?.company_id;

        if (!companyId) {
          logger.error("checkout.session.completed missing company_id in metadata");
          break;
        }

        // Retrieve the full subscription to get price/tier info
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const { tier, limit } = tierFromSubscription(subscription);
        const priceId = subscription.items.data[0]?.price?.id ?? null;

        await db
          .update(companies)
          .set({
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            planTier: tier,
            planEmployeeLimit: limit,
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));

        await logAudit({
          action: "subscription_created",
          entityType: "company",
          entityId: companyId,
          newValue: { tier, limit, subscriptionId },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const { tier, limit } = tierFromSubscription(subscription);
        const priceId = subscription.items.data[0]?.price?.id ?? null;

        // Find company by stripeCustomerId
        const [company] = await db
          .select({ id: companies.id, planTier: companies.planTier })
          .from(companies)
          .where(eq(companies.stripeCustomerId, customerId))
          .limit(1);

        if (!company) {
          logger.error({ customerId }, "subscription.updated: no company found for customer");
          break;
        }

        await db
          .update(companies)
          .set({
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            planTier: tier,
            planEmployeeLimit: limit,
            updatedAt: new Date(),
          })
          .where(eq(companies.id, company.id));

        await logAudit({
          action: "subscription_updated",
          entityType: "company",
          entityId: company.id,
          oldValue: { tier: company.planTier },
          newValue: { tier, limit, subscriptionId: subscription.id },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const [company] = await db
          .select({ id: companies.id, planTier: companies.planTier })
          .from(companies)
          .where(eq(companies.stripeCustomerId, customerId))
          .limit(1);

        if (!company) {
          logger.error({ customerId }, "subscription.deleted: no company found for customer");
          break;
        }

        // Downgrade to free tier
        await db
          .update(companies)
          .set({
            stripeSubscriptionId: null,
            stripePriceId: null,
            planTier: "free",
            planEmployeeLimit: PLAN_TIERS.free.employeeLimit,
            updatedAt: new Date(),
          })
          .where(eq(companies.id, company.id));

        await logAudit({
          action: "subscription_cancelled",
          entityType: "company",
          entityId: company.id,
          oldValue: { tier: company.planTier },
          newValue: { tier: "free", limit: PLAN_TIERS.free.employeeLimit },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const [company] = await db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.stripeCustomerId, customerId))
          .limit(1);

        if (company) {
          await logAudit({
            action: "payment_failed",
            entityType: "company",
            entityId: company.id,
            newValue: {
              invoiceId: invoice.id,
              amountDueCents: invoice.amount_due,
              attemptCount: invoice.attempt_count,
            },
          });
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err : String(err), eventType: event.type },
      "Error processing Stripe webhook event",
    );
    return NextResponse.json(
      { success: false, error: "Webhook processing failed" } satisfies ApiResponse,
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, received: true });
}
