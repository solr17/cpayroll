CREATE TYPE "public"."citizenship_status" AS ENUM('SC', 'PR1', 'PR2', 'PR3', 'FW');--> statement-breakpoint
CREATE TYPE "public"."cpf_status_type" AS ENUM('SC', 'PR1', 'PR2', 'PR3');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'probation', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('FT', 'PT', 'CONTRACT', 'LOCUM');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('annual', 'sick_outpatient', 'sick_hospitalisation', 'maternity', 'paternity', 'childcare', 'compassionate', 'unpaid', 'other');--> statement-breakpoint
CREATE TYPE "public"."pay_run_status" AS ENUM('draft', 'calculated', 'reviewed', 'approved', 'paid', 'filed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'employee');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"uen" text NOT NULL,
	"address_json" jsonb,
	"bank_account_json" jsonb,
	"cpf_submission_number" text,
	"iras_tax_ref" text,
	"pay_day" integer DEFAULT 25 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_uen_unique" UNIQUE("uen")
);
--> statement-breakpoint
CREATE TABLE "cpf_rate_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"effective_date" date NOT NULL,
	"status_type" "cpf_status_type" NOT NULL,
	"age_band_min" integer NOT NULL,
	"age_band_max" integer NOT NULL,
	"employer_rate" numeric(6, 4) NOT NULL,
	"employee_rate" numeric(6, 4) NOT NULL,
	"total_rate" numeric(6, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpf_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payslip_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"ow_cents" integer NOT NULL,
	"aw_cents" integer DEFAULT 0 NOT NULL,
	"ow_capped_cents" integer NOT NULL,
	"aw_capped_cents" integer DEFAULT 0 NOT NULL,
	"employer_rate" numeric(6, 4) NOT NULL,
	"employee_rate" numeric(6, 4) NOT NULL,
	"total_rate" numeric(6, 4) NOT NULL,
	"employer_amount_cents" integer NOT NULL,
	"employee_amount_cents" integer NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"age_band" text NOT NULL,
	"rate_table" text NOT NULL,
	"ytd_ow_cents" integer NOT NULL,
	"ytd_aw_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"nric_fin_hash" text NOT NULL,
	"nric_last4" text NOT NULL,
	"full_name" text NOT NULL,
	"dob" date NOT NULL,
	"gender" text,
	"nationality" text,
	"citizenship_status" "citizenship_status" NOT NULL,
	"pr_effective_date" date,
	"mobile" text,
	"email" text,
	"address_encrypted" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"employee_code" text,
	"position" text,
	"department" text,
	"hire_date" date NOT NULL,
	"confirmation_date" date,
	"probation_end" date,
	"employment_type" "employment_type" DEFAULT 'FT' NOT NULL,
	"contract_end_date" date,
	"termination_date" date,
	"termination_reason" text,
	"bank_json_encrypted" text,
	"cpf_account_number" text,
	"work_pass_type" text,
	"work_pass_expiry" date,
	"tax_ref_number" text,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" numeric(4, 1) NOT NULL,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"status" "pay_run_status" DEFAULT 'draft' NOT NULL,
	"total_gross_cents" integer,
	"total_net_cents" integer,
	"total_employer_cpf_cents" integer,
	"total_employee_cpf_cents" integer,
	"total_sdl_cents" integer,
	"total_fwl_cents" integer,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pay_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"basic_salary_cents" integer NOT NULL,
	"prorated_days" numeric(5, 2),
	"gross_pay_cents" integer NOT NULL,
	"ot_hours" numeric(6, 2),
	"ot_pay_cents" integer DEFAULT 0,
	"allowances_json" jsonb,
	"deductions_json" jsonb,
	"employer_cpf_cents" integer NOT NULL,
	"employee_cpf_cents" integer NOT NULL,
	"sdl_cents" integer NOT NULL,
	"fwl_cents" integer DEFAULT 0 NOT NULL,
	"net_pay_cents" integer NOT NULL,
	"employer_total_cost_cents" integer NOT NULL,
	"pdf_file_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"effective_date" date NOT NULL,
	"basic_salary_cents" integer NOT NULL,
	"allowances_json" jsonb,
	"ot_eligible" boolean DEFAULT false NOT NULL,
	"ot_rate_multiplier" numeric(4, 2) DEFAULT '1.50',
	"aws_months" numeric(4, 2) DEFAULT '0',
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"totp_secret" text,
	"totp_enabled" text DEFAULT 'false',
	"employee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cpf_records" ADD CONSTRAINT "cpf_records_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpf_records" ADD CONSTRAINT "cpf_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;