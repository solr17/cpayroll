import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const updateSchema = z.object({
  status: z.enum(["submitted", "processing", "completed", "failed", "cancelled"]),
  bankReference: z.string().max(100).optional(),
  failureReason: z.string().max(500).optional(),
});

/** GET /api/payments/[id] — Get single payment */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin", "payroll_operator");
    const { id } = await params;

    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.companyId, session.companyId)))
      .limit(1);

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: payment } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** PATCH /api/payments/[id] — Update payment status */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin", "payroll_operator");
    const { id } = await params;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { status: newStatus, bankReference, failureReason } = parsed.data;

    // Fetch existing payment
    const [existing] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.companyId, session.companyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Payment not found" } satisfies ApiResponse,
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
    if (failureReason !== undefined) {
      updateValues.failureReason = failureReason;
    }
    if (newStatus === "submitted") {
      updateValues.submittedAt = new Date();
    }
    if (newStatus === "completed") {
      updateValues.completedAt = new Date();
    }

    await db.update(payments).set(updateValues).where(eq(payments.id, id));

    await logAudit({
      userId: session.id,
      action: "update_payment_status",
      entityType: "payment",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: newStatus, bankReference, failureReason },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Return updated payment
    const [updated] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);

    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
