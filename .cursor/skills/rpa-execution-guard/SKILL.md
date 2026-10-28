---
name: rpa-execution-guard
description: >-
  Stops retry loops, scope drift, and unapproved architecture for RPA Web.
  Mandatory on coding, debugging, testing, and UI work in this project.
---

# RPA Execution Guard

Behavior guard adapted from SEO-OPS/Zyvavu patterns — **rewritten for this repo**. Complements `rpa-token-discipline` and the four RPA domain skills.

## State machine

- **PROCEED** — command succeeded, or a related failure has a clear scoped fix.
- **CHANGE_STRATEGY** — first failure of an attempt family; try one materially different evidence-based approach.
- **STOP_AND_ASK** — second failure for the same purpose, a guard trips, or an unapproved design/API decision is required.

Renaming a command/script does not reset the attempt family.

## Stop conditions

1. Two failed attempts at the same purpose → STOP_AND_ASK.
2. Tool loop twice without a new explanation → STOP.
3. ~5 minutes on one blocker without progress → stop that investigation, report evidence.
4. Scope drift into unrelated modules, extra menus, or “sync beautify” across routes → ask first.
5. Architecture invention (new UI kit, new menu, parallel auth, invented endpoint) → propose smallest path and stop.
6. Production / live mutations while building UI → forbidden without explicit approval.
7. Material ambiguity on routes, identity, lease, or auth → ask; do not guess.
8. Unrelated test failures → report; do not expand scope to force green.

## Allowed vs forbidden automation

- **Allowed:** Cursor browser MCP for local/mock visual QA (see `rpa-visual-qa`).
- **Forbidden:** bypassing API protection, production writes, autonomous login against production, or claiming UI PASS without verification.

## Stop message template

```
BLOCKED / NEED USER DECISION
Goal: ...
Evidence: ...
Attempt 1: ...
Attempt 2: ...
Guard: ...
Smallest safe next option: ...
```
