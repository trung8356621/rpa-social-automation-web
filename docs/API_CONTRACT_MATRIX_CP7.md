# API Contract Matrix — Checkpoint 7

**Date:** 2026-10-28  
**Scope:** Evidence matrix for five React Web menus vs Laravel `seo-ops-addons-rpa` (GitHub `main` @ `72b615d`) + OpenAPI repo file + React mock UI.  
**Live production:** OpenAPI URLs returned **HTTP 401** without staff session — **no `CONFIRMED_LIVE` rows** in this checkpoint.  
**Rules:** No invented endpoints. UI mock fields are not production contracts.

## Evidence legend

| Label | Meaning |
| --- | --- |
| `CONFIRMED_SOURCE` | Route/controller/model/migration exists in addon repo |
| `CONFIRMED_LIVE` | Observed on production with valid auth (none this CP) |
| `PARTIAL` | Related capability exists but incomplete vs UI need |
| `MISSING` | UI/business need; no verified staff/client contract |
| `MOCK_ONLY` | Present only in React mock / fixtures |
| `UNKNOWN` | Insufficient evidence |
| `PROPOSED` | CP7 recommendation — not implemented |

## Auth families (do not mix)

| Family | Mechanism | Typical prefix | Use in Web Admin |
| --- | --- | --- | --- |
| Staff Web Session | SEO-OPS Filament/session (+ CSRF on mutate) | `/social-automation/api/...` | **Yes** |
| RPA Admin Bearer | `EnsureRpaAdminUserApi` | `/api/v1/social-automation/rpa-admin/...` | **No** (Creator/Admin tool) |
| Client API Key | `EnsureRpaClientApiKey` Bearer key + lease | `/api/v1/social-automation/client/...` | **No** (Electron only) |
| Service API scopes | Service credentials | `/api/v1/services/{service}/social-automation/...` | **No** |

**Source:** `src/SocialAutomationServiceProvider.php`, `routes/api-services.php`, `openapi/openapi.yaml`.

## Doc conflicts (architecture)

| Topic | Source A | Source B | Impact |
| --- | --- | --- | --- |
| Web vs Realtime repos | `docs/README.md` + `ARCHITECTURE_RESET` update: React CSR **separate** from Node Realtime | `01_API_WEB_REALTIME.md`: still says one Node source named `rpa-social-automation-web` containing Web+Realtime | Follow **README / Reset update**. Treat `01` as stale on repo topology. |
| OpenAPI as deploy proof | `02_ADDON_BACKEND.md` notes VPS OpenAPI deploy report | Live OpenAPI **401** this survey; GitHub OpenAPI ≠ live proof | Matrix uses **SOURCE** only for paths |
| Browser title | Design Language / Theme: **Username** | Filament `device-group.blade.php` titles **`account_name`** | Staff inventory must not copy Filament title literally |

---

## 6.1 Action Tags

**Staff base:** `/social-automation/api/action-registry`  
**Controller:** `ActionRegistryController`  
**OpenAPI:** paths under `/social-automation/api/action-registry/*`  
**React:** `src/features/action-tags/*` (mock)

