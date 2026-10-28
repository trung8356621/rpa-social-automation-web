# CP9A — Action Tags Live Read Handoff

**Date:** 2026-10-28  
**Repo:** `rpa-social-automation-web`  
**Scope:** Action Tags **read-only** staff API wiring. Other four routes remain MOCK.  
**Laravel evidence:** `seo-ops-addons-rpa` @ `bbacd03a862a810a9906bbb691417378fe3353aa`  
**Production probe host:** `https://seo-ops.duckdns.org`

---

## 1. Staff authentication findings

| Item | Evidence |
| --- | --- |
| Mechanism | SEO-OPS **web session** (`Authenticate` + session stack) — OpenAPI `SeoOpsSessionCookie` |
| Middleware (staff action-registry) | `EncryptCookies`, `AddQueuedCookiesToResponse`, `StartSession`, `AuthenticateSession`, `ShareErrorsFromSession`, `VerifyCsrfToken`, `Authenticate`, `SubstituteBindings` |
| Cookie (live Set-Cookie) | `laravel-session`; **Secure; HttpOnly; SameSite=Lax**; Path=/ |
| OpenAPI cookie name | Documents `laravel_session` — **live header uses `laravel-session`** (host evidence wins) |
| Unauthenticated JSON | `Accept: application/json` → **HTTP 401** `{"message":"Unauthenticated."}` |
| Browser HTML without Accept | Login page HTML (“Đăng nhập SEO Ops”) |
| CORS (probe) | `Access-Control-Allow-Origin: http://localhost:3000` + `Allow-Credentials: true` — **not** `http://localhost:5173` |
| CSRF | On middleware for all staff registry routes including GET; mutating routes need CSRF token in same-origin browser session |
| Access policy | `SocialAutomationAccess` (Owners/Admins/Staff); catalog GET calls `assertCanAccess()`; `data()` relies on Authenticate middleware |

**Do not use:** Client API Key, RPA Admin Bearer, invent JWT, or Electron auth/resolve/pull from React.

---

## 2. Same-origin / local-dev recommendation

**Production intent (preferred):** Serve React **static build** under SEO-OPS so staff cookie is **same-origin**. Session + CSRF work without CORS.

**Local DEV (`http://localhost:5173`):**

- Cross-origin credentialed fetch to production **will not** carry `SameSite=Lax` session cookies.
- Production CORS currently allows `localhost:3000`, not Vite `5173`.
- Vite DEV proxy (`/social-automation/api` → SEO-OPS) is **development-only** so relative URLs resolve; it does **not** by itself authenticate the browser to production (cookie host / Secure / SameSite still apply).
- **Do not** globally loosen Laravel CORS/CSRF for CP9A.
- **Do not** log Cookie / Set-Cookie / tokens.

**Authenticated LIVE_CONFIRMED** requires a same-origin staff session (or owner-approved cookie bridge). Without it, UI correctly shows **Authentication required**.

---

## 3. Exact endpoint mapping (CP9A reads)

Base: `/social-automation/api/action-registry`

### A. Sites — `GET .../data` → `sites[]`

| API field | React `Site` | Notes |
| --- | --- | --- |
| `id` | `id` | number |
| `key` | `key` | |
| `name` | `name` | |
| `base_url` | `base_url` | |
| `base_url_mode` | `base_url_mode` | `fixed` \| `dynamic` |
| `test_base_url` | `test_base_url` | nullable |
| `description` | `description` | nullable |
| `paths_count` | `paths_count` | |

Auth: staff session. Mutations (POST/PUT sites) **not called** in CP9A.

### B. Paths — `GET .../data` → `paths[]`

| API field | React `PathItem` |
| --- | --- |
| `id`, `site_id`, `site_key`, `key`, `name`, `url_pattern`, `path_inputs[]`, `description` | same |

### C. Actions — `GET .../data` → `actions[]`

| API field | React `ActionItem` |
| --- | --- |
| `id`, `key`, `name`, `description` | same |

Source filters out `like`/`share`.

### D. Action Tags — `GET .../data` → `tags[]`

| API field | React field | Notes |
| --- | --- | --- |
| `id`, `tag_key`, site/path/action keys+names, `scripts_count`, `ready`, latest request | same | |
| `auth_script_id` | join → `auth_script.package_id` | **int package id**, not package_key |
| `auth_release_id` | join → `auth_script.release_id` | **int release id** |
| *(no nested `auth_script` object in GET data)* | `auth_script` | **Client join** with Auth catalog |

### E. Tag Keys

Derived server-side as `{site}.{path}.{action}` (`tag_key`). Display/copy only in CP9A.

### F. Script Requests — `GET .../data` → `requests[]`

Mapped to React `ScriptRequestItem`. Create request POST **not called**.

### G. Authentication Script catalog

`GET .../authentication-scripts` → `{ ok, packages[] }`

