import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salaryRecords, employees } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import type { ApiResponse } from "@/types";

/** GET /api/employees/:id/salary-history — Get salary revision history */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin", "payroll_operator");
    const { id } = await params;

    // Verify employee belongs to company
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const records = await db
      .select({
        id: salaryRecords.id,
        effectiveDate: salaryRecords.effectiveDate,
        basicSalaryCents: salaryRecords.basicSalaryCents,
        allowancesJson: salaryRecords.allowancesJson,
        otEligible: salaryRecords.otEligible,
        otRateMultiplier: salaryRecords.otRateMultiplier,
        awsMonths: salaryRecords.awsMonths,
        createdBy: salaryRecords.createdBy,
        createdAt: salaryRecords.createdAt,
      })
      .from(salaryRecords)
      .where(eq(salaryRecords.employeeId, id))
      .orderBy(desc(salaryRecords.effectiveDate));

    return NextResponse.json({
      success: true,
      data: records,
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