| MENU | UI OPERATION | HTTP | ENDPOINT | REQUEST FIELDS | RESPONSE FIELDS | AUTH | BACKEND SOURCE | STATUS | GAP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Action Tags | Load registry | GET | `/social-automation/api/action-registry/data` | — | `sites`, `paths`, `actions`, `tags` (+ `scripts_count`, `ready`, latest request), `requests` | Staff session | `ActionRegistryController::data` | CONFIRMED_SOURCE | No `auth_scripts` / `auth_script` in payload |
| Action Tags | Create Site | POST | `.../sites` | site key/name/base_url/mode… | site row | Staff | `storeSite` | CONFIRMED_SOURCE | — |
| Action Tags | Update Site | PUT | `.../sites/{id}` | same | site row | Staff | `updateSite` | CONFIRMED_SOURCE | — |
| Action Tags | Create Path | POST | `.../paths` | site_id, key, url_pattern, inputs… | path row | Staff | `storePath` | CONFIRMED_SOURCE | — |
| Action Tags | Update Path | PUT | `.../paths/{id}` | same | path row | Staff | `updatePath` | CONFIRMED_SOURCE | — |
| Action Tags | List Actions | (via data) | GET `.../data` | — | `actions[]` | Staff | `data` | CONFIRMED_SOURCE | No dedicated Actions CRUD routes in ServiceProvider |
| Action Tags | Create Tag | POST | `.../tags` | site/path/action selection | tag + auto script request | Staff | `storeTag` | CONFIRMED_SOURCE | Creates tag; does not set Auth Script |
| Action Tags | Delete Tag | DELETE | `.../tags/{id}` | — | ok / 422 if scripts linked | Staff | `destroyTag` | CONFIRMED_SOURCE | Blocks delete when `sa_action_tag_scripts` links exist |
| Action Tags | Create Script Request | POST | `.../tags/{id}/requests` | `request_type`, optional `script_id`/`script_version` | request row | Staff | `createRequest` | CONFIRMED_SOURCE | Regular script request — not Auth attach |
| Action Tags | **Update Tag** | — | — | — | — | — | No `updateTag` method; OpenAPI has create+delete only | **MISSING** | React mock update Auth Script is local-only |
| Action Tags | Tag key | (derived) | — | — | `tag_key` = `{site}.{path}.{action}` | — | `SaActionTag::buildKey` + migration | CONFIRMED_SOURCE | — |
| Action Tags | Tag ↔ Script (regular) | (table) | no staff mutate API surveyed | — | `sa_action_tag_scripts` | — | migration + `SaActionTagScript` | CONFIRMED_SOURCE | Relation is regular script links; **not** Auth-role |
| Action Tags | Tag ↔ Auth Script | — | — | — | — | — | No `auth_script_*` column/API; React `auth_script` mock | **MOCK_ONLY / MISSING** | See `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md` |
| Action Tags | Auth Script catalog | — | — | — | — | — | No `is_authentication` in packages/OpenAPI | **MISSING** | Mock `auth_scripts[]` only |

**Update Action Tag:** **NOT present** in controller, routes, or OpenAPI (SOURCE_CONFIRMED absence).

---

## 6.2 Script Registry

**React:** `src/features/script-registry/*` mirrors `ScriptRegistryUiService` shapes (comments in `types.ts`).  
**Service:** `PackageRegistry/ScriptRegistryUiService.php` (`listScriptsForUi`, `scriptDetail`).  
**Staff JSON for Web grid:** **MISSING** — service used by Filament Livewire (`UsesScriptRegistryUi`), not registered under `/social-automation/api/...`.

| MENU | UI OPERATION | HTTP | ENDPOINT | REQUEST | RESPONSE (key) | AUTH | BACKEND SOURCE | STATUS | GAP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Script Registry | List scripts (staff Web) | — | — | — | — | Staff | UI service exists; **no staff REST** | **MISSING** | Need staff wrapper or approved reuse |
| Script Registry | Detail (staff Web) | — | — | — | — | Staff | `scriptDetail()` | **MISSING** as REST | — |
| Script Registry | Catalog (Admin tool) | GET | `/api/v1/social-automation/rpa-admin/scripts` | — | catalog | RPA Admin Bearer | `RpaAdminScriptSyncController::catalog` | CONFIRMED_SOURCE | Wrong auth for React staff Web |
| Script Registry | Sync plan / publish / pull | POST | `.../rpa-admin/scripts/sync/plan`, `/publish`, `/pull` | manifest/body | plan/result | RPA Admin | same controller | CONFIRMED_SOURCE | Creator path; not Web staff CRUD |
| Script Registry | Video demo get/attach | GET/POST | `.../scripts/video-demo` | release refs | media meta | RPA Admin | same | CONFIRMED_SOURCE | Not public CDN assumption |
| Script Registry | Asset get/attach | GET/POST | `.../scripts/asset` | — | asset | RPA Admin | same | CONFIRMED_SOURCE | — |
| Script Registry | Staff media stream | GET | `/social-automation/script-media/{mediaId}` | mediaId | binary/stream | Staff middleware group | `ScriptReleaseMediaController::show` | CONFIRMED_SOURCE | IDs from registry; not free CDN URL |
| Script Registry | Remove / tombstone | — | (no staff route in ServiceProvider) | package_key | — | Filament/service | `ScriptRemoveService::remove` | PARTIAL | Domain exists; **no staff REST** for React Remove |
| Script Registry | Identity | — | — | — | `package_key`, manifest `script_id`, release `version`/`id` | — | `sa_packages`, `sa_package_releases` | CONFIRMED_SOURCE | UI uses both package_key + script_id |
| Script Registry | `is_authentication` | — | — | — | — | — | **Absent** in migrations/models/OpenAPI survey | **PROPOSED / MISSING** | Mock flag only |
| Script Registry | Video URL on grid | — | — | — | `video_media_id` / `thumbnail_media_id` + status | — | `ScriptRegistryUiService` + media tables | PARTIAL | React `video_url`/`thumbnail_url` are MOCK presentation |

