import { pgTable, uuid, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const payItemTypeEnum = pgEnum("pay_item_type", ["earning", "deduction"]);

export const payItemCategoryEnum = pgEnum("pay_item_category", ["fixed", "variable", "statutory"]);

export const payItemCpfClassEnum = pgEnum("pay_item_cpf_class", ["OW", "AW", "none"]);

export const payItems = pgTable("pay_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: payItemTypeEnum("type").notNull(),
  category: payItemCategoryEnum("category").notNull(),
  cpfApplicable: boolean("cpf_applicable").notNull().default(true),
  cpfClassification: payItemCpfClassEnum("cpf_classification").notNull().default("OW"),
  sdlApplicable: boolean("sdl_applicable").notNull().default(true),
  taxable: boolean("taxable").notNull().default(true),
  isSystemDefault: boolean("is_system_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  glAccountCode: text("gl_account_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
