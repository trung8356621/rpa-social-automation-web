# CP9A.3 — Staff Session & Same-Origin Deployment

**Date:** 2026-10-28  
**Repo:** `rpa-social-automation-web`  
**Laravel evidence:** `seo-ops-addons-rpa` (GitHub `main` + prior CP8A `bbacd03`)  
**Production probe:** `https://seo-ops.duckdns.org`  
**Scope:** Design + local Vite build prep only. **No** production deploy, Nginx, or Laravel edits in this checkpoint.

---

## 1. Existing Laravel auth mechanism

| Item | Evidence |
| --- | --- |
| Staff identity | SEO-OPS `User` + web session (Filament / `Authenticate`) — **not** a separate React login |
| Login HTML | `GET /login` → **200** (SEO Ops login page) |
| Session cookie | `laravel-session`; **Secure; HttpOnly; SameSite=Lax**; Path=/ |
| CSRF cookie | `XSRF-TOKEN`; **Secure; SameSite=Lax**; **not** HttpOnly (readable by same-origin JS) |
| CSRF warm-up | `GET /sanctum/csrf-cookie` → **204** (sets cookies) |
| Filament panels (probe) | `/admin`, `/seo` → **302** → `/login` when anonymous |
| Addon Filament panel (source) | `SocialAutomationPanelProvider` → `id('social-automation')`, `path('social-automation-panel')` |
| Guard for staff JSON APIs | Same session stack as Filament-backed web routes |

**Do not invent** React JWT/Bearer staff auth. **Do not** use Client API Key in the browser.

---

## 2. Existing API middleware (Action Registry)

Registered in `SocialAutomationServiceProvider` under prefix `social-automation` with:

`EncryptCookies` → `AddQueuedCookiesToResponse` → `StartSession` → `AuthenticateSession` → `ShareErrorsFromSession` → `VerifyCsrfToken` → `Authenticate` → `SubstituteBindings`

| Request | Observed |
| --- | --- |
| `GET .../action-registry/data` + `Accept: application/json` | **401** `{"message":"Unauthenticated."}` |
| Same URL, browser/HTML Accept | **302** → `/login` |
| Extra gate | `SocialAutomationAccess` (e.g. auth catalog `assertCanAccess`) |

Protecting SPA HTML **does not** replace this API middleware.

---

## 3. Production React mount recommendation

### Candidates

| Approach | Summary | Fit |
| --- | --- | --- |
| **A. Laravel serves SPA HTML** under auth middleware; static hashed assets from `public/` | Reuses staff session redirect-to-login; API stays on same middleware | **Recommended** |
| **B. Nginx static + SPA fallback** only | Fast assets; HTML gate weaker unless `auth_request`; still needs careful precedence vs `/api` | Secondary assist for assets |
| **C. Existing Filament + `SocialAutomationVite` mini-app** | Filament page embeds Action Tags Vite entry with `data-csrf` + `data-api-base` + server `initialData` | **Legacy for Action Tags only** — not the five-route CSR product |

### Existing integration (C) — source truth

Addon already has:

- `resources/js/action-tags/*` + addon `vite.config.js` (dev port **5175**)
- `SocialAutomationVite` → `public/build-social-automation` + `hot-social-automation`
- Filament blade injects CSRF + API base + initial registry JSON into `#action-registry-root`

That pattern proves **same-origin session + CSRF** works when UI is served from SEO-OPS. It is **not** a drop-in for the new five-route React Router app in this repo.

### Recommended (A) for `rpa-social-automation-web`

1. Build this repo with  
   `VITE_RPA_API_MODE=live` and  
   `VITE_RPA_ASSET_BASE=/build-rpa-web/`  
   (exact prefix owner-approved; must not collide with API).
2. Publish `dist/` → SEO-OPS `public/build-rpa-web/` (hashed JS/CSS + `manifest.json`).
3. Add **Laravel** routes (future handoff — not in this repo) that serve the SPA `index.html` **only** for:

   - `/social-automation/action-tags`
   - `/social-automation/scripts`
   - `/social-automation/accounts`
   - `/social-automation/clients`
   - `/social-automation/client-api-keys`

   Middleware: same staff session stack as Action Registry (Authenticate + session). Unauthenticated → redirect `/login` (HTML) or JSON 401 if Accept prefers JSON.
4. Keep `/social-automation/api/*` and `/social-automation/script-media/*` on existing controllers — **never** SPA-fallback those prefixes.
5. Optional Nginx: ensure those five paths hit PHP/Laravel (today they do **not** — see blockers). Assets under `/build-rpa-web/` can be served as static files with long cache; `index.html` must be **no-cache**.

Shell HTML should be empty of business data (unlike Filament `data-initial-data`). Live data only via staff API.

---

## 4. Route collision analysis

| Path family | Owner today | Collision risk |
| --- | --- | --- |
| `/social-automation/api/*` | Laravel staff JSON | **Must win** over SPA |
| `/social-automation/script-media/{id}` | Laravel staff media | **Must win** |
| `/social-automation/action-tags` etc. (5 UI routes) | **None** — production probe → **nginx 404** | Free for SPA mount after Nginx→Laravel wiring |
| `/social-automation-panel/*` | Filament panel path (source) | Prod probe → nginx 404; keep distinct from React URLs |
| `/seo`, `/admin` | Filament | Do not overwrite |
| `/login` | SEO-OPS auth | Do not overwrite |
| `/build-social-automation/*` | Legacy Action Tags Vite assets | Do not reuse name; use `/build-rpa-web/` (or similar) for CSR app |
| Root `/assets/*` | **Unsafe** for production if other apps share host | Avoid; use prefixed `base` |

