# /start — Begin ClinicPay work session

## Current State
- Branch: !`git branch --show-current`
- Status: !`git status --short`
- Last 3 commits: !`git log --oneline -3 2>/dev/null || echo "No commits yet"`

## Instructions

Read CLAUDE.md. Check for uncommitted changes — if dirty, stash or continue based on context.

Ask: **"What are we working on today?"**

Classify the response:
- **Payroll engine** (CPF/SDL/FWL/gross/net) → HIGH RISK. Remind: test-first, integer cents.
- **Database migration** → HIGH RISK. Remind: backup, no-drop-financial-data.
- **Security/auth** → HIGH RISK. Remind: PDPA, audit trail.
- **Filing/reports** → MEDIUM RISK. Remind: compliance formats.
- **UI/frontend** → STANDARD RISK.
- **Small bug** → Route to /quickfix flow. Auto-proceed.

For HIGH RISK: show which NEVER rules apply and what tests must pass. Ask to confirm approach.
For MEDIUM/STANDARD: auto-proceed. Create feature branch if needed, show session plan, start working.

Default effort: high. Only use ultrathink if user requests it.

$ARGUMENTS
