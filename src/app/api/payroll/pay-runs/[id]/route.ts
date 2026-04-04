import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getPayRun, getPayRunPayslips, deletePayRun } from "@/lib/payroll/pay-run";
import { logAudit } from "@/lib/audit/log";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ApiResponse } from "@/types";

/** GET /api/payroll/pay-runs/[id] — Get a single pay run with payslips */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    const run = await getPayRun(id, session.companyId);
    if (!run) {
      return NextResponse.json(
        { success: false, error: "Pay run not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const payslips = await getPayRunPayslips(id);

    // Look up approver names for dual approval display
    let firstApproverName: string | null = null;
    let secondApproverName: string | null = null;

    if (run.firstApprovedBy) {
      const [u] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, run.firstApprovedBy))
        .limit(1);
      firstApproverName = u?.name ?? null;
    }
    if (run.secondApprovedBy) {
      const [u] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, run.secondApprovedBy))
        .limit(1);
      secondApproverName = u?.name ?? null;
    }

    return NextResponse.json({
      success: true,
      data: { ...run, payslips, firstApproverName, secondApproverName },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** DELETE /api/payroll/pay-runs/[id] — Delete a draft pay run */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    await deletePayRun(id, session.companyId, session.id);

    await logAudit({
      userId: session.id,
      action: "delete_pay_run_api",
      entityType: "pay_run",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    let status = 500;
    if (message.startsWith("Unauthorized")) status = 401;
    else if (message === "Pay run not found") status = 404;
    else if (message === "Can only delete draft pay runs") status = 409;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
