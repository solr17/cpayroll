import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salaryRecords, employees } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const bulkRevisionSchema = z.object({
  action: z.enum(["preview", "apply"]),
  method: z.enum(["percentage", "fixed"]),
  value: z.number().positive("Value must be positive"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  employeeIds: z.array(z.string().uuid()).optional(),
});

interface EmployeePreview {
  id: string;
  name: string;
  department: string | null;
  currentBasicCents: number;
  newBasicCents: number;
  changeCents: number;
  changePercent: number;
}

/**
 * Compute the new salary in integer cents.
 * - percentage: Math.round(current * (1 + pct/100))
 * - fixed: current + fixedCents
 */
function computeNewSalary(
  currentCents: number,
  method: "percentage" | "fixed",
  value: number,
): number {
  if (method === "percentage") {
    return Math.round(currentCents * (1 + value / 100));
  }
  // fixed: value is already in cents
  return currentCents + Math.round(value);
}

/** POST /api/salary/bulk-revision — Preview or apply bulk salary revision */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = bulkRevisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { action, method, value, effectiveDate, employeeIds } = parsed.data;

    // 1. Get active employees for this company
    const activeEmployees = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        department: employees.department,
      })
      .from(employees)
      .where(and(eq(employees.companyId, session.companyId), eq(employees.status, "active")))
      .orderBy(employees.fullName);

    // Filter to requested IDs if provided
    const targetEmployees = employeeIds
      ? activeEmployees.filter((e: (typeof activeEmployees)[number]) => employeeIds.includes(e.id))
      : activeEmployees;

    if (targetEmployees.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active employees found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // 2. Get the latest salary record for each employee
    const previews: EmployeePreview[] = [];
    const errors: string[] = [];

    for (const emp of targetEmployees) {
      const [latestSalary] = await db
        .select({
          id: salaryRecords.id,
          basicSalaryCents: salaryRecords.basicSalaryCents,
          allowancesJson: salaryRecords.allowancesJson,
          otEligible: salaryRecords.otEligible,
          otRateMultiplier: salaryRecords.otRateMultiplier,
          awsMonths: salaryRecords.awsMonths,
        })
        .from(salaryRecords)
        .where(eq(salaryRecords.employeeId, emp.id))
        .orderBy(desc(salaryRecords.effectiveDate))
        .limit(1);

      if (!latestSalary) {
        errors.push(`${emp.fullName}: No existing salary record found`);
        continue;
      }

      const currentCents = latestSalary.basicSalaryCents;
      const newCents = computeNewSalary(currentCents, method, value);
      const changeCents = newCents - currentCents;
      const changePercent =
        currentCents > 0 ? Math.round((changeCents / currentCents) * 10000) / 100 : 0;

      previews.push({
        id: emp.id,
        name: emp.fullName,
        department: emp.department,
        currentBasicCents: currentCents,
        newBasicCents: newCents,
        changeCents,
        changePercent,
      });
    }

    // 3. Preview only — return computed data without saving
    if (action === "preview") {
      return NextResponse.json({
        success: true,
        data: { employees: previews, errors },
      } satisfies ApiResponse);
    }

    // 4. Apply — create new salary records
    let applied = 0;

    for (const preview of previews) {
      // Re-fetch the latest salary to copy all fields
      const [latestSalary] = await db
        .select({
          basicSalaryCents: salaryRecords.basicSalaryCents,
          allowancesJson: salaryRecords.allowancesJson,
          otEligible: salaryRecords.otEligible,
          otRateMultiplier: salaryRecords.otRateMultiplier,
          awsMonths: salaryRecords.awsMonths,
        })
        .from(salaryRecords)
        .where(eq(salaryRecords.employeeId, preview.id))
        .orderBy(desc(salaryRecords.effectiveDate))
        .limit(1);

      if (!latestSalary) {
        errors.push(`${preview.name}: Salary record disappeared during apply`);
        continue;
      }

      const [newRecord] = await db
        .insert(salaryRecords)
        .values({
          employeeId: preview.id,
          effectiveDate,
          basicSalaryCents: preview.newBasicCents,
          allowancesJson: latestSalary.allowancesJson,
          otEligible: latestSalary.otEligible,
          otRateMultiplier: latestSalary.otRateMultiplier,
          awsMonths: latestSalary.awsMonths,
          createdBy: session.id,
        })
        .returning();

      await logAudit({
        userId: session.id,
        action: "bulk_salary_revision",
        entityType: "salary_record",
        entityId: newRecord?.id,
        oldValue: {
          employeeId: preview.id,
          basicSalaryCents: preview.currentBasicCents,
        },
        newValue: {
          employeeId: preview.id,
          basicSalaryCents: preview.newBasicCents,
          effectiveDate,
          method,
          value,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      });

      applied++;
    }

    return NextResponse.json({
      success: true,
      data: { applied, errors },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
