import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, payslips, payRuns, companies } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { generateIr21Data } from "@/lib/documents/ir21";
import type { ApiResponse } from "@/types";

/**
 * POST /api/tax/ir21
 *
 * Generate IR21 tax clearance report for a foreign employee leaving Singapore.
 * Body: { employeeId: string, year: number }
 *
 * Returns a downloadable CSV file with IR21 form data.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");

    const body = (await request.json()) as { employeeId?: string; year?: number };
    const { employeeId, year } = body;

    if (!employeeId || !year) {
      return NextResponse.json(
        { success: false, error: "employeeId and year are required" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        { success: false, error: "Invalid year parameter" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Fetch employee — must belong to the same company
    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Only applicable to foreign workers
    if (employee.citizenshipStatus === "SC") {
      return NextResponse.json(
        {
          success: false,
          error: "IR21 is only applicable to foreign employees (non-SC)",
        } satisfies ApiResponse,
        { status: 422 },
      );
    }

    // Fetch company
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, session.companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Aggregate payslip data for the year
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const [annualData] = await db
      .select({
        totalGrossPayCents: sql<number>`COALESCE(SUM(${payslips.grossPayCents}), 0)`,
        totalBonusCents: sql<number>`COALESCE(SUM(COALESCE((${payslips.allowancesJson}->>'bonusCents')::int, 0)), 0)`,
        totalEmployeeCpfCents: sql<number>`COALESCE(SUM(${payslips.employeeCpfCents}), 0)`,
      })
      .from(payslips)
      .innerJoin(payRuns, eq(payslips.payRunId, payRuns.id))
      .where(
        and(
          eq(payslips.employeeId, employeeId),
          sql`${payRuns.periodStart} >= ${yearStart}`,
          sql`${payRuns.periodStart} <= ${yearEnd}`,
          sql`${payRuns.status} != 'draft'`,
        ),
      );

    const cessationDate = employee.terminationDate ?? new Date().toISOString().slice(0, 10);
    const lastDayInSg = employee.terminationDate ?? new Date().toISOString().slice(0, 10);

    const result = generateIr21Data({
      fullName: employee.fullName,
      nricLast4: employee.nricLast4,
      nationality: employee.nationality ?? "Unknown",
      dob: employee.dob,
      cessationDate,
      lastDayInSingapore: lastDayInSg,
      grossSalaryCents: Number(annualData?.totalGrossPayCents ?? 0),
      bonusCents: Number(annualData?.totalBonusCents ?? 0),
      employeeCpfCents: Number(annualData?.totalEmployeeCpfCents ?? 0),
      companyName: company.name,
      companyUen: company.uen,
    });

    await logAudit({
      userId: session.id,
      action: "generate_ir21",
      entityType: "employee",
      entityId: employeeId,
      newValue: { year, employeeName: employee.fullName },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
