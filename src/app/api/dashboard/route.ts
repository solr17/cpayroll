import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, payRuns, auditLog, users, companies } from "@/lib/db/schema";
import { eq, and, count, desc, sql, inArray, ne } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { nowSG, formatDateISO } from "@/lib/utils/date";
import type { ApiResponse } from "@/types";

interface WorkPassAlertSummary {
  expiredCount: number;
  expiringCount: number;
  employees: Array<{
    id: string;
    fullName: string;
    workPassExpiry: string;
    status: "expired" | "expiring";
  }>;
}

interface DashboardData {
  activeEmployeeCount: number;
  totalEmployeeCount: number;
  latestPayRun: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    totalGrossCents: number;
    totalNetCents: number;
    totalEmployerCpfCents: number;
    totalSdlCents: number;
    totalFwlCents: number;
  } | null;
  monthlyPayrollTrend: Array<{
    month: string;
    grossCents: number;
    netCents: number;
    headcount: number;
  }>;
  upcomingDeadlines: Array<{
    label: string;
    date: string;
    daysUntil: number;
    type: "cpf" | "iras" | "payroll";
  }>;
  recentActivity: Array<{
    action: string;
    entityType: string;
    createdAt: string;
    userName: string;
  }>;
  workPassAlerts: WorkPassAlertSummary;
  companyName: string;
}

