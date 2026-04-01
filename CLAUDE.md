# ClinicPay — Singapore Clinic Payroll Platform

## Quick Reference

- **Stack**: Next.js 15 / React 19 / TypeScript / Tailwind CSS v4 / PostgreSQL (Neon) / Redis (Upstash) / BullMQ
- **ORM**: Drizzle ORM with @neondatabase/serverless driver
- **Auth**: NextAuth v5 with TOTP 2FA
- **Test**: Vitest
- **Lint/Format**: ESLint + Prettier

## Commands

```bash
npm run dev              # Dev server
npm run build            # Production build
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run format           # Prettier
npm test                 # All tests (Vitest)
npm run test:cpf         # CPF engine tests only
npm run test:payroll     # Payroll calculation tests
npm run test:coverage    # Coverage report
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Apply migrations
npm run db:studio        # Drizzle Studio (DB browser)
npm run seed             # Seed test data
npm run seed:cpf-rates   # Seed CPF rate tables
```

## Architecture

### Directory Structure

```
src/
  app/                    # Next.js App Router
    (auth)/               # Login, 2FA
    (dashboard)/          # Admin pages
    api/                  # Route handlers
  lib/
    payroll/              # === CRITICAL PATH — all financial calc here ===
      cpf.ts              # CPF calculation (integer cents only)
      sdl.ts              # SDL calculation
      fwl.ts              # FWL lookup
      engine.ts           # Full pipeline orchestrator
      rounding.ts         # Rounding rules
    db/schema/            # Drizzle schema (9 tables)
    auth/                 # NextAuth + RBAC + TOTP
    crypto/               # AES-256-GCM, NRIC HMAC-SHA256
    audit/                # Append-only audit logger
    utils/money.ts        # Integer cents arithmetic
    utils/date.ts         # SG timezone (Asia/Singapore)
    validators/           # Zod schemas
  components/             # React components
  types/                  # Shared TypeScript types
tests/
  unit/cpf/               # 100+ CPF tests
  unit/payroll/           # Payroll pipeline tests
  fixtures/               # Test data
docs/                     # Documentation
```

### Key Rules

- **All monetary values are integer cents.** Variables end in `_cents`. No floats for money.
- **CPF calculation is centralised** in `src/lib/payroll/`. No CPF math anywhere else.
- **Rounding rules (sacrosanct):**
  - Total CPF = round to nearest dollar (>= 0.50 up, < 0.50 down)
  - Employee CPF = always round DOWN (Math.floor)
  - Employer CPF = Total - Employee (derived, never independent)
- **Audit trail is append-only.** No UPDATE or DELETE on audit_log table.
- **Salary records are immutable.** New salary = new row with effective_date.
- **NRIC/FIN**: HMAC-SHA256 hash for lookup, last 4 chars for display. Full NRIC never in UI/logs/errors.
- **PII columns** (bank_json, address) encrypted with AES-256-GCM.

## NEVER Rules

### Financial Accuracy

- NEVER use float/double for monetary amounts. Always integer cents.
- NEVER use Math.round() for employee CPF share. Always Math.floor().
- NEVER calculate employer CPF independently. Always totalCpf - employeeCpf.
- NEVER hard-code CPF rates or ceilings. Read from cpf_rate_tables.
- NEVER skip AW ceiling check. AW ceiling = $102,000 - total OW for year.
- NEVER ignore annual CPF limit ($37,740). Check YTD contributions.
- NEVER pro-rate by working days unless configured. Default is calendar days.
- NEVER apply age-band rate changes in birthday month. Apply from 1st of FOLLOWING month.
- NEVER apply PR status CPF changes immediately. Apply from 1st of FOLLOWING month.
- NEVER use OW ceiling of $7,400. It is $8,000 from 2026.

### Security / PDPA

- NEVER log, print, or display a full NRIC/FIN. Only nric_last4 in UI/logs/reports.
- NEVER store NRIC in plaintext. Only HMAC-SHA256 hash + last 4 chars.
- NEVER return PII in API responses unless endpoint requires it AND user has correct RBAC role.
- NEVER disable or bypass audit trail. Every data mutation must be logged.
- NEVER UPDATE or DELETE rows in audit_log or salary_records.
- NEVER commit .env, encryption keys, or database credentials.
- NEVER send salary data in error messages, toasts, or console.log.

### Database

- NEVER drop a column containing financial data without backup step.
- NEVER use CASCADE DELETE on payslips, cpf_records, or audit_log.
- NEVER alter audit_log to add UPDATE or DELETE permissions.
- NEVER change a \_cents column from integer to float/decimal.

### Code Quality

- NEVER duplicate CPF calculation logic. Import from src/lib/payroll/.
- NEVER use `any` type. Use proper types.
- NEVER skip tests for payroll calculation changes. Test-first is mandatory.
- NEVER merge without CPF tests passing (npm run test:cpf).

## Docs Mapping

| Code Path              | Doc File                                    |
| ---------------------- | ------------------------------------------- |
| `src/lib/payroll/**`   | `docs/cpf-rules.md`, `docs/architecture.md` |
| `src/app/api/**`       | `docs/api.md`                               |
| `src/lib/db/schema/**` | `docs/architecture.md`                      |
| Deployment configs     | `docs/deployment.md`                        |
| CPF rate changes       | `docs/regulatory.md`                        |

## Effort Levels

- **Default: high** — use for 80% of tasks.
- **ultrathink/max** — only for genuinely hard debugging or complex CPF edge cases.
- Burning context on thinking tokens for routine tasks degrades performance in long sessions.

## Context Management

- Compact proactively at ~50% context usage. Preserve: current plan, files being edited, test results.
- /clear between unrelated tasks.
- If correcting the same issue twice, stop and re-plan instead of retrying.

## Workflow Commands

| Command        | When to Use                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/start`       | Begin session. Loads context, classifies task risk.                                                                |
| `/ship`        | Pre-merge: CPF tests → full tests → typecheck → lint → financial audit → security scan → commit. Asks before push. |
| `/quality`     | Deep 4-category review (financial, code, security, database).                                                      |
| `/quickfix`    | Fast bug fix. Auto: test-first → fix → verify → NEVER rule → commit.                                               |
| `/techdebt`    | Safe refactoring with risk classification.                                                                         |
| `/update-docs` | Sync docs with code changes.                                                                                       |
| `/done`        | End session. Auto: commit → update CLAUDE.md → update docs → push → summary.                                       |
