import { pgTable, uuid, integer, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { leaveTypeEnum } from "./leave-records";

export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    year: integer("year").notNull(),
    leaveType: leaveTypeEnum("leave_type").notNull(),
    entitlementDays: numeric("entitlement_days", { precision: 5, scale: 1 }).notNull(),
    usedDays: numeric("used_days", { precision: 5, scale: 1 }).notNull().default("0"),
    carryOverDays: numeric("carry_over_days", { precision: 5, scale: 1 }).notNull().default("0"),
    adjustmentDays: numeric("adjustment_days", { precision: 5, scale: 1 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("leave_balances_emp_year_type").on(table.employeeId, table.year, table.leaveType),
  ],
);
