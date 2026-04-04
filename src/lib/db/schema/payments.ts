import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { payRuns } from "./pay-runs";
import { payslips } from "./payslips";
import { employees } from "./employees";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "submitted",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  payRunId: uuid("pay_run_id")
    .notNull()
    .references(() => payRuns.id),
  payslipId: uuid("payslip_id").references(() => payslips.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  employeeName: text("employee_name").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumberMasked: text("account_number_masked").notNull(), // last 4 digits only
  amountCents: integer("amount_cents").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("giro"),
  bankReference: text("bank_reference"),
  failureReason: text("failure_reason"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
