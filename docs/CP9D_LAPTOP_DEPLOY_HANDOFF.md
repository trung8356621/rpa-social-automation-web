# CP9D — Laptop Deploy Handoff (Desktop blocked)

**Date:** 2026-10-28  
**Desktop agent status:** **STOPPED** — no authorized VPS SSH identity on this machine.  
**Production:** `https://seo-ops.duckdns.org`  
**Target:** `/www/wwwroot/seo-ops-client/public/build-rpa-web/`

---

## Why desktop stopped

| Check | Result |
| --- | --- |
| Git `ssh.exe` present | Yes (`C:\Program Files\Git\usr\bin\ssh.exe`) |
| BatchMode SSH to `seo-ops.duckdns.org` | **Permission denied (publickey,password)** |
| `~/.ssh` private keys | **None** (only Cursor-ish config stubs) |
| Invent / try unrelated keys | **Forbidden** by CP9D rules |

Do **not** paste passwords into chat. Use the laptop’s existing authorized SSH key / known deploy path.

---

## Prepared artifacts (desktop)

| Path | Purpose |
| --- | --- |
| `dist/` | Verified production build (live + `/build-rpa-web/`) |
| `deploy-artifacts/cp9d/dist-mirror/` | Same tree, ready to `scp -r` |
| `deploy-artifacts/cp9d/build-rpa-web.zip` | Zip of `dist/*` |
| `deploy-artifacts/cp9d/SHA256SUMS.txt` | Per-file SHA-256 + sizes |
| `docs/CP9C_PRODUCTION_BUILD_MANIFEST.md` | Canonical checksum table |

**Source revision (git HEAD, local):** `5ee9dd81c4c45f55e081efeffbaa470bcaf0abae`  
Note: working tree also has uncommitted CP9A.3 Vite/env docs; **bundle content** matches CP9C hashes.

**Build env:**

```bash
VITE_RPA_API_MODE=live
VITE_RPA_ASSET_BASE=/build-rpa-web/
# VITE_RPA_API_BASE unset
pnpm run typecheck && pnpm exec oxlint src && pnpm run build
```

Precheck on desktop: typecheck PASS · oxlint warnings-only PASS · build PASS · CP9C checksums MATCH · no source maps · no secrets / no Client API Key material · mode baked `live` · API base empty.

---

## Pre-deploy production probes (anonymous, from desktop)

| Path | Observed |
| --- | --- |
| Five SPA UI routes | **302 → `/login`** |
| `/social-automation/api/action-registry/data` (Accept JSON) | **401** |
| `/build-rpa-web/*` assets | **404** (not deployed yet) |
| `/login` | **200** |
| `/seo`, `/admin` | **302 → `/login`** |

---

## Laptop procedure (execute with authorized SSH)

### 1) Precheck on VPS

```bash
ssh <authorized-host> '
set -euo pipefail
test -d /www/wwwroot/seo-ops-client/public
df -h /www/wwwroot/seo-ops-client/public
ls -la /www/wwwroot/seo-ops-client/public/build-rpa-web 2>/dev/null || echo "build-rpa-web: absent (first deploy OK)"
# Nginx vhost path may vary — locate without guessing ownership:
nginx -T 2>/dev/null | grep -n "seo-ops\|build-rpa-web\|social-automation/action-tags" | head -80
'
```

### 2) Backup

```bash
ssh <authorized-host> '
set -euo pipefail
STAMP=$(date +%Y%m%d%H%M%S)
BK=/root/backups/cp9d-$STAMP
mkdir -p "$BK"
# Backup Nginx vhost(s) that mention seo-ops / social-automation
nginx -T > "$BK/nginx-T-before.txt"
# Copy active conf files if known, e.g.:
# cp -a /www/server/panel/vhost/nginx/*.conf "$BK/" 2>/dev/null || true
if [ -d /www/wwwroot/seo-ops-client/public/build-rpa-web ]; then
  cp -a /www/wwwroot/seo-ops-client/public/build-rpa-web "$BK/build-rpa-web.prev"
  (cd "$BK/build-rpa-web.prev" && find . -type f -print0 | sort -z | xargs -0 sha256sum) > "$BK/build-rpa-web.prev.sha256"
fi
echo "BACKUP=$BK"
'
```

Verify restore path exists: `test -d "$BK"`.

