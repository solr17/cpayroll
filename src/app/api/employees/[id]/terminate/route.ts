import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, salaryRecords, leaveBalances } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import { z } from "zod";
import { calculateFinalPay } from "@/lib/payroll/final-pay";
import type { ApiResponse } from "@/types";

const TERMINATION_REASONS = [
  "resignation",
  "retrenchment",
  "end_of_contract",
  "misconduct",
  "mutual_agreement",
  "retirement",
  "death",
  "poor_performance",
  "other",
] as const;

const terminateSchema = z.object({
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  terminationReason: z.enum(TERMINATION_REASONS, {
    errorMap: () => ({ message: `Reason must be one of: ${TERMINATION_REASONS.join(", ")}` }),
  }),
  noticePeriodServed: z.boolean().default(true),
  isRetrenchment: z.boolean().default(false),
  unusedLeaveDays: z.number().min(0).optional(),
});

/** POST /api/employees/:id/terminate — Terminate an employee */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    const body = await request.json();
    const parsed = terminateSchema.safeParse(body);

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
      terminationDate,
      terminationReason,
      noticePeriodServed,
      isRetrenchment,
      unusedLeaveDays: unusedLeaveDaysOverride,
    } = parsed.data;

    const [employee] = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        hireDate: employees.hireDate,
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

    if (employee.status === "terminated") {
      return NextResponse.json(
        { success: false, error: "Employee is already terminated" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Update employee status
    await db
      .update(employees)
      .set({
        terminationDate,
        terminationReason,
        status: "terminated",
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id));

    await logAudit({
      userId: session.id,
      action: "terminate_employee",
      entityType: "employee",
      entityId: id,
      newValue: { terminationDate, terminationReason, noticePeriodServed, isRetrenchment },
    });

    // Calculate final pay summary
    let finalPaySummary = null;
    try {
      // Get current salary
      const [salary] = await db
        .select({
          basicSalaryCents: salaryRecords.basicSalaryCents,
          awsMonths: salaryRecords.awsMonths,
        })
        .from(salaryRecords)
        .where(eq(salaryRecords.employeeId, id))
        .orderBy(desc(salaryRecords.effectiveDate))
        .limit(1);

      if (salary) {
        // Get unused leave days
        let unusedDays = unusedLeaveDaysOverride ?? 0;
        if (unusedLeaveDaysOverride === undefined) {
          const year = new Date(terminationDate).getFullYear();
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
                eq(leaveBalances.employeeId, id),
                eq(leaveBalances.year, year),
                eq(leaveBalances.leaveType, "annual"),
              ),
            )
            .limit(1);

          if (balance) {
            const entitlement = parseFloat(String(balance.entitlementDays));
            const used = parseFloat(String(balance.usedDays));
            const carryOver = parseFloat(String(balance.carryOverDays));
            const adjustment = parseFloat(String(balance.adjustmentDays));
            unusedDays = Math.max(0, entitlement + carryOver + adjustment - used);
          }
        }

        const awsMonths = salary.awsMonths ? parseFloat(String(salary.awsMonths)) : 0;

        finalPaySummary = calculateFinalPay({
          employeeId: id,
          terminationDate,
          hireDate: employee.hireDate,
          basicSalaryCents: salary.basicSalaryCents,
          awsMonths,
          unusedLeaveDays: unusedDays,
          noticePeriodServed,
          isRetrenchment,
        });
      }
    } catch {
      // Final pay calculation is non-blocking — termination still succeeds
    }

    // Fire-and-forget webhook dispatch
    dispatchWebhook(session.companyId, "employee.terminated", {
      employeeId: id,
      terminationDate,
      terminationReason,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        id,
        status: "terminated",
        terminationDate,
        terminationReason,
        finalPay: finalPaySummary,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
