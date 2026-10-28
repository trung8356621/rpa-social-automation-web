---
name: rpa-react-architecture
description: >-
  Defines React + TypeScript + Vite architecture for rpa-social-automation-web.
  Use when scaffolding, adding routes, creating hooks/components, or choosing
  frontend libraries and folder structure.
---

# RPA React Architecture

## Approved stack

- React + TypeScript + Vite (CSR)
- Tailwind CSS + **shadcn/ui** + Lucide
- Do **not** add another UI kit (Mantine, Chakra, Ant, etc.) without an explicit owner decision

## Boundaries

- This repo is the **Web CSR** source. Laravel owns business data/auth; Node realtime (separate) relays authorized events only.
- Web uses SEO-OPS **staff session** auth when live. Never put Client API Key secrets in browser state or bundles.
- Do not build a standalone user/login/JWT system for this app.
- Production may serve **static build artifacts** only into SEO-OPS; keep React source out of Laravel.

## Structure conventions

For each approved route:

- `pages/` or route module — composition only
- `hooks/` — data fetching, query state, mutations
- `components/` — presentation primitives and route widgets

Keep route-specific data hooks separate from shared UI primitives listed in the Design Language vocabulary (`AppShell`, `FilterBar`, `BrowserCard`, …).

## Proposed UI route slugs (confirm before production mount)

- `/social-automation/action-tags`
- `/social-automation/scripts`
- `/social-automation/accounts`
- `/social-automation/clients`
- `/social-automation/client-api-keys`

URL query owns filters/selection/pagination; back/forward must restore state.

## Implementation order (from Design Language)

1. Shell + tokens + router (5 routes)
2. Action Tags (port existing mini-app behavior)
3. Script Registry grid + media
4. Accounts
5. Client API Keys
6. Browser-first Clients + realtime snapshot reconciliation

One route at a time. Do not “beautify” multiple routes in one pass.
