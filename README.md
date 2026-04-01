# ClinicPay

Singapore clinic payroll platform with compliant CPF calculations, PDPA-grade data protection, and automated pay run workflows.

## Features

- **CPF Engine** — Age-band rates, OW/AW classification, annual ceilings ($102k salary, $37,740 CPF), pro-ration, and PR graduated contribution schedules. All math in integer cents.
- **Pay Runs** — State-machine workflow: draft → calculated → reviewed → approved → paid → filed. Bulk payslip generation with Excel and PDF export.
- **Employee Management** — Full CRUD with NRIC hashing (HMAC-SHA256), PII encryption (AES-256-GCM), citizenship/PR status tracking, and salary history.
- **SDL & FWL** — Skills Development Levy and Foreign Worker Levy calculations.
- **IR8A Reporting** — Tax filing report generation for IRAS.
- **Audit Trail** — Append-only log of every data mutation. No updates or deletes.
- **Auth & RBAC** — NextAuth v5 with three roles (owner, admin, employee) and optional TOTP 2FA.
- **Overtime** — Configurable multiplier, hourly rate derived from basic salary.

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Framework  | Next.js 15 / React 19 / TypeScript |
| Styling    | Tailwind CSS v4                    |
| Database   | PostgreSQL (Neon) via Drizzle ORM  |
| Queue      | Redis (Upstash) + BullMQ           |
| Auth       | NextAuth v5 + TOTP 2FA             |
| Validation | Zod                                |
| Testing    | Vitest                             |
| PDF        | Puppeteer                          |
| Excel      | ExcelJS                            |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (e.g. [Neon](https://neon.tech))
- Redis instance (e.g. [Upstash](https://upstash.com))

### Setup

```bash
git clone <repo-url> && cd cpayroll
npm install
cp .env.example .env   # fill in your values
npm run db:migrate      # apply database migrations
npm run seed:cpf-rates  # load CPF rate tables
npm run seed            # optional: seed test data
npm run dev             # http://localhost:3000
```

### Environment Variables

| Variable          | Description                                      |
| ----------------- | ------------------------------------------------ |
| `DATABASE_URL`    | PostgreSQL connection string                     |
| `REDIS_URL`       | Redis connection string                          |
| `NEXTAUTH_SECRET` | 32-byte base64 session secret                    |
| `NEXTAUTH_URL`    | App base URL (`http://localhost:3000`)           |
| `ENCRYPTION_KEY`  | 32-byte hex key for AES-256-GCM PII encryption   |
| `NRIC_HMAC_KEY`   | 32-byte hex key for NRIC hashing                 |
| `S3_ENDPOINT`     | Optional — S3-compatible storage endpoint        |
| `S3_BUCKET`       | Optional — bucket name for file storage          |
| `S3_ACCESS_KEY`   | Optional — S3 access key                         |
| `S3_SECRET_KEY`   | Optional — S3 secret key                         |
| `S3_REGION`       | Optional — S3 region (default: `ap-southeast-1`) |

## Scripts

```bash
npm run dev              # Development server
npm run build            # Production build
npm run typecheck        # TypeScript check (tsc --noEmit)
npm run lint             # ESLint
npm run format           # Prettier

npm test                 # All tests
npm run test:cpf         # CPF engine tests only
npm run test:payroll     # Payroll calculation tests
npm run test:coverage    # Coverage report

npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Apply migrations
npm run db:studio        # Drizzle Studio (DB browser)
npm run seed             # Seed test data
npm run seed:cpf-rates   # Seed CPF rate tables
```

## Project Structure

```
src/
  app/
    (auth)/                 # Login, 2FA pages
    (dashboard)/            # Protected admin pages
      employees/            # Employee CRUD
      payroll/              # Pay runs & payslips
      cpf/                  # CPF rate management
      reports/              # IR8A, payslips
      settings/             # Company configuration
    api/                    # REST route handlers
  lib/
    payroll/                # CPF, SDL, FWL, engine (critical path)
    db/schema/              # Drizzle table definitions
    auth/                   # NextAuth + RBAC + TOTP
    crypto/                 # AES-256-GCM, NRIC HMAC
    audit/                  # Append-only audit logger
    utils/                  # Money (cents), date (SG timezone)
    validators/             # Zod schemas
  components/               # React UI components
  types/                    # Shared TypeScript types
tests/
  unit/cpf/                 # 100+ CPF edge case tests
  unit/payroll/             # Payroll engine tests
  fixtures/                 # Test data
docs/                       # API, architecture, CPF rules, deployment
```

## Database Schema

11 tables managed by Drizzle ORM:

| Table             | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `companies`       | Tenant details (UEN, bank info, CPF submission number) |
| `employees`       | Employee roster with hashed NRIC and encrypted PII     |
| `users`           | Auth accounts with RBAC roles and TOTP secrets         |
| `salary_records`  | Immutable salary history (append-only)                 |
| `pay_runs`        | Batch payroll cycles with status tracking              |
| `payslips`        | Individual payment records with full breakdown         |
| `cpf_records`     | CPF contribution details per payslip                   |
| `cpf_rate_tables` | Configurable CPF rates by age band and citizenship     |
| `leave_records`   | Leave tracking (annual, sick, unpaid)                  |
| `audit_log`       | Immutable audit trail (append-only)                    |

All monetary columns store **integer cents** — no floats.

## Key Design Decisions

- **Integer cents everywhere** — All money values use integer arithmetic to avoid floating-point errors. Variables are suffixed with `_cents`.
- **Centralised CPF math** — All CPF calculation lives in `src/lib/payroll/`. No CPF logic anywhere else.
- **CPF rounding rules** — Total CPF rounds to nearest dollar. Employee share always rounds down (`Math.floor`). Employer share is derived (total minus employee).
- **Append-only records** — Salary records and audit logs are never updated or deleted.
- **NRIC protection** — Full NRIC is never stored in plaintext, displayed in UI, or included in logs. Only the HMAC hash (for lookup) and last 4 characters (for display) are kept.
- **PII encryption** — Bank details and addresses are encrypted at rest with AES-256-GCM.

## Documentation

| Topic               | File                                         |
| ------------------- | -------------------------------------------- |
| API endpoints       | [docs/api.md](docs/api.md)                   |
| Architecture        | [docs/architecture.md](docs/architecture.md) |
| CPF rules & rates   | [docs/cpf-rules.md](docs/cpf-rules.md)       |
| Deployment          | [docs/deployment.md](docs/deployment.md)     |
| Regulatory calendar | [docs/regulatory.md](docs/regulatory.md)     |

## License

Private. All rights reserved.
