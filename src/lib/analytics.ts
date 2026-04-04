import posthog from "posthog-js";

/** Track a product event (no-op if PostHog not configured) */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(event, properties);
  }
}

/** Identify a user after login */
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.identify(userId, traits);
  }
}

/** Reset identity on logout */
export function resetAnalytics() {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.reset();
  }
}
