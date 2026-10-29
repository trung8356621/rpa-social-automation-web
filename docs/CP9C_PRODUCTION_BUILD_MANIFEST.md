# CP9C — React Production Build Manifest

**Date:** 2026-10-28  
**Repo:** `rpa-social-automation-web`  
**Build command:**  
`VITE_RPA_API_MODE=live` + `VITE_RPA_ASSET_BASE=/build-rpa-web/` + `pnpm run build`  
**Status:** Local artifacts ready. **Not deployed.**

---

## Target path (confirmed)

| Layer | Path | Evidence |
| --- | --- | --- |
| VPS Laravel app root | `/www/wwwroot/seo-ops-client` | `seo-ops-addons-rpa/scratch/vps-*.sh`, `vps-auth-smoke.php` |
| Laravel public asset dir | `/www/wwwroot/seo-ops-client/public/build-rpa-web/` | `RpaWebSpaBuild::BUILD_DIRECTORY = 'build-rpa-web'` |
| URL prefix | `/build-rpa-web/` | Owner D2 + Vite `base` |

Relative Laravel contract: `public/build-rpa-web/index.html` + `public/build-rpa-web/assets/*`.

Note: addon docs sometimes say host name `omnichannel-client`; **production VPS scripts consistently use `seo-ops-client`**. Use the VPS path above.

---

## Build env used

| Variable | Value |
| --- | --- |
| `VITE_RPA_API_MODE` | `live` |
| `VITE_RPA_ASSET_BASE` | `/build-rpa-web/` |
| `VITE_RPA_API_BASE` | unset / empty (same-origin relative staff API) |

Local `.env.local` remains `mock` for development. Shell/CI env overrides `.env.local` for this production build (Vite: existing env wins).

---

## Verification summary

| Check | Result |
| --- | --- |
| Exactly five React UI routes | PASS — `action-tags`, `scripts`, `accounts`, `clients`, `client-api-keys` (+ index redirect) |
| Hashed JS/CSS | PASS — `index-OEOE0sHf.js`, `index-WlJ7lH4E.css` |
| `dist/index.html` asset prefix | PASS — `/build-rpa-web/assets/...` |
| Relative staff API | PASS — `/social-automation/api/action-registry/...`; baked `getRpaApiBaseUrl` → `""` |
| No localhost API URLs | PASS — only React Router origin fallbacks, not API hosts |
| No `seo-ops.duckdns.org` in bundle | PASS |
| No production secrets / Client API Key material | PASS — mock UI may show `*_MOCK_ONLY_*` placeholder string for Client API Keys mock create only |
| Live mode baked in | PASS — `return \`live\`` |
| No mock fallback in live Action Tags | PASS — source `useActionRegistry` returns live path when mode is live |
| Mock mode still available for DEV | PASS — default / `.env.local` `mock` |
| `pnpm run typecheck` | PASS |
| `pnpm exec oxlint src` | PASS (warnings only; exit 0) |
| `pnpm run build` (prod env) | PASS |

---

## File inventory (SHA-256)

Source tree: local `dist/` → copy into VPS `public/build-rpa-web/`.

| Relative path | Bytes | SHA-256 |
| --- | --- | --- |
| `index.html` | 513 | `f6a3166e96ea63671a6828fbcf2947f1d40e17dbe0d00e0d48037994b790f73c` |
| `favicon.svg` | 214 | `cf29001d9770c8a6d8c8eda4b065471dd1aa6015c240b91332a48fc92cda1c27` |
| `assets/index-OEOE0sHf.js` | 475588 | `98149a58d1959044b752c359ff570f9b99b840d2479886913644bfea3d28e908` |
| `assets/index-WlJ7lH4E.css` | 31077 | `0cee281142d6b3e2fd691047311a971f5ae5830545ebc7aeee22e5c5ecc6abc3` |
| `assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2` | 25960 | `ca157063339ac4ad418f214f3abfed119b0798ab4d377386ce5c9e5a7a435ebd` |
| `assets/inter-cyrillic-wght-normal-DqGufNeO.woff2` | 18748 | `71d5ee93cc1e9f1d520a3a8b66456de18c7879d8df09d57fcd2eaff75fef0075` |
| `assets/inter-greek-ext-wght-normal-DlzME5K_.woff2` | 11232 | `6e9e020a25f9b56d418f2c085b1d3c09725a4da23fe693a5b463064606732190` |
| `assets/inter-greek-wght-normal-CkhJZR-_.woff2` | 18996 | `1be3448e292fbf05ffe176fe1e43f135013d50b1e7d324ad1a558f623d3bb6f6` |
| `assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2` | 85068 | `34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956` |
| `assets/inter-latin-wght-normal-Dx4kXJAl.woff2` | 48256 | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` |
| `assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2` | 10252 | `5c66f9e07e90c6d4ac4922cc68d60de26c17b1858e677fb5e603fce3952b3ff2` |
| `.vite/manifest.json` | 3008 | `c100edbfbf2678f2594b564e548dd3ab85b5ced2e446ab0215e93b960b7e20e3` |

**Required for SPA shell:** `index.html` + `assets/*` (+ `favicon.svg` referenced by HTML).  
`.vite/manifest.json` is optional for current Laravel `RpaWebSpaBuild` (reads `index.html` only) but useful for ops audit.

---

## Static asset deployment instructions (DO NOT RUN until owner approves)

1. Rebuild if `dist/` is stale, with the same env as above.
2. On VPS, optional rollback:  
   `mv /www/wwwroot/seo-ops-client/public/build-rpa-web /www/wwwroot/seo-ops-client/public/build-rpa-web.prev`
3. Create target:  
   `mkdir -p /www/wwwroot/seo-ops-client/public/build-rpa-web`
4. Copy **contents** of local `dist/` into that directory (preserve `assets/` subtree).
5. Confirm:  
   - file exists: `.../public/build-rpa-web/index.html`  
   - hashed assets match checksums above  
   - anonymous GET of a SPA UI path still redirects to `/login` (Laravel)  
   - authenticated staff session loads SPA; JS/CSS under `/build-rpa-web/assets/` return 200
6. Cache guidance: long-cache hashed `/build-rpa-web/assets/*`; **no-cache** `index.html`.
7. Do **not** modify Laravel or Nginx in the asset-copy step (already registered in CP9B).

Rollback: restore `build-rpa-web.prev` → `build-rpa-web`.

---

## Out of scope for CP9C

- No production copy/rsync executed  
- No Laravel / Nginx edits  
- No UI changes  
- No git commit / push  
