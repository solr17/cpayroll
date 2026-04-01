import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payRuns, payslips, cpfRecords, employees } from "@/lib/db/schema";
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
