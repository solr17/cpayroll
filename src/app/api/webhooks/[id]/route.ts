import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhooks, webhookLogs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/dispatch";
import type { ApiResponse } from "@/types";

const validEvents = Object.keys(WEBHOOK_EVENTS) as [string, ...string[]];

const updateWebhookSchema = z.object({
  url: z.string().url("Must be a valid URL").optional(),
  events: z.array(z.enum(validEvents)).min(1).optional(),
  active: z.boolean().optional(),
  description: z.string().max(500).optional().nullable(),
});

/** GET /api/webhooks/[id] — Get webhook details + recent logs */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    const [webhook] = await db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        active: webhooks.active,
        description: webhooks.description,
        lastTriggeredAt: webhooks.lastTriggeredAt,
        failCount: webhooks.failCount,
        createdAt: webhooks.createdAt,
        updatedAt: webhooks.updatedAt,
      })
      .from(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.companyId, session.companyId)))
      .limit(1);

    if (!webhook) {
      return NextResponse.json(
        { success: false, error: "Webhook not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Fetch recent delivery logs (last 50)
    const logs = await db
      .select({
        id: webhookLogs.id,
        event: webhookLogs.event,
        responseStatus: webhookLogs.responseStatus,
        success: webhookLogs.success,
        attemptNumber: webhookLogs.attemptNumber,
        createdAt: webhookLogs.createdAt,
      })
      .from(webhookLogs)
      .where(eq(webhookLogs.webhookId, id))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      data: { ...webhook, recentLogs: logs },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** PATCH /api/webhooks/[id] — Update webhook */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;
    const body = await request.json();
    const parsed = updateWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Verify ownership
    const [existing] = await db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.companyId, session.companyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Webhook not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const input = parsed.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.url !== undefined) updateData.url = input.url;
    if (input.events !== undefined) updateData.events = input.events;
    if (input.active !== undefined) {
      updateData.active = input.active;
      // Reset fail count when re-activating
      if (input.active) updateData.failCount = 0;
    }
    if (input.description !== undefined) updateData.description = input.description;

    const [updated] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, id))
      .returning();

    await logAudit({
      userId: session.id,
      action: "update_webhook",
      entityType: "webhook",
      entityId: id,
      newValue: { changedFields: Object.keys(input) },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** DELETE /api/webhooks/[id] — Soft delete (deactivate) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    // Verify ownership
    const [existing] = await db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.companyId, session.companyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Webhook not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    await db
      .update(webhooks)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(webhooks.id, id));

    await logAudit({
      userId: session.id,
      action: "delete_webhook",
      entityType: "webhook",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ success: true, data: { id, active: false } } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
