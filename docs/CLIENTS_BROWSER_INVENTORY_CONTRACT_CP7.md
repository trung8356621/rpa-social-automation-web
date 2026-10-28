# Clients Browser Inventory Contract (CP7)

**Date:** 2026-10-28  
**Status:** Staff Browser-first inventory proposal. Endpoints labeled **PROPOSED** unless marked SOURCE.  
**Prior audit:** `docs/CLIENTS_READ_ONLY_AUDIT_2026-10-28.md` (still authoritative for mock vs real).  
**React mock:** `src/features/clients/*` — Checkpoint 6; do not treat as live wiring.

## Design constraints (approved)

- **Browser-first:** cards are Browsers; Client/PC is a small metadata tag.  
- Card title = **Username**; **Account Name** secondary.  
- Identity: Client = `client_api_key_id`; Account = Account ID; Device hostname ≠ identity.  
- Distinguish: Client connection ≠ Browser runtime ≠ Session signal ≠ Execution confirmation.  
- Ops list: only **truly running/online Browsers**; offline counted separately.  
- Do **not** invent Force Disconnect / Release Lease for staff Web without contract.  
- Do **not** copy Filament device-group as the React layout contract.

---

## 1. Existing SOURCE capabilities (not staff REST inventory)

| Capability | Where | Auth | Notes |
| --- | --- | --- | --- |
| Device-grouped dashboard | `SessionSyncService::clientDashboard()` | Filament Livewire `SocialAutomationSessionsPage` | Builds `devices[].browsers[]` used by `device-group.blade.php` |
| Agent table | `AgentRegistryService::listForUi()` | Filament Agents page | Connection-oriented; not Browser-first |
| Browser session list (sparse) | `GET /api/v1/social-automation/client/browser-sessions` | **Client API Key** | `browser_id`, `account_name`, `platform`, `status`, `last_confirmed_at` — **no username** |
| Browser sync/delete | Client `browser-sync`, `browser-delete` | Client key | Writes runtime truth |
| Session confirm login | `POST .../client/session-confirm-login` | Client key | Checkpoint-adjacent |
| Staff notify | `POST /social-automation/api/clients/sessions/{sessionId}/notifications` | Staff session | Not inventory |
| Lease/heartbeat | Client register/heartbeat; columns on `sa_agents` | Client key | TTL 120s; 409 in-use |

**Gap:** No staff-session JSON that returns a **Browser-first flattened inventory** with Username title fields.

---

## 2. Signal groups (must stay separate)

| # | Signal | Meaning | SOURCE anchors | Staff REST today |
| --- | --- | --- | --- | --- |
| 1 | Client connection / lease | Key has valid lease + heartbeat | `ClientConnectionLease`, agent columns | Not on keys index; not inventory API |
| 2 | Browser runtime | Browser running/stopped/stale | `capabilities.status`, `ready_status`, `listForUi` effective_status | Filament only |
| 3 | Account binding | Account ID on session | `account_id` immutable bind rules | Filament/client sync |
| 4 | Session signal | present / state / checked_at | `SessionSignalState`, dashboard fields | Filament; client confirmLogin |
| 5 | Execution confirmation | last task / script outcome | `last_task_at`; capabilities `execution_confirmation` in `listForUi` | Partial; React enum MOCK |
| 6 | Screenshot / execution log | artifacts | **Not** in dashboard survey | **MISSING** |
| 7 | Notifications / ACK | staff→client | notify REST + client ack | Partial |
| 8 | Realtime freshness | stale vs offline | Docs; OnlineStateCalculator | WSS schema not approved code here |

---

## 3. Resource schema — PROPOSED staff DTO

Flattened **Browser** row for React Clients (map from `clientDashboard` + Account join).

```text
BrowserInventoryItem (PROPOSED)
  browser_id: string              # session_uuid — SOURCE
  account_id: number|null         # DB FK — SOURCE
  account_uuid: string|null       # join SaAccount — PROPOSED expose
  username: string|null           # join SaAccount.getDisplayUsername — PROPOSED (MISSING on Filament card)
  account_name: string            # SOURCE on dashboard
  platform: string                # SOURCE
  site_url: string|null           # SOURCE via account
  browser_runtime: running|stopped|unknown_stale|error  # derive — SOURCE concepts
  client_api_key_id: number|null  # SOURCE on device
  client_label: string|null       # key.name join — PROPOSED
  device_hostname: string|null    # agent.display_name — SOURCE metadata
  connection: online|offline      # agent heartbeat — SOURCE concept
  lease_status: none|valid|expired  # from connection_token/expires — PROPOSED staff expose
  heartbeat_at: string|null       # SOURCE agent.last_heartbeat_at
  heartbeat_stale: boolean        # DERIVED vs OnlineStateCalculator TTL — PROPOSED
  session_signal: enum            # map session_state + signal_present — SOURCE concepts
  signal_checked_at: string|null  # SOURCE
  last_task_at: string|null       # SOURCE
  execution_state: ...            # PROPOSED/unknown until confirm schema
  partition_ref: omit or technical only — MOCK in React; not required for v1
```

