---
name: rpa-visual-qa
description: >-
  Visual acceptance checklist for RPA Web routes. Use before claiming a screen
  done, before live API wiring, after layout changes, or when reviewing
  screenshots at 1440/1280/narrow widths.
---

# RPA Visual QA

A successful build/typecheck is **not** UI acceptance.

## Gate before API integration

1. Route matches Design Language + Theme Manifest (not Filament chrome, not mockup inventions).
2. Components listed; mock data clearly labeled as mock.
3. States present and distinct: loading, empty, no-filter-results, error, stale/syncing, permission-denied (as applicable).
4. Screenshots or owner review at **1440**, **1280**, and narrow width.
5. Check overflow, alignment, spacing rhythm (4/8/12/16/24), hierarchy, focus/keyboard for dialogs/drawers.
6. Script cards keep **16:9** media; Clients stay Browser-first (Username title).

## Cursor browser MCP

Allowed for this project: navigate, snapshot, screenshot at target widths, light interaction on **local/mock** UI.

Do **not** use browser automation to bypass API auth, mutate production, or invent selectors for unverified flows.

## Status labels in reports

- `UI NOT VERIFIED` — no owner/screenshot pass yet
- `UI FAIL` — defect found
- `UI PASS` — only with owner confirmation or agreed screenshot checklist completed

Never claim visual PASS from build success alone.
