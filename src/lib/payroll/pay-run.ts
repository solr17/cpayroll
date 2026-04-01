/**
 * Pay Run Management — lifecycle and batch processing.
 *
 * Status flow: DRAFT → CALCULATED → REVIEWED → APPROVED → PAID → FILED
 */

import { db } from "@/lib/db";
import {
  payRuns,
  payslips,
  cpfRecords,
  employees,
  salaryRecords,
  cpfRateTables,
} from "@/lib/db/schema";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { calculateEmployeePayroll } from "./engine";
import { logAudit } from "@/lib/audit/log";
import { daysInMonth, getAgeBandForMonth } from "@/lib/utils/date";
import type {
  EmployeePayrollInput,
  EmployeePayrollResult,
  CpfRateEntry,
  VariablePayItems,
} from "./types";
import type { PayRunStatus, CitizenshipStatus } from "@/types";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["calculated"],
  calculated: ["draft", "reviewed"],
  reviewed: ["calculated", "approved"],
  approved: ["paid"],
  paid: ["filed"],
};

export function isValidTransition(from: PayRunStatus, to: PayRunStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Derive CPF rate table type from citizenship status */
function deriveRateTable(citizenshipStatus: CitizenshipStatus): string {
  switch (citizenshipStatus) {
    case "SC":
      return "SC";
    case "PR1":
      return "PR1";
    case "PR2":
      return "PR2";
    case "PR3":
      return "PR3";
    case "FW":
      return "FW";
    default:
      return "SC";
  }
}

/** Calculate YTD amounts from prior payslips in the same calendar year */
async function calculateYtd(
  employeeId: string,
  periodStart: string,
): Promise<{ ytdOwCents: number; ytdAwCents: number; ytdCpfCents: number }> {
  const year = new Date(periodStart).getFullYear();
  const yearStart = `${year}-01-01`;

  const result = await db
    .select({
      totalOw: sql<number>`COALESCE(SUM(${cpfRecords.owCappedCents}), 0)`,
      totalAw: sql<number>`COALESCE(SUM(${cpfRecords.awCappedCents}), 0)`,
      totalCpf: sql<number>`COALESCE(SUM(${cpfRecords.totalAmountCents}), 0)`,
    })
    .from(cpfRecords)
    .innerJoin(payslips, eq(cpfRecords.payslipId, payslips.id))
    .innerJoin(payRuns, eq(payslips.payRunId, payRuns.id))
    .where(
      and(
        eq(cpfRecords.employeeId, employeeId),
        sql`${payRuns.periodStart} >= ${yearStart}`,
        sql`${payRuns.periodStart} < ${periodStart}`,
        sql`${payRuns.status} != 'draft'`,
      ),
    );

  const row = result[0];
  return {
    ytdOwCents: Number(row?.totalOw ?? 0),
    ytdAwCents: Number(row?.totalAw ?? 0),
    ytdCpfCents: Number(row?.totalCpf ?? 0),
  };
}

/** Load CPF rates for a given status type and effective date */
async function loadCpfRates(statusType: string, effectiveDate: string): Promise<CpfRateEntry[]> {
  // For foreigners, no CPF rates needed
  if (statusType === "FW") return [];

  const cpfStatus = statusType as "SC" | "PR1" | "PR2" | "PR3";

  const rates = await db
    .select()
    .from(cpfRateTables)
    .where(
      and(eq(cpfRateTables.statusType, cpfStatus), lte(cpfRateTables.effectiveDate, effectiveDate)),
    )
    .orderBy(desc(cpfRateTables.effectiveDate));

  // Get the latest effective date
  if (rates.length === 0) return [];
  const latestDate = rates[0]!.effectiveDate;

  // Return all entries for that effective date
  return rates
    .filter((r: (typeof rates)[number]) => r.effectiveDate === latestDate)
    .map((r: (typeof rates)[number]) => ({
      employerRate: parseFloat(r.employerRate),
      employeeRate: parseFloat(r.employeeRate),
      totalRate: parseFloat(r.totalRate),
      ageBandMin: r.ageBandMin,
      ageBandMax: r.ageBandMax,
    }));
}

/** Create a new pay run in DRAFT status */
export async function createPayRun(
  companyId: string,
  periodStart: string,
  periodEnd: string,
  payDate: string,
  userId: string,
) {
  const [run] = await db
    .insert(payRuns)
    .values({
      companyId,
      periodStart,
      periodEnd,
      payDate,
      status: "draft",
      createdBy: userId,
    })
    .returning();

  await logAudit({
    userId,
    action: "create_pay_run",
    entityType: "pay_run",
    entityId: run?.id,
    newValue: { periodStart, periodEnd, payDate },
  });

  return run;
}

/** Get a pay run by ID */
export async function getPayRun(payRunId: string, companyId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);
  return run ?? null;
}

/** List all pay runs for a company */
export async function listPayRuns(companyId: string) {
  return db
    .select()
    .from(payRuns)
    .where(eq(payRuns.companyId, companyId))
    .orderBy(desc(payRuns.periodStart));
}

