# DEV Environment — Same-Origin Vite Proxy (CP10)

**Purpose:** Develop React with Vite HMR on `http://localhost:5173` while calling the real SEO-OPS staff session API through a **DEV-only** Vite proxy. No VPS build/deploy per edit.

**Not for production.** Production remains same-origin static assets under `/build-rpa-web/` (CP9).

---

## Enable / disable

| Mode | How |
| --- | --- |
| **Mock UI (default)** | `.env.local` → `VITE_RPA_API_MODE=mock` · `pnpm dev` |
| **Live staff API via proxy** | `.env.local` → `VITE_RPA_API_MODE=live` · leave `VITE_RPA_API_BASE` empty · `pnpm dev` |
| **Disable DEV proxy entirely** | Remove `config/dev-proxy.ts` + the `createDevProxy` import/usage in `vite.config.ts` (see teardown) |

Optional target override (Node env only, never baked into the browser bundle):

```bash
VITE_RPA_DEV_PROXY_TARGET=https://seo-ops.duckdns.org
```

---

## DEV-owned files (safe to delete later)

| File | Role |
| --- | --- |
| `config/dev-proxy.ts` | Proxy map, cookie Secure strip, login HTML absolute-URL rewrite, post-login Location remap |
| `vite.config.ts` | Registers `server.proxy` **only** when `command === 'serve'` |
| `docs/DEV_ENVIRONMENT.md` | This document |
| `.env.example` | Documents `VITE_RPA_DEV_PROXY_TARGET` |

**Do not** put DEV session/cookie logic in `src/features/*`, React components, or production auth. API client stays on **relative** URLs (`src/lib/api/*`).

---

## Staff login via DEV proxy

1. `pnpm dev` (port **5173**, strict).
2. Open `http://localhost:5173/login` (proxied Laravel login HTML).
3. Sign in with a **real** staff account (no fake users, no credential hardcoding).
4. On success, DEV remaps Filament home (`/seo`, `/admin`) → `/social-automation/action-tags`.
5. With `VITE_RPA_API_MODE=live`, Action Tags calls  
   `GET /social-automation/api/action-registry/data` with `credentials: 'include'` → expect **200** JSON when authenticated.
6. Logout via proxied `/logout` (or clear site cookies for `localhost`) → API returns **401**.

Proxied prefixes (no SPA catch-all):

- `/login`, `/logout`
- `/sanctum`
- `/social-automation/api`
- `/social-automation/script-media`

---

## Cookie / CSRF notes (DEV only)

Production cookies: `laravel-session` + `XSRF-TOKEN`; **Secure; SameSite=Lax**; host-only (no Domain).

On HTTP `localhost`, the proxy **strips `Secure`** (and any Domain) so the browser can store cookies for the Vite origin. SameSite=Lax is kept. CSRF is **not** disabled. CORS is **not** widened — the browser sees same-origin requests to `:5173`.

Never log Cookie / Set-Cookie values.

---

## Teardown (remove DEV proxy later)

1. Delete `config/dev-proxy.ts`.
2. In `vite.config.ts`, remove `createDevProxy` import and the `server.proxy` / `command === 'serve'` wiring (restore a plain `defineConfig({...})` if desired; keep `base` / production build options).
3. Optionally drop `VITE_RPA_DEV_PROXY_TARGET` notes from `.env.example` / this doc.
4. No React business logic or Laravel changes required.

---

## Production build isolation check

```bash
# Proxy must not appear in the client bundle
VITE_RPA_API_MODE=live VITE_RPA_ASSET_BASE=/build-rpa-web/ pnpm run build
# Confirm dist JS has no seo-ops.duckdns.org and no DEV proxy strings
```

`vite build` uses `command === 'build'` → **no** `server.proxy` registration.
