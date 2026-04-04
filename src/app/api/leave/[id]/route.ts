import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { leaveRecords, leaveBalances, employees } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const updateLeaveSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

/** PATCH /api/leave/[id] — Approve or reject a leave request */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: not logged in" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    // Only owner, admin, payroll_operator can approve/reject
    if (!["owner", "admin", "payroll_operator"].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: insufficient role" } satisfies ApiResponse,
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateLeaveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Get the leave record and verify it belongs to this company
    const [record] = await db
      .select({
        id: leaveRecords.id,
        employeeId: leaveRecords.employeeId,
        leaveType: leaveRecords.leaveType,
        startDate: leaveRecords.startDate,
        days: leaveRecords.days,
        status: leaveRecords.status,
      })
      .from(leaveRecords)
      .innerJoin(employees, eq(employees.id, leaveRecords.employeeId))
      .where(and(eq(leaveRecords.id, id), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Leave request not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    if (record.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot update leave request with status '${record.status}'. Only pending requests can be approved or rejected.`,
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const newStatus = parsed.data.status;

    // Update the leave record
    const [updated] = await db
      .update(leaveRecords)
      .set({
        status: newStatus,
        approvedBy: session.id,
        updatedAt: new Date(),
      })
      .where(eq(leaveRecords.id, id))
      .returning();

    // If approved, update the used days in leave balances
    if (newStatus === "approved") {
      const leaveYear = parseInt(record.startDate.substring(0, 4), 10);
      const days = parseFloat(record.days);

      await db
        .update(leaveBalances)
        .set({
          usedDays: sql`${leaveBalances.usedDays}::numeric + ${days}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveBalances.employeeId, record.employeeId),
            eq(leaveBalances.year, leaveYear),
            eq(leaveBalances.leaveType, record.leaveType),
          ),
        );
    }

    await logAudit({
      userId: session.id,
      action: `leave.request.${newStatus}`,
      entityType: "leave_record",
      entityId: id,
      oldValue: { status: record.status },
      newValue: { status: newStatus },
    });

    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** DELETE /api/leave/[id] — Cancel a pending leave request */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: not logged in" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    const { id } = await params;
    const isAdmin = ["owner", "admin"].includes(session.role);

    // Get the leave record
    const [record] = await db
      .select({
        id: leaveRecords.id,
        employeeId: leaveRecords.employeeId,
        leaveType: leaveRecords.leaveType,
        startDate: leaveRecords.startDate,
        days: leaveRecords.days,
        status: leaveRecords.status,
      })
      .from(leaveRecords)
      .innerJoin(employees, eq(employees.id, leaveRecords.employeeId))
      .where(and(eq(leaveRecords.id, id), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Leave request not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Only pending requests can be cancelled (unless admin cancelling an approved one)
    const canCancel = record.status === "pending" || (record.status === "approved" && isAdmin);

    if (!canCancel) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel leave request with status '${record.status}'.`,
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const wasApproved = record.status === "approved";

    // Update status to cancelled
    const [updated] = await db
      .update(leaveRecords)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(leaveRecords.id, id))
      .returning();

    // If the request was already approved, reverse the used days
    if (wasApproved) {
      const leaveYear = parseInt(record.startDate.substring(0, 4), 10);
      const days = parseFloat(record.days);

      await db
        .update(leaveBalances)
        .set({
          usedDays: sql`GREATEST(${leaveBalances.usedDays}::numeric - ${days}, 0)`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveBalances.employeeId, record.employeeId),
            eq(leaveBalances.year, leaveYear),
            eq(leaveBalances.leaveType, record.leaveType),
          ),
        );
    }

    await logAudit({
      userId: session.id,
      action: "leave.request.cancel",
      entityType: "leave_record",
      entityId: id,
      oldValue: { status: record.status },
      newValue: { status: "cancelled" },
    });

    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
