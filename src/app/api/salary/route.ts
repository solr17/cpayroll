import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salaryRecords, employees } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const createSalarySchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  basicSalaryCents: z.number().int().min(0, "Salary must be non-negative"),
  allowancesJson: z
    .array(
      z.object({
        name: z.string().min(1),
        amountCents: z.number().int().min(0),
        isFixed: z.boolean(),
      }),
    )
    .optional(),
  otEligible: z.boolean().default(false),
  otRateMultiplier: z.number().min(1).max(10).default(1.5),
  awsMonths: z.number().min(0).max(12).default(0),
});

/** GET /api/salary — List salary records for an employee */
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const employeeId = request.nextUrl.searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "employeeId query parameter is required" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Verify employee belongs to the same company
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!emp) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const records = await db
      .select()
      .from(salaryRecords)
      .where(eq(salaryRecords.employeeId, employeeId))
      .orderBy(desc(salaryRecords.effectiveDate));

    return NextResponse.json({
      success: true,
      data: records,
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/salary — Create a new salary record (append-only) */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = createSalarySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const input = parsed.data;

    // Verify employee belongs to the same company
    const [emp] = await db
      .select({ id: employees.id, fullName: employees.fullName })
      .from(employees)
      .where(and(eq(employees.id, input.employeeId), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!emp) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const [record] = await db
      .insert(salaryRecords)
      .values({
        employeeId: input.employeeId,
        effectiveDate: input.effectiveDate,
        basicSalaryCents: input.basicSalaryCents,
        allowancesJson: input.allowancesJson ?? null,
        otEligible: input.otEligible,
        otRateMultiplier: String(input.otRateMultiplier),
        awsMonths: String(input.awsMonths),
        createdBy: session.id,
      })
      .returning();

    await logAudit({
      userId: session.id,
      action: "create_salary_record",
      entityType: "salary_record",
      entityId: record?.id,
      newValue: {
        employeeId: input.employeeId,
        effectiveDate: input.effectiveDate,
        basicSalaryCents: input.basicSalaryCents,
        otEligible: input.otEligible,
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
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