**Grid field alignment (SOURCE vs mock):**

| UI field | Backend evidence | Status |
| --- | --- | --- |
| `package_key`, `script_id`, `name`, `action_tag_key`, `version`, `release_id`, `status` | `listScriptsForUi` | CONFIRMED_SOURCE (service) |
| `assets_complete`, `video_demo_status`, media ids | same + media service | CONFIRMED_SOURCE |
| `thumbnail_url`, `video_url` | mock only; play via media id route | MOCK_ONLY / PARTIAL |
| `is_authentication` | none | MOCK_ONLY |
| `last_sync_label`, `updated_by_label` | service labels | CONFIRMED_SOURCE (service) |

---

## 6.3 Accounts

**Staff base:** `/social-automation/api/accounts`  
**Controller:** `SocialAutomationAccountManagementController`  
**Service:** `SaAccountService`  
**Model:** `SaAccount` (password `hidden`; list exposes `has_password` only)

| MENU | UI OPERATION | HTTP | ENDPOINT | REQUEST FIELDS | RESPONSE FIELDS | AUTH | BACKEND SOURCE | STATUS | GAP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Accounts | List | GET | `/social-automation/api/accounts` | — | `id`, `account_uuid`, `installation_id`, `platform`, `name`/`account_name`, `username`, `email`, `has_password`, `note`, timestamps, creator | Staff | `index` | CONFIRMED_SOURCE | Strong fit to React types |
| Accounts | Create | POST | same | `name`/`account_name` required; `platform`, `username`, `email`, `site_url`, password via service | account (no password) | Staff | `store` + `SaAccountService::create` | CONFIRMED_SOURCE | — |
| Accounts | Update | PUT | `/accounts/{id}` | same family | account | Staff | `update` | CONFIRMED_SOURCE | — |
| Accounts | Delete | DELETE | `/accounts/{id}` | — | ok | Staff | `destroy` | CONFIRMED_SOURCE | — |
| Accounts | Platform / Username / Account Name | — | — | — | fields above | — | inventory migration + model | CONFIRMED_SOURCE | Identity = `account_uuid` / id — not username |
| Accounts | Credential metadata | — | — | — | `has_password` only on staff list | Staff | controller | CONFIRMED_SOURCE | Password fetch is **Client** `.../accounts/{id}/password` — not for Web |
| Accounts | Browser binding | — | Client browser-sync | Account ID required | session | Client key | `SessionSyncService::syncClientBrowsers` | CONFIRMED_SOURCE | Staff Accounts UI does not manage browsers |
| Accounts | Action Tags association | — | — | — | — | — | No account↔tag table/API found | **MISSING** | WordPress-first needs resolution rule (platform vs explicit link) |

**React Accounts mock:** no Action Tag fields — consistent with missing backend association.

---

## 6.4 Client API Keys

