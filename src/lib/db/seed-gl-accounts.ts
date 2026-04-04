import { db } from "@/lib/db";
import { glAccounts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

interface DefaultGlAccount {
  accountCode: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  payItemMapping: string;
}

const DEFAULT_GL_ACCOUNTS: DefaultGlAccount[] = [
  {
    accountCode: "1000",
    accountName: "Cash/Bank",
    accountType: "asset",
    payItemMapping: "net_pay",
  },
  {
    accountCode: "2100",
    accountName: "CPF Payable",
    accountType: "liability",
    payItemMapping: "cpf_total",
  },
  {
    accountCode: "2110",
    accountName: "SDL Payable",
    accountType: "liability",
    payItemMapping: "sdl",
  },
  {
    accountCode: "2120",
    accountName: "SHG Payable",
    accountType: "liability",
    payItemMapping: "shg",
  },
  {
    accountCode: "2130",
    accountName: "Other Deductions Payable",
    accountType: "liability",
    payItemMapping: "other_deductions",
  },
  {
    accountCode: "5100",
    accountName: "Salary Expense",
    accountType: "expense",
    payItemMapping: "basic_salary",
  },
  {
    accountCode: "5110",
    accountName: "Allowance Expense",
    accountType: "expense",
    payItemMapping: "allowances",
  },
  {
    accountCode: "5200",
    accountName: "CPF Expense - Employer",
    accountType: "expense",
    payItemMapping: "cpf_employer",
  },
  {
    accountCode: "5210",
    accountName: "SDL Expense",
    accountType: "expense",
    payItemMapping: "sdl_expense",
  },
  {
    accountCode: "5220",
    accountName: "FWL Expense",
    accountType: "expense",
    payItemMapping: "fwl",
  },
];

/**
 * Seed default GL accounts for a company.
 * Idempotent — skips accounts that already exist by code + company.
 */
export async function seedDefaultGlAccounts(companyId: string): Promise<void> {
  for (const account of DEFAULT_GL_ACCOUNTS) {
    const [existing] = await db
      .select({ id: glAccounts.id })
      .from(glAccounts)
      .where(
        and(eq(glAccounts.companyId, companyId), eq(glAccounts.accountCode, account.accountCode)),
      )
      .limit(1);

    if (existing) continue;

    await db.insert(glAccounts).values({
      companyId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      payItemMapping: account.payItemMapping,
      isActive: true,
    });
  }
}
