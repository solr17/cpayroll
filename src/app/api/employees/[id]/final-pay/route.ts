import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, salaryRecords, leaveBalances, payslips, payRuns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import { calculateFinalPay } from "@/lib/payroll/final-pay";
import type { ApiResponse } from "@/types";

const finalPayQuerySchema = z.object({
  noticePeriodServed: z.enum(["true", "false"]).default("true"),
  isRetrenchment: z.enum(["true", "false"]).default("false"),
  unusedLeaveDays: z.string().optional(),
});

const finalPayPostSchema = z.object({
  noticePeriodServed: z.boolean().default(true),
  isRetrenchment: z.boolean().default(false),
  unusedLeaveDays: z.number().min(0).optional(),
  notes: z.string().optional(),
});

/**
 * Fetch employee's unused annual leave days from leave_balances.
 * Falls back to 0 if no balance record exists.
 */
async function getUnusedLeaveDays(employeeId: string, year: number): Promise<number> {
  const [balance] = await db
    .select({
      entitlementDays: leaveBalances.entitlementDays,
      usedDays: leaveBalances.usedDays,
      carryOverDays: leaveBalances.carryOverDays,
      adjustmentDays: leaveBalances.adjustmentDays,
    })
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.year, year),
        eq(leaveBalances.leaveType, "annual"),
      ),
    )
    .limit(1);

  if (!balance) return 0;

  const entitlement = parseFloat(String(balance.entitlementDays));
  const used = parseFloat(String(balance.usedDays));
  const carryOver = parseFloat(String(balance.carryOverDays));
  const adjustment = parseFloat(String(balance.adjustmentDays));

  return Math.max(0, entitlement + carryOver + adjustment - used);
}

/**
 * Fetch the current (latest) salary record for the employee.
 */
async function getCurrentSalary(employeeId: string) {
  const [salary] = await db
    .select({
      basicSalaryCents: salaryRecords.basicSalaryCents,
      awsMonths: salaryRecords.awsMonths,
    })
    .from(salaryRecords)
    .where(eq(salaryRecords.employeeId, employeeId))
    .orderBy(desc(salaryRecords.effectiveDate))
    .limit(1);

  return salary;
}

