# Clients Route — Read-only Audit (Checkpoint batch 2026-10-28)

**Scope:** Survey only. Do **not** implement `/social-automation/clients` in this batch.  
**Sources:** `seo-ops-addons-rpa` Filament `agents.blade.php`, `partials/device-group.blade.php`, `AgentRegistryService`, `docs/01_API_WEB_REALTIME.md`, `docs/02_ADDON_BACKEND.md`, Design Language Browser-first rules.

## Field → API / Source matrix

| UI Field (Design Language) | Laravel Source / API evidence | Business Meaning | Verified? | Gap |
| --- | --- | --- | --- | --- |
| Client / PC tag (hostname) | `device-group`: `$device['name']`, OS meta; Agents table `display_name` | Metadata only — not Client identity | Partial | Two Filament UIs: Agents table vs device-group cards; React must not invent PC-group cards |
| Client identity | `client_api_key_id` in device technical details; docs: `sa_client_api_keys.id` | Logical Client = API Key ID | Yes (docs + blade) | Staff list of “clients” as Browsers must key off key id / lease, not UUID alone |
| Connection lease | `ClientConnectionLease` domain; 409 `CLIENT_KEY_IN_USE` | One active connection per key | Yes (domain) | **No staff JSON on Client API Keys index** exposing lease token/expiry |
| Client online/offline | Agents: `online_state`; device-group: `$device['online']` | Presence of Client connection | Partial | Need single REST snapshot for Web; realtime is signal-only |
| Browser list (ops) | device-group `$device['browsers'][]` | Runtime browsers on a Client | Yes (blade shape) | Need verified REST/OpenAPI for Browser-first list (not device-first group) |
| Browser Username (title) | Design Language / Theme Manifest | Ops title for Browser card | **Gap** | device-group titles use **`account_name`**, not username — redesign required |
| Account Name (secondary) | `$browser['account_name']` | End-user label | Yes (blade) | Keep secondary after Username |
| Account ID binding | Docs: Browser ↔ Account ID | Binding ≠ login | Partial | Confirm field name in registry JSON (`account_uuid` / id) |
| Platform / site_url | `$browser['platform']`, `site_url` | Site context | Yes (blade) | — |
| Session Signal present | `$browser['signal_present']`, `signal_checked_at` | Signal ≠ verified login | Yes (blade) | Clear-signal action exists in Filament; need staff API if Web exposes |
| Session state | `$browser['session_state']` (`verified` / `needs_login` / `candidate`) | Session Signal taxonomy | Yes (blade) | Map carefully; do not merge with Client online |
| Execution / Task hint | `$browser['last_task_at']`, dispatch flags | Not full Execution Confirmation | Partial | Dedicated execution-confirm API not verified in this pass |
| Dispatch enabled / pause | `dispatch_enabled`, `dispatch_eligible`, `pause_reason` | Task receive toggle | Yes (blade) | Confirm Web mutation auth before wiring |
| Require login | Filament `requireLogin` | Force needs_login | Filament-only evidence | Need OpenAPI method before UI |
| Notification / ACK | `openNotificationModal` | Staff → Client notify | Filament UI | Node realtime + REST ACK contract **not chốt** (docs) |
| Last screenshot / execution log | Not in surveyed blades | Artifact / log | **Missing** | No field in agents/device-group samples |
| Browser ID (technical) | `$browser['browser_id']` | Debug identity | Yes | Hide under Technical Details |
| Device ID / UUID | `$device['device_id']`, Agents `device_id` | Metadata | Yes | Not Client identity |
| Realtime snapshot / stale | Docs: WSS presence + REST truth; Refresh | Stale ≠ offline | Doc-level | Node schema **chưa phê duyệt** |
| Offline browser count | Design Language | Aggregate only | Spec | Need API aggregate or client-side filter of online-only list |

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

## Missing contracts (owner decisions)

1. Canonical staff REST (or gateway) for Browser-first inventory + aggregates.  
2. Username field on browser/session payload (required for title).  
3. Lease/heartbeat exposure for staff UI (Keys page currently lacks it).  
4. Notification send + ACK APIs for Web.  
5. Screenshot/execution-log endpoints if required on Clients cards.  
6. Realtime event schema version for presence/session/stale.

**No schema invented in this audit.**
