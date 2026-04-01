import {
  pgTable,
  uuid,
  integer,
  numeric,
  jsonb,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { payRuns } from "./pay-runs";
import { employees } from "./employees";

export const payslips = pgTable("payslips", {
  id: uuid("id").defaultRandom().primaryKey(),
  payRunId: uuid("pay_run_id")
    .notNull()
    .references(() => payRuns.id),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  basicSalaryCents: integer("basic_salary_cents").notNull(),
  proratedDays: numeric("prorated_days", { precision: 5, scale: 2 }),
  grossPayCents: integer("gross_pay_cents").notNull(),
  otHours: numeric("ot_hours", { precision: 6, scale: 2 }),
  otPayCents: integer("ot_pay_cents").default(0),
  allowancesJson: jsonb("allowances_json"),
  deductionsJson: jsonb("deductions_json"),
  employerCpfCents: integer("employer_cpf_cents").notNull(),
  employeeCpfCents: integer("employee_cpf_cents").notNull(),
  sdlCents: integer("sdl_cents").notNull(),
  fwlCents: integer("fwl_cents").notNull().default(0),
  netPayCents: integer("net_pay_cents").notNull(),
  employerTotalCostCents: integer("employer_total_cost_cents").notNull(),
  pdfFileKey: text("pdf_file_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
