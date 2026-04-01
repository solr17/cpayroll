import {
  pgTable,
  uuid,
  date,
  integer,
  numeric,
  pgEnum,
  timestamp,
} from "drizzle-orm/pg-core";

export const cpfStatusTypeEnum = pgEnum("cpf_status_type", [
  "SC",
  "PR1",
  "PR2",
  "PR3",
]);

export const cpfRateTables = pgTable("cpf_rate_tables", {
  id: uuid("id").defaultRandom().primaryKey(),
  effectiveDate: date("effective_date").notNull(),
  statusType: cpfStatusTypeEnum("status_type").notNull(),
  ageBandMin: integer("age_band_min").notNull(),
  ageBandMax: integer("age_band_max").notNull(),
  employerRate: numeric("employer_rate", { precision: 6, scale: 4 }).notNull(),
  employeeRate: numeric("employee_rate", { precision: 6, scale: 4 }).notNull(),
  totalRate: numeric("total_rate", { precision: 6, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
