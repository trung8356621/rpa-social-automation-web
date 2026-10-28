# CP8 — React Integration Handoff (Auth Script / Action Tags)

**Date:** 2026-10-28  
**Update:** Checkpoint **7.2** — aligned with Laravel security contract  
**Repo:** `rpa-social-automation-web`  
**Status:** Wire-up brief **after** Laravel CP8 staff APIs exist. **No React code in CP7.2.**  
**Authority:** `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md`, `CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md`  
**UI lock:** Action Tags route only; five menus unchanged.

---

## 1. Scope

| In scope (when live) | Out of scope |
| --- | --- |
| Create Tag **with** Auth pin (atomic POST if Laravel ships it) | Client `auth-script/resolve` (Electron) |
| Edit Tag Auth pin (`PUT`) | Client API Key in Web |
| Clear Auth pin (`PUT` null pair) | Clients inventory live |
| Explicit **published release** select (D3) | Script Registry staff REST |
| Show unavailable pinned release | Claiming mutation success before server OK |
| Handle 401/403/409/422/5xx | Platform-based Auth “smart” filter as backend truth |

---

## 2. Existing mock fields (this repo)

| Location | Field | Note |
| --- | --- | --- |
| `action-tags/types.ts` | `auth_script`, `auth_scripts`, `is_authentication` | MOCK anticipates PROPOSED |
| | `compatible_site_keys` | MOCK only — **remain MOCK** |
| `AddTagDrawer.tsx` | submits `auth_script_id` | Live must also send **`auth_release_id`** |
| `use-action-registry-mock.ts` | local create/update Auth | Replace with staff APIs when gated live |
| `script-registry` `is_authentication?` | MOCK | No staff scripts list API yet |

---

## 3. Backend mapping (CP7.2)

### 3.1 Create Tag + pin

| UI | API |
| --- | --- |
| Add Tag drawer with Auth + release | `POST /social-automation/api/action-registry/tags` (**SOURCE** path) + **PROPOSED** body fields `auth_script_id`, `auth_release_id` |
| No Auth selected | Omit fields or null pair — **backward compatible** |

### 3.2 Edit / clear pin

| UI | API |
| --- | --- |
| Edit Tag Auth | `PUT .../tags/{id}` **PROPOSED** both set |
| Clear Auth | `PUT` both `null` |

### 3.3 Read

| UI | API |
| --- | --- |
| Grid / drawer | `GET .../data` **SOURCE** + PROPOSED `tags[].auth_script` (`script_id`, `release_id`, `version`, `name`, `status`) |
| Catalog | PROPOSED `auth_scripts[]` with **`releases[{release_id,version,status}]`** |

### 3.4 Display rules

- Pin `status=unavailable` / missing release → warning badge; block save until new published release chosen or clear.  
- Never invent “use latest” in UI.  
- Never show success toast until HTTP 2xx from server.

---

## 4. HTTP handling (staff session)

| Status | UI behavior |
| --- | --- |
| 401 | Session expired → re-auth guidance; no mock success |
| 403 | Permission denied message |
| 409 | Conflict message (if any) |
| 422 | Show server `error` / validation (incomplete pin, not Auth package, unpublished release) |
| 5xx | Generic failure; leave drawer open |
| 2xx | Then update local cache / close drawer |

**Auth:** Staff session + CSRF on mutate. **Never** Client API Key in browser.

---

## 5. Mock → live

1. Wait Laravel staff create/PUT/`data` verified (+ OpenAPI).  
2. Env/flag `mock|live` — default mock.  
3. Live **read** first; then live create/PUT on non-prod.  
4. Extend types with `release_id`; dual select script+release.  
5. Keep `?demo=` for offline QA.  
6. Do not wire Clients/Scripts in same pass.  
7. Electron resolve/SB1/SB2 are **not** React work.

---

## 6. Must remain MOCK

- Clients inventory, Keys lease badges, Script Registry CDN URLs, `compatible_site_keys` as real filter, Force Disconnect / Release Lease, passwords/raw keys, any Client-key calls.

---

## 7. Contract delta vs CP7.1 React brief

| Delta | Action |
| --- | --- |
| Atomic **create + pin** | Preferred over create-then-PUT |
| Explicit release on create **and** edit | Required (D3) |
| Error taxonomy 401/403/422 | Do not treat as soft mock success |
| Resolve endpoint | Out of React scope; security blockers are Laravel/Electron |
| Unavailable pin display | Required for staff honesty |

---

## 8. Stop / ask

- Live wire before staff PUT/create-pin APIs exist  
- Sending only `auth_script_id`  
- Using Client resolve from Web  
- Expanding menu scope without owner approval