**Empty / error / stale states (PROPOSED):**

| State | Rule |
| --- | --- |
| Empty | No running browsers → empty ops grid; optional `online_clients_no_browser[]` |
| Loading | Client pending REST |
| Error | Staff API 401/403/5xx — surface error; no fake browsers |
| Stale heartbeat | `connection=online` flags + `heartbeat_stale=true` — **not** same as offline |
| Device offline | Browser effective `unknown_stale` (already in `SessionSyncService::listForUi`) — exclude from “running ops” list per Design Language |

---

## 4. Relationships

```text
sa_client_api_keys.id ──1──0..1── sa_agents.client_api_key_id
sa_agents ──1──*── sa_browser_sessions
sa_browser_sessions.account_id ──*──1── sa_accounts.id
```

- One active lease per key (unique `client_api_key_id` on agents after migration).  
- Browser bound to Account ID; Account Name/Username are labels.  
- PC/hostname is agent display metadata only.

---

## 5. PROPOSED staff REST endpoints

All under staff session auth (same middleware family as `/social-automation/api/accounts`). **Not implemented.**

| Method | Path (PROPOSED) | Purpose |
| --- | --- | --- |
| GET | `/social-automation/api/browsers` or `/social-automation/api/clients/browsers` | Browser-first inventory + aggregates |
| GET | `/social-automation/api/browsers/{browserId}` | Detail / drawer |
| POST | `/social-automation/api/browsers/refresh-snapshot` | Optional explicit resync trigger (or client-only sync remains) |

**Query (PROPOSED):** `runtime=running|stopped|all`, `q=` search username/account/platform, pagination.

**Aggregates (PROPOSED):** `counts: { running, stopped, clients_online, heartbeat_stale }` — not a KPI marketing strip; for filter chips.

**Reuse:** Prefer projecting `SessionSyncService::clientDashboard()` / `listForUi()` into Browser-first JSON rather than new DB tables.

**Mutations out of v1 Web Clients mock:** toggle dispatch, clear signal, require login, notifications — exist as Filament/Livewire or partial REST; wire only after owner approval and OpenAPI update.

**Forbidden without contract:** Force Disconnect, Release Lease, Kill Browser, Execute Script from Web.

---

## 6. Realtime boundary (PROPOSED event names)

Realtime Gateway is a **separate** Node service. Events are fast signals; REST snapshot is truth on Refresh/reconnect.

| Event (PROPOSED) | Payload hints | Notes |
| --- | --- | --- |
| `client.connection.changed` | `client_api_key_id`, online, lease_expires_at | After register/disconnect/expiry |
| `client.heartbeat` | `client_api_key_id`, heartbeat_at | May be coalesced |
| `browser.runtime.changed` | `browser_id`, runtime | From sync |
| `browser.session_signal.changed` | `browser_id`, signal | From confirm/clear |
| `execution.updated` | `browser_id`, state, ref | Only if schema exists |
| `snapshot.stale` | reason | Gateway restart / gap |

**No approved WSS schema file** surveyed in this Web repo. Do not treat the table above as shipped API.

---

## 7. Username field plan

| Source | Username available? |
| --- | --- |
| `SaAccount` / staff Accounts API | **Yes** (`username`) |
| Filament device-group card title | **No** — uses `account_name` |
| Client `browser-sessions` list | **No** |
| Bindable Account (client) | **Yes** (`username`) |

**PROPOSED:** Staff inventory joins Account and sets `username` for Design Language title; fallback when null: show em dash / “Username chưa có” (React already mocks null username).

---

## 8. Conflict notes

| Conflict | Impact |
| --- | --- |
| Filament slug collision: Agents page and Sessions page both `$slug = 'clients'` | Filament nav confusion — not React route; note for Laravel owners |
| `01_API_WEB_REALTIME.md` vs README split Web/Realtime | Inventory still Laravel REST + separate WSS; ignore stale “one Node source” wording |
| OpenAPI `BrowserSessionsSuccess` matches sparse client list (no username) | Aligns with controller; staff inventory must be a **new** schema |

---

## 9. Implementation readiness

| Item | Status |
| --- | --- |
| Domain data for inventory | SOURCE via agents + browser sessions + accounts |
| Staff REST | **MISSING** (PROPOSED) |
| React mock | Done (CP6) — wait for contract approval |
| Live confirmation | Blocked — staff auth required; OpenAPI 401 without session |
