import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payslips, payRuns, employees, cpfRecords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import type { ApiResponse } from "@/types";

/** GET /api/payroll/payslips/[id] — Get a single payslip with employee details and CPF record */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // First try as owner/admin
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: not logged in" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    // Fetch payslip with employee and pay run data
    const [result] = await db
      .select({
        payslip: payslips,
        employeeName: employees.fullName,
        nricLast4: employees.nricLast4,
        department: employees.department,
        position: employees.position,
        citizenshipStatus: employees.citizenshipStatus,
        employeeCompanyId: employees.companyId,
        payRunPeriodStart: payRuns.periodStart,
        payRunPeriodEnd: payRuns.periodEnd,
        payRunPayDate: payRuns.payDate,
        payRunStatus: payRuns.status,
        payRunCompanyId: payRuns.companyId,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .innerJoin(payRuns, eq(payslips.payRunId, payRuns.id))
      .where(eq(payslips.id, id))
      .limit(1);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Payslip not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Authorization: owner/admin can see any payslip in their company,
    // employee can only see their own payslip
    const isCompanyAdmin =
      (session.role === "owner" || session.role === "admin") &&
      result.payRunCompanyId === session.companyId;
    const isOwnPayslip = session.role === "employee" && result.payslip.employeeId === session.id;

    if (!isCompanyAdmin && !isOwnPayslip) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: insufficient permissions" } satisfies ApiResponse,
        { status: 403 },
      );
    }

    // Fetch CPF record for this payslip
    const [cpfRecord] = await db
      .select()
      .from(cpfRecords)
      .where(eq(cpfRecords.payslipId, id))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        payslip: result.payslip,
        employee: {
          name: result.employeeName,
          nricLast4: result.nricLast4,
          department: result.department,
          position: result.position,
          citizenshipStatus: result.citizenshipStatus,
        },
        payRun: {
          periodStart: result.payRunPeriodStart,
          periodEnd: result.payRunPeriodEnd,
          payDate: result.payRunPayDate,
          status: result.payRunStatus,
        },
        cpfRecord: cpfRecord ?? null,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
