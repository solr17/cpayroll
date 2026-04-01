# /update-docs — Sync documentation with code

## Current State
- Changed files: !`git diff --name-only HEAD~5 2>/dev/null || git diff --name-only`

## Instructions

Auto-proceed. No confirmation needed.

### Doc Mapping
| Code Path | Doc File |
|-----------|----------|
| `src/lib/payroll/**` | `docs/cpf-rules.md`, `docs/architecture.md` |
| `src/app/api/**` | `docs/api.md` |
| `src/lib/db/schema/**` | `docs/architecture.md` |
| Docker/deployment configs | `docs/deployment.md` |
| CPF rate changes | `docs/regulatory.md` |

1. Scan recent changes (last 5 commits or branch diff).
2. For each changed file, check mapping above.
3. Read current doc and changed code.
4. Update doc with: new functions, changed behavior, new endpoints, new tables, updated rates.
5. For payroll changes: ensure docs/cpf-rules.md has exact rounding rule + edge cases + test file ref.
6. For regulatory changes: ensure docs/regulatory.md has effective date + source + old→new values.
7. Commit: `docs: update <file> for <change>`

$ARGUMENTS