/** Get payslips for a pay run */
export async function getPayRunPayslips(payRunId: string) {
  return db
    .select({
      payslip: payslips,
      employeeName: employees.fullName,
      nricLast4: employees.nricLast4,
      department: employees.department,
      position: employees.position,
      citizenshipStatus: employees.citizenshipStatus,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId))
    .orderBy(employees.fullName);
}

/** Calculate payroll for all active employees in a pay run */
export async function calculatePayRun(
  payRunId: string,
  companyId: string,
  userId: string,
  variableItemsMap?: Record<string, Partial<VariablePayItems>>,
) {
  // Get pay run
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);

  if (!run) throw new Error("Pay run not found");
  if (run.status !== "draft" && run.status !== "reviewed") {
    throw new Error(`Cannot calculate from status: ${run.status}`);
  }

  // Get active employees (include probation — they still get paid)
  const activeEmployees = await db
    .select()
    .from(employees)
    .where(
      and(eq(employees.companyId, companyId), sql`${employees.status} IN ('active', 'probation')`),
    );

  const totalDays = daysInMonth(run.periodStart);
  const results: EmployeePayrollResult[] = [];

  let totalGross = 0;
  let totalNet = 0;
  let totalEmployerCpf = 0;
  let totalEmployeeCpf = 0;
  let totalSdl = 0;
  let totalFwl = 0;

  // Clear existing payslips and CPF records for this run (recalculation)
  const existingPayslips = await db
    .select({ id: payslips.id })
    .from(payslips)
    .where(eq(payslips.payRunId, payRunId));
  for (const slip of existingPayslips) {
    await db.delete(cpfRecords).where(eq(cpfRecords.payslipId, slip.id));
  }
  await db.delete(payslips).where(eq(payslips.payRunId, payRunId));

  for (const emp of activeEmployees) {
    // Skip employees who haven't started yet or already terminated before period
    if (emp.hireDate > run.periodEnd) continue;
    if (emp.terminationDate && emp.terminationDate < run.periodStart) continue;

    // Get latest salary record effective on or before the period end
    const [salary] = await db
      .select()
      .from(salaryRecords)
      .where(
        and(eq(salaryRecords.employeeId, emp.id), lte(salaryRecords.effectiveDate, run.periodEnd)),
      )
      .orderBy(desc(salaryRecords.effectiveDate))
      .limit(1);

    if (!salary) continue;

    // Calculate age using proper age band logic (age as of 1st of month)
    const age = getAgeBandForMonth(emp.dob, run.periodStart);

    // Derive rate table from citizenship status
    const rateTable = deriveRateTable(emp.citizenshipStatus);

    // Load CPF rates from database
    const rates = await loadCpfRates(rateTable, run.periodStart);

    // Calculate YTD from prior payslips
    const ytd = await calculateYtd(emp.id, run.periodStart);

    const allowances =
      (salary.allowancesJson as Array<{ name: string; amountCents: number; isFixed: boolean }>) ??
      [];

    // Get FWL rate from employee record (stored as work pass levy)
    const fwlRateCents = emp.citizenshipStatus === "FW" ? parseFwlRate(emp) : 0;

    // Merge variable items from the map if provided
    const empVariableItems = variableItemsMap?.[emp.id];
    const variableItems: VariablePayItems = {
      otHours: empVariableItems?.otHours ?? 0,
      bonusCents: empVariableItems?.bonusCents ?? 0,
      commissionCents: empVariableItems?.commissionCents ?? 0,
      awsCents: empVariableItems?.awsCents ?? 0,
      reimbursementCents: empVariableItems?.reimbursementCents ?? 0,
      additionalAllowances: empVariableItems?.additionalAllowances ?? [],
      additionalDeductions: empVariableItems?.additionalDeductions ?? [],
      unpaidLeaveDays: empVariableItems?.unpaidLeaveDays ?? 0,
    };

    const input: EmployeePayrollInput = {
      employeeId: emp.id,
      basicSalaryCents: salary.basicSalaryCents,
      fixedAllowances: allowances,
      otEligible: salary.otEligible,
      otRateMultiplier: parseFloat(salary.otRateMultiplier ?? "1.5"),
      citizenshipStatus: emp.citizenshipStatus,
      age,
      dob: emp.dob,
      hireDate: emp.hireDate,
      terminationDate: emp.terminationDate,
      fwlRateCents,
      variableItems,
      ytdOwCents: ytd.ytdOwCents,
      ytdAwCents: ytd.ytdAwCents,
      ytdCpfCents: ytd.ytdCpfCents,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      totalDaysInMonth: totalDays,
      rates,
    };

    const result = calculateEmployeePayroll(input);
    results.push(result);

    // Insert payslip
    const [slip] = await db
      .insert(payslips)
      .values({
        payRunId,
        employeeId: emp.id,
        basicSalaryCents: result.basicSalaryCents,
        proratedDays: String(totalDays),
        grossPayCents: result.grossPayCents,
        otHours: String(result.otHours),
        otPayCents: result.otPayCents,
        allowancesJson: result.allowancesDetail,
        deductionsJson: result.deductionsDetail,
        employerCpfCents: result.cpf.employerCpfCents,
        employeeCpfCents: result.cpf.employeeCpfCents,
        sdlCents: result.sdl.sdlCents,
        fwlCents: result.fwl.fwlCents,
        netPayCents: result.netPayCents,
        employerTotalCostCents: result.employerTotalCostCents,
      })
      .returning();

    // Insert CPF record
    await db.insert(cpfRecords).values({
      payslipId: slip!.id,
      employeeId: emp.id,
      owCents: result.owCents,
      awCents: result.awCents,
      owCappedCents: result.cpf.owCappedCents,
      awCappedCents: result.cpf.awCappedCents,
      employerRate: String(result.cpf.employerRate),
      employeeRate: String(result.cpf.employeeRate),
      totalRate: String(result.cpf.totalRate),
      employerAmountCents: result.cpf.employerCpfCents,
      employeeAmountCents: result.cpf.employeeCpfCents,
      totalAmountCents: result.cpf.totalCpfCents,
      ageBand: result.cpf.ageBand,
      rateTable,
      ytdOwCents: ytd.ytdOwCents + result.cpf.owCappedCents,
      ytdAwCents: ytd.ytdAwCents + result.cpf.awCappedCents,
    });

    totalGross += result.grossPayCents;
    totalNet += result.netPayCents;
    totalEmployerCpf += result.cpf.employerCpfCents;
    totalEmployeeCpf += result.cpf.employeeCpfCents;
    totalSdl += result.sdl.sdlCents;
    totalFwl += result.fwl.fwlCents;
  }

  // Update pay run totals and status
  await db
    .update(payRuns)
    .set({
      status: "calculated",
      totalGrossCents: totalGross,
      totalNetCents: totalNet,
      totalEmployerCpfCents: totalEmployerCpf,
      totalEmployeeCpfCents: totalEmployeeCpf,
      totalSdlCents: totalSdl,
      totalFwlCents: totalFwl,
      updatedAt: new Date(),
    })
    .where(eq(payRuns.id, payRunId));

  await logAudit({
    userId,
    action: "calculate_pay_run",
    entityType: "pay_run",
    entityId: payRunId,
    newValue: { employeeCount: results.length, totalGross, totalNet },
  });

  return { results, totalGross, totalNet, totalEmployerCpf, totalEmployeeCpf, totalSdl, totalFwl };
}

/** Parse FWL rate from employee record metadata */
function parseFwlRate(emp: { workPassType: string | null }): number {
  // Default FWL rates by pass type (in cents) — these are configurable per employee
  // but we use defaults when not specifically set
  if (!emp.workPassType) return 0;
  const passType = emp.workPassType.toLowerCase();
  if (passType.includes("s pass")) return 45000; // S$450
  if (passType.includes("work permit")) return 30000; // S$300
  return 0;
}

/** Transition pay run status */
export async function transitionPayRun(
  payRunId: string,
  companyId: string,
  newStatus: PayRunStatus,
  userId: string,
) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);

  if (!run) throw new Error("Pay run not found");
  if (!isValidTransition(run.status, newStatus)) {
    throw new Error(`Invalid transition: ${run.status} → ${newStatus}`);
  }

  const updates: Record<string, unknown> = { status: newStatus, updatedAt: new Date() };
  if (newStatus === "approved") {
    updates.approvedBy = userId;
    updates.approvedAt = new Date();
  }
  if (newStatus === "paid") {
    updates.paidAt = new Date();
  }

  await db.update(payRuns).set(updates).where(eq(payRuns.id, payRunId));

  await logAudit({
    userId,
    action: `transition_pay_run_${newStatus}`,
    entityType: "pay_run",
    entityId: payRunId,
    oldValue: { status: run.status },
    newValue: { status: newStatus },
  });
}

/** Delete a draft pay run */
export async function deletePayRun(payRunId: string, companyId: string, userId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);

  if (!run) throw new Error("Pay run not found");
  if (run.status !== "draft") {
    throw new Error("Can only delete draft pay runs");
  }

  // Clean up payslips and CPF records
  const existingPayslips = await db
    .select({ id: payslips.id })
    .from(payslips)
    .where(eq(payslips.payRunId, payRunId));
  for (const slip of existingPayslips) {
    await db.delete(cpfRecords).where(eq(cpfRecords.payslipId, slip.id));
  }
  await db.delete(payslips).where(eq(payslips.payRunId, payRunId));
  await db.delete(payRuns).where(eq(payRuns.id, payRunId));

  await logAudit({
    userId,
    action: "delete_pay_run",
    entityType: "pay_run",
    entityId: payRunId,
    oldValue: { periodStart: run.periodStart, periodEnd: run.periodEnd },
  });
}
