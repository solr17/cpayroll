import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payslips, payRuns, employees, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { generatePayNowQrString, generatePayNowQrSvg } from "@/lib/bank/paynow-qr";
import type { ApiResponse } from "@/types";

/** POST /api/payroll/pay-runs/[id]/paynow-batch — Generate PayNow QRs for entire pay run */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin", "payroll_operator");
    const { id } = await params;

    // Fetch pay run
    const [run] = await db
      .select()
      .from(payRuns)
      .where(and(eq(payRuns.id, id), eq(payRuns.companyId, session.companyId)))
      .limit(1);

    if (!run) {
      return NextResponse.json(
        { success: false, error: "Pay run not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    if (run.status === "draft") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot generate QR codes for a draft pay run. Calculate it first.",
        } satisfies ApiResponse,
        { status: 409 },
      );
    }

    // Fetch company
    const [company] = await db
      .select({ uen: companies.uen, name: companies.name })
      .from(companies)
      .where(eq(companies.id, session.companyId))
      .limit(1);

    if (!company?.uen) {
      return NextResponse.json(
        {
          success: false,
          error: "Company UEN is required for PayNow QR generation",
        } satisfies ApiResponse,
        { status: 422 },
      );
    }

    // Fetch all payslips with employee data
    const slipsWithEmployees = await db
      .select({
        payslipId: payslips.id,
        employeeId: payslips.employeeId,
        netPayCents: payslips.netPayCents,
        employeeName: employees.fullName,
        nricLast4: employees.nricLast4,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.payRunId, id));

    if (slipsWithEmployees.length === 0) {
      return NextResponse.json(
        { success: false, error: "No payslips found in this pay run" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const period = run.periodStart.slice(0, 7);

    // Generate QR codes for each employee
    const qrCodes = await Promise.all(
      slipsWithEmployees.map(async (row: (typeof slipsWithEmployees)[number]) => {
        const amountDollars = row.netPayCents / 100;
        const reference = `SAL-${period}-${row.nricLast4}`;

        const qrData = {
          proxyType: "UEN" as const,
          proxyValue: company.uen,
          amount: amountDollars,
          reference,
          merchantName: company.name.substring(0, 25),
          editable: false,
        };

        const qrString = generatePayNowQrString(qrData);
        const qrSvg = await generatePayNowQrSvg(qrData, 200);

        return {
          payslipId: row.payslipId,
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          nricLast4: row.nricLast4,
          amountCents: row.netPayCents,
          amount: amountDollars,
          reference,
          qrString,
          qrSvg,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        payRunId: id,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        payDate: run.payDate,
        companyName: company.name,
        count: qrCodes.length,
        qrCodes,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
