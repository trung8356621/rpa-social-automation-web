---
name: rpa-token-discipline
description: >-
  Limits redundant context loading for rpa-social-automation-web. Use on every
  coding/debug task to keep reads, searches, and verification narrowly scoped.
---

# RPA Token Discipline

Adapted in spirit from SEO-OPS/Zyvavu discipline skills — **not a copy**. Correctness and UI-spec fidelity outrank token savings.

## Do

- Read the task-named files, the relevant `docs/*` section, and the matching project skill first.
- For large files, read only implicated ranges/symbols when practical.
- Prefer one focused search over several broad disk/repo scans.
- Prefer RTK-wrapped shell commands when RTK is available (`rtk git`, `rtk read`, `rtk grep`, …).
- Run one focused verification pass after changes; do not repeat equivalent checks.

## Do not

- Dump entire backend/Laravel trees into context.
- Re-scan `D:\` or sibling repos without a concrete gap.
- Reopen files that did not change unless a specific unanswered question remains.
- Spawn overlapping agents/tools for the same purpose.
- Generate scratch dump/reproduce scripts when direct inspection answers the question.

If ambiguity changes architecture, menus, contracts, or auth boundaries → stop and ask (see `rpa-execution-guard`).
