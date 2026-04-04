import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import type { ApiResponse } from "@/types";

/** GET /api/payments — List payments with filters */
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin", "payroll_operator");
    const { searchParams } = new URL(request.url);

    const payRunId = searchParams.get("payRunId");
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(payments.companyId, session.companyId)];

    if (payRunId) {
      conditions.push(eq(payments.payRunId, payRunId));
    }
    if (status) {
      conditions.push(sql`${payments.status} = ${status}`);
    }
    if (employeeId) {
      conditions.push(eq(payments.employeeId, employeeId));
    }
    if (dateFrom) {
      conditions.push(sql`${payments.createdAt} >= ${dateFrom}::timestamptz`);
    }
    if (dateTo) {
      conditions.push(sql`${payments.createdAt} <= ${dateTo}::timestamptz`);
    }

    const whereClause = and(...conditions);

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: payments.id,
          payRunId: payments.payRunId,
          payslipId: payments.payslipId,
          employeeId: payments.employeeId,
          employeeName: payments.employeeName,
          bankName: payments.bankName,
          accountNumberMasked: payments.accountNumberMasked,
          amountCents: payments.amountCents,
          status: payments.status,
          paymentMethod: payments.paymentMethod,
          bankReference: payments.bankReference,
          failureReason: payments.failureReason,
          submittedAt: payments.submittedAt,
          completedAt: payments.completedAt,
          createdAt: payments.createdAt,
          updatedAt: payments.updatedAt,
        })
        .from(payments)
        .where(whereClause)
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    // Summary aggregation for the filtered set
    const summaryRows = await db
      .select({
        status: payments.status,
        count: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      })
      .from(payments)
      .where(whereClause)
      .groupBy(payments.status);

    const summary: Record<string, { count: number; totalCents: number }> = {};
    for (const row of summaryRows) {
      summary[row.status] = { count: row.count, totalCents: row.totalCents };
    }

    return NextResponse.json({
      success: true,
      data: {
        payments: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        summary,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
