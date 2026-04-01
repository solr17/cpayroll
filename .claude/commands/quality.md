# /quality — Deep quality & financial accuracy review

## Current State
- Branch: !`git branch --show-current`
- Recent changes: !`git diff --stat HEAD~3 2>/dev/null || git diff --stat`

## Instructions

Auto-proceed through all checks. Produce graded report at the end.

### Part 1 — Financial Accuracy
1. **Integer cents**: Grep changed files for monetary ops. Every amount/salary/pay/cpf/sdl/fwl/levy variable MUST be integer cents. Flag floats.
2. **CPF rounding**: total=Math.round, employee=Math.floor, employer=total-employee. Flag violations.
3. **Ceilings**: OW $8,000/month, AW $102,000-YTD_OW, annual limit $37,740.
4. **Date logic**: Pro-ration off-by-one, age-band transitions (1st of following month), PR changes (1st of following month).
5. **Edge cases**: Tests for mid-month join/leave, zero wages, at-ceiling values, boundary birthdays.

### Part 2 — Code Quality
1. No duplication of payroll logic outside src/lib/payroll/.
2. No `any`, no unsafe type assertions. Zod validation on inputs.
3. Payroll calculations never silently swallow errors.
4. Changed payroll functions have corresponding test changes.

### Part 3 — Security / PDPA
1. No full NRIC in UI/logs/errors/API.
2. PII excluded from responses unless needed + RBAC checked.
3. All mutations log to audit_log.
4. No sensitive data in console/toast/errors.

### Part 4 — Database (if schema changes)
1. Migration reversible?
2. No dropping _cents columns, no type changes to float.
3. audit_log has no UPDATE/DELETE.
4. Financial queries have indexes.

Output graded report:
| Category | Grade | Issues |
|----------|-------|--------|
| Financial Accuracy | A-F | ... |
| Code Quality | A-F | ... |
| Security / PDPA | A-F | ... |
| Database Safety | A-F | ... |

List every issue with file:line and fix.

$ARGUMENTS
