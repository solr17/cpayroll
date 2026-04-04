import Stripe from "stripe";

/**
 * Stripe client singleton.
 *
 * Required env vars:
 *   - STRIPE_SECRET_KEY          — Stripe secret API key (sk_live_... or sk_test_...)
 *   - STRIPE_WEBHOOK_SECRET      — Webhook endpoint signing secret (whsec_...)
 *   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — Publishable key for future client-side use (pk_...)
 */

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2026-03-25.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}
