import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payRuns, payslips, employees, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { generatePayslipPdf } from "@/lib/documents/payslip-pdf";
import type { PayslipPdfData } from "@/lib/documents/payslip-pdf";
import type { ApiResponse } from "@/types";

interface AllowanceItem {
  name: string;
  amountCents: number;
  isFixed?: boolean;
}

interface DeductionItem {
  name: string;
  amountCents: number;
}

/** Build PayslipPdfData from raw DB row + company */
function buildPdfData(
  row: {
    payslip: typeof payslips.$inferSelect;
    employeeName: string;
    employeeCode: string | null;
    nricLast4: string;
    department: string | null;
    position: string | null;
    hireDate: string;
  },
  company: typeof companies.$inferSelect,
  payRun: { periodStart: string; periodEnd: string; payDate: string },
): PayslipPdfData {
  const allowances = (row.payslip.allowancesJson as AllowanceItem[] | null) ?? [];
  const deductions = (row.payslip.deductionsJson as DeductionItem[] | null) ?? [];

  const bonusCents = allowances.find((a) => a.name === "Bonus")?.amountCents ?? 0;
  const commissionCents = allowances.find((a) => a.name === "Commission")?.amountCents ?? 0;
  const awsCents = allowances.find((a) => a.name === "AWS / 13th Month")?.amountCents ?? 0;

  const regularAllowances = allowances.filter(
    (a) => !["Bonus", "Commission", "AWS / 13th Month"].includes(a.name),
  );

  const shgDeduction = deductions.find(
    (d) => ["CDAC", "MBMF", "SINDA", "ECF"].includes(d.name) || d.name.includes("SHG"),
  );
  const otherDeds = deductions.filter(
    (d) =>
      d.name !== "Employee CPF" &&
      !["CDAC", "MBMF", "SINDA", "ECF"].includes(d.name) &&
      !d.name.includes("SHG"),
  );

  const result: PayslipPdfData = {
    companyName: company.name,
    companyUen: company.uen,
    employeeName: row.employeeName,
    nricLast4: row.nricLast4,
    paymentDate: payRun.payDate,
    employeeId: row.employeeCode ?? undefined,
    department: row.department ?? undefined,
    position: row.position ?? undefined,
    hireDate: row.hireDate,
    periodStart: payRun.periodStart,
    periodEnd: payRun.periodEnd,
    basicSalaryCents: row.payslip.basicSalaryCents,
    proratedDays: row.payslip.proratedDays,
    allowances: regularAllowances,
    otherDeductions: otherDeds,
    shgCents: shgDeduction?.amountCents ?? 0,
    shgFundType: shgDeduction?.name ?? undefined,
    otHours: parseFloat(row.payslip.otHours ?? "0"),
    otPayCents: row.payslip.otPayCents ?? 0,
    bonusCents,
    commissionCents,
    awsCents,
    employeeCpfCents: row.payslip.employeeCpfCents,
    employerCpfCents: row.payslip.employerCpfCents,
    sdlCents: row.payslip.sdlCents,
    fwlCents: row.payslip.fwlCents,
    grossPayCents: row.payslip.grossPayCents,
    netPayCents: row.payslip.netPayCents,
  };
  return result;
}

/** POST /api/payroll/pay-runs/[id]/pdf-batch — Generate PDFs for all payslips in a pay run */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
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
        { success: false, error: "Cannot generate PDFs for a draft pay run" } satisfies ApiResponse,
        { status: 409 },
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

    // Fetch all payslips with employee data
    const slipsWithEmployees = await db
      .select({
        payslip: payslips,
        employeeName: employees.fullName,
        employeeCode: employees.employeeCode,
        nricLast4: employees.nricLast4,
        department: employees.department,
        position: employees.position,
        hireDate: employees.hireDate,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.payRunId, id));

    let generated = 0;
    let failed = 0;

    for (const row of slipsWithEmployees) {
      try {
        const pdfData = buildPdfData(row, company, {
          periodStart: run.periodStart,
          periodEnd: run.periodEnd,
          payDate: run.payDate,
        });
        // Generate PDF to validate it works (not storing to file system in this MVP)
        await generatePayslipPdf(pdfData);
        generated++;
      } catch {
        failed++;
      }
    }

    await logAudit({
      userId: session.id,
      action: "batch_generate_pdf",
      entityType: "pay_run",
      entityId: id,
      newValue: { generated, failed, total: slipsWithEmployees.length },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        payRunId: id,
        total: slipsWithEmployees.length,
        generated,
        failed,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
