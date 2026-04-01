import { pgTable, uuid, date, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const payRunStatusEnum = pgEnum("pay_run_status", [
  "draft",
  "calculated",
  "reviewed",
  "approved",
  "paid",
  "filed",
]);

export const payRuns = pgTable("pay_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  payDate: date("pay_date").notNull(),
  status: payRunStatusEnum("status").notNull().default("draft"),
  totalGrossCents: integer("total_gross_cents"),
  totalNetCents: integer("total_net_cents"),
  totalEmployerCpfCents: integer("total_employer_cpf_cents"),
  totalEmployeeCpfCents: integer("total_employee_cpf_cents"),
  totalSdlCents: integer("total_sdl_cents"),
  totalFwlCents: integer("total_fwl_cents"),
  createdBy: uuid("created_by"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
