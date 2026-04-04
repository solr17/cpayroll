import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payslips, payRuns, employees, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { generatePayNowQrString, generatePayNowQrSvg } from "@/lib/bank/paynow-qr";
import type { ApiResponse } from "@/types";

interface PayNowByPayslipBody {
  payslipId: string;
}

interface PayNowByAmountBody {
  employeeId: string;
  amountCents: number;
  reference: string;
}

type PayNowRequestBody = PayNowByPayslipBody | PayNowByAmountBody;

function isPayslipRequest(body: PayNowRequestBody): body is PayNowByPayslipBody {
  return "payslipId" in body && typeof (body as PayNowByPayslipBody).payslipId === "string";
}

/** POST /api/payroll/paynow — Generate PayNow QR for a specific payment */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin", "payroll_operator");
    const body = (await request.json()) as PayNowRequestBody;

    // Fetch company UEN
    const [company] = await db
      .select({ uen: companies.uen, name: companies.name })
      .from(companies)
      .where(eq(companies.id, session.companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    if (!company.uen) {
      return NextResponse.json(
        {
          success: false,
          error: "Company UEN is required for PayNow QR generation",
        } satisfies ApiResponse,
        { status: 422 },
      );
    }

    let amountCents: number;
    let reference: string;

    if (isPayslipRequest(body)) {
      // Fetch payslip with pay run for authorization and amount
      const [result] = await db
        .select({
          netPayCents: payslips.netPayCents,
          payRunId: payslips.payRunId,
          employeeId: payslips.employeeId,
          companyId: payRuns.companyId,
          periodStart: payRuns.periodStart,
        })
        .from(payslips)
        .innerJoin(payRuns, eq(payslips.payRunId, payRuns.id))
        .where(eq(payslips.id, body.payslipId))
        .limit(1);

      if (!result) {
        return NextResponse.json(
          { success: false, error: "Payslip not found" } satisfies ApiResponse,
          { status: 404 },
        );
      }

      if (result.companyId !== session.companyId) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized: payslip belongs to another company",
          } satisfies ApiResponse,
          { status: 403 },
        );
      }

      // Fetch employee name for reference
      const [emp] = await db
        .select({ nricLast4: employees.nricLast4 })
        .from(employees)
        .where(eq(employees.id, result.employeeId))
        .limit(1);

      amountCents = result.netPayCents;
      const period = result.periodStart.slice(0, 7);
      reference = `SAL-${period}-${emp?.nricLast4 ?? "XXXX"}`;
    } else {
      // Direct amount request
      if (!body.amountCents || body.amountCents <= 0) {
        return NextResponse.json(
          { success: false, error: "amountCents must be a positive integer" } satisfies ApiResponse,
          { status: 400 },
        );
      }

      // Verify employee belongs to this company
      const [emp] = await db
        .select({ companyId: employees.companyId })
        .from(employees)
        .where(and(eq(employees.id, body.employeeId), eq(employees.companyId, session.companyId)))
        .limit(1);

      if (!emp) {
        return NextResponse.json(
          { success: false, error: "Employee not found in your company" } satisfies ApiResponse,
          { status: 404 },
        );
      }

      amountCents = body.amountCents;
      reference = body.reference;
    }

    const amountDollars = amountCents / 100;

    const qrData = {
      proxyType: "UEN" as const,
      proxyValue: company.uen,
      amount: amountDollars,
      reference,
      merchantName: company.name.substring(0, 25),
      editable: false,
    };

    const qrString = generatePayNowQrString(qrData);
    const qrSvg = await generatePayNowQrSvg(qrData);

    return NextResponse.json({
      success: true,
      data: {
        qrString,
        qrSvg,
        amount: amountDollars,
        amountCents,
        reference,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
