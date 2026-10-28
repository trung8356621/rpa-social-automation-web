---
name: rpa-ui-design
description: >-
  Enforces RPA Compact Desktop Control Center UI for Social Automation Web.
  Use when designing, laying out, styling, or reviewing any React screen,
  component, menu, token, or visual change in this project.
---

# RPA UI Design

## Source of truth (read, do not reinvent)

1. `docs/RPA_WEB_UI_ROUTES_AND_DESIGN_LANGUAGE_V1.md`
2. `docs/RPA_UI_THEME_MANIFEST.md`
3. Business boundaries: `docs/01_API_WEB_REALTIME.md`, `docs/02_ADDON_BACKEND.md`, `docs/03_APP_CLIENT_ELECTRON.md`

When mockups/images disagree with these docs, **follow the text docs**.

## Hard scope

- Exactly **5 menus**: Action Tags, Script Registry, Accounts, Clients, Client API Keys.
- Do **not** add Dashboard, Settings, Task, Workflow, Campaign, Scheduler, Jobs, or other menus.
- Do **not** invent layout, fields, actions, or KPIs not in the specification or verified API.

## Visual language

- Compact desktop control center; data-first; light borders; clear hierarchy.
- No gradients, glassmorphism, heavy shadows, nested ornamental cards, or decorative icon clusters.
- One primary action per region; secondary = outline/ghost.
- Status always has **text + color**, never color alone.
- Tokens: use manifest light/dark values (primary `#2563EB` light). Font Inter + system-ui. Spacing 4/8/12/16/24. Control radius 6px, card 10px.

## Route intent (summary — re-read the route section before coding)

| Route | Must keep |
| --- | --- |
| Action Tags | Existing mini-app flow (tags + sites/paths); table + filters; not a permanent tree sidebar |
| Script Registry | Video 16:9 **card grid**, not CRUD table; detail drawer + video modal |
| Accounts | Inventory; **Account ID** = identity; Account Name / Username correct roles |
| Client API Keys | Masked secret; lease/heartbeat; revoke with confirm |
| Clients | **Browser-first**; Username title; Account Name secondary; PC/Client = small metadata; only truly online Browsers in ops list |

Independent signals: Client Connection ≠ Browser Runtime ≠ Account Binding ≠ Session Signal ≠ Execution Confirmation.

## Before any UI edit

1. Re-read the route section in the Design Language doc.
2. List planned components + loading/empty/error/stale states.
3. Prefer mock data labeled clearly until layout passes visual QA.
