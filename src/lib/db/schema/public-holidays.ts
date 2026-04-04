import { pgTable, uuid, text, date, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const publicHolidays = pgTable("public_holidays", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  isGazetted: boolean("is_gazetted").notNull().default(true),
  companyId: uuid("company_id").references(() => companies.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
