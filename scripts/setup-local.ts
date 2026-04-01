/**
 * Local Development Setup — Creates PGlite database with schema and seed data.
 * Run: npx tsx scripts/setup-local.ts
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createHash, createHmac, randomBytes, createCipheriv } from "crypto";
import * as bcryptjs from "bcryptjs";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "9cf8bc8e947a7c32b7265528ca535b0b898d5afa6cc6538f0020627cfbfd8353";
const NRIC_HMAC_KEY =
  process.env.NRIC_HMAC_KEY || "f5ce94da47a6e2754ee2825d4aa3e6ff82fd5892e7467490ed815a4f6f53f39e";

function encrypt(plaintext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

function hashNric(nric: string): string {
  const key = Buffer.from(NRIC_HMAC_KEY, "hex");
  return createHmac("sha256", key).update(nric.toUpperCase().trim()).digest("hex");
}

async function main() {
  console.log("Setting up local PGlite database...\n");

  const client = new PGlite("./data/clinicpay");
  const db = drizzle(client);

  // ─── Create Enums ───────────────────────────────────────────────────────────
  console.log("Creating enums...");
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE citizenship_status AS ENUM ('SC', 'PR1', 'PR2', 'PR3', 'FW');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE employment_type AS ENUM ('FT', 'PT', 'CONTRACT', 'LOCUM');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE employee_status AS ENUM ('active', 'probation', 'terminated');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE pay_run_status AS ENUM ('draft', 'calculated', 'reviewed', 'approved', 'paid', 'filed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE cpf_status_type AS ENUM ('SC', 'PR1', 'PR2', 'PR3');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE leave_type AS ENUM ('annual', 'sick_outpatient', 'sick_hospitalisation', 'maternity', 'paternity', 'childcare', 'compassionate', 'unpaid', 'other');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('owner', 'admin', 'employee');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  // ─── Create Tables ──────────────────────────────────────────────────────────
  console.log("Creating tables...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      uen TEXT NOT NULL UNIQUE,
      address_json JSONB,
      bank_account_json JSONB,
      cpf_submission_number TEXT,
      iras_tax_ref TEXT,
      pay_day INTEGER NOT NULL DEFAULT 25,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role user_role NOT NULL DEFAULT 'employee',
      totp_secret TEXT,
      totp_enabled TEXT DEFAULT 'false',
      employee_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id),
      nric_fin_hash TEXT NOT NULL,
      nric_last4 TEXT NOT NULL,
      full_name TEXT NOT NULL,
      dob DATE NOT NULL,
      gender TEXT,
      nationality TEXT,
      citizenship_status citizenship_status NOT NULL,
      pr_effective_date DATE,
      mobile TEXT,
      email TEXT,
      address_encrypted TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      employee_code TEXT,
      position TEXT,
      department TEXT,
      hire_date DATE NOT NULL,
      confirmation_date DATE,
      probation_end DATE,
      employment_type employment_type NOT NULL DEFAULT 'FT',
      contract_end_date DATE,
      termination_date DATE,
      termination_reason TEXT,
      bank_json_encrypted TEXT,
      cpf_account_number TEXT,
      work_pass_type TEXT,
      work_pass_expiry DATE,
      tax_ref_number TEXT,
      status employee_status NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS salary_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES employees(id),
      effective_date DATE NOT NULL,
      basic_salary_cents INTEGER NOT NULL,
      allowances_json JSONB,
      ot_eligible BOOLEAN NOT NULL DEFAULT false,
      ot_rate_multiplier NUMERIC(4,2) DEFAULT 1.50,
      aws_months NUMERIC(4,2) DEFAULT 0,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS pay_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id),
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      pay_date DATE NOT NULL,
      status pay_run_status NOT NULL DEFAULT 'draft',
      total_gross_cents INTEGER,
      total_net_cents INTEGER,
      total_employer_cpf_cents INTEGER,
      total_employee_cpf_cents INTEGER,
      total_sdl_cents INTEGER,
      total_fwl_cents INTEGER,
      created_by UUID,
      approved_by UUID,
      approved_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS payslips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pay_run_id UUID NOT NULL REFERENCES pay_runs(id),
      employee_id UUID NOT NULL REFERENCES employees(id),
      basic_salary_cents INTEGER NOT NULL,
      prorated_days NUMERIC(5,2),
      gross_pay_cents INTEGER NOT NULL,
      ot_hours NUMERIC(6,2),
      ot_pay_cents INTEGER DEFAULT 0,
      allowances_json JSONB,
      deductions_json JSONB,
      employer_cpf_cents INTEGER NOT NULL,
      employee_cpf_cents INTEGER NOT NULL,
      sdl_cents INTEGER NOT NULL,
      fwl_cents INTEGER NOT NULL DEFAULT 0,
      net_pay_cents INTEGER NOT NULL,
      employer_total_cost_cents INTEGER NOT NULL,
      pdf_file_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS cpf_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payslip_id UUID NOT NULL REFERENCES payslips(id),
      employee_id UUID NOT NULL REFERENCES employees(id),
      ow_cents INTEGER NOT NULL,
      aw_cents INTEGER NOT NULL DEFAULT 0,
      ow_capped_cents INTEGER NOT NULL,
      aw_capped_cents INTEGER NOT NULL DEFAULT 0,
      employer_rate NUMERIC(6,4) NOT NULL,
      employee_rate NUMERIC(6,4) NOT NULL,
      total_rate NUMERIC(6,4) NOT NULL,
      employer_amount_cents INTEGER NOT NULL,
      employee_amount_cents INTEGER NOT NULL,
      total_amount_cents INTEGER NOT NULL,
      age_band TEXT NOT NULL,
      rate_table TEXT NOT NULL,
      ytd_ow_cents INTEGER NOT NULL,
      ytd_aw_cents INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS cpf_rate_tables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      effective_date DATE NOT NULL,
      status_type cpf_status_type NOT NULL,
      age_band_min INTEGER NOT NULL,
      age_band_max INTEGER NOT NULL,
      employer_rate NUMERIC(6,4) NOT NULL,
      employee_rate NUMERIC(6,4) NOT NULL,
      total_rate NUMERIC(6,4) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS leave_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES employees(id),
      leave_type leave_type NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days NUMERIC(4,1) NOT NULL,
      status leave_status NOT NULL DEFAULT 'pending',
      approved_by UUID,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID,
      old_value JSONB,
      new_value JSONB,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ─── Seed CPF Rate Tables (2026) ───────────────────────────────────────────
  console.log("Seeding CPF rate tables...");

  // Check if already seeded
  const existing = await client.query("SELECT COUNT(*) as count FROM cpf_rate_tables");
  if (Number((existing.rows[0] as { count: number }).count) === 0) {
    // SC rates 2026
    const scRates = [
      { min: 0, max: 55, employer: 0.17, employee: 0.2, total: 0.37 },
      { min: 56, max: 60, employer: 0.155, employee: 0.17, total: 0.325 },
      { min: 61, max: 65, employer: 0.12, employee: 0.115, total: 0.235 },
      { min: 66, max: 70, employer: 0.09, employee: 0.075, total: 0.165 },
      { min: 71, max: 999, employer: 0.075, employee: 0.05, total: 0.125 },
    ];

    for (const r of scRates) {
      await client.query(
        `INSERT INTO cpf_rate_tables (effective_date, status_type, age_band_min, age_band_max, employer_rate, employee_rate, total_rate)
         VALUES ('2026-01-01', 'SC', $1, $2, $3, $4, $5)`,
        [r.min, r.max, r.employer, r.employee, r.total],
      );
    }

    // PR3+ rates (same as SC)
    for (const r of scRates) {
      await client.query(
        `INSERT INTO cpf_rate_tables (effective_date, status_type, age_band_min, age_band_max, employer_rate, employee_rate, total_rate)
         VALUES ('2026-01-01', 'PR3', $1, $2, $3, $4, $5)`,
        [r.min, r.max, r.employer, r.employee, r.total],
      );
    }

    // PR1 rates (graduated - lower)
    const pr1Rates = [
      { min: 0, max: 55, employer: 0.04, employee: 0.05, total: 0.09 },
      { min: 56, max: 60, employer: 0.04, employee: 0.05, total: 0.09 },
      { min: 61, max: 65, employer: 0.04, employee: 0.05, total: 0.09 },
      { min: 66, max: 70, employer: 0.04, employee: 0.05, total: 0.09 },
      { min: 71, max: 999, employer: 0.04, employee: 0.05, total: 0.09 },
    ];

    for (const r of pr1Rates) {
      await client.query(
        `INSERT INTO cpf_rate_tables (effective_date, status_type, age_band_min, age_band_max, employer_rate, employee_rate, total_rate)
         VALUES ('2026-01-01', 'PR1', $1, $2, $3, $4, $5)`,
        [r.min, r.max, r.employer, r.employee, r.total],
      );
    }

    // PR2 rates (graduated - mid)
    const pr2Rates = [
      { min: 0, max: 55, employer: 0.09, employee: 0.15, total: 0.24 },
      { min: 56, max: 60, employer: 0.09, employee: 0.125, total: 0.215 },
      { min: 61, max: 65, employer: 0.075, employee: 0.075, total: 0.15 },
      { min: 66, max: 70, employer: 0.06, employee: 0.05, total: 0.11 },
      { min: 71, max: 999, employer: 0.06, employee: 0.05, total: 0.11 },
    ];

    for (const r of pr2Rates) {
      await client.query(
        `INSERT INTO cpf_rate_tables (effective_date, status_type, age_band_min, age_band_max, employer_rate, employee_rate, total_rate)
         VALUES ('2026-01-01', 'PR2', $1, $2, $3, $4, $5)`,
        [r.min, r.max, r.employer, r.employee, r.total],
      );
    }

    console.log("  Seeded 20 CPF rate entries (SC, PR1, PR2, PR3+)");
  } else {
    console.log("  CPF rates already seeded, skipping");
  }

  // ─── Seed Company + Admin + Employees ────────────────────────────────────
  console.log("Seeding company and employees...");

  const existingCompany = await client.query("SELECT COUNT(*) as count FROM companies");
  if (Number((existingCompany.rows[0] as { count: number }).count) === 0) {
    // Create company
    const companyResult = await client.query(`
      INSERT INTO companies (name, uen, address_json, cpf_submission_number, iras_tax_ref, pay_day, bank_account_json)
      VALUES (
        'HealthFirst Medical Clinic',
        '202012345A',
        '{"line1": "123 Medical Row", "line2": "#01-01 Health Hub", "postal": "123456", "country": "Singapore"}',
        'CSN-12345',
        'TX-2020-12345',
        25,
        '{"bankName": "DBS", "accountNumber": "0123456789", "branchCode": "001"}'
      )
      RETURNING id
    `);
    const companyId = (companyResult.rows[0] as { id: string }).id;
    console.log(`  Company created: ${companyId}`);

    // Create admin user
    const passwordHash = await bcryptjs.hash("password123", 12);
    await client.query(
      `INSERT INTO users (company_id, email, password_hash, name, role)
       VALUES ($1, 'admin@clinicpay.sg', $2, 'Admin User', 'owner')`,
      [companyId, passwordHash],
    );
    console.log("  Admin user created: admin@clinicpay.sg / password123");

    // Create sample employees
    const sampleEmployees = [
      {
        nric: "S8012345A",
        name: "Tan Ah Kow",
        dob: "1980-03-15",
        gender: "M",
        nationality: "Singaporean",
        citizenship: "SC",
        position: "Senior Doctor",
        department: "Medical",
        hireDate: "2020-01-15",
        type: "FT",
        salary: 1200000,
        bank: { bankName: "DBS", branchCode: "001", accountNumber: "1234567890" },
      },
      {
        nric: "S8512346B",
        name: "Lim Mei Ling",
        dob: "1985-07-22",
        gender: "F",
        nationality: "Singaporean",
        citizenship: "SC",
        position: "Head Nurse",
        department: "Nursing",
        hireDate: "2021-03-01",
        type: "FT",
        salary: 550000,
        bank: { bankName: "OCBC", branchCode: "502", accountNumber: "2345678901" },
      },
      {
        nric: "G9112347C",
        name: "Maria Santos",
        dob: "1991-11-08",
        gender: "F",
        nationality: "Filipino",
        citizenship: "FW",
        position: "Clinic Assistant",
        department: "Operations",
        hireDate: "2023-06-15",
        type: "FT",
        salary: 280000,
        bank: { bankName: "DBS", branchCode: "001", accountNumber: "3456789012" },
        workPassType: "Work Permit",
        workPassExpiry: "2027-06-14",
      },
      {
        nric: "S7512348D",
        name: "Wong Wei Ming",
        dob: "1975-01-30",
        gender: "M",
        nationality: "Singaporean",
        citizenship: "SC",
        position: "Receptionist",
        department: "Admin",
        hireDate: "2022-09-01",
        type: "FT",
        salary: 350000,
        bank: { bankName: "UOB", branchCode: "001", accountNumber: "4567890123" },
      },
      {
        nric: "S9012349E",
        name: "Priya Nair",
        dob: "1990-05-12",
        gender: "F",
        nationality: "Singaporean",
        citizenship: "SC",
        position: "Staff Nurse",
        department: "Nursing",
        hireDate: "2024-01-02",
        type: "FT",
        salary: 420000,
        bank: { bankName: "DBS", branchCode: "003", accountNumber: "5678901234" },
      },
    ];

    for (const emp of sampleEmployees) {
      const empResult = await client.query(
        `INSERT INTO employees (
          company_id, nric_fin_hash, nric_last4, full_name, dob, gender, nationality,
          citizenship_status, mobile, email, position, department, hire_date,
          employment_type, bank_json_encrypted, work_pass_type, work_pass_expiry, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'active')
        RETURNING id`,
        [
          companyId,
          hashNric(emp.nric),
          emp.nric.slice(-4),
          emp.name,
          emp.dob,
          emp.gender,
          emp.nationality,
          emp.citizenship,
          "9" + String(Math.floor(Math.random() * 10000000)).padStart(7, "0"),
          emp.name.toLowerCase().replace(/\s+/g, ".") + "@healthfirst.sg",
          emp.position,
          emp.department,
          emp.hireDate,
          emp.type,
          encrypt(JSON.stringify(emp.bank)),
          emp.workPassType ?? null,
          emp.workPassExpiry ?? null,
        ],
      );
      const empId = (empResult.rows[0] as { id: string }).id;

      // Create salary record
      await client.query(
        `INSERT INTO salary_records (employee_id, effective_date, basic_salary_cents, ot_eligible, ot_rate_multiplier, allowances_json)
         VALUES ($1, $2, $3, $4, 1.50, $5)`,
        [
          empId,
          emp.hireDate,
          emp.salary,
          emp.salary <= 260000, // OT eligible if <= $2,600/month
          JSON.stringify([
            { name: "Transport Allowance", amountCents: 15000, isFixed: true },
            { name: "Meal Allowance", amountCents: 10000, isFixed: true },
          ]),
        ],
      );
      console.log(
        `  Employee: ${emp.name} (${emp.citizenship}) - S$${(emp.salary / 100).toLocaleString()}/month`,
      );
    }
  } else {
    console.log("  Data already seeded, skipping");
  }

  console.log("\n✓ Local database setup complete!");
  console.log("  Database: ./data/clinicpay");
  console.log("  Login: admin@clinicpay.sg / password123");
  console.log("\n  Run: npm run dev");

  process.exit(0);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
