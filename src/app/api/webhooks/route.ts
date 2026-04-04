import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/dispatch";
import type { ApiResponse } from "@/types";

const validEvents = Object.keys(WEBHOOK_EVENTS) as [string, ...string[]];

const createWebhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.enum(validEvents)).min(1, "At least one event is required"),
  description: z.string().max(500).optional(),
});

/** GET /api/webhooks — List all webhooks for the company */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin");

    const result = await db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        active: webhooks.active,
        description: webhooks.description,
        lastTriggeredAt: webhooks.lastTriggeredAt,
        failCount: webhooks.failCount,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(eq(webhooks.companyId, session.companyId))
      .orderBy(webhooks.createdAt);

    return NextResponse.json({ success: true, data: result } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/webhooks — Create a new webhook */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = createWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { url, events, description } = parsed.data;
    const secret = randomBytes(32).toString("hex");

    const [created] = await db
      .insert(webhooks)
      .values({
        companyId: session.companyId,
        url,
        secret,
        events,
        description: description ?? null,
      })
      .returning();

    await logAudit({
      userId: session.id,
      action: "create_webhook",
      entityType: "webhook",
      entityId: created?.id,
      newValue: { url, events, description },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Return secret only on creation so the user can copy it
    return NextResponse.json(
      { success: true, data: { ...created, secret } } satisfies ApiResponse,
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
