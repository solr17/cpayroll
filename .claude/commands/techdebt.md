# /techdebt — Address technical debt

## Current State

- Branch: !`git branch --show-current`
- Status: !`git status --short`

## Instructions

Classify risk:

- **HIGH** (payroll engine, CPF, db schema, audit, encryption) → ASK before starting.
- **MEDIUM** (filing, reports, API, auth) → Auto-proceed with extra care.
- **LOW** (UI, styling, tooling) → Auto-proceed.

For HIGH RISK:

- Run `npm run test:cpf` and `npm test` BEFORE starting. Save results.
- Change incrementally. Test after each change.
- Never change payroll logic and its tests in same commit.
- Verify output for 5 employee scenarios (different ages, residency, wages).

For ALL:

- No payroll calculation duplication.
- Maintain \_cents naming.
- Don't remove audit trail logging.
- Run full test suite + typecheck + lint after.
- Update CLAUDE.md if architecture changed.
- Commit: `refactor(<scope>): <what>`

$ARGUMENTS