function calculateUpcomingDeadlines(payDay: number): DashboardData["upcomingDeadlines"] {
  const now = new Date();
  const deadlines: DashboardData["upcomingDeadlines"] = [];

  // CPF deadline: 14th of next month
  const cpfYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const cpfMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const cpfDate = new Date(cpfYear, cpfMonth, 14);
  const cpfDaysUntil = Math.ceil((cpfDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  deadlines.push({
    label: "CPF Submission Deadline",
    date: cpfDate.toISOString().split("T")[0] as string,
    daysUntil: cpfDaysUntil,
    type: "cpf",
  });

  // IRAS deadline: 1 March (only show if we're in Jan or Feb)
  const currentMonth = now.getMonth(); // 0=Jan
  if (currentMonth === 0 || currentMonth === 1) {
    const irasDate = new Date(now.getFullYear(), 2, 1);
    const irasDaysUntil = Math.ceil((irasDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    deadlines.push({
      label: "IRAS IR8A Filing Deadline",
      date: irasDate.toISOString().split("T")[0] as string,
      daysUntil: irasDaysUntil,
      type: "iras",
    });
  }

  // Next payday: payDay of current or next month
  let payDate = new Date(now.getFullYear(), now.getMonth(), payDay);
  if (payDate <= now) {
    payDate = new Date(now.getFullYear(), now.getMonth() + 1, payDay);
  }
  const payDaysUntil = Math.ceil((payDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  deadlines.push({
    label: "Next Payday",
    date: payDate.toISOString().split("T")[0] as string,
    daysUntil: payDaysUntil,
    type: "payroll",
  });

  deadlines.sort((a, b) => a.daysUntil - b.daysUntil);
  return deadlines;
}

/** GET /api/dashboard — All dashboard data in one call */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin");
    const companyId = session.companyId;

    // Calculate work pass alert cutoff (90 days from today in SG timezone)
    const today = formatDateISO(nowSG());
    const ninetyDaysFromNow = new Date(nowSG());
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const cutoffDate = formatDateISO(ninetyDaysFromNow);

    // Run independent queries in parallel
    const [
      activeCountResult,
      totalCountResult,
      latestPayRunResult,
      trendResult,
      activityResult,
      companyResult,
      workPassResult,
    ] = await Promise.all([
      // Active employee count
      db
        .select({ value: count() })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyId),
            inArray(employees.status, ["active", "probation"]),
          ),
        ),

      // Total employee count
      db.select({ value: count() }).from(employees).where(eq(employees.companyId, companyId)),

      // Latest pay run
      db
        .select({
          id: payRuns.id,
          periodStart: payRuns.periodStart,
          periodEnd: payRuns.periodEnd,
          status: payRuns.status,
          totalGrossCents: payRuns.totalGrossCents,
          totalNetCents: payRuns.totalNetCents,
          totalEmployerCpfCents: payRuns.totalEmployerCpfCents,
          totalSdlCents: payRuns.totalSdlCents,
          totalFwlCents: payRuns.totalFwlCents,
        })
        .from(payRuns)
        .where(eq(payRuns.companyId, companyId))
        .orderBy(desc(payRuns.periodStart))
        .limit(1),

      // Monthly payroll trend (last 6 months, exclude drafts)
      db
        .select({
          month: sql<string>`to_char(${payRuns.periodStart}, 'YYYY-MM')`,
          grossCents: sql<number>`COALESCE(SUM(${payRuns.totalGrossCents}), 0)`,
          netCents: sql<number>`COALESCE(SUM(${payRuns.totalNetCents}), 0)`,
          headcount: count(),
        })
        .from(payRuns)
        .where(
          and(
            eq(payRuns.companyId, companyId),
            ne(payRuns.status, "draft"),
            sql`${payRuns.periodStart} >= (CURRENT_DATE - INTERVAL '6 months')`,
          ),
        )
        .groupBy(sql`to_char(${payRuns.periodStart}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${payRuns.periodStart}, 'YYYY-MM')`),

      // Recent activity (last 10 audit entries with user name)
      db
        .select({
          action: auditLog.action,
          entityType: auditLog.entityType,
          createdAt: auditLog.createdAt,
          userName: users.name,
        })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.userId, users.id))
        .orderBy(desc(auditLog.createdAt))
        .limit(10),

      // Company info
      db
        .select({ name: companies.name, payDay: companies.payDay })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1),

      // Work pass alerts: FW employees with passes expiring within 90 days or already expired
      db
        .select({
          id: employees.id,
          fullName: employees.fullName,
          workPassExpiry: employees.workPassExpiry,
        })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyId),
            eq(employees.citizenshipStatus, "FW"),
            inArray(employees.status, ["active", "probation"]),
            sql`${employees.workPassExpiry} IS NOT NULL`,
            sql`${employees.workPassExpiry} <= ${cutoffDate}`,
          ),
        ),
    ]);

    const company = companyResult[0];
    const latestRun = latestPayRunResult[0] ?? null;

    // Build work pass alert summary
    const wpExpired: WorkPassAlertSummary["employees"] = [];
    const wpExpiring: WorkPassAlertSummary["employees"] = [];
    for (const fw of workPassResult) {
      if (!fw.workPassExpiry) continue;
      if (fw.workPassExpiry < today) {
        wpExpired.push({
          id: fw.id,
          fullName: fw.fullName,
          workPassExpiry: fw.workPassExpiry,
          status: "expired",
        });
      } else {
        wpExpiring.push({
          id: fw.id,
          fullName: fw.fullName,
          workPassExpiry: fw.workPassExpiry,
          status: "expiring",
        });
      }
    }

    const data: DashboardData = {
      activeEmployeeCount: activeCountResult[0]?.value ?? 0,
      totalEmployeeCount: totalCountResult[0]?.value ?? 0,
      latestPayRun: latestRun
        ? {
            id: latestRun.id,
            periodStart: latestRun.periodStart,
            periodEnd: latestRun.periodEnd,
            status: latestRun.status,
            totalGrossCents: latestRun.totalGrossCents ?? 0,
            totalNetCents: latestRun.totalNetCents ?? 0,
            totalEmployerCpfCents: latestRun.totalEmployerCpfCents ?? 0,
            totalSdlCents: latestRun.totalSdlCents ?? 0,
            totalFwlCents: latestRun.totalFwlCents ?? 0,
          }
        : null,
      monthlyPayrollTrend: trendResult.map(
        (row: { month: string; grossCents: number; netCents: number; headcount: number }) => ({
          month: row.month,
          grossCents: Number(row.grossCents),
          netCents: Number(row.netCents),
          headcount: Number(row.headcount),
        }),
      ),
      upcomingDeadlines: calculateUpcomingDeadlines(company?.payDay ?? 25),
      recentActivity: activityResult.map(
        (row: {
          action: string;
          entityType: string;
          createdAt: Date | null;
          userName: string | null;
        }) => ({
          action: row.action,
          entityType: row.entityType,
          createdAt: row.createdAt?.toISOString() ?? "",
          userName: row.userName ?? "System",
        }),
      ),
      workPassAlerts: {
        expiredCount: wpExpired.length,
        expiringCount: wpExpiring.length,
        employees: [...wpExpired, ...wpExpiring],
      },
      companyName: company?.name ?? "ClinicPay",
    };

    return NextResponse.json({
      success: true,
      data,
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
