import { db } from "@/lib/db";
import { payRuns, payslips, employees } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VarianceAlert {
  employeeId: string;
  employeeName: string;
  type: "high_variance" | "new_hire" | "termination" | "age_band_change" | "first_payroll";
  message: string;
  severity: "warning" | "info";
  currentCents?: number;
  previousCents?: number;
  changePercent?: number;
}

// ---------------------------------------------------------------------------
// Age band boundaries for CPF
// ---------------------------------------------------------------------------

const AGE_BAND_BOUNDARIES = [55, 60, 65, 70];

function getAgeAtDate(dob: string, date: string): number {
  const birth = new Date(dob + "T00:00:00");
  const ref = new Date(date + "T00:00:00");
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function crossesAgeBand(dob: string, periodStart: string, periodEnd: string): number | null {
  for (const boundary of AGE_BAND_BOUNDARIES) {
    const ageAtStart = getAgeAtDate(dob, periodStart);
    const ageAtEnd = getAgeAtDate(dob, periodEnd);
    if (ageAtStart < boundary && ageAtEnd >= boundary) {
      return boundary;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

export async function detectVariances(
  payRunId: string,
  companyId: string,
): Promise<VarianceAlert[]> {
  const alerts: VarianceAlert[] = [];

  // 1. Get current pay run
  const [currentRun] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);

  if (!currentRun) return alerts;

  // 2. Get current payslips with employee info
  const currentPayslips = await db
    .select({
      employeeId: payslips.employeeId,
      netPayCents: payslips.netPayCents,
      grossPayCents: payslips.grossPayCents,
      employeeName: employees.fullName,
      hireDate: employees.hireDate,
      terminationDate: employees.terminationDate,
      dob: employees.dob,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId));

  if (currentPayslips.length === 0) return alerts;

  // 3. Find previous pay run
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

  // 4. Get previous payslips map
  const prevMap = new Map<string, { netPayCents: number; grossPayCents: number }>();
  if (previousRun) {
    const prevPayslips = await db
      .select({
        employeeId: payslips.employeeId,
        netPayCents: payslips.netPayCents,
        grossPayCents: payslips.grossPayCents,
      })
      .from(payslips)
      .where(eq(payslips.payRunId, previousRun.id));

    for (const p of prevPayslips) {
      prevMap.set(p.employeeId, {
        netPayCents: p.netPayCents,
        grossPayCents: p.grossPayCents,
      });
    }
  }

  // 5. Detect variances for each employee
  for (const curr of currentPayslips) {
    const prev = prevMap.get(curr.employeeId);

    // First payroll — no previous payslips at all for this employee
    if (!prev && !previousRun) {
      alerts.push({
        employeeId: curr.employeeId,
        employeeName: curr.employeeName,
        type: "first_payroll",
        message: "First payroll run — no historical data to compare",
        severity: "info",
        currentCents: curr.netPayCents,
      });
      continue;
    }

    // New hire — employee not in previous run
    if (!prev) {
      const isNewHire =
        curr.hireDate >= currentRun.periodStart && curr.hireDate <= currentRun.periodEnd;
      alerts.push({
        employeeId: curr.employeeId,
        employeeName: curr.employeeName,
        type: isNewHire ? "new_hire" : "first_payroll",
        message: isNewHire
          ? `New hire (joined ${curr.hireDate}) — first payslip`
          : "Employee not in previous pay run — first payslip in this sequence",
        severity: "info",
        currentCents: curr.netPayCents,
      });
      continue;
    }

    // Termination — employee has terminationDate within this period
    if (
      curr.terminationDate &&
      curr.terminationDate >= currentRun.periodStart &&
      curr.terminationDate <= currentRun.periodEnd
    ) {
      alerts.push({
        employeeId: curr.employeeId,
        employeeName: curr.employeeName,
        type: "termination",
        message: `Termination date ${curr.terminationDate} falls within this pay period`,
        severity: "warning",
        currentCents: curr.netPayCents,
        previousCents: prev.netPayCents,
      });
    }

    // High variance — net pay changed > 20%
    if (prev.netPayCents > 0) {
      const change = curr.netPayCents - prev.netPayCents;
      const changePercent = (change / prev.netPayCents) * 100;
      if (Math.abs(changePercent) > 20) {
        alerts.push({
          employeeId: curr.employeeId,
          employeeName: curr.employeeName,
          type: "high_variance",
          message: `Net pay changed ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% from previous month`,
          severity: "warning",
          currentCents: curr.netPayCents,
          previousCents: prev.netPayCents,
          changePercent: Math.round(changePercent * 100) / 100,
        });
      }
    }

    // Age band change — crosses 55/60/65/70 boundary this month
    const ageBoundary = crossesAgeBand(curr.dob, currentRun.periodStart, currentRun.periodEnd);
    if (ageBoundary !== null) {
      alerts.push({
        employeeId: curr.employeeId,
        employeeName: curr.employeeName,
        type: "age_band_change",
        message: `Employee turns ${ageBoundary} during this pay period — CPF rate change applies from next month`,
        severity: "info",
        currentCents: curr.netPayCents,
        previousCents: prev.netPayCents,
      });
    }
  }

  // Sort: warnings first, then info
  alerts.sort((a, b) => {
    if (a.severity === b.severity) return a.employeeName.localeCompare(b.employeeName);
    return a.severity === "warning" ? -1 : 1;
  });

  return alerts;
}
