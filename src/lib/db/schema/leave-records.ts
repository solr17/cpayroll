import {
  pgTable,
  uuid,
  date,
  numeric,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { employees } from "./employees";

export const leaveTypeEnum = pgEnum("leave_type", [
  "annual",
  "sick_outpatient",
  "sick_hospitalisation",
  "maternity",
  "paternity",
  "childcare",
  "compassionate",
  "unpaid",
  "other",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const leaveRecords = pgTable("leave_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  leaveType: leaveTypeEnum("leave_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: numeric("days", { precision: 4, scale: 1 }).notNull(),
  status: leaveStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
