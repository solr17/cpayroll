import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { sendTestWebhook } from "@/lib/webhooks/dispatch";
import type { ApiResponse } from "@/types";

/** POST /api/webhooks/[id]/test — Send a test event to the webhook URL */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const result = await sendTestWebhook(id);

    return NextResponse.json({
      success: true,
      data: result,
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
