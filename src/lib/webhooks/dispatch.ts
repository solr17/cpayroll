import { createHmac, randomUUID } from "crypto";
import { db } from "@/lib/db";
import { webhooks, webhookLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** All supported webhook event types */
export const WEBHOOK_EVENTS = {
  "payroll.calculated": "Fired when a pay run calculation completes",
  "payroll.approved": "Fired when a pay run is approved",
  "payroll.paid": "Fired when a pay run is marked as paid",
  "employee.created": "Fired when a new employee is added",
  "employee.updated": "Fired when an employee record is updated",
  "employee.terminated": "Fired when an employee is terminated",
  "leave.requested": "Fired when leave is requested",
  "leave.approved": "Fired when leave is approved",
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

/** Timeout for webhook HTTP calls (ms) */
const WEBHOOK_TIMEOUT_MS = 10_000;

/** Max consecutive failures before auto-deactivation */
const MAX_FAIL_COUNT = 10;

/**
 * Create HMAC-SHA256 signature of a payload string using a hex secret.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Send a single webhook delivery and log the result.
 */
async function deliverWebhook(
  webhook: { id: string; url: string; secret: string; failCount: number },
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, webhook.secret);
  const deliveryId = randomUUID();

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ClinicPay-Signature": `sha256=${signature}`,
        "X-ClinicPay-Event": event,
        "X-ClinicPay-Delivery": deliveryId,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = response.status;

    // Read up to 4KB of response body for logging
    const text = await response.text();
    responseBody = text.slice(0, 4096);
    success = response.ok;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : "Unknown delivery error";
    success = false;
  }

  // Log the delivery attempt
  await db.insert(webhookLogs).values({
    webhookId: webhook.id,
    event,
    payload,
    responseStatus,
    responseBody,
    success,
    attemptNumber: 1,
  });

  // Update webhook metadata
  if (success) {
    await db
      .update(webhooks)
      .set({
        lastTriggeredAt: new Date(),
        failCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, webhook.id));
  } else {
    const newFailCount = webhook.failCount + 1;
    await db
      .update(webhooks)
      .set({
        lastTriggeredAt: new Date(),
        failCount: newFailCount,
        // Auto-deactivate after MAX_FAIL_COUNT consecutive failures
        ...(newFailCount >= MAX_FAIL_COUNT ? { active: false } : {}),
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, webhook.id));
  }
}

/**
 * Dispatch a webhook event to all active subscribers for a company.
 *
 * This is fire-and-forget. It resolves quickly and never throws,
 * so it will not block the calling request handler.
 */
export async function dispatchWebhook(
  companyId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  // Find all active webhooks for this company subscribed to this event
  const activeWebhooks = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      secret: webhooks.secret,
      events: webhooks.events,
      failCount: webhooks.failCount,
    })
    .from(webhooks)
    .where(and(eq(webhooks.companyId, companyId), eq(webhooks.active, true)));

  // Filter to those subscribed to this specific event
  const matching = activeWebhooks.filter((wh: { events: unknown }) => {
    const events = wh.events as string[];
    return Array.isArray(events) && events.includes(event);
  });

  if (matching.length === 0) return;

  // Enrich payload with metadata
  const enrichedPayload = {
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  };

  type WebhookRow = { id: string; url: string; secret: string; failCount: number };

  // Fire all deliveries concurrently, catching individual errors
  await Promise.all(
    matching.map((wh: WebhookRow) =>
      deliverWebhook(wh, event, enrichedPayload).catch(() => {
        // Swallow — individual delivery errors are already logged in webhook_logs
      }),
    ),
  );
}

/**
 * Send a test ping event to a specific webhook.
 */
export async function sendTestWebhook(webhookId: string): Promise<{
  success: boolean;
  responseStatus: number | null;
  responseBody: string | null;
}> {
  const [webhook] = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      secret: webhooks.secret,
      failCount: webhooks.failCount,
    })
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!webhook) {
    throw new Error("Webhook not found");
  }

  const testPayload = {
    event: "test.ping" as const,
    timestamp: new Date().toISOString(),
    data: { message: "This is a test webhook delivery from ClinicPay" },
  };

  const body = JSON.stringify(testPayload);
  const signature = signPayload(body, webhook.secret);
  const deliveryId = randomUUID();

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ClinicPay-Signature": `sha256=${signature}`,
        "X-ClinicPay-Event": "test.ping",
        "X-ClinicPay-Delivery": deliveryId,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = response.status;
    const text = await response.text();
    responseBody = text.slice(0, 4096);
    success = response.ok;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : "Unknown delivery error";
    success = false;
  }

  // Log the test delivery
  await db.insert(webhookLogs).values({
    webhookId: webhook.id,
    event: "test.ping",
    payload: testPayload,
    responseStatus,
    responseBody,
    success,
    attemptNumber: 1,
  });

  return { success, responseStatus, responseBody };
}
