import { pgTable, uuid, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  uen: text("uen").notNull().unique(),
  addressJson: jsonb("address_json"),
  bankAccountJson: jsonb("bank_account_json"),
  cpfSubmissionNumber: text("cpf_submission_number"),
  irasTaxRef: text("iras_tax_ref"),
  payDay: integer("pay_day").notNull().default(25),
  prorationMethod: text("proration_method").default("calendar"),
  otMultiplier: numeric("ot_multiplier", { precision: 3, scale: 1 }).default("1.5"),
  dualApprovalThresholdCents: integer("dual_approval_threshold_cents").default(0), // 0 = disabled
  // Stripe billing fields
  stripePriceId: text("stripe_price_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planTier: text("plan_tier").default("free"), // free, pro, enterprise
  planEmployeeLimit: integer("plan_employee_limit").default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
