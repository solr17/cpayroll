import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const bulkUpdateSchema = z.object({
  paymentIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(["submitted", "processing", "completed", "failed", "cancelled"]),
  bankReference: z.string().max(100).optional(),
});

/** POST /api/payments/bulk-update — Bulk update payment statuses */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin", "payroll_operator");

    const body = await request.json();
    const parsed = bulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { paymentIds, status: newStatus, bankReference } = parsed.data;

    // Verify all payments belong to this company
    const existing = await db
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(and(eq(payments.companyId, session.companyId), inArray(payments.id, paymentIds)));

    if (existing.length !== paymentIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Only ${existing.length} of ${paymentIds.length} payments found for your company`,
        } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Build update values
    const updateValues: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (bankReference !== undefined) {
      updateValues.bankReference = bankReference;
    }
    if (newStatus === "submitted") {
      updateValues.submittedAt = new Date();
    }
    if (newStatus === "completed") {
      updateValues.completedAt = new Date();
    }

    await db
      .update(payments)
      .set(updateValues)
      .where(and(eq(payments.companyId, session.companyId), inArray(payments.id, paymentIds)));

    await logAudit({
      userId: session.id,
      action: "bulk_update_payment_status",
      entityType: "payment",
      entityId: paymentIds[0],
      newValue: { paymentIds, status: newStatus, bankReference, count: paymentIds.length },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { updated: existing.length, status: newStatus },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
