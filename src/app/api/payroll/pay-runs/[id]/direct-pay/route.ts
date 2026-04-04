import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payRuns, payslips, employees, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { decrypt } from "@/lib/crypto/aes";
import { getBankApiClient } from "@/lib/bank/api";
import { logAudit } from "@/lib/audit/log";
import type { ApiResponse, BankDetails } from "@/types";
import type { PaymentItem } from "@/lib/bank/api";

/**
 * POST /api/payroll/pay-runs/[id]/direct-pay
 *
 * Submit salary payments directly via bank API (DBS RAPID) instead of
 * downloading a GIRO file for manual upload.
 *
 * Requirements:
 *  - Pay run must be in "approved" or "paid" status
 *  - DBS RAPID env vars must be configured
 *  - Only owner/admin can trigger
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    // -----------------------------------------------------------------------
    // 1. Fetch & validate the pay run
    // -----------------------------------------------------------------------

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

    if (run.status !== "approved" && run.status !== "paid") {
      return NextResponse.json(
        {
          success: false,
          error: `Pay run must be approved before submitting payments. Current status: ${run.status}`,
        } satisfies ApiResponse,
        { status: 409 },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Check bank API availability
    // -----------------------------------------------------------------------

    const dbsClient = getBankApiClient("DBS");
    if (!dbsClient) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DBS RAPID API is not configured. Set DBS_RAPID_CLIENT_ID and DBS_RAPID_CLIENT_SECRET environment variables.",
        } satisfies ApiResponse,
        { status: 422 },
      );
    }

    // -----------------------------------------------------------------------
    // 3. Fetch company details for debit account
    // -----------------------------------------------------------------------

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

    const companyBank = company.bankAccountJson as {
      accountNumber?: string;
      bankName?: string;
    } | null;

    const debitAccount = process.env.DBS_RAPID_DEBIT_ACCOUNT ?? companyBank?.accountNumber ?? "";

    if (!debitAccount) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No debit account configured. Set DBS_RAPID_DEBIT_ACCOUNT or update company bank details.",
        } satisfies ApiResponse,
        { status: 422 },
      );
    }

    // -----------------------------------------------------------------------
    // 4. Fetch payslips with employee bank details
    // -----------------------------------------------------------------------

    const slipsWithEmployees = await db
      .select({
        payslip: payslips,
        employeeId: employees.id,
        employeeName: employees.fullName,
        nricLast4: employees.nricLast4,
        bankJsonEncrypted: employees.bankJsonEncrypted,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.payRunId, id));

    if (slipsWithEmployees.length === 0) {
      return NextResponse.json(
        { success: false, error: "No payslips found for this pay run" } satisfies ApiResponse,
        { status: 422 },
      );
    }

    // -----------------------------------------------------------------------
    // 5. Group employees by bank — DBS employees go via API, others via file
    // -----------------------------------------------------------------------

    const dbsPayments: PaymentItem[] = [];
    const nonDbsEmployees: string[] = [];
    const noBankEmployees: string[] = [];

    for (const row of slipsWithEmployees) {
      if (!row.bankJsonEncrypted) {
        noBankEmployees.push(row.employeeName);
        continue;
      }

      let bankDetails: BankDetails;
      try {
        bankDetails = JSON.parse(decrypt(row.bankJsonEncrypted)) as BankDetails;
      } catch {
        noBankEmployees.push(row.employeeName);
        continue;
      }

      const bankUpper = (bankDetails.bankName ?? "").toUpperCase();
      const isDbs = bankUpper === "DBS" || bankUpper === "POSB";

      if (isDbs) {
        dbsPayments.push({
          beneficiaryName: row.employeeName,
          beneficiaryAccount: bankDetails.accountNumber,
          bankCode: bankDetails.bankName,
          branchCode: bankDetails.branchCode,
          amountCents: row.payslip.netPayCents,
          reference: `SAL-${run.periodStart.slice(0, 7)}-${row.nricLast4}`,
          description: `Salary ${run.periodStart} to ${run.periodEnd}`,
        });
      } else {
        nonDbsEmployees.push(row.employeeName);
      }
    }

    if (dbsPayments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No DBS/POSB account holders found in this pay run. Use GIRO file export instead.",
        } satisfies ApiResponse,
        { status: 422 },
      );
    }

    // -----------------------------------------------------------------------
    // 6. Submit to DBS RAPID
    // -----------------------------------------------------------------------

    const batchRef = `PR-${run.id.slice(0, 8)}-${Date.now()}`;

    const result = await dbsClient.submitPayment({
      reference: batchRef,
      debitAccount,
      payments: dbsPayments,
    });

    // -----------------------------------------------------------------------
    // 7. Audit log
    // -----------------------------------------------------------------------

    await logAudit({
      userId: session.id,
      action: "direct_pay_submitted",
      entityType: "pay_run",
      entityId: id,
      newValue: {
        batchId: result.batchId,
        batchRef,
        bank: "DBS",
        paymentCount: dbsPayments.length,
        totalCents: dbsPayments.reduce((sum, p) => sum + p.amountCents, 0),
        status: result.status,
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // -----------------------------------------------------------------------
    // 8. Response
    // -----------------------------------------------------------------------

    return NextResponse.json({
      success: true,
      data: {
        batchId: result.batchId,
        transactionReference: result.transactionReference,
        status: result.status,
        submitted: dbsPayments.length,
        payments: result.payments,
        ...(nonDbsEmployees.length > 0 && {
          nonDbsEmployees: {
            count: nonDbsEmployees.length,
            message:
              "These employees have non-DBS bank accounts. Use GIRO file export for their payments.",
          },
        }),
        ...(noBankEmployees.length > 0 && {
          noBankEmployees: {
            count: noBankEmployees.length,
            message: "These employees have no bank details on file.",
          },
        }),
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;

    // Never leak bank account details in error responses
    const safeMessage = message.replace(/\d{6,}/g, "****");

    return NextResponse.json({ success: false, error: safeMessage } satisfies ApiResponse, {
      status,
    });
  }
}
