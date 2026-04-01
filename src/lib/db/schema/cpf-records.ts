import { pgTable, uuid, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { payslips } from "./payslips";
import { employees } from "./employees";

export const cpfRecords = pgTable("cpf_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  payslipId: uuid("payslip_id")
    .notNull()
    .references(() => payslips.id),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  owCents: integer("ow_cents").notNull(),
  awCents: integer("aw_cents").notNull().default(0),
  owCappedCents: integer("ow_capped_cents").notNull(),
  awCappedCents: integer("aw_capped_cents").notNull().default(0),
  employerRate: numeric("employer_rate", { precision: 6, scale: 4 }).notNull(),
  employeeRate: numeric("employee_rate", { precision: 6, scale: 4 }).notNull(),
  totalRate: numeric("total_rate", { precision: 6, scale: 4 }).notNull(),
  employerAmountCents: integer("employer_amount_cents").notNull(),
  employeeAmountCents: integer("employee_amount_cents").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  ageBand: text("age_band").notNull(),
  rateTable: text("rate_table").notNull(),
  ytdOwCents: integer("ytd_ow_cents").notNull(),
  ytdAwCents: integer("ytd_aw_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
