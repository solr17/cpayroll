import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payslips, payRuns, employees, companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
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

/** GET /api/payroll/payslips/[id]/pdf — Generate and download payslip PDF */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: not logged in" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    // Fetch payslip with employee, pay run, and company data
    const [result] = await db
      .select({
        payslip: payslips,
        employeeName: employees.fullName,
        employeeCode: employees.employeeCode,
        nricLast4: employees.nricLast4,
        department: employees.department,
        position: employees.position,
        hireDate: employees.hireDate,
        employeeCompanyId: employees.companyId,
        payRunPeriodStart: payRuns.periodStart,
        payRunPeriodEnd: payRuns.periodEnd,
        payRunPayDate: payRuns.payDate,
        payRunCompanyId: payRuns.companyId,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .innerJoin(payRuns, eq(payslips.payRunId, payRuns.id))
      .where(eq(payslips.id, id))
      .limit(1);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Payslip not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Authorization check
    const isCompanyAdmin =
      (session.role === "owner" ||
        session.role === "admin" ||
        session.role === "payroll_operator") &&
      result.payRunCompanyId === session.companyId;
    const isOwnPayslip = session.role === "employee" && result.payslip.employeeId === session.id;

    if (!isCompanyAdmin && !isOwnPayslip) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: insufficient permissions" } satisfies ApiResponse,
        { status: 403 },
      );
    }

    // Fetch company for header
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, result.payRunCompanyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Parse payslip JSON fields
    const allowances = (result.payslip.allowancesJson as AllowanceItem[] | null) ?? [];
    const deductions = (result.payslip.deductionsJson as DeductionItem[] | null) ?? [];

    // Separate bonus/commission/AWS from regular allowances
    const bonusCents = allowances.find((a) => a.name === "Bonus")?.amountCents ?? 0;
    const commissionCents = allowances.find((a) => a.name === "Commission")?.amountCents ?? 0;
    const awsCents = allowances.find((a) => a.name === "AWS / 13th Month")?.amountCents ?? 0;

    const regularAllowances = allowances.filter(
      (a) => !["Bonus", "Commission", "AWS / 13th Month"].includes(a.name),
    );

    // SHG deductions
    const shgDeduction = deductions.find(
      (d) => ["CDAC", "MBMF", "SINDA", "ECF"].includes(d.name) || d.name.includes("SHG"),
    );
    const otherDeds = deductions.filter(
      (d) =>
        d.name !== "Employee CPF" &&
        !["CDAC", "MBMF", "SINDA", "ECF"].includes(d.name) &&
        !d.name.includes("SHG"),
    );

    const pdfData: PayslipPdfData = {
      companyName: company.name,
      companyUen: company.uen,
      employeeName: result.employeeName,
      employeeId: result.employeeCode ?? undefined,
      nricLast4: result.nricLast4,
      department: result.department ?? undefined,
      position: result.position ?? undefined,
      hireDate: result.hireDate,
      paymentDate: result.payRunPayDate,
      periodStart: result.payRunPeriodStart,
      periodEnd: result.payRunPeriodEnd,
      basicSalaryCents: result.payslip.basicSalaryCents,
      proratedDays: result.payslip.proratedDays,
      allowances: regularAllowances,
      otherDeductions: otherDeds,
      shgCents: shgDeduction?.amountCents ?? 0,
      shgFundType: shgDeduction?.name ?? undefined,
      otHours: parseFloat(result.payslip.otHours ?? "0"),
      otPayCents: result.payslip.otPayCents ?? 0,
      bonusCents,
      commissionCents,
      awsCents,
      employeeCpfCents: result.payslip.employeeCpfCents,
      employerCpfCents: result.payslip.employerCpfCents,
      sdlCents: result.payslip.sdlCents,
      fwlCents: result.payslip.fwlCents,
      grossPayCents: result.payslip.grossPayCents,
      netPayCents: result.payslip.netPayCents,
    };

    const pdfBytes = await generatePayslipPdf(pdfData);

    const filename = `payslip-${result.employeeName.replace(/\s+/g, "_")}-${result.payRunPeriodEnd}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
