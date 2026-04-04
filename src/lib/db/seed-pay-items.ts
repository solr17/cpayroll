import { db } from "@/lib/db";
import { payItems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

interface DefaultPayItem {
  code: string;
  name: string;
  type: "earning" | "deduction";
  category: "fixed" | "variable" | "statutory";
  cpfApplicable: boolean;
  cpfClassification: "OW" | "AW" | "none";
  sdlApplicable: boolean;
  taxable: boolean;
}

const DEFAULT_PAY_ITEMS: DefaultPayItem[] = [
  {
    code: "BASIC_SALARY",
    name: "Basic Salary",
    type: "earning",
    category: "fixed",
    cpfApplicable: true,
    cpfClassification: "OW",
    sdlApplicable: true,
    taxable: true,
  },
  {
    code: "TRANSPORT_ALLOW",
    name: "Transport Allowance",
    type: "earning",
    category: "fixed",
    cpfApplicable: true,
    cpfClassification: "OW",
    sdlApplicable: true,
    taxable: true,
  },
  {
    code: "MEAL_ALLOW",
    name: "Meal Allowance",
    type: "earning",
    category: "fixed",
    cpfApplicable: true,
    cpfClassification: "OW",
    sdlApplicable: true,
    taxable: true,
  },
  {
    code: "HOUSING_ALLOW",
    name: "Housing Allowance",
    type: "earning",
    category: "fixed",
    cpfApplicable: true,
    cpfClassification: "OW",
    sdlApplicable: true,
    taxable: true,
  },
  {
    code: "OT_PAY",
    name: "Overtime Pay",
    type: "earning",
    category: "variable",
    cpfApplicable: true,
    cpfClassification: "OW",
    sdlApplicable: true,
    taxable: true,
  },
  {
    code: "BONUS",
    name: "Bonus",
    type: "earning",
    category: "variable",
    cpfApplicable: true,
    cpfClassification: "AW",
    sdlApplicable: true,
    taxable: true,
  },
  {
    code: "COMMISSION",
    name: "Commission",
    type: "earning",
    category: "variable",
    cpfApplicable: true,
    cpfClassification: "AW",
    sdlApplicable: true,
    taxable: true,
  },
  {
    code: "AWS",
    name: "Annual Wage Supplement",
    type: "earning",
    category: "variable",
    cpfApplicable: true,
    cpfClassification: "AW",
    sdlApplicable: true,
    taxable: true,
  },
  {
    code: "REIMBURSEMENT",
    name: "Reimbursement",
    type: "earning",
    category: "variable",
    cpfApplicable: false,
    cpfClassification: "none",
    sdlApplicable: false,
    taxable: false,
  },
  {
    code: "EMPLOYEE_CPF",
    name: "Employee CPF",
    type: "deduction",
    category: "statutory",
    cpfApplicable: false,
    cpfClassification: "none",
    sdlApplicable: false,
    taxable: false,
  },
  {
    code: "SHG",
    name: "Self-Help Group",
    type: "deduction",
    category: "statutory",
    cpfApplicable: false,
    cpfClassification: "none",
    sdlApplicable: false,
    taxable: true,
  },
  {
    code: "LOAN_REPAY",
    name: "Loan Repayment",
    type: "deduction",
    category: "variable",
    cpfApplicable: false,
    cpfClassification: "none",
    sdlApplicable: false,
    taxable: false,
  },
];

/**
 * Seed default pay items for a company.
 * Safe to call multiple times — skips items that already exist by code.
 */
export async function seedDefaultPayItems(companyId: string): Promise<void> {
  for (const item of DEFAULT_PAY_ITEMS) {
    // Check if item already exists for this company (idempotent)
    const [existing] = await db
      .select({ id: payItems.id })
      .from(payItems)
      .where(and(eq(payItems.companyId, companyId), eq(payItems.code, item.code)))
      .limit(1);

    if (existing) continue;

    await db.insert(payItems).values({
      companyId,
      code: item.code,
      name: item.name,
      type: item.type,
      category: item.category,
      cpfApplicable: item.cpfApplicable,
      cpfClassification: item.cpfClassification,
      sdlApplicable: item.sdlApplicable,
      taxable: item.taxable,
      isSystemDefault: true,
      isActive: true,
    });
  }
}
