# Project docs (source of truth)

| Doc | Role |
| --- | --- |
| `RPA_WEB_UI_ROUTES_AND_DESIGN_LANGUAGE_V1.md` | **UI routes, layout rules, component vocabulary** |
| `RPA_UI_THEME_MANIFEST.md` | Design tokens + Browser-first rules |
| `RPA_CLIENT_AUTH_SCRIPT_WORDPRESS_FIRST_TEST_2026-10-28.md` | Auth Script trước Checkpoint (WordPress-first) |
| `01_API_WEB_REALTIME.md` | Web / realtime product decisions (partially superseded — see below) |
| `02_ADDON_BACKEND.md` | Laravel addon boundaries + OpenAPI links |
| `03_APP_CLIENT_ELECTRON.md` | Electron client boundaries |
| `ARCHITECTURE_RESET_2026-10-28.md` | Historical; header notes later decisions |
| `CLIENTS_READ_ONLY_AUDIT_2026-10-28.md` | Clients field audit (pre–staff REST) |
| `API_CONTRACT_MATRIX_CP7.md` | CP7 five-menu API evidence matrix |
| `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md` | CP7/7.1 Auth Script contract (PROPOSED; D1–D4 approved design) |
| `CLIENTS_BROWSER_INVENTORY_CONTRACT_CP7.md` | CP7 Browser-first staff inventory (PROPOSED) |
| `WORDPRESS_FIRST_INTEGRATION_PLAN_CP7.md` | CP7/7.1 WordPress-first sequence |
| `CP7_OWNER_DECISIONS.md` | CP7 decisions (D1–D4 approved design) |
| `CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md` | CP8 Laravel Auth Script + security blockers (CP7.2) |
| `CP8_REACT_INTEGRATION_HANDOFF.md` | CP8 React Action Tags Auth wire-up brief |
| `CP8_PRODUCTION_READINESS_CHECKLIST.md` | CP8 VPS BEFORE/VERIFY/ROLLBACK checklist |
| `mockups/` | Visual concepts only — text docs win on conflict |

## Architecture (chốt 28/10/2026)

- **`rpa-social-automation-web`**: React CSR only (this repo).
- **`rpa-social-automation-realtime`**: separate Node WebSocket Gateway.
- **Laravel SEO-OPS**: business data source of truth.

If `01_API_WEB_REALTIME.md` still describes Web + Realtime in one source, treat that as an **older** decision replaced by the split-source architecture. Do not rewrite other agents' docs here.
