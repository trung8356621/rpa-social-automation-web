# Clients Route — Read-only Audit (Checkpoint batch 2026-10-28)

**Scope (original):** Survey only. Do **not** implement `/social-automation/clients` in this batch.  
**Update (Checkpoint 6 — 2026-10-28):** MOCK Browser-first UI implemented in React Web. Live staff inventory API still **not** invented. Classifications below remain authoritative for wiring.

**Sources:** `seo-ops-addons-rpa` Filament `agents.blade.php`, `partials/device-group.blade.php`, `AgentRegistryService`, `docs/01_API_WEB_REALTIME.md`, `docs/02_ADDON_BACKEND.md`, Design Language Browser-first rules.  
**React mock evidence:** `src/features/clients/*` (types comments + fixtures).

## Field → API / Source matrix

| UI Field (Design Language) | Laravel Source / API evidence | Business Meaning | Classification | Gap |
| --- | --- | --- | --- | --- |
| Client / PC tag (hostname) | `device-group`: `$device['name']`, OS meta; Agents table `display_name` | Metadata only — not Client identity | CONFIRMED (metadata) | Two Filament UIs: Agents table vs device-group cards; React must not invent PC-group cards |
| Client identity | `client_api_key_id` in device technical details; docs: `sa_client_api_keys.id` | Logical Client = API Key ID | CONFIRMED | Staff list of “clients” as Browsers must key off key id / lease, not UUID alone |
| Connection lease | `ClientConnectionLease` domain; 409 `CLIENT_KEY_IN_USE` | One active connection per key | CONFIRMED (domain) | **No staff JSON on Client API Keys index** exposing lease token/expiry — UI shows MOCK lease |
| Client online/offline | Agents: `online_state`; device-group: `$device['online']` | Presence of Client connection | Partial → MOCK staff snapshot | Need single REST snapshot for Web; realtime is signal-only |
| Browser list (ops) | device-group `$device['browsers'][]` | Runtime browsers on a Client | CONFIRMED (blade shape) | Need verified REST/OpenAPI for Browser-first list (not device-first group) |
| Browser Username (title) | Design Language / Theme Manifest | Ops title for Browser card | **MISSING CONTRACT** | device-group titles use **`account_name`**, not username — mock uses `username` labeled MOCK ONLY |
| Account Name (secondary) | `$browser['account_name']` | End-user label | CONFIRMED | Keep secondary after Username |
| Account ID binding | Docs: Browser ↔ Account ID | Binding ≠ login | Partial | Confirm field name in registry JSON (`account_uuid` / id) — mock uses `account_uuid` |
| Platform / site_url | `$browser['platform']`, `site_url` | Site context | CONFIRMED | — |
| Session Signal present | `$browser['signal_present']`, `signal_checked_at` | Signal ≠ verified login | CONFIRMED | Clear-signal action exists in Filament; need staff API if Web exposes |
| Session state | `$browser['session_state']` (`verified` / `needs_login` / `candidate`) | Session Signal taxonomy | CONFIRMED | Map carefully; do not merge with Client online; mock adds `unknown` / `absent` / `present` |
| Execution / Task hint | `$browser['last_task_at']`, dispatch flags | Not full Execution Confirmation | Partial | Dedicated execution-confirm API not verified — mock `execution_state` / `last_script_ref` = MOCK ONLY |
| Dispatch enabled / pause | `dispatch_enabled`, `dispatch_eligible`, `pause_reason` | Task receive toggle | CONFIRMED (blade) | Confirm Web mutation auth before wiring — **not** exposed in Checkpoint 6 UI |
| Require login | Filament `requireLogin` | Force needs_login | Filament-only evidence | Need OpenAPI method before UI |
| Notification / ACK | `openNotificationModal` | Staff → Client notify | Filament UI | Node realtime + REST ACK contract **not chốt** (docs) — disabled in mock drawer |
| Last screenshot / execution log | Not in surveyed blades | Artifact / log | **MISSING CONTRACT** | No field in agents/device-group samples — not shown as real data |
| Browser ID (technical) | `$browser['browser_id']` | Debug identity | CONFIRMED | Drawer Technical / Browser section |
| Partition / instance ref | Not verified on staff list | Runtime partition | **MOCK ONLY** | Drawer only |
| Device ID / UUID | `$device['device_id']`, Agents `device_id` | Metadata | CONFIRMED | Not Client identity |
| Heartbeat / stale | Domain lease + Keys mock presentation | Stale ≠ offline | **MOCK ONLY** for staff Clients UI | Keys index lacks heartbeat; Clients mock mirrors Keys mock lease pattern |
| Realtime snapshot / stale | Docs: WSS presence + REST truth; Refresh | Stale ≠ offline | Doc-level | Node schema **chưa phê duyệt** |
| Offline browser count | Design Language | Aggregate only | Spec | Checkpoint 6 uses separate Stopped section + counts from mock filter — no fake KPI strip |

## Signal groups (do not collapse)

1. **Client connection / lease** — key id, lease active, 409 in-use  
2. **Browser runtime** — browser online/running for ops list  
3. **Account identity / binding** — Account ID on browser  
4. **Session Signal** — present / state / checked_at  
5. **Execution Confirmation** — not evidenced as first-class in Filament samples  
6. **Last Screenshot / Execution Log** — **missing** from surveyed UI sources  
7. **Notifications / ACK** — Filament modal only; realtime ACK not finalized  
8. **Realtime snapshot / stale** — doc intent; OpenAPI/event schema gap  

## Browser-first design risks

- Legacy Filament **device-group** is PC-card + nested browsers with **Account Name as title** — conflicts with approved Browser-first (Username title, PC as small tag).  
- Agents page is **device/agent table**, not Browser ops list.  
- Implementing Clients by porting device-group literally would **FAIL** Design Language.  
- Only **truly online Browsers** in ops list; offline = counts — needs filter rules from API.  
- Do not treat Client Online as Browser Running or Session verified.

## Checkpoint 6 mock mapping (React)

| Mock fixture | Scenario |
| --- | --- |
| `brw-wp-running` | WordPress Browser Running + Session Verified |
| `brw-fb-running` | Facebook Browser Running + Needs Login + Execution Failed |
| `cli-online-idle` | Client Online, no Browser Running |
| `brw-stopped` | Browser Stopped (Known / Stopped section) |
| `brw-stale-hb` | Running + Heartbeat Stale |
| `brw-session-unknown` | Running + Session Unknown + username null |

Demo query: `?demo=default|loading|empty|error`.

Safe mock actions only: View Details, Copy Account ID, Search/Filter. Force Disconnect / Release Lease / Execute / Restart / Kill = disabled note (no contract).

## Missing contracts (owner decisions)

1. Canonical staff REST (or gateway) for Browser-first inventory + aggregates.  
2. Username field on browser/session payload (required for title).  
3. Lease/heartbeat exposure for staff UI (Keys page currently lacks it).  
4. Notification send + ACK APIs for Web.  
5. Screenshot/execution-log endpoints if required on Clients cards.  
6. Realtime event schema version for presence/session/stale.

**No schema invented in this audit. Checkpoint 6 UI remains MOCK-labeled.**
