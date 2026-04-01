import {
  pgTable,
  uuid,
  date,
  integer,
  boolean,
  jsonb,
  numeric,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { employees } from "./employees";

// APPEND-ONLY: Never update or delete rows in this table.
export const salaryRecords = pgTable("salary_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  effectiveDate: date("effective_date").notNull(),
  basicSalaryCents: integer("basic_salary_cents").notNull(),
  allowancesJson: jsonb("allowances_json"),
  otEligible: boolean("ot_eligible").notNull().default(false),
  otRateMultiplier: numeric("ot_rate_multiplier", { precision: 4, scale: 2 }).default("1.50"),
  awsMonths: numeric("aws_months", { precision: 4, scale: 2 }).default("0"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