**Staff base:** `/social-automation/api/client-keys`  
**Controller:** `RpaClientApiKeyManagementController`  
**Lease domain:** `ClientConnectionLease` + migration `2026_10_28_120000_client_api_key_identity_and_connection_lease.php` on `sa_agents`

| MENU | UI OPERATION | HTTP | ENDPOINT | REQUEST | RESPONSE | AUTH | BACKEND SOURCE | STATUS | GAP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Client API Keys | List | GET | `/social-automation/api/client-keys` | — | `id`, `name`, `key_prefix`, `installation_id`, creator, `last_used_at`, `revoked_at`, `is_active`, `created_at` | Staff | `index` | CONFIRMED_SOURCE | **No lease/heartbeat** |
| Client API Keys | Create + one-time reveal | POST | `/client-keys` | `name` | `raw_key` + key meta | Staff | `store` | CONFIRMED_SOURCE | Reveal once in create response |
| Client API Keys | Revoke | POST | `/client-keys/{id}/revoke` | — | ok | Staff | `revoke` | CONFIRMED_SOURCE | Revoke ≠ release lease UI |
| Client API Keys | Active or candidate | GET | `/client-keys/active-or-candidate` | — | activation helper payload | Staff | `activeOrCandidate` | CONFIRMED_SOURCE | Filament dashboard helper |
| Client API Keys | Activate candidate | POST | `/client-keys/activate-candidate` | `candidate_token` | raw_key once | Staff | `activateCandidate` | CONFIRMED_SOURCE | — |
| Client API Keys | Logical Client identity | — | — | — | `sa_client_api_keys.id` / `client_api_key_id` | — | migration + docs | CONFIRMED_SOURCE | One key ↔ one agent unique |
| Client API Keys | Lease claim/renew | POST | `/api/v1/social-automation/client/register`, `/heartbeat` | device meta + `connection_token` | token + `connection_lease_expires_at` (TTL 120s) | Client key | `RpaClientApiController` + `ClientConnectionLease` | CONFIRMED_SOURCE | Not on staff keys index |
| Client API Keys | Lease conflict | — | register/heartbeat | — | **409** `CLIENT_KEY_IN_USE` | Client | OpenAPI + domain | CONFIRMED_SOURCE | — |
| Client API Keys | Disconnect / release lease | POST | `/client/disconnect` | `connection_token` | ok | Client | controller | CONFIRMED_SOURCE | **Do not invent staff Force Disconnect** |
| Client API Keys | Online / heartbeat UI | — | — | — | React `mock_lease` | — | — | **MOCK_ONLY** | Active key ≠ online client |
| Client API Keys | Device hostname | — | agent register/heartbeat | OS/display meta | `display_name` / OS fields on agent | Client→Laravel | `AgentRegistryService` | PARTIAL | Metadata only; not on keys index JSON |

---

## 6.5 Clients (Browser-first)

**React:** `src/features/clients/*` + `docs/CLIENTS_READ_ONLY_AUDIT_2026-10-28.md`  
**Filament shape:** `SessionSyncService::clientDashboard()` → `sessions.blade.php` + `device-group.blade.php` (**Livewire**, not REST)  
**Client-auth list:** `GET /api/v1/social-automation/client/browser-sessions` (sparse; Electron)

