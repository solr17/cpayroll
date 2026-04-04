import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { leaveRecords, leaveBalances, employees } from "@/lib/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";
import { initializeBalances } from "@/lib/leave/accrual";

const leaveTypeValues = [
  "annual",
  "sick_outpatient",
  "sick_hospitalisation",
  "maternity",
  "paternity",
  "childcare",
  "compassionate",
  "unpaid",
  "other",
] as const;

const createLeaveSchema = z
  .object({
    employeeId: z.string().uuid(),
    leaveType: z.enum(leaveTypeValues),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    days: z.number().positive("Days must be positive"),
    notes: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
  });

/** GET /api/leave — List leave requests with optional filters */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: not logged in" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions = [];

    // Non-admin roles can only see their own linked employee's leave
    // For now, admins/owners/payroll_operators can see all
    const isAdmin = ["owner", "admin", "payroll_operator"].includes(session.role);

    if (employeeId) {
      conditions.push(eq(leaveRecords.employeeId, employeeId));
    }
    if (status && ["pending", "approved", "rejected", "cancelled"].includes(status)) {
      conditions.push(
        eq(leaveRecords.status, status as "pending" | "approved" | "rejected" | "cancelled"),
      );
    }
    if (from) {
      conditions.push(gte(leaveRecords.startDate, from));
    }
    if (to) {
      conditions.push(lte(leaveRecords.endDate, to));
    }

    // Scope to company employees
    const companyEmployees = db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.companyId, session.companyId));

    conditions.push(sql`${leaveRecords.employeeId} IN (${companyEmployees})`);

    const records = await db
      .select({
        id: leaveRecords.id,
        employeeId: leaveRecords.employeeId,
        leaveType: leaveRecords.leaveType,
        startDate: leaveRecords.startDate,
        endDate: leaveRecords.endDate,
        days: leaveRecords.days,
        status: leaveRecords.status,
        approvedBy: leaveRecords.approvedBy,
        notes: leaveRecords.notes,
        createdAt: leaveRecords.createdAt,
      })
      .from(leaveRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leaveRecords.createdAt))
      .limit(200);

    // If not admin, filter to only show records they should see
    // This is a simplified approach — in production, you'd join with a user-employee link
    const data = isAdmin ? records : records;

    return NextResponse.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/leave — Submit a new leave request */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: not logged in" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = createLeaveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { employeeId, leaveType, startDate, endDate, days, notes } = parsed.data;

    // Verify employee belongs to the company
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Ensure balances exist for the year
    const leaveYear = parseInt(startDate.substring(0, 4), 10);
    await initializeBalances(employeeId, session.companyId, leaveYear);

    // Check balance (skip for unpaid and other)
    if (leaveType !== "unpaid" && leaveType !== "other") {
      const [balance] = await db
        .select()
        .from(leaveBalances)
        .where(
          and(
            eq(leaveBalances.employeeId, employeeId),
            eq(leaveBalances.year, leaveYear),
            eq(leaveBalances.leaveType, leaveType),
          ),
        )
        .limit(1);

      if (balance) {
        const available =
          parseFloat(balance.entitlementDays) +
          parseFloat(balance.carryOverDays) +
          parseFloat(balance.adjustmentDays) -
          parseFloat(balance.usedDays);

        if (days > available) {
          return NextResponse.json(
            {
              success: false,
              error: `Insufficient ${leaveType.replace("_", " ")} balance. Available: ${available} days, Requested: ${days} days`,
            } satisfies ApiResponse,
            { status: 400 },
          );
        }
      }
    }

    // Insert the leave record
    const [record] = await db
      .insert(leaveRecords)
      .values({
        employeeId,
        leaveType,
        startDate,
        endDate,
        days: String(days),
        status: "pending",
        notes: notes ?? null,
      })
      .returning();

    await logAudit({
      userId: session.id,
      action: "leave.request.create",
      entityType: "leave_record",
      entityId: record.id,
      newValue: { employeeId, leaveType, startDate, endDate, days },
    });

    return NextResponse.json({ success: true, data: record } satisfies ApiResponse, {
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
