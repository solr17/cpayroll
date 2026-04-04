import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payRuns, payslips, employees, cpfRecords, companies, payments } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { decrypt } from "@/lib/crypto/aes";
import { generateDbsGiroFile } from "@/lib/bank/dbs";
import { generateOcbcFile } from "@/lib/bank/ocbc";
import { generateUobFile } from "@/lib/bank/uob";
import { generateHsbcFile } from "@/lib/bank/hsbc";
import { generateScFile } from "@/lib/bank/sc";
import { generateMaybankFile } from "@/lib/bank/maybank";
import { generateCimbFile } from "@/lib/bank/cimb";
import { generateCpfEzPayFile } from "@/lib/documents/cpf-ezpay";
import { generateCpfSubmissionFile } from "@/lib/documents/cpf-submission";
import { generatePayslipHtml } from "@/lib/documents/payslip-html";
import { logAudit } from "@/lib/audit/log";
import type { ApiResponse, BankDetails } from "@/types";
import type { PayrollAllowance, PayrollDeduction } from "@/lib/payroll/types";
import type { BankPaymentRecord } from "@/lib/bank/types";

const VALID_EXPORT_TYPES = [
  "bank-dbs",
  "bank-ocbc",
  "bank-uob",
  "bank-hsbc",
  "bank-sc",
  "bank-maybank",
  "bank-cimb",
  "cpf",
  "cpf-ftp",
  "payslips",
] as const;
type ExportType = (typeof VALID_EXPORT_TYPES)[number];

function isValidExportType(value: string): value is ExportType {
  return (VALID_EXPORT_TYPES as readonly string[]).includes(value);
}