| API field | React `AuthScriptOption` |
| --- | --- |
| `package_id` | `package_id` |
| `package_key` | `script_id` (display/mock-compatible) |
| `name` | `name` |
| `is_authentication` | `is_authentication` |
| `releases[]` (`id`,`version`,`status`,…) | `releases[{release_id,version,status}]` |
| preferred published `version` | `version` |
| — | `compatible_site_keys: null` | **MOCK-only; not invented live** |

Empty packages → empty Auth catalog UI (no mock WordPress Login).

### H. Pinned Auth release

Stored on tag as `auth_script_id` + `auth_release_id`. Display via catalog join. Missing package/release → `status: unavailable` label — never invent “latest”.

**Staff mutations present in Laravel but NOT wired in CP9A:**  
POST tags, PUT tags/{id}/auth-pin, sites/paths CUD, tag accounts grant/revoke, script requests, DELETE tag.

**Never call from React:** Client `POST .../auth/resolve`, `POST .../auth/pull`.

---

## 4. React API adapter design

| Piece | Path |
| --- | --- |
| Mode / base | `src/lib/api/config.ts` — `VITE_RPA_API_MODE=mock\|live` (default **mock**), optional `VITE_RPA_API_BASE` |
| Transport | `src/lib/api/http.ts` — native fetch, timeout, AbortController, credentials include, safe errors |
| Errors | `src/lib/api/errors.ts` — `ApiError` kinds incl. `auth` |
| Live types / mappers | `src/features/action-tags/api/*` |
| Hook | `src/features/action-tags/use-action-registry.ts` — mock \| live; live **no mock fallback** |
| Page | `src/pages/ActionTagsPage.tsx` — loading / auth-required / error / live read-only banner |

Live mutations: UI disabled + throw/toast “Live editing not enabled yet”.

---

## 5. Confirmed vs proposed fields

| Field / shape | Status |
| --- | --- |
| GET `data` sites/paths/actions/tags/requests | **CONFIRMED_SOURCE** (controller) |
| `tags[].auth_script_id` / `auth_release_id` ints | **CONFIRMED_SOURCE** |
| Nested `tags[].auth_script` on GET data | **Not in source** — React joins |
| GET `authentication-scripts` → `packages[]` | **CONFIRMED_SOURCE** |
| Auth pin PUT `/tags/{id}/auth-pin` | **CONFIRMED_SOURCE** — out of CP9A writes |
| Create tag optional auth pin body | **CONFIRMED_SOURCE** — out of CP9A writes |
| `compatible_site_keys` | **MOCK_ONLY** |
| LIVE authenticated payload | **NOT CONFIRMED** this checkpoint (401 without staff session) |

---

## 6. Live verification status

| Check | Result |
| --- | --- |
| Unauthenticated GET data | **401** JSON — adapter → Authentication required |
| Unauthenticated GET authentication-scripts | **401** |
| Authenticated happy-path GET | **BLOCKED** — no authorized same-origin staff session in this agent environment |
| LIVE_CONFIRMED real rows | **No** |
| Zero Auth packages on prod (owner smoke) | Consistent with empty catalog when eventually authenticated |

---

## 7. Remaining mutation contract (next checkpoint)

Wire only after owner approval + non-prod or authorized write window:

1. POST `/tags` with optional `auth_script_id` + `auth_release_id` (both ints, D3 explicit release)
2. PUT `/tags/{id}/auth-pin` (set pair or `clear: true`)
3. Sites/Paths POST/PUT + CSRF token from same-origin session
4. DELETE tag / script requests as needed

React must send **package_id** and **release_id**, not mock string `script_id` alone.

---

## 8. Blockers

1. **Staff session same-origin** required for LIVE_CONFIRMED reads from desktop Vite.
2. CORS allowlist is `localhost:3000`, not `5173`; SameSite=Lax blocks cross-site cookies anyway.
3. No Laravel changes in CP9A — cookie/CORS bridge needs owner decision if DEV live auth is required before static embed.

---

## 10. CP9A.1 — Network error diagnosis (2026-10-28)

**Symptoms:** Live UI showed `Network error. Check connection or API host.`

**Evidence:**
- Relative `GET http://localhost:5173/social-automation/api/action-registry/data` via Vite proxy → **HTTP 401** JSON `Unauthenticated.` (Laravel reached).
- Absolute `GET https://seo-ops.duckdns.org/...` from origin `:5173` → browser `TypeError: Failed to fetch` (**CORS**, not 401 surfaced).
- Transport bug: `AbortController.abort('timeout')` makes Chromium reject fetch with the **string** `"timeout"`, which was misclassified as `network` instead of `timeout`/`abort`.

**Fix (React-only):** `src/lib/api/http.ts` — abort timeout without custom reason; classify abort rejections correctly; clearer message if absolute `VITE_RPA_API_BASE` is set. Keep `VITE_RPA_API_BASE` empty in DEV.

**Expected live unauthenticated result after fix:** Authentication required (401), not Network error.

---

## 9. Screenshots

`docs/qa-screenshots/checkpoint-9a/`

See final report for capture list. Live success-with-rows screenshot intentionally omitted.