| MENU | UI OPERATION | HTTP | ENDPOINT | REQUEST | RESPONSE | AUTH | BACKEND SOURCE | STATUS | GAP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clients | Staff Browser inventory | — | — | — | — | Staff | `clientDashboard()` exists in service only | **MISSING** | Need Browser-first staff REST (PROPOSED in separate doc) |
| Clients | Browser ID | — | — | — | `browser_id` = `session_uuid` | — | `SaBrowserSession`, sync, dashboard | CONFIRMED_SOURCE | — |
| Clients | Username (card title) | — | — | — | — | — | Dashboard uses **`account_name`**; Account has `username` | **MISSING** on inventory | Must join Account.username (PROPOSED) |
| Clients | Account Name | — | — | — | `account_name` | — | dashboard / capabilities | CONFIRMED_SOURCE | Secondary in Design Language |
| Clients | Account ID binding | — | browser-sync | `account_id` required | bound session | Client | `SessionSyncService` | CONFIRMED_SOURCE | Field naming: id vs uuid — confirm in staff DTO |
| Clients | Platform / site_url | — | — | — | from account/session | — | dashboard | CONFIRMED_SOURCE | — |
| Clients | Logical Client ID | — | — | — | `client_api_key_id` on device | — | dashboard + agents | CONFIRMED_SOURCE | Not hostname |
| Clients | Device hostname | — | — | — | `name` / `display_name` | — | agent | CONFIRMED_SOURCE (metadata) | Small PC tag only |
| Clients | Lease / heartbeat | — | client register/heartbeat | — | agent lease + `last_heartbeat_at` | Client | lease migration + AgentRegistry | PARTIAL | Not exposed on staff inventory REST |
| Clients | Session signal | — | capabilities + confirmLogin | — | `signal_present`, `session_state`, checked_at | Mixed | `SessionSignalState`, dashboard, `POST .../session-confirm-login` | PARTIAL | Staff mutate via Filament methods; limited REST notify |
| Clients | Execution confirm / ACK | — | job ack (runner) / notification ack (client) | — | — | Runner/Client | Service API jobs; client notifications | PARTIAL | Not first-class on staff inventory; React `execution_state` MOCK |
| Clients | Screenshot metadata | — | — | — | — | — | not in dashboard/browser list surveyed | **MISSING** | — |
| Clients | Browser list per Client | — | — | — | `devices[].browsers[]` in `clientDashboard` | Filament | SessionSyncService | CONFIRMED_SOURCE (service) | Device-grouped; Design Language is Browser-first flatten |
| Clients | Client-only browser list | GET | `/api/v1/social-automation/client/browser-sessions` | — | `browser_id`, `account_name`, `platform`, `status`, `last_confirmed_at` | Client key | `listBrowserSessions` | CONFIRMED_SOURCE | Sparse; no username; **not** staff Web auth |
| Clients | Staff notify session | POST | `/social-automation/api/clients/sessions/{sessionId}/notifications` | type, message, idempotency_key | notification_id | Staff | `ClientManagementController::notify` | CONFIRMED_SOURCE | Not full Clients inventory |

**Do not treat Filament PC-group UI as the React contract.** See `CLIENTS_BROWSER_INVENTORY_CONTRACT_CP7.md`.

---

## Cross-cutting: Realtime

| Signal | REST truth owner | Realtime role | Status |
| --- | --- | --- | --- |
| Client connected/disconnected | Lease + heartbeat on `sa_agents` | Presence hint | Domain SOURCE; WSS schema **PROPOSED/UNKNOWN** (separate realtime repo; not surveyed as code here) |
| Browser started/stopped | `sa_browser_sessions` + sync | Fast signal | SOURCE via client sync |
| Session signal | capabilities + confirmLogin | Fast signal | SOURCE partial |
| Execution requested/completed | Tasks/jobs APIs (service) | Progress/ACK | Out of WordPress-first minimal path unless needed for Web result |

---

## Summary counts (staff Web relevance)

| Status | Approx. meaning for five menus |
| --- | --- |
| CONFIRMED_SOURCE | Action Tags read/create/delete; Sites/Paths; Accounts CRUD; Client Keys CRUD+reveal; Client lease/browser APIs (Electron); media-by-id |
| PARTIAL | Script registry (service/Filament/Admin, not staff REST); Clients signals; lease UI |
| MISSING | Action Tag update; Auth Script flag/relation; Account↔Tag; Staff Script Registry REST; Staff Browser-first inventory; Username on inventory; Screenshot |
| MOCK_ONLY | Auth Script select; Script `is_authentication`; Keys lease badges; Clients inventory grid |
| CONFIRMED_LIVE | **None** (OpenAPI 401) |

**Repo surveyed:** https://github.com/trung8356621/seo-ops-addons-rpa (`main` `72b615d`) — SOURCE only.  
**Live probe:** `https://seo-ops.duckdns.org/api/v1/social-automation/openapi.json` → **401**.