### 3) Nginx — protect `/build-rpa-web/index.html` only

Five SPA routes already hit Laravel. Do **not** add SPA catch-all.

Goal: direct `GET /build-rpa-web/index.html` must **not** bypass staff auth.

Minimal pattern (adjust to actual vhost; validate before reload):

```nginx
# Hashed static assets — public OK (no secrets in bundle)
location ^~ /build-rpa-web/assets/ {
    alias /www/wwwroot/seo-ops-client/public/build-rpa-web/assets/;
    access_log off;
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# Deny/redirect bare index so HTML is only served via Laravel SPA routes
location = /build-rpa-web/index.html {
    return 302 /login;
    # Alternative if owner prefers 403: return 403;
}
```

Then:

```bash
nginx -t && systemctl reload nginx   # or aaPanel equivalent
# If nginx -t fails: restore conf from backup and STOP
```

If current Nginx already forces index through Laravel and hashed assets 404 only because missing files, **asset deploy alone may be enough** — still verify anonymous `GET /build-rpa-web/index.html` after deploy.

### 4) Staged upload + promote

From laptop (paths relative to this repo):

```bash
# Upload zip or mirror
scp deploy-artifacts/cp9d/build-rpa-web.zip <authorized-host>:/tmp/build-rpa-web-cp9d.zip
scp deploy-artifacts/cp9d/SHA256SUMS.txt <authorized-host>:/tmp/build-rpa-web-SHA256SUMS.txt

ssh <authorized-host> '
set -euo pipefail
STAGE=/tmp/build-rpa-web-stage-$$
rm -rf "$STAGE"
mkdir -p "$STAGE"
cd "$STAGE"
unzip -q /tmp/build-rpa-web-cp9d.zip
# Verify critical files
sha256sum -c <<EOF
f6a3166e96ea63671a6828fbcf2947f1d40e17dbe0d00e0d48037994b790f73c  index.html
cf29001d9770c8a6d8c8eda4b065471dd1aa6015c240b91332a48fc92cda1c27  favicon.svg
98149a58d1959044b752c359ff570f9b99b840d2479886913644bfea3d28e908  assets/index-OEOE0sHf.js
0cee281142d6b3e2fd691047311a971f5ae5830545ebc7aeee22e5c5ecc6abc3  assets/index-WlJ7lH4E.css
EOF
# Promote atomically-ish
TARGET=/www/wwwroot/seo-ops-client/public/build-rpa-web
if [ -d "$TARGET" ]; then
  mv "$TARGET" "${TARGET}.prev-$(date +%Y%m%d%H%M%S)"
fi
mkdir -p "$TARGET"
cp -a "$STAGE"/. "$TARGET"/
chown -R www:www "$TARGET" 2>/dev/null || chown -R www:www "$TARGET"
ls -la "$TARGET" "$TARGET/assets" | head
'
```

On checksum failure: **do not promote**; restore previous dir; STOP.

No Laravel edits · no DB migrate · no PHP-FPM restart.

### 5) Smoke (must observe)

**A. Anonymous** — five UI routes → `/login`  
**B. Assets** — hashed JS/CSS/fonts **200** + correct MIME  
**C. Staff session** — open `/social-automation/action-tags` → App Shell (no login bypass)  
**D. LIVE GET** — authenticated `GET .../action-registry/data` → **200** (do not claim PASS without observing it)  
**E. Deep-link refresh** on all five routes  
**F. Regression** — `/seo`, `/admin`, `/login`, staff APIs, Filament Action Tags

### 6) Rollback

```bash
# restore assets
mv /www/wwwroot/seo-ops-client/public/build-rpa-web /www/wwwroot/seo-ops-client/public/build-rpa-web.bad
mv /www/wwwroot/seo-ops-client/public/build-rpa-web.prev-STAMP /www/wwwroot/seo-ops-client/public/build-rpa-web
# restore nginx from $BK, nginx -t, reload
```

---

## Report fields for laptop agent

DONE · SOURCE_REVISION · DEPLOYED_ASSETS · CHECKSUMS · NGINX_STATUS · ANONYMOUS_ACCESS · STAFF_SESSION · LIVE_GET_RESULT · DEEP_LINKS · REGRESSION · BLOCKERS · NEXT · **PRODUCTION_UI_PASS | PARTIAL | BLOCKED**
