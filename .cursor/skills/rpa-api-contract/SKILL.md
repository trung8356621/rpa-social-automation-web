---
name: rpa-api-contract
description: >-
  Guards API-first integration for RPA Social Automation Web. Use when adding
  API clients, mapping UI fields to endpoints, choosing mocks vs live data, or
  touching auth/OpenAPI/realtime contracts.
---

# RPA API Contract

## Sources

- Live (auth required): `https://seo-ops.duckdns.org/api/v1/social-automation/openapi.json`
- Repo evidence: `seo-ops-addons-rpa` `openapi/openapi.yaml` — not proof of deploy
- Behavior anchors: Action Tags React mini-app; Filament scripts/agents/accounts/client-keys blades
- Docs: `docs/01_API_WEB_REALTIME.md`, `docs/02_ADDON_BACKEND.md`, `docs/03_APP_CLIENT_ELECTRON.md`

## Rules

1. **No invented endpoints, fields, menus, or actions.** If OpenAPI/source lacks it, stop and ask.
2. Before wiring a route, produce a short matrix: UI field → endpoint/response field → auth → empty/loading/error → tested?
3. Mock/local UI may run without SEO-OPS login. **Live API must keep authentication.**
4. Never place Client API Key material in the web app. Electron owns API Key auth; web uses staff session.
5. **No production mutations** while building UI. Prefer mocks; any live write needs explicit owner approval and non-production data.
6. Realtime/socket events are fast signals only. REST/Laravel remains business truth; resync snapshot on reconnect; distinguish stale vs offline.
7. Identity: Client = `client_api_key_id` (one active lease); Account = Account ID; Device UUID/hostname are metadata only.
8. Do not implement UI affordances (e.g. “Release Lease”) unless the verified contract and authorization support them.

## Known families (verify methods/auth before use)

- Action registry: `/social-automation/api/action-registry/...`
- Accounts / client-keys (web): `/social-automation/api/accounts`, `/social-automation/api/client-keys/...`
- RPA admin scripts: `/api/v1/social-automation/rpa-admin/scripts...`
- Electron client APIs under `/api/v1/social-automation/client/...` are **not** for browser staff UI secrets
