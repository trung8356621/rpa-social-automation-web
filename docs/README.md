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
| `mockups/` | Visual concepts only — text docs win on conflict |

## Architecture (chốt 28/10/2026)

- **`rpa-social-automation-web`**: React CSR only (this repo).
- **`rpa-social-automation-realtime`**: separate Node WebSocket Gateway.
- **Laravel SEO-OPS**: business data source of truth.

If `01_API_WEB_REALTIME.md` still describes Web + Realtime in one source, treat that as an **older** decision replaced by the split-source architecture. Do not rewrite other agents' docs here.
