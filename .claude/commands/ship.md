# /ship — Ship ClinicPay code

## Current State

- Branch: !`git branch --show-current`
- Uncommitted: !`git status --short`
- Diff: !`git diff --stat`

## Instructions

Run every step. Stop on first failure. Auto-proceed through all checks.

### Step 1 — CPF Tests (if payroll code changed)

```bash
npm run test:cpf
```

If fails: STOP. CPF tests must be green. No exceptions.

### Step 2 — Full Tests

```bash
npm test
```

### Step 3 — TypeScript

```bash
npm run typecheck
```

### Step 4 — Lint

```bash
npm run lint
```

### Step 5 — Financial Audit (scan diff)

- Flag `float`, `parseFloat`, `toFixed` near monetary values.
- Flag `Math.round` on employee CPF share (must be Math.floor).
- Flag CPF/SDL/FWL calculations outside `src/lib/payroll/`.
- Flag hard-coded CPF rates or ceilings.
- Verify new monetary variables end in `_cents`.

### Step 6 — Security Scan (scan diff)

- Flag full NRIC patterns (S/T/F/G/M + 7 digits + letter) in strings/logs/UI.
- Flag console.log that might leak salary/PII.
- Verify no .env files staged.
- Check new API routes have RBAC.

### Step 7 — Migration Safety (if applicable)

- No DROP COLUMN on \_cents columns without backup.
- No CASCADE DELETE on payslip/CPF/audit tables.

### Step 8 — Update CLAUDE.md + docs

Check if changes warrant CLAUDE.md or docs/ updates per the doc mapping table. Auto-update if needed.

### Step 9 — Commit

Stage and commit with descriptive message. Auto-proceed.

### Step 10 — Push

**ASK before pushing to remote.** Show: branch name, commit count, summary of changes.

Report summary table: Step | Status | Notes

$ARGUMENTS
