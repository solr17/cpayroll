import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  uen: text("uen").notNull().unique(),
  addressJson: jsonb("address_json"),
  bankAccountJson: jsonb("bank_account_json"),
  cpfSubmissionNumber: text("cpf_submission_number"),
  irasTaxRef: text("iras_tax_ref"),
  payDay: integer("pay_day").notNull().default(25),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
