-- Migration: Add GL accounts, GL journal entries, pay items, SHG fields, public holidays
-- Generated: 2026-04-03

-- New enums
CREATE TYPE "public"."gl_account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."pay_item_type" AS ENUM('earning', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."pay_item_category" AS ENUM('fixed', 'variable', 'statutory');--> statement-breakpoint
CREATE TYPE "public"."pay_item_cpf_class" AS ENUM('OW', 'AW', 'none');--> statement-breakpoint

-- GL Accounts table
CREATE TABLE "gl_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "companies"("id"),
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" "gl_account_type" NOT NULL,
	"pay_item_mapping" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- GL Journal Entries table
CREATE TABLE "gl_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "companies"("id"),
	"pay_run_id" uuid NOT NULL REFERENCES "pay_runs"("id"),
	"entry_date" date NOT NULL,
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"debit_cents" integer DEFAULT 0 NOT NULL,
	"credit_cents" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"department" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Pay Items table
CREATE TABLE "pay_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "companies"("id"),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "pay_item_type" NOT NULL,
	"category" "pay_item_category" NOT NULL,
	"cpf_applicable" boolean DEFAULT true NOT NULL,
	"cpf_classification" "pay_item_cpf_class" DEFAULT 'OW' NOT NULL,
	"sdl_applicable" boolean DEFAULT true NOT NULL,
	"taxable" boolean DEFAULT true NOT NULL,
	"is_system_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"gl_account_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Public Holidays table
CREATE TABLE "public_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"is_gazetted" boolean DEFAULT true NOT NULL,
	"company_id" uuid REFERENCES "companies"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add new columns to employees table
ALTER TABLE "employees" ADD COLUMN "race" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "religion" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "shg_opted_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Add new columns to payslips table
ALTER TABLE "payslips" ADD COLUMN "shg_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "shg_fund_type" text;--> statement-breakpoint

-- Add pro-ration method to companies table
ALTER TABLE "companies" ADD COLUMN "proration_method" text DEFAULT 'calendar';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "ot_multiplier" numeric(3, 1) DEFAULT 1.5;--> statement-breakpoint

-- Update user_role enum to add new roles
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'payroll_operator';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'report_viewer';--> statement-breakpoint

-- Indexes for performance
CREATE INDEX "idx_gl_accounts_company" ON "gl_accounts" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_gl_journal_company_payrun" ON "gl_journal_entries" ("company_id", "pay_run_id");--> statement-breakpoint
CREATE INDEX "idx_pay_items_company" ON "pay_items" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_public_holidays_year" ON "public_holidays" ("year");--> statement-breakpoint
CREATE INDEX "idx_employees_race" ON "employees" ("race");
