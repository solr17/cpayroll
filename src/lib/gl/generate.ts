import { db } from "@/lib/db";
import { glAccounts, glJournalEntries, payRuns, payslips, employees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit/log";
import { addCents } from "@/lib/utils/money";
import type { AllowanceItem, DeductionItem } from "@/types";

/** Shape of a generated GL journal entry */
export interface GlEntry {
  id: string;
  companyId: string;
  payRunId: string;
  entryDate: string;
  accountCode: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
  description: string;
  department: string | null;
}

/** Default chart of accounts when company has no GL mappings configured */
const DEFAULT_ACCOUNTS: Record<string, { code: string; name: string; type: "debit" | "credit" }> = {
  basic_salary: { code: "5100", name: "Salary Expense", type: "debit" },
  allowances: { code: "5110", name: "Allowance Expense", type: "debit" },
  cpf_employer: { code: "5200", name: "CPF Expense (Employer)", type: "debit" },
  sdl: { code: "5210", name: "SDL Expense", type: "debit" },
  fwl: { code: "5220", name: "FWL Expense", type: "debit" },
  cpf_payable: { code: "2100", name: "CPF Payable", type: "credit" },
  shg: { code: "2120", name: "SHG Payable", type: "credit" },
  net_pay: { code: "1000", name: "Cash / Bank", type: "credit" },
  other_deductions: { code: "2200", name: "Other Deductions Payable", type: "credit" },
};

/**
 * Generate GL journal entries from a confirmed payroll run.
 *
 * Aggregates payslip data into double-entry journal lines and inserts
 * them into gl_journal_entries. Returns the created entries.
 */
export async function generateGlEntries(
  payRunId: string,
  companyId: string,
  userId: string,
): Promise<GlEntry[]> {
  // 1. Validate the pay run belongs to this company
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
    .limit(1);

  if (!run) {
    throw new Error("Pay run not found");
  }

  // 2. Check for existing journal entries (prevent duplicates)
  const existing = await db
    .select({ id: glJournalEntries.id })
    .from(glJournalEntries)
    .where(and(eq(glJournalEntries.payRunId, payRunId), eq(glJournalEntries.companyId, companyId)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(
      "Journal entries already exist for this pay run. Delete them first to regenerate.",
    );
  }

  // 3. Load company GL account mappings
  const accountMappings = await db
    .select()
    .from(glAccounts)
    .where(and(eq(glAccounts.companyId, companyId), eq(glAccounts.isActive, true)));

  // Build lookup: payItemMapping → { code, name }
  const mappingLookup = new Map<string, { code: string; name: string }>();
  for (const acct of accountMappings) {
    mappingLookup.set(acct.payItemMapping, {
      code: acct.accountCode,
      name: acct.accountName,
    });
  }

  function getAccount(mapping: string): { code: string; name: string } {
    const fromDb = mappingLookup.get(mapping);
    if (fromDb) return fromDb;
    const fallback = DEFAULT_ACCOUNTS[mapping];
    if (fallback) return { code: fallback.code, name: fallback.name };
    return { code: "9999", name: `Unmapped: ${mapping}` };
  }

  // 4. Load all payslips for this pay run with employee department
  const payslipRows = await db
    .select({
      basicSalaryCents: payslips.basicSalaryCents,
      grossPayCents: payslips.grossPayCents,
      employerCpfCents: payslips.employerCpfCents,
      employeeCpfCents: payslips.employeeCpfCents,
      sdlCents: payslips.sdlCents,
      fwlCents: payslips.fwlCents,
      shgCents: payslips.shgCents,
      netPayCents: payslips.netPayCents,
      allowancesJson: payslips.allowancesJson,
      deductionsJson: payslips.deductionsJson,
      department: employees.department,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payRunId, payRunId));

  if (payslipRows.length === 0) {
    throw new Error("No payslips found for this pay run");
  }

  // 5. Aggregate amounts across all payslips
  let totalBasicSalaryCents = 0;
  let totalAllowancesCents = 0;
  let totalEmployerCpfCents = 0;
  let totalEmployeeCpfCents = 0;
  let totalSdlCents = 0;
  let totalFwlCents = 0;
  let totalShgCents = 0;
  let totalNetPayCents = 0;
  let totalOtherDeductionsCents = 0;

  for (const slip of payslipRows) {
    totalBasicSalaryCents = addCents(totalBasicSalaryCents, slip.basicSalaryCents);
    totalEmployerCpfCents = addCents(totalEmployerCpfCents, slip.employerCpfCents);
    totalEmployeeCpfCents = addCents(totalEmployeeCpfCents, slip.employeeCpfCents);
    totalSdlCents = addCents(totalSdlCents, slip.sdlCents);
    totalFwlCents = addCents(totalFwlCents, slip.fwlCents);
    totalShgCents = addCents(totalShgCents, slip.shgCents);
    totalNetPayCents = addCents(totalNetPayCents, slip.netPayCents);

    // Sum allowances from JSON
    const allowances = slip.allowancesJson as AllowanceItem[] | null;
    if (allowances && Array.isArray(allowances)) {
      for (const a of allowances) {
        totalAllowancesCents = addCents(totalAllowancesCents, a.amountCents);
      }
    }

    // Sum voluntary/loan deductions from JSON (statutory ones are already captured as CPF/SDL/etc.)
    const deductions = slip.deductionsJson as DeductionItem[] | null;
    if (deductions && Array.isArray(deductions)) {
      for (const d of deductions) {
        if (d.type !== "statutory") {
          totalOtherDeductionsCents = addCents(totalOtherDeductionsCents, d.amountCents);
        }
      }
    }
  }

  // 6. Build journal entry lines
  const entryDate = run.payDate;
  const periodDesc = `${run.periodStart} to ${run.periodEnd}`;
  const entries: Array<{
    accountCode: string;
    accountName: string;
    debitCents: number;
    creditCents: number;
    description: string;
  }> = [];

  // DEBIT entries (expenses)
  if (totalBasicSalaryCents > 0) {
    const acct = getAccount("basic_salary");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: totalBasicSalaryCents,
      creditCents: 0,
      description: `Basic salary expense for ${periodDesc}`,
    });
  }

  if (totalAllowancesCents > 0) {
    const acct = getAccount("allowances");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: totalAllowancesCents,
      creditCents: 0,
      description: `Allowance expense for ${periodDesc}`,
    });
  }

  if (totalEmployerCpfCents > 0) {
    const acct = getAccount("cpf_employer");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: totalEmployerCpfCents,
      creditCents: 0,
      description: `Employer CPF contribution for ${periodDesc}`,
    });
  }

  if (totalSdlCents > 0) {
    const acct = getAccount("sdl");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: totalSdlCents,
      creditCents: 0,
      description: `SDL levy for ${periodDesc}`,
    });
  }

  if (totalFwlCents > 0) {
    const acct = getAccount("fwl");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: totalFwlCents,
      creditCents: 0,
      description: `FWL levy for ${periodDesc}`,
    });
  }

  // CREDIT entries (liabilities and cash)
  const totalCpfPayable = addCents(totalEmployerCpfCents, totalEmployeeCpfCents);
  if (totalCpfPayable > 0) {
    const acct = getAccount("cpf_payable");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: 0,
      creditCents: totalCpfPayable,
      description: `CPF payable (employer + employee) for ${periodDesc}`,
    });
  }

  if (totalShgCents > 0) {
    const acct = getAccount("shg");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: 0,
      creditCents: totalShgCents,
      description: `SHG fund payable for ${periodDesc}`,
    });
  }

  if (totalOtherDeductionsCents > 0) {
    const acct = getAccount("other_deductions");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: 0,
      creditCents: totalOtherDeductionsCents,
      description: `Other deductions payable for ${periodDesc}`,
    });
  }

  if (totalNetPayCents > 0) {
    const acct = getAccount("net_pay");
    entries.push({
      accountCode: acct.code,
      accountName: acct.name,
      debitCents: 0,
      creditCents: totalNetPayCents,
      description: `Net pay disbursement for ${periodDesc}`,
    });
  }

  // 7. Insert into database
  const insertedRows: GlEntry[] = [];
  for (const entry of entries) {
    const [row] = await db
      .insert(glJournalEntries)
      .values({
        companyId,
        payRunId,
        entryDate,
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        debitCents: entry.debitCents,
        creditCents: entry.creditCents,
        description: entry.description,
        department: null,
      })
      .returning();

    insertedRows.push({
      id: row.id,
      companyId: row.companyId,
      payRunId: row.payRunId,
      entryDate: row.entryDate,
      accountCode: row.accountCode,
      accountName: row.accountName,
      debitCents: row.debitCents,
      creditCents: row.creditCents,
      description: row.description,
      department: row.department,
    });
  }

  // 8. Audit log
  await logAudit({
    userId,
    action: "gl_entries_generated",
    entityType: "pay_run",
    entityId: payRunId,
    newValue: {
      entryCount: insertedRows.length,
      totalDebits: insertedRows.reduce((sum, e) => sum + e.debitCents, 0),
      totalCredits: insertedRows.reduce((sum, e) => sum + e.creditCents, 0),
    },
  });

  return insertedRows;
}