/** GET /api/payroll/pay-runs/[id]/export — Export pay run data */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    const exportType = request.nextUrl.searchParams.get("type");
    if (!exportType || !isValidExportType(exportType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid export type. Must be one of: ${VALID_EXPORT_TYPES.join(", ")}`,
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

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

    // Only allow export of calculated+ pay runs
    if (run.status === "draft") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot export a draft pay run. Calculate it first.",
        } satisfies ApiResponse,
        { status: 409 },
      );
    }

    // Fetch company details
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

    // Fetch payslips with employee data
    const slipsWithEmployees = await db
      .select({
        payslip: payslips,
        employeeId: employees.id,
        employeeName: employees.fullName,
        nricLast4: employees.nricLast4,
        citizenshipStatus: employees.citizenshipStatus,
        bankJsonEncrypted: employees.bankJsonEncrypted,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.payRunId, id));

    await logAudit({
      userId: session.id,
      action: `export_pay_run_${exportType}`,
      entityType: "pay_run",
      entityId: id,
      newValue: { exportType, recordCount: slipsWithEmployees.length },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Bank file exports
    if (exportType.startsWith("bank-")) {
      const bankRecords: BankPaymentRecord[] = [];

      for (const row of slipsWithEmployees) {
        if (!row.bankJsonEncrypted) continue;

        let bankDetails: BankDetails;
        try {
          bankDetails = JSON.parse(decrypt(row.bankJsonEncrypted)) as BankDetails;
        } catch {
          continue;
        }

        const record: BankPaymentRecord = {
          employeeName: row.employeeName,
          bankCode: bankDetails.bankName,
          branchCode: bankDetails.branchCode,
          accountNumber: bankDetails.accountNumber,
          amountCents: row.payslip.netPayCents,
          reference: `SAL-${run.periodStart.slice(0, 7)}-${row.nricLast4}`,
        };
        if (bankDetails.payNowLinked) {
          record.payNowId = bankDetails.payNowLinked;
        }
        bankRecords.push(record);
      }

      if (bankRecords.length === 0) {
        return NextResponse.json(
          { success: false, error: "No employees with bank details found" } satisfies ApiResponse,
          { status: 422 },
        );
      }

      const companyBank = company.bankAccountJson as {
        accountNumber?: string;
        companyCode?: string;
      } | null;
      const debitAccount = companyBank?.accountNumber ?? "";
      const companyCode = companyBank?.companyCode ?? company.uen;
      const batchRef = `PR-${run.id.slice(0, 8)}`;

      let fileResult;
      switch (exportType) {
        case "bank-dbs":
          fileResult = generateDbsGiroFile(bankRecords, debitAccount, run.payDate, batchRef);
          break;
        case "bank-ocbc":
          fileResult = generateOcbcFile(
            bankRecords,
            companyCode,
            debitAccount,
            run.payDate,
            batchRef,
          );
          break;
        case "bank-uob":
          fileResult = generateUobFile(bankRecords, debitAccount, run.payDate, batchRef);
          break;
        case "bank-hsbc":
          fileResult = generateHsbcFile(
            bankRecords,
            companyCode,
            debitAccount,
            run.payDate,
            batchRef,
          );
          break;
        case "bank-sc":
          fileResult = generateScFile(
            bankRecords,
            companyCode,
            debitAccount,
            run.payDate,
            batchRef,
          );
          break;
        case "bank-maybank":
          fileResult = generateMaybankFile(bankRecords, debitAccount, run.payDate, batchRef);
          break;
        case "bank-cimb":
          fileResult = generateCimbFile(bankRecords, debitAccount, run.payDate, batchRef);
          break;
        default:
          return NextResponse.json(
            { success: false, error: "Unknown bank format" } satisfies ApiResponse,
            { status: 400 },
          );
      }

      // Create payment records for each employee in the batch
      try {
        const bankLabel = exportType.replace("bank-", "").toUpperCase();
        const paymentRecords = [];
        for (const record of bankRecords) {
          // Find the matching slip to get payslipId and employeeId
          const matchedRow = slipsWithEmployees.find(
            (row: (typeof slipsWithEmployees)[number]) => row.employeeName === record.employeeName,
          );
          const maskedAccount = record.accountNumber.slice(-4).padStart(4, "*");
          paymentRecords.push({
            companyId: session.companyId,
            payRunId: id,
            payslipId: matchedRow?.payslip.id ?? null,
            employeeId: matchedRow?.employeeId ?? null,
            employeeName: record.employeeName,
            bankName: bankLabel,
            accountNumberMasked: `****${maskedAccount}`,
            amountCents: record.amountCents,
            status: "pending" as const,
            paymentMethod: record.payNowId ? "paynow" : "giro",
          });
        }
        if (paymentRecords.length > 0) {
          await db.insert(payments).values(paymentRecords);
        }
      } catch {
        // Payment tracking is a side effect — do not break the export if it fails
      }

      return new NextResponse(fileResult.content, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileResult.filename}"`,
        },
      });
    }

    // CPF EZPay export
    if (exportType === "cpf") {
      // Fetch CPF records for all payslips
      const payslipIds = slipsWithEmployees.map(
        (s: (typeof slipsWithEmployees)[number]) => s.payslip.id,
      );
      const allCpfRecords =
        payslipIds.length > 0
          ? await db.select().from(cpfRecords).where(inArray(cpfRecords.payslipId, payslipIds))
          : [];

      // Build CPF submission records (only SC/PR employees)
      const cpfSubmissionRecords = slipsWithEmployees
        .filter((row: (typeof slipsWithEmployees)[number]) => row.citizenshipStatus !== "FW")
        .map((row: (typeof slipsWithEmployees)[number]) => {
          const cpfRecord = allCpfRecords.find(
            (c: (typeof allCpfRecords)[number]) => c.payslipId === row.payslip.id,
          );
          return {
            nricLast4: row.nricLast4,
            employeeName: row.employeeName,
            owCents: cpfRecord?.owCappedCents ?? 0,
            awCents: cpfRecord?.awCappedCents ?? 0,
            employerCpfCents: row.payslip.employerCpfCents,
            employeeCpfCents: row.payslip.employeeCpfCents,
            totalCpfCents: row.payslip.employerCpfCents + row.payslip.employeeCpfCents,
          };
        });

      const periodYearMonth = run.periodStart.slice(0, 7).replace("-", "");
      const totalSdlCents = slipsWithEmployees.reduce(
        (sum: number, r: (typeof slipsWithEmployees)[number]) => sum + r.payslip.sdlCents,
        0,
      );

      const cpfFile = generateCpfEzPayFile(
        cpfSubmissionRecords,
        company.uen,
        periodYearMonth,
        totalSdlCents,
      );

      return new NextResponse(cpfFile.content, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${cpfFile.filename}"`,
        },
      });
    }

    // CPF Board FTP submission file
    if (exportType === "cpf-ftp") {
      const payslipIds = slipsWithEmployees.map(
        (s: (typeof slipsWithEmployees)[number]) => s.payslip.id,
      );
      const allCpfRecords =
        payslipIds.length > 0
          ? await db.select().from(cpfRecords).where(inArray(cpfRecords.payslipId, payslipIds))
          : [];

      const cpfSubmissionRecords = slipsWithEmployees
        .filter((row: (typeof slipsWithEmployees)[number]) => row.citizenshipStatus !== "FW")
        .map((row: (typeof slipsWithEmployees)[number]) => {
          const cpfRecord = allCpfRecords.find(
            (c: (typeof allCpfRecords)[number]) => c.payslipId === row.payslip.id,
          );
          return {
            nricLast4: row.nricLast4,
            fullName: row.employeeName,
            owCents: cpfRecord?.owCappedCents ?? 0,
            awCents: cpfRecord?.awCappedCents ?? 0,
            employeeCpfCents: row.payslip.employeeCpfCents,
            employerCpfCents: row.payslip.employerCpfCents,
            totalCpfCents: row.payslip.employerCpfCents + row.payslip.employeeCpfCents,
          };
        });

      const periodYearMonth = run.periodStart.slice(0, 7).replace("-", "");
      const totalSdlCents = slipsWithEmployees.reduce(
        (sum: number, r: (typeof slipsWithEmployees)[number]) => sum + r.payslip.sdlCents,
        0,
      );

      const ftpFile = generateCpfSubmissionFile({
        csn: company.cpfSubmissionNumber ?? company.uen,
        companyName: company.name,
        period: periodYearMonth,
        employees: cpfSubmissionRecords,
        totalSdlCents,
      });

      return new NextResponse(ftpFile.content, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${ftpFile.filename}"`,
        },
      });
    }

    // Payslips HTML export
    if (exportType === "payslips") {
      const htmlPayslips: string[] = [];

      for (const row of slipsWithEmployees) {
        const allowances = (row.payslip.allowancesJson as PayrollAllowance[] | null) ?? [];
        const deductions = (row.payslip.deductionsJson as PayrollDeduction[] | null) ?? [];

        // Extract bonus/commission/AWS from allowances detail if present
        const bonusCents = allowances.find((a) => a.name === "Bonus")?.amountCents ?? 0;
        const commissionCents = allowances.find((a) => a.name === "Commission")?.amountCents ?? 0;
        const awsCents = allowances.find((a) => a.name === "AWS / 13th Month")?.amountCents ?? 0;

        // Filter out bonus/commission/AWS from regular allowances for display
        const regularAllowances = allowances.filter(
          (a) => !["Bonus", "Commission", "AWS / 13th Month"].includes(a.name),
        );

        // Map deductions to the new payslip format
        const shgDeduction = deductions.find(
          (d) => ["CDAC", "MBMF", "SINDA", "ECF"].includes(d.name) || d.name.includes("SHG"),
        );
        const otherDeds = deductions.filter(
          (d) =>
            d.name !== "Employee CPF" &&
            !["CDAC", "MBMF", "SINDA", "ECF"].includes(d.name) &&
            !d.name.includes("SHG"),
        );

        const html = generatePayslipHtml({
          companyName: company.name,
          companyUen: company.uen,
          employeeName: row.employeeName,
          nricLast4: row.nricLast4,
          paymentDate: run.payDate,
          periodStart: run.periodStart,
          periodEnd: run.periodEnd,
          basicSalaryCents: row.payslip.basicSalaryCents,
          proratedDays: row.payslip.proratedDays,
          allowances: regularAllowances,
          otherDeductions: otherDeds,
          shgCents: shgDeduction?.amountCents ?? 0,
          ...(shgDeduction?.name ? { shgFundType: shgDeduction.name } : {}),
          otHours: parseFloat(row.payslip.otHours ?? "0"),
          otPayCents: row.payslip.otPayCents ?? 0,
          bonusCents,
          commissionCents,
          awsCents,
          employeeCpfCents: row.payslip.employeeCpfCents,
          employerCpfCents: row.payslip.employerCpfCents,
          sdlCents: row.payslip.sdlCents,
          grossPayCents: row.payslip.grossPayCents,
          netPayCents: row.payslip.netPayCents,
        });

        htmlPayslips.push(html);
      }

      return NextResponse.json({
        success: true,
        data: {
          payRunId: id,
          payslipCount: htmlPayslips.length,
          payslips: htmlPayslips,
        },
      } satisfies ApiResponse);
    }

    return NextResponse.json(
      { success: false, error: "Unhandled export type" } satisfies ApiResponse,
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
