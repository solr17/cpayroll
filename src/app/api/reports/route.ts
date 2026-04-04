import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payRuns, payslips, cpfRecords, employees, salaryRecords } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import type { ApiResponse } from "@/types";

/** GET /api/reports?type=payroll-detail|payroll-summary|cpf|statutory|ytd|variance&payRunId=X&year=X */
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type");
    const payRunId = searchParams.get("payRunId");
    const year = searchParams.get("year");

    if (!reportType) {
      return NextResponse.json(
        { success: false, error: "Report type is required" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    switch (reportType) {
      case "payroll-detail": {
        if (!payRunId) {
          return NextResponse.json(
            { success: false, error: "payRunId is required" } satisfies ApiResponse,
            { status: 400 },
          );
        }
        const data = await getPayrollDetailReport(payRunId, session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "payroll-summary": {
        if (!payRunId) {
          return NextResponse.json(
            { success: false, error: "payRunId is required" } satisfies ApiResponse,
            { status: 400 },
          );
        }
        const data = await getPayrollSummaryReport(payRunId, session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "cpf": {
        if (!payRunId) {
          return NextResponse.json(
            { success: false, error: "payRunId is required" } satisfies ApiResponse,
            { status: 400 },
          );
        }
        const data = await getCpfReport(payRunId, session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "statutory": {
        if (!payRunId) {
          return NextResponse.json(
            { success: false, error: "payRunId is required" } satisfies ApiResponse,
            { status: 400 },
          );
        }
        const data = await getStatutoryReport(payRunId, session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "ytd": {
        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
        if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2100) {
          return NextResponse.json(
            { success: false, error: "Invalid year parameter" } satisfies ApiResponse,
            { status: 400 },
          );
        }
        const data = await getYtdReport(session.companyId, targetYear);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "variance": {
        if (!payRunId) {
          return NextResponse.json(
            { success: false, error: "payRunId is required" } satisfies ApiResponse,
            { status: 400 },
          );
        }
        const data = await getVarianceReport(payRunId, session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "ir8a": {
        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear() - 1;
        const data = await getIr8aReport(session.companyId, targetYear);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "bank_file": {
        if (!payRunId) {
          return NextResponse.json(
            { success: false, error: "payRunId is required" } satisfies ApiResponse,
            { status: 400 },
          );
        }
        const data = await getBankFileReport(payRunId, session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "cost_to_company": {
        if (!payRunId) {
          return NextResponse.json(
            { success: false, error: "payRunId is required" } satisfies ApiResponse,
            { status: 400 },
          );
        }
        const data = await getCostToCompanyReport(payRunId, session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "headcount": {
        const data = await getHeadcountReport(session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      case "employee_master": {
        const data = await getEmployeeMasterReport(session.companyId);
        return NextResponse.json({ success: true, data } satisfies ApiResponse);
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown report type: ${reportType}` } satisfies ApiResponse,
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

async function getPayrollDetailReport(payRunId: string, companyId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);
  if (!run) throw new Error("Pay run not found");

  const rows = await db
    .select({
      employeeName: employees.fullName,
      nricLast4: employees.nricLast4,
      department: employees.department,
      position: employees.position,
      citizenshipStatus: employees.citizenshipStatus,
      basicSalaryCents: payslips.basicSalaryCents,
      grossPayCents: payslips.grossPayCents,
      otHours: payslips.otHours,
      otPayCents: payslips.otPayCents,
      employerCpfCents: payslips.employerCpfCents,
      employeeCpfCents: payslips.employeeCpfCents,
      sdlCents: payslips.sdlCents,
      fwlCents: payslips.fwlCents,
      netPayCents: payslips.netPayCents,
      employerTotalCostCents: payslips.employerTotalCostCents,
      allowancesJson: payslips.allowancesJson,
      deductionsJson: payslips.deductionsJson,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId))
    .orderBy(employees.fullName);

  return {
    reportType: "payroll-detail",
    period: { start: run.periodStart, end: run.periodEnd },
    payDate: run.payDate,
    status: run.status,
    rows,
    totals: {
      grossPayCents: run.totalGrossCents,
      netPayCents: run.totalNetCents,
      employerCpfCents: run.totalEmployerCpfCents,
      employeeCpfCents: run.totalEmployeeCpfCents,
      sdlCents: run.totalSdlCents,
      fwlCents: run.totalFwlCents,
    },
  };
}

async function getPayrollSummaryReport(payRunId: string, companyId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);
  if (!run) throw new Error("Pay run not found");

  const departmentSummary = await db
    .select({
      department: employees.department,
      employeeCount: sql<number>`COUNT(*)`,
      totalGrossCents: sql<number>`SUM(${payslips.grossPayCents})`,
      totalNetCents: sql<number>`SUM(${payslips.netPayCents})`,
      totalEmployerCpfCents: sql<number>`SUM(${payslips.employerCpfCents})`,
      totalEmployeeCpfCents: sql<number>`SUM(${payslips.employeeCpfCents})`,
      totalSdlCents: sql<number>`SUM(${payslips.sdlCents})`,
      totalFwlCents: sql<number>`SUM(${payslips.fwlCents})`,
      totalEmployerCostCents: sql<number>`SUM(${payslips.employerTotalCostCents})`,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId))
    .groupBy(employees.department);

  return {
    reportType: "payroll-summary",
    period: { start: run.periodStart, end: run.periodEnd },
    departments: departmentSummary.map((d: (typeof departmentSummary)[number]) => ({
      ...d,
      department: d.department ?? "Unassigned",
      employeeCount: Number(d.employeeCount),
      totalGrossCents: Number(d.totalGrossCents),
      totalNetCents: Number(d.totalNetCents),
      totalEmployerCpfCents: Number(d.totalEmployerCpfCents),
      totalEmployeeCpfCents: Number(d.totalEmployeeCpfCents),
      totalSdlCents: Number(d.totalSdlCents),
      totalFwlCents: Number(d.totalFwlCents),
      totalEmployerCostCents: Number(d.totalEmployerCostCents),
    })),
    grandTotals: {
      grossPayCents: run.totalGrossCents,
      netPayCents: run.totalNetCents,
      employerCpfCents: run.totalEmployerCpfCents,
      employeeCpfCents: run.totalEmployeeCpfCents,
      sdlCents: run.totalSdlCents,
      fwlCents: run.totalFwlCents,
    },
  };
}

async function getCpfReport(payRunId: string, companyId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);
  if (!run) throw new Error("Pay run not found");

  const rows = await db
    .select({
      employeeName: employees.fullName,
      nricLast4: employees.nricLast4,
      citizenshipStatus: employees.citizenshipStatus,
      owCents: cpfRecords.owCents,
      awCents: cpfRecords.awCents,
      owCappedCents: cpfRecords.owCappedCents,
      awCappedCents: cpfRecords.awCappedCents,
      employerRate: cpfRecords.employerRate,
      employeeRate: cpfRecords.employeeRate,
      totalRate: cpfRecords.totalRate,
      employerAmountCents: cpfRecords.employerAmountCents,
      employeeAmountCents: cpfRecords.employeeAmountCents,
      totalAmountCents: cpfRecords.totalAmountCents,
      ageBand: cpfRecords.ageBand,
      rateTable: cpfRecords.rateTable,
      ytdOwCents: cpfRecords.ytdOwCents,
      ytdAwCents: cpfRecords.ytdAwCents,
    })
    .from(cpfRecords)
    .innerJoin(payslips, eq(cpfRecords.payslipId, payslips.id))
    .innerJoin(employees, eq(cpfRecords.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId))
    .orderBy(employees.fullName);

  return {
    reportType: "cpf",
    period: { start: run.periodStart, end: run.periodEnd },
    rows,
    totals: {
      employerCpfCents: run.totalEmployerCpfCents,
      employeeCpfCents: run.totalEmployeeCpfCents,
    },
  };
}

async function getStatutoryReport(payRunId: string, companyId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);
  if (!run) throw new Error("Pay run not found");

  const rows = await db
    .select({
      employeeName: employees.fullName,
      nricLast4: employees.nricLast4,
      citizenshipStatus: employees.citizenshipStatus,
      employerCpfCents: payslips.employerCpfCents,
      employeeCpfCents: payslips.employeeCpfCents,
      sdlCents: payslips.sdlCents,
      fwlCents: payslips.fwlCents,
      grossPayCents: payslips.grossPayCents,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId))
    .orderBy(employees.fullName);

  return {
    reportType: "statutory",
    period: { start: run.periodStart, end: run.periodEnd },
    rows: rows.map((r: (typeof rows)[number]) => ({
      ...r,
      totalCpfCents: r.employerCpfCents + r.employeeCpfCents,
      totalStatutoryCents: r.employerCpfCents + r.employeeCpfCents + r.sdlCents + r.fwlCents,
    })),
    totals: {
      employerCpfCents: run.totalEmployerCpfCents,
      employeeCpfCents: run.totalEmployeeCpfCents,
      sdlCents: run.totalSdlCents,
      fwlCents: run.totalFwlCents,
    },
  };
}

async function getYtdReport(companyId: string, year: number) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const rows = await db
    .select({
      employeeId: employees.id,
      employeeName: employees.fullName,
      nricLast4: employees.nricLast4,
      department: employees.department,
      citizenshipStatus: employees.citizenshipStatus,
      totalGrossCents: sql<number>`SUM(${payslips.grossPayCents})`,
      totalOtPayCents: sql<number>`SUM(${payslips.otPayCents})`,
      totalEmployerCpfCents: sql<number>`SUM(${payslips.employerCpfCents})`,
      totalEmployeeCpfCents: sql<number>`SUM(${payslips.employeeCpfCents})`,
      totalSdlCents: sql<number>`SUM(${payslips.sdlCents})`,
      totalFwlCents: sql<number>`SUM(${payslips.fwlCents})`,
      totalNetPayCents: sql<number>`SUM(${payslips.netPayCents})`,
      totalEmployerCostCents: sql<number>`SUM(${payslips.employerTotalCostCents})`,
      monthsWorked: sql<number>`COUNT(DISTINCT ${payRuns.periodStart})`,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .innerJoin(payRuns, eq(payslips.payRunId, payRuns.id))
    .where(
      and(
        eq(employees.companyId, companyId),
        sql`${payRuns.periodStart} >= ${yearStart}`,
        sql`${payRuns.periodStart} <= ${yearEnd}`,
        sql`${payRuns.status} != 'draft'`,
      ),
    )
    .groupBy(
      employees.id,
      employees.fullName,
      employees.nricLast4,
      employees.department,
      employees.citizenshipStatus,
    )
    .orderBy(employees.fullName);

  return {
    reportType: "ytd",
    year,
    rows: rows.map((r: (typeof rows)[number]) => ({
      ...r,
      totalGrossCents: Number(r.totalGrossCents),
      totalOtPayCents: Number(r.totalOtPayCents),
      totalEmployerCpfCents: Number(r.totalEmployerCpfCents),
      totalEmployeeCpfCents: Number(r.totalEmployeeCpfCents),
      totalSdlCents: Number(r.totalSdlCents),
      totalFwlCents: Number(r.totalFwlCents),
      totalNetPayCents: Number(r.totalNetPayCents),
      totalEmployerCostCents: Number(r.totalEmployerCostCents),
      monthsWorked: Number(r.monthsWorked),
    })),
  };
}

async function getVarianceReport(payRunId: string, companyId: string) {
  const [currentRun] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);
  if (!currentRun) throw new Error("Pay run not found");

  // Find the previous pay run
  const [previousRun] = await db
    .select()
    .from(payRuns)
    .where(
      and(
        eq(payRuns.companyId, companyId),
        sql`${payRuns.periodStart} < ${currentRun.periodStart}`,
        sql`${payRuns.status} != 'draft'`,
      ),
    )
    .orderBy(desc(payRuns.periodStart))
    .limit(1);

  // Get current payslips
  const currentPayslips = await db
    .select({
      employeeId: payslips.employeeId,
      employeeName: employees.fullName,
      nricLast4: employees.nricLast4,
      grossPayCents: payslips.grossPayCents,
      netPayCents: payslips.netPayCents,
      employeeCpfCents: payslips.employeeCpfCents,
      employerCpfCents: payslips.employerCpfCents,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId));

  // Get previous payslips if available
  const prevMap = new Map<string, { grossPayCents: number; netPayCents: number }>();
  if (previousRun) {
    const prevPayslips = await db
      .select({
        employeeId: payslips.employeeId,
        grossPayCents: payslips.grossPayCents,
        netPayCents: payslips.netPayCents,
      })
      .from(payslips)
      .where(eq(payslips.payRunId, previousRun.id));

    for (const p of prevPayslips) {
      prevMap.set(p.employeeId, { grossPayCents: p.grossPayCents, netPayCents: p.netPayCents });
    }
  }

  const rows = currentPayslips.map((curr: (typeof currentPayslips)[number]) => {
    const prev = prevMap.get(curr.employeeId);
    const grossChange = prev ? curr.grossPayCents - prev.grossPayCents : null;
    const netChange = prev ? curr.netPayCents - prev.netPayCents : null;
    const isNew = !prev;
    const hasVariance = grossChange !== null && grossChange !== 0;
    const variancePercent =
      prev && prev.grossPayCents > 0 ? ((grossChange ?? 0) / prev.grossPayCents) * 100 : null;
    const flag = isNew
      ? "new"
      : variancePercent && Math.abs(variancePercent) > 10
        ? "high"
        : hasVariance
          ? "changed"
          : "none";

    return {
      ...curr,
      previousGrossCents: prev?.grossPayCents ?? null,
      previousNetCents: prev?.netPayCents ?? null,
      grossChangeCents: grossChange,
      netChangeCents: netChange,
      variancePercent: variancePercent ? Math.round(variancePercent * 100) / 100 : null,
      flag,
    };
  });

  return {
    reportType: "variance",
    currentPeriod: { start: currentRun.periodStart, end: currentRun.periodEnd },
    previousPeriod: previousRun
      ? { start: previousRun.periodStart, end: previousRun.periodEnd }
      : null,
    rows,
  };
}

async function getIr8aReport(companyId: string, year: number) {
  const ytdData = await getYtdReport(companyId, year);

  return {
    reportType: "ir8a",
    year,
    employees: ytdData.rows.map((r: (typeof ytdData.rows)[number]) => ({
      employeeName: r.employeeName,
      nricLast4: r.nricLast4,
      department: r.department,
      totalGrossPayCents: r.totalGrossCents,
      totalEmployerCpfCents: r.totalEmployerCpfCents,
      totalEmployeeCpfCents: r.totalEmployeeCpfCents,
      monthsWorked: r.monthsWorked,
    })),
  };
}

// ---------------------------------------------------------------------------
// Bank File Report
// ---------------------------------------------------------------------------

async function getBankFileReport(payRunId: string, companyId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);
  if (!run) throw new Error("Pay run not found");

  const rows = await db
    .select({
      employeeName: employees.fullName,
      nricLast4: employees.nricLast4,
      bankJsonEncrypted: employees.bankJsonEncrypted,
      netPayCents: payslips.netPayCents,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId))
    .orderBy(employees.fullName);

  // Group by bank
  const bankGroups = new Map<
    string,
    Array<{
      employeeName: string;
      nricLast4: string;
      accountMasked: string;
      netPayCents: number;
    }>
  >();

  for (const row of rows) {
    let bankName = "Unknown";
    let accountMasked = "****";

    if (row.bankJsonEncrypted) {
      try {
        // Dynamically import decrypt to avoid importing at module level
        const { decrypt } = await import("@/lib/crypto/aes");
        const bankJson = JSON.parse(decrypt(row.bankJsonEncrypted)) as {
          bankName: string;
          accountNumber: string;
        };
        bankName = bankJson.bankName || "Unknown";
        const acct = bankJson.accountNumber || "";
        accountMasked = acct.length > 4 ? "****" + acct.slice(-4) : acct;
      } catch {
        // Decryption failed — use defaults
      }
    }

    const group = bankGroups.get(bankName) ?? [];
    group.push({
      employeeName: row.employeeName,
      nricLast4: row.nricLast4,
      accountMasked,
      netPayCents: row.netPayCents,
    });
    bankGroups.set(bankName, group);
  }

  const banks = Array.from(bankGroups.entries()).map(([bankName, employees]) => ({
    bankName,
    employeeCount: employees.length,
    totalNetPayCents: employees.reduce((sum, e) => sum + e.netPayCents, 0),
    employees,
  }));

  return {
    reportType: "bank_file",
    period: { start: run.periodStart, end: run.periodEnd },
    banks,
    grandTotalCents: banks.reduce((sum, b) => sum + b.totalNetPayCents, 0),
  };
}

// ---------------------------------------------------------------------------
// Cost to Company Report
// ---------------------------------------------------------------------------

async function getCostToCompanyReport(payRunId: string, companyId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);
  if (!run) throw new Error("Pay run not found");

  const rows = await db
    .select({
      employeeName: employees.fullName,
      nricLast4: employees.nricLast4,
      department: employees.department,
      grossPayCents: payslips.grossPayCents,
      employerCpfCents: payslips.employerCpfCents,
      sdlCents: payslips.sdlCents,
      fwlCents: payslips.fwlCents,
      shgCents: payslips.shgCents,
      employerTotalCostCents: payslips.employerTotalCostCents,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId))
    .orderBy(employees.fullName);

  const totals = rows.reduce(
    (acc: Record<string, number>, r: (typeof rows)[number]) => ({
      grossPayCents: acc.grossPayCents + r.grossPayCents,
      employerCpfCents: acc.employerCpfCents + r.employerCpfCents,
      sdlCents: acc.sdlCents + r.sdlCents,
      fwlCents: acc.fwlCents + r.fwlCents,
      shgCents: acc.shgCents + r.shgCents,
      employerTotalCostCents: acc.employerTotalCostCents + r.employerTotalCostCents,
    }),
    {
      grossPayCents: 0,
      employerCpfCents: 0,
      sdlCents: 0,
      fwlCents: 0,
      shgCents: 0,
      employerTotalCostCents: 0,
    },
  );

  return {
    reportType: "cost_to_company",
    period: { start: run.periodStart, end: run.periodEnd },
    rows: rows.map((r: (typeof rows)[number]) => ({
      ...r,
      department: r.department ?? "Unassigned",
      totalCostCents: r.grossPayCents + r.employerCpfCents + r.sdlCents + r.fwlCents + r.shgCents,
    })),
    totals,
  };
}

// ---------------------------------------------------------------------------
// Headcount Report
// ---------------------------------------------------------------------------

async function getHeadcountReport(companyId: string) {
  const allEmployees = await db
    .select({
      id: employees.id,
      status: employees.status,
      department: employees.department,
      employmentType: employees.employmentType,
    })
    .from(employees)
    .where(eq(employees.companyId, companyId));

  // By status
  const byStatus: Record<string, number> = {};
  for (const emp of allEmployees) {
    byStatus[emp.status] = (byStatus[emp.status] ?? 0) + 1;
  }

  // By department
  const byDepartment: Record<string, number> = {};
  for (const emp of allEmployees) {
    const dept = emp.department ?? "Unassigned";
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
  }

  // By employment type
  const byEmploymentType: Record<string, number> = {};
  for (const emp of allEmployees) {
    byEmploymentType[emp.employmentType] = (byEmploymentType[emp.employmentType] ?? 0) + 1;
  }

  return {
    reportType: "headcount",
    totalEmployees: allEmployees.length,
    byStatus: Object.entries(byStatus)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    byDepartment: Object.entries(byDepartment)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count),
    byEmploymentType: Object.entries(byEmploymentType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Employee Master Report
// ---------------------------------------------------------------------------

async function getEmployeeMasterReport(companyId: string) {
  const rows = await db
    .select({
      fullName: employees.fullName,
      nricLast4: employees.nricLast4,
      department: employees.department,
      position: employees.position,
      hireDate: employees.hireDate,
      status: employees.status,
      employmentType: employees.employmentType,
      citizenshipStatus: employees.citizenshipStatus,
      gender: employees.gender,
      dob: employees.dob,
      email: employees.email,
      mobile: employees.mobile,
    })
    .from(employees)
    .where(eq(employees.companyId, companyId))
    .orderBy(employees.fullName);

  // Fetch latest salary for each employee
  const employeeIds = await db
    .select({ id: employees.id, fullName: employees.fullName })
    .from(employees)
    .where(eq(employees.companyId, companyId));

  const salaryMap = new Map<string, number>();
  for (const emp of employeeIds) {
    const [latestSalary] = await db
      .select({ basicSalaryCents: salaryRecords.basicSalaryCents })
      .from(salaryRecords)
      .where(eq(salaryRecords.employeeId, emp.id))
      .orderBy(desc(salaryRecords.effectiveDate))
      .limit(1);
    if (latestSalary) {
      salaryMap.set(emp.fullName, latestSalary.basicSalaryCents);
    }
  }

  return {
    reportType: "employee_master",
    rows: rows.map((r: (typeof rows)[number]) => ({
      ...r,
      department: r.department ?? "Unassigned",
      position: r.position ?? "-",
      nricDisplay: "\u2022\u2022\u2022\u2022\u2022" + r.nricLast4,
      basicSalaryCents: salaryMap.get(r.fullName) ?? null,
    })),
    totalCount: rows.length,
  };
}