React Router paths in this repo already match the intended public URLs (no `basename` required if HTML is served at those exact paths).

---

## 5. Vite asset base strategy

| Mode | `base` / `VITE_RPA_ASSET_BASE` | API calls |
| --- | --- | --- |
| Local DEV | `/` (default) | Relative `/social-automation/api/...` via Vite proxy |
| Production build | `/build-rpa-web/` (example) | Same relative API paths (same origin) |

Configured in `vite.config.ts` (this checkpoint).  
Hashed filenames + `manifest: true` for cache busting.  
After deploy: new hash ⇒ new URL; set long `Cache-Control` on hashed assets only; **never** long-cache `index.html`.

Deep links: browser refresh on `/social-automation/scripts` requires server to return SPA HTML (Laravel route or Nginx `try_files` that excludes `/api` and `/script-media`).

---

## 6. Staff session / CSRF handling

| Concern | Guidance |
| --- | --- |
| Reads (current CP9A) | `credentials: 'include'` + relative URL; handle **401** → Authentication required UI |
| Future mutations | Same-origin; read `XSRF-TOKEN` cookie → send `X-XSRF-TOKEN` (and/or meta csrf if Laravel injects one). Warm with `/sanctum/csrf-cookie` if needed |
| CSRF | **Never** disable globally |
| HTML gate vs API | Both required; API remains source of authorization |
| Static JS/CSS | May be downloadable without session if Nginx serves `/build-rpa-web/` publicly — **acceptable only if no secrets/privileged payloads are embedded** (current CSR design OK; avoid Filament-style `data-initial-data` in public shell) |

Bundle scan (local `pnpm build`): no `seo-ops.duckdns.org` / Client raw key embedded; only mock UI copy mentioning “raw secret” in Client API Keys mock screen text.

---

## 7. Local development limitations

| Topic | Status |
| --- | --- |
| Mock mode | Default; full UI without SEO-OPS login |
| Live mode + Vite proxy | Reaches Laravel; **401** without staff session — expected |
| Reusing production session from `:5173` | **Not possible** safely: `SameSite=Lax` + Secure cookie host-scoped to `seo-ops.duckdns.org`; CORS allowlist is `localhost:3000` not `5173` |
| Absolute `VITE_RPA_API_BASE` | Forbidden as default — causes CORS `Failed to fetch` |
| Cookie copy / credential injection | **Forbidden** |
| Authenticated LIVE_CONFIRMED from laptop Vite | **Blocked** until same-origin mount (or owner-approved private bridge) |

Keep DEV proxy; keep `VITE_RPA_API_MODE=mock|live`.

---

## 8. Production deployment plan (owner / Laravel handoff)

**Not executed in CP9A.3.**

1. Owner approves asset prefix and SPA HTML owner (Laravel vs Nginx).
2. React: `pnpm build` with `VITE_RPA_API_MODE=live` + `VITE_RPA_ASSET_BASE=/build-rpa-web/`.
3. Copy `dist/**` → VPS `public/build-rpa-web/`.
4. Laravel: SPA view controller + five GET routes + auth middleware; do not SPA-catch `api` / `script-media`.
5. Nginx: route the five UI paths (and optionally `/social-automation` → action-tags) to Laravel `index.php`; keep API/media as today; static alias for `/build-rpa-web/`.
6. Smoke: anonymous HTML → login redirect; staff session → SPA loads; `GET .../action-registry/data` → **200** JSON; refresh on deep link works.
7. Decide fate of Filament Action Tags page / `build-social-automation` (coexist vs deprecate).

---

## 9. Rollback strategy

1. Remove or disable the five Laravel SPA routes (or Nginx SPA locations).
2. Delete/replace `public/build-rpa-web/` if needed.
3. Filament legacy Action Tags (`build-social-automation`) remains independent if left untouched.
4. Staff APIs unchanged — rollback UI does not require API migration rollback.
5. Keep previous `index.html` / asset dir renamed (`build-rpa-web.prev`) for one-release quick restore.

---

## 10. Owner decisions / blockers

| ID | Decision / blocker |
| --- | --- |
| D1 | Approve **Approach A** (Laravel-authenticated SPA HTML + prefixed static assets)? |
| D2 | Exact asset prefix (`/build-rpa-web/` vs other)? |
| D3 | **Nginx** currently returns **404** for `/social-automation/action-tags` (not Laravel). Production mount **requires** Nginx (or equivalent) change — out of this Web repo. |
| D4 | Coexist vs replace Filament Action Tags + `SocialAutomationVite` mini-app? |
| D5 | When to implement Laravel SPA routes (separate Laravel handoff)? |
| B1 | Authenticated live GET from Vite DEV remains blocked without same-origin session. |
| B2 | No wildcard CORS; no CSRF disable; no Client API Key in React. |

---

## Laravel / Nginx handoff (do not implement here)

**Laravel addon**

- Add authenticated SPA HTML controller/routes for the five paths.
- Publish/copy React build into `public/build-rpa-web`.
- Optionally link from SEO Filament nav to `/social-automation/action-tags`.
- Preserve Action Registry API middleware.

**Nginx**

- Forward SPA UI paths to PHP.
- Static location for `/build-rpa-web/` with hashed-asset caching.
- Do not send `/social-automation/api/` or `/social-automation/script-media/` to SPA fallback.

---

## Local verification (CP9A.3)

- `pnpm run typecheck` / `oxlint src` / `pnpm run build` — run after Vite `base` change.
- Default `base=/` mock/live relative URLs unchanged.
- Production-style check:  
  `VITE_RPA_ASSET_BASE=/build-rpa-web/ pnpm run build` → `dist/index.html` references `/build-rpa-web/assets/...`.
