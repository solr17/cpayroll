---
name: interview-execute
description: >
  Use when user requests a new feature, significant change, or complex task.
  Interviews user first, then executes 5-phase pipeline. Especially important
  for payroll engine changes, CPF calculations, database migrations, compliance features.
  Triggers on: "build", "implement", "add feature", "create", "new module".
---

# Interview-Execute — ClinicPay

Arguments: $ARGUMENTS

## Phase 1: Interview (MANDATORY)

Ask questions. Wait for answers. Adapt based on task type.

### Core (always ask):

1. What are we building? (one sentence)
2. Why does this need to exist? (business/regulatory reason)
3. Where in the codebase? (which module)
4. What should it NOT do? (boundaries)

### If touches payroll/CPF/SDL/FWL:

5. Involves monetary amounts? (confirm integer cents)
6. Which CPF rules apply? (age bands, ceilings, rounding)
7. Edge cases? (mid-month, zero wages, ceiling hits)
8. Reference values from CPF Board calculator?

### If touches database:

9. Touch financial data columns?
10. Reversible migration? Rollback plan?
11. Affects audit trail?

### If touches PII/auth:

12. Handles NRIC, bank details, salary data?
13. Who has access? (Owner/Admin/Employee)

**DO NOT stop after these questions if you still have uncertainty. Keep asking until zero ambiguity.**

Readiness test: "Could I implement this right now with zero questions left?" If no, keep interviewing.

### Present plan:

```
=== Implementation Plan ===
Task: <summary>
Risk: HIGH/MEDIUM/LOW
Modules: <list>
Tests Required: <list>
NEVER Rules: <applicable rules from CLAUDE.md>
Edge Cases: <list>
Files: <list>
===========================
```

**HIGH RISK (payroll engine, db migration, auth): ASK "Proceed?"**
**MEDIUM/LOW RISK: Auto-proceed.**

## Phase 2: Implement

Pre-impl:

- If payroll code: run `npm run test:cpf` for green baseline.
- If db migration: run `npx drizzle-kit status`.
- Create feature branch if needed.

Rules:

- Test-first for payroll calculations.
- Integer cents everywhere. Variable names end in `_cents`.
- CPF/SDL/FWL logic ONLY in `src/lib/payroll/`.
- Every mutation logs to audit_log.
- NRIC: HMAC hash, last 4 only for display.

Steps:

1. Types/interfaces first.
2. Tests that define expected behavior (test-first for financial).
3. Implement.
4. Run tests incrementally.

Auto-proceed. No confirmation needed during implementation.

## Phase 3: Verify

Auto-proceed through all:

```bash
npm run test:cpf    # if payroll changed
npm test            # full suite
npm run typecheck
npm run lint
npm run format
```

Fix failures before Phase 4.

## Phase 4: Three-Agent Review

Spawn 3 review perspectives. Collect all findings before presenting.

### Agent 1: Bug Hunter (Financial Focus)

- Rounding: Math.floor for employee CPF? Math.round for total? Employer = total - employee?
- Dates: off-by-one in pro-ration, age-band transitions (1st of following month), PR changes
- Ceilings: OW monthly cap, AW cap, annual limit
- SDL floor ($2) / ceiling ($11.25)
- FWL: employer-borne only, not deducted from employee
- Null handling, async errors, race conditions

### Agent 2: Architect (Centralisation & Audit)

- ALL financial logic in src/lib/payroll/? Flag any outside.
- Consistent integer cents? Flag parseFloat/toFixed on money.
- Payroll engine pure (deterministic, no DB calls inside calc)?
- CPF rates from config, not hardcoded?
- Every mutation through audit logger?
- audit_log and salary_records append-only?
- No N+1 queries, proper transactions?

### Agent 3: Simplifier (Clarity Without Sacrificing Accuracy)

- Break complex functions into testable pieces?
- Redundant abstractions?
- Complex conditionals → lookup tables?
- **DO NOT simplify**: CPF rounding, ceiling logic, age-band rules, encryption, audit logging.

### Output:

```
=== 3-Agent Review ===
## Bug Hunter: [issues]
## Architect: [issues]
## Simplifier: [issues]
Critical: X | High: X | Medium/Low: X
======================
```

Auto-fix CRITICAL issues. ASK before architectural changes.

## Phase 5: Document (auto-proceed)

1. Update CLAUDE.md if new patterns or NEVER rules discovered.
2. Update docs/ per mapping in CLAUDE.md.
3. Commit with descriptive message.
4. Print completion summary.
