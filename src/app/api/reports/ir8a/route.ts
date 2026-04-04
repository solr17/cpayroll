import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payRuns, payslips, employees, companies } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { generateIr8aXml } from "@/lib/documents/ir8a-xml";
import { generateIr8aTextFile } from "@/lib/documents/ir8a-text";
import type { ApiResponse } from "@/types";

/** GET /api/reports/ir8a?year=2025 — Generate IR8A XML file */
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear() - 1;
    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        { success: false, error: "Invalid year parameter" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Get company details
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

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Aggregate annual data per employee
    const employeeData = await db
      .select({
        employeeId: employees.id,
        employeeName: employees.fullName,
        nricLast4: employees.nricLast4,
        dob: employees.dob,
        nationality: employees.nationality,
        hireDate: employees.hireDate,
        terminationDate: employees.terminationDate,
        totalGrossPayCents: sql<number>`COALESCE(SUM(${payslips.grossPayCents}), 0)`,
        totalBonusCents: sql<number>`COALESCE(SUM(COALESCE((${payslips.allowancesJson}->>'bonusCents')::int, 0)), 0)`,
        totalEmployerCpfCents: sql<number>`COALESCE(SUM(${payslips.employerCpfCents}), 0)`,
        totalEmployeeCpfCents: sql<number>`COALESCE(SUM(${payslips.employeeCpfCents}), 0)`,
      })
      .from(employees)
      .innerJoin(payslips, eq(employees.id, payslips.employeeId))
      .innerJoin(payRuns, eq(payslips.payRunId, payRuns.id))
      .where(
        and(
          eq(employees.companyId, session.companyId),
          sql`${payRuns.periodStart} >= ${yearStart}`,
          sql`${payRuns.periodStart} <= ${yearEnd}`,
          sql`${payRuns.status} != 'draft'`,
        ),
      )
      .groupBy(
        employees.id,
        employees.fullName,
        employees.nricLast4,
        employees.dob,
        employees.nationality,
        employees.hireDate,
        employees.terminationDate,
      );

    const format = searchParams.get("format") ?? "xml";

    if (format === "text") {
      // AIS pipe-delimited text file for IRAS submission
      const textEmployees = employeeData.map((e: (typeof employeeData)[number]) => ({
        nricLast4: e.nricLast4,
        fullName: e.employeeName,
        dob: e.dob,
        grossSalaryCents: Number(e.totalGrossPayCents),
        bonusCents: Number(e.totalBonusCents),
        directorFeeCents: 0,
        commissionCents: 0,
        pensionCents: 0,
        employeeCpfCents: Number(e.totalEmployeeCpfCents),
        employerCpfCents: Number(e.totalEmployerCpfCents),
        donationsCents: 0,
        benefitsInKindCents: 0,
        excessCpfCents: 0,
      }));

      const textResult = generateIr8aTextFile({
        companyUen: company.uen,
        companyName: company.name,
        yearOfAssessment: year + 1, // YA = basis year + 1
        employees: textEmployees,
      });

      return new NextResponse(textResult.content, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${textResult.filename}"`,
        },
      });
    }

    if (format === "json") {
      // JSON response with aggregated data
      const jsonEmployees = employeeData.map((e: (typeof employeeData)[number]) => ({
        nricLast4: e.nricLast4,
        employeeName: e.employeeName,
        dob: e.dob,
        nationality: e.nationality ?? "Singapore",
        totalGrossPayCents: Number(e.totalGrossPayCents),
        totalBonusCents: Number(e.totalBonusCents),
        totalEmployerCpfCents: Number(e.totalEmployerCpfCents),
        totalEmployeeCpfCents: Number(e.totalEmployeeCpfCents),
      }));

      return NextResponse.json({
        success: true,
        data: { year, employees: jsonEmployees },
      } satisfies ApiResponse);
    }

    // Default: XML format
    const ir8aEmployees = employeeData.map((e: (typeof employeeData)[number]) => ({
      nricLast4: e.nricLast4,
      employeeName: e.employeeName,
      dob: e.dob,
      nationality: e.nationality ?? "Singapore",
      hireDate: e.hireDate,
      terminationDate: e.terminationDate,
      totalGrossPayCents: Number(e.totalGrossPayCents),
      totalBonusCents: Number(e.totalBonusCents),
      totalEmployerCpfCents: Number(e.totalEmployerCpfCents),
      totalEmployeeCpfCents: Number(e.totalEmployeeCpfCents),
      totalDirectorFeesCents: 0,
      totalBenefitsInKindCents: 0,
    }));

    const result = generateIr8aXml(ir8aEmployees, company.uen, company.name, year);

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
