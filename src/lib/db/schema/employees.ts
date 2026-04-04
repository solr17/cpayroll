import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  pgEnum,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const citizenshipStatusEnum = pgEnum("citizenship_status", [
  "SC",
  "PR1",
  "PR2",
  "PR3",
  "FW",
]);

export const employmentTypeEnum = pgEnum("employment_type", ["FT", "PT", "CONTRACT", "LOCUM"]);

export const employeeStatusEnum = pgEnum("employee_status", ["active", "probation", "terminated"]);

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  nricFinHash: text("nric_fin_hash").notNull(),
  nricLast4: text("nric_last4").notNull(),
  fullName: text("full_name").notNull(),
  dob: date("dob").notNull(),
  gender: text("gender"),
  nationality: text("nationality"),
  citizenshipStatus: citizenshipStatusEnum("citizenship_status").notNull(),
  prEffectiveDate: date("pr_effective_date"),
  mobile: text("mobile"),
  email: text("email"),
  addressEncrypted: text("address_encrypted"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  employeeCode: text("employee_code"),
  position: text("position"),
  department: text("department"),
  hireDate: date("hire_date").notNull(),
  confirmationDate: date("confirmation_date"),
  probationEnd: date("probation_end"),
  employmentType: employmentTypeEnum("employment_type").notNull().default("FT"),
  contractEndDate: date("contract_end_date"),
  terminationDate: date("termination_date"),
  terminationReason: text("termination_reason"),
  bankJsonEncrypted: text("bank_json_encrypted"),
  cpfAccountNumber: text("cpf_account_number"),
  workPassType: text("work_pass_type"),
  workPassExpiry: date("work_pass_expiry"),
  taxRefNumber: text("tax_ref_number"),
  race: text("race"),
  religion: text("religion"),
  shgOptedOut: boolean("shg_opted_out").notNull().default(false),
  // IR8A/IR8S fields
  isDirector: boolean("is_director").notNull().default(false),
  directorFeeCents: integer("director_fee_cents").default(0),
  benefitsInKindJson: jsonb("benefits_in_kind_json"), // array of {type, amountCents, description}
  transportAllowanceCents: integer("transport_allowance_cents").default(0),
  entertainmentAllowanceCents: integer("entertainment_allowance_cents").default(0),
  voluntaryCpfCents: integer("voluntary_cpf_cents").default(0),
  esopGainsCents: integer("esop_gains_cents").default(0),
  taxBorneByEmployerCents: integer("tax_borne_by_employer_cents").default(0),
  status: employeeStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
