import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { payRuns } from "./pay-runs";

export const glAccountTypeEnum = pgEnum("gl_account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

export const glAccounts = pgTable("gl_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  accountCode: text("account_code").notNull(),
  accountName: text("account_name").notNull(),
  accountType: glAccountTypeEnum("account_type").notNull(),
  payItemMapping: text("pay_item_mapping").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const glJournalEntries = pgTable("gl_journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  payRunId: uuid("pay_run_id")
    .notNull()
    .references(() => payRuns.id),
  entryDate: date("entry_date").notNull(),
  accountCode: text("account_code").notNull(),
  accountName: text("account_name").notNull(),
  debitCents: integer("debit_cents").notNull().default(0),
  creditCents: integer("credit_cents").notNull().default(0),
  description: text("description").notNull(),
  department: text("department"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
