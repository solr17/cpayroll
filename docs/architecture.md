# ClinicPay Architecture

## Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4
- **Database**: PostgreSQL 16+ (Neon serverless)
- **ORM**: Drizzle ORM
- **Auth**: Session-based with TOTP 2FA, RBAC (Owner/Admin/Employee)
- **Queue**: BullMQ + Upstash Redis
- **Testing**: Vitest

## Database

All monetary values stored as integer cents. No floating point for money.
Schema: 10 tables (companies, employees, salary_records, pay_runs, payslips, cpf_records, cpf_rate_tables, leave_records, audit_log, users).

## Security

- NRIC: HMAC-SHA256 hash for lookup, last 4 chars for display
- PII: AES-256-GCM encryption at application level
- Audit: Append-only log, every mutation tracked
- Auth: RBAC with 3 roles, TOTP 2FA for admin/owner
