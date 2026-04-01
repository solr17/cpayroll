# /quickfix — Fast bug fix (auto-proceed)

## Current State

- Branch: !`git branch --show-current`
- Status: !`git status --short`

## Instructions

Auto-proceed through everything. No confirmation prompts.

1. **Identify** the bug from: $ARGUMENTS
2. **Locate** root cause — read code, trace logic.
3. **Classify**: FINANCIAL | COMPLIANCE | SECURITY | FUNCTIONAL
4. **Write test first** that reproduces the bug. Confirm it fails.
5. **Fix it.** Minimal, surgical.
6. **Run test** to confirm pass.
7. If FINANCIAL: run `npm run test:cpf` for regression.
8. Run `npm test` full suite.
9. **Update CLAUDE.md** — add NEVER rule:
   `- NEVER <thing that caused bug> — discovered when <brief description>.`
10. **Commit**: `fix(<scope>): <what>`

For FINANCIAL bugs also:

- Verify against CPF Board calculator logic.
- Add edge case to tests/fixtures/.
- Search for same pattern elsewhere.

$ARGUMENTS
