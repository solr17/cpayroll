# /done — End work session (auto-proceed)

## Current State

- Branch: !`git branch --show-current`
- Status: !`git status --short`
- Uncommitted: !`git diff --stat`

## Instructions

Auto-proceed through everything.

### Step 1 — Commit uncommitted work

If dirty: stage and commit. WIP: `wip(<scope>): <what was in progress>`

### Step 2 — Update CLAUDE.md

- Bug fixed → add NEVER rule.
- Feature added → update Architecture if new patterns.
- Regulatory rule implemented → verify in NEVER rules.
- New convention → add to appropriate section.

### Step 3 — Update docs

Run /update-docs logic: check changed files against doc mapping, update as needed.

### Step 4 — Push

`git push -u origin $(git branch --show-current)`

### Step 5 — Summary

```
=== ClinicPay Session Summary ===
Branch: <branch>
Commits this session: <count>
Files changed: <count>
Tests: <pass/fail>
CPF tests: <pass/fail/not-run>
CLAUDE.md updated: <yes/no>
Docs updated: <list or none>
Next steps: <what to do next>
================================
```

$ARGUMENTS