/** GET /api/employees/:id/final-pay — Calculate final pay preview */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    // Parse query params
    const url = new URL(request.url);
    const queryParsed = finalPayQuerySchema.safeParse({
      noticePeriodServed: url.searchParams.get("noticePeriodServed") ?? "true",
      isRetrenchment: url.searchParams.get("isRetrenchment") ?? "false",
      unusedLeaveDays: url.searchParams.get("unusedLeaveDays") ?? undefined,
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: queryParsed.error.errors[0]?.message ?? "Invalid parameters",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const {
      noticePeriodServed,
      isRetrenchment,
      unusedLeaveDays: unusedLeaveDaysParam,
    } = queryParsed.data;

    // Fetch employee
    const [employee] = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        hireDate: employees.hireDate,
        terminationDate: employees.terminationDate,
        status: employees.status,
      })
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Get current salary
    const salary = await getCurrentSalary(id);
    if (!salary) {
      return NextResponse.json(
        { success: false, error: "No salary record found for employee" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Determine termination date (use existing if terminated, otherwise today)
    const terminationDate = employee.terminationDate ?? new Date().toISOString().slice(0, 10);

    // Get unused leave days (override from query or fetch from DB)
    const unusedDays =
      unusedLeaveDaysParam !== undefined
        ? parseFloat(unusedLeaveDaysParam)
        : await getUnusedLeaveDays(id, new Date(terminationDate).getFullYear());

    const awsMonths = salary.awsMonths ? parseFloat(String(salary.awsMonths)) : 0;

    const result = calculateFinalPay({
      employeeId: id,
      terminationDate,
      hireDate: employee.hireDate,
      basicSalaryCents: salary.basicSalaryCents,
      awsMonths,
      unusedLeaveDays: unusedDays,
      noticePeriodServed: noticePeriodServed === "true",
      isRetrenchment: isRetrenchment === "true",
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        employeeName: employee.fullName,
        hireDate: employee.hireDate,
        terminationDate,
        basicSalaryCents: salary.basicSalaryCents,
        awsMonths,
        unusedLeaveDays: unusedDays,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/employees/:id/final-pay — Generate final pay statement / payslip record */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    const body = await request.json();
    const parsed = finalPayPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const {
      noticePeriodServed,
      isRetrenchment,
      unusedLeaveDays: unusedLeaveDaysOverride,
      notes,
    } = parsed.data;

    // Fetch employee — must be terminated
    const [employee] = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        hireDate: employees.hireDate,
        terminationDate: employees.terminationDate,
        status: employees.status,
      })
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    if (employee.status !== "terminated" || !employee.terminationDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Employee must be terminated before generating final pay",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Get current salary
    const salary = await getCurrentSalary(id);
    if (!salary) {
      return NextResponse.json(
        { success: false, error: "No salary record found for employee" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const terminationDate = employee.terminationDate;
    const unusedDays =
      unusedLeaveDaysOverride !== undefined
        ? unusedLeaveDaysOverride
        : await getUnusedLeaveDays(id, new Date(terminationDate).getFullYear());

    const awsMonths = salary.awsMonths ? parseFloat(String(salary.awsMonths)) : 0;

    const result = calculateFinalPay({
      employeeId: id,
      terminationDate,
      hireDate: employee.hireDate,
      basicSalaryCents: salary.basicSalaryCents,
      awsMonths,
      unusedLeaveDays: unusedDays,
      noticePeriodServed,
      isRetrenchment,
    });

    // Create a special pay run for the final pay
    const [payRun] = await db
      .insert(payRuns)
      .values({
        companyId: session.companyId,
        periodStart: terminationDate,
        periodEnd: terminationDate,
        payDate: terminationDate,
        status: "approved",
        totalGrossCents: result.totalFinalPayCents,
        totalNetCents: result.totalFinalPayCents,
        totalEmployerCpfCents: 0,
        totalEmployeeCpfCents: 0,
        totalSdlCents: 0,
        totalFwlCents: 0,
        createdBy: session.id,
        approvedBy: session.id,
        approvedAt: new Date(),
      })
      .returning({ id: payRuns.id });

    if (!payRun) {
      return NextResponse.json(
        { success: false, error: "Failed to create final pay run" } satisfies ApiResponse,
        { status: 500 },
      );
    }

    // Build allowances JSON for the payslip breakdown
    const allowancesJson = result.breakdown.map((item) => ({
      name: item.label,
      amountCents: item.amountCents,
      isFixed: false,
    }));

    // Create payslip record
    const [payslip] = await db
      .insert(payslips)
      .values({
        payRunId: payRun.id,
        employeeId: id,
        basicSalaryCents: salary.basicSalaryCents,
        grossPayCents: result.totalFinalPayCents,
        allowancesJson,
        deductionsJson: [
          {
            name: notes ? `Final Pay - ${notes}` : "Final Pay Statement",
            amountCents: 0,
            type: "statutory" as const,
          },
        ],
        employerCpfCents: 0,
        employeeCpfCents: 0,
        sdlCents: 0,
        fwlCents: 0,
        shgCents: 0,
        netPayCents: result.totalFinalPayCents,
        employerTotalCostCents: result.totalFinalPayCents,
      })
      .returning({ id: payslips.id });

    // Audit log
    await logAudit({
      userId: session.id,
      action: "generate_final_pay",
      entityType: "employee",
      entityId: id,
      newValue: {
        payRunId: payRun.id,
        payslipId: payslip?.id,
        totalFinalPayCents: result.totalFinalPayCents,
        leaveEncashmentCents: result.leaveEncashmentCents,
        proRatedAwsCents: result.proRatedAwsCents,
        noticePeriodPayCents: result.noticePeriodPayCents,
        retrenchmentBenefitCents: result.retrenchmentBenefitCents,
        noticePeriodServed,
        isRetrenchment,
        unusedLeaveDays: unusedDays,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        payRunId: payRun.id,
        payslipId: payslip?.id,
        ...result,
        employeeName: employee.fullName,
        hireDate: employee.hireDate,
        terminationDate,
        basicSalaryCents: salary.basicSalaryCents,
        awsMonths,
        unusedLeaveDays: unusedDays,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
