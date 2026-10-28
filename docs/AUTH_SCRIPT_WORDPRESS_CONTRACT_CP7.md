# Authentication Script — WordPress Contract (CP7 / CP7.1 / CP7.2)

**Date:** 2026-10-28  
**Updates:** CP7.1 D1–D4 approved design · **CP7.2 security & production readiness**  
**Status:** **PROPOSED** contract. **Not implemented.** Not production-safe until SECURITY BLOCKERS cleared.  
**Business source:** `docs/RPA_CLIENT_AUTH_SCRIPT_WORDPRESS_FIRST_TEST_2026-10-28.md`  
**Decisions:** `docs/CP7_OWNER_DECISIONS.md` (D1–D4 **locked**)  
**Handoffs:** `CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md`, `CP8_REACT_INTEGRATION_HANDOFF.md`, `CP8_PRODUCTION_READINESS_CHECKLIST.md`  
**Code survey:** `seo-ops-addons-rpa` @ `72b615d` (SOURCE). Live Auth **not** exercised.

## Goal (approved business)

When Electron opens a Browser for an Account **with explicit Action Tag context**:

1. **Authorize** Client ↔ Browser ↔ Account ↔ Tag (see security)  
2. Resolve **pinned** Authentication Script release on that Tag (if configured)  
3. Download **pinned** release (not latest)  
4. Execute Auth Script in the same Browser / Account / Chromium partition  
5. Run **existing Checkpoint** (no new Checkpoint flags)  
6. Checkpoint — not “script finished” — decides login success  

If no Auth configured (after successful authz): manual login.  
If authz fails: **HTTP error** — not fake manual-success.

**Out of scope:** Login Strategy module; Campaign/Task/Workflow; Browser inventory REST; changing D1–D4.

---

## Approved design decisions (locked)

| ID | Decision |
| --- | --- |
| **D1=A** | Auth refs on Action Tag columns; ≤1 Auth Script per Tag; do not overload `sa_action_tag_scripts` |
| **D2** | Explicit Action Tag context only; never platform-alone selection |
| **D3=B** | Pin published release (`auth_script_id` + `auth_release_id`); no silent latest |
| **D4=A** | `is_authentication` on `sa_packages`; publish keeps consistent kind |

---

## CP7.2 security summary

| Item | Label |
| --- | --- |
| Browser↔Account↔Agent binding | SOURCE_CONFIRMED (`sa_browser_sessions`) |
| Account access by Client | SOURCE_CONFIRMED — **installation_id** scope only |
| Account↔Tag allowlist | **MISSING** → **SECURITY BLOCKER (SB1)** |
| Client pinned package pull | **MISSING** (Admin pull by version exists) → **BLOCKER (SB2)** |
| Lease on every client route | SOURCE: not in `authorizedClient` → harden resolve (**SB3**) |
| Trust Client `action_tag_key` alone for Auth access | **FORBIDDEN** |
| Platform matching for Auth selection/authz | **FORBIDDEN** |
| Secrets in resolve response | **FORBIDDEN** |
| Disguise 403 as 200 manual login | **FORBIDDEN** |

**Verdict:** Staff pin APIs can proceed with validation. Client resolve is **not** production-ready until SB1/SB2 addressed (or owner accepts SB1-C risk in writing).

---

## 1. PROPOSED data fields

### 1.1 `sa_packages.is_authentication` (**PROPOSED**)

| Item | Spec |
| --- | --- |
| Column | `is_authentication` boolean NOT NULL DEFAULT `false` |
| Applies | `kind = 'script'` |
| Catalog | Auth option ⇒ flag true + ≥1 published release |
| Publish | Keep Auth kind consistent (D4) |
| SOURCE | **Absent** |

### 1.2 Action Tag Auth columns (**PROPOSED**)

| Column | Type | Meaning |
| --- | --- | --- |
| `auth_script_id` | string(128) NULL | Script/package identity (align with registry `script_id` / `package_key` conventions — SOURCE) |
| `auth_release_id` | unsignedBigInteger NULL | Pin to `sa_package_releases.id` |

**Invariants:** both null XOR both set; release must belong to package; published + `is_authentication`; never write Auth into `sa_action_tag_scripts`.

### 1.3 Identities for download (SOURCE — do not invent types)

| Identity | SOURCE |
| --- | --- |
| `package_key` | `sa_packages.package_key` |
| `script_id` | manifest `script_id` or fallback `package_key` |
| `release_id` | `sa_package_releases.id` |
| `version` | `sa_package_releases.version` (string) |
| `content_digest` | `sa_package_releases.content_digest` (sha256 hex; `PackageDigest`) |

Admin pull (**SOURCE**): `POST /api/v1/social-automation/rpa-admin/scripts/pull` with **`package_key` + `version`** (pinned — not latest-only).  
Client equivalent: **PROPOSED** (SB2) — required for Electron under Client API Key.

Integrity: publish digest SOURCE; Electron verify = **UNKNOWN** until Client audit — do not claim guaranteed.

---

## 2. Staff API — Create / Update / Clear / Read (**PROPOSED** where noted)

### 2.1 Create Tag + Auth pin (atomic — preferred)

**Endpoint SOURCE:** `POST /social-automation/api/action-registry/tags`  
**Auth:** Staff session  

Extend existing transactional `storeTag` (**SOURCE** already uses DB transaction):

**Request (**PROPOSED** additive, backward compatible):**

```json
{
  "site_id": 1,
  "path_id": 2,
  "action_key": "login",
  "auth_script_id": "wordpress.login",
  "auth_release_id": 42
}
```

Omit Auth fields → behavior identical to today.

**Response (**PROPOSED**):** existing `tag` + `request`; include `auth_script` summary when pinned.

**Fallback:** create without pin then PUT — document partial failure if pin step fails.

### 2.2 Update / clear pin

```http
PUT /social-automation/api/action-registry/tags/{id}
```

Attach: both fields set · Clear: both null.

### 2.3 GET Tag / registry data

**SOURCE:** `GET /social-automation/api/action-registry/data`  
**PROPOSED add:** `tags[].auth_script`, `auth_scripts[]` catalog (published releases listed explicitly).

### 2.4 Validation

Incomplete pair → 422 · non-Auth script → 422 · unpublished/mismatched release → 422 · no silent latest · no regular-script-table Auth rows.

---

## 3. Client Auth resolve (**PROPOSED** — security-hardened)

```http
POST /api/v1/social-automation/client/auth-script/resolve
```

### Authorization (must all pass before business “no auth”)

1. Valid Client API Key (**SOURCE** middleware).  
2. Active lease (**PROPOSED** harden — SB3).  
3. Agent for `client_api_key_id`.  
4. Account in installation (**SOURCE** pattern).  
5. Browser on this agent and bound to Account (**SOURCE** sessions).  
6. Load Tag **server-side** by id (preferred) or key→id; **ignore** any client-supplied pin/script fields.  
7. **SB1** Account↔Tag entitlement — else **403**.  
8. Then read pin from DB.

### HTTP taxonomy (CP7.2 correction)

| Case | HTTP | Notes |
| --- | --- | --- |
| No pin after authz OK | **200** | `auth_required=false`, `reason=no_auth_script_configured` — true manual path |
| Missing / ambiguous Tag context | **422** | Not 200 |
| Unauthorized binding | **401/403/409** | Not 200 |
| Invalid release / not Auth package | **422** | Not 200 |
| Backend error | **500** | No secrets |
| Success | **200** | `auth_required=true` + pinned `package_key`/`version`/`release_id`/`content_digest` |

Manual Browser Open **without** Tag: Client **must not** call resolve for Auth, or call is rejected with 422 missing context — operator stays on manual Checkpoint path locally.

---

## 4. Browser Open behavior

```
Account ID + browser_id/partition + explicit Action Tag context
  → Authorize (SB1 required for prod)
  → Resolve pin from DB
       ├─ null pin → MANUAL → Checkpoint
       ├─ bad pin → 422/fail → MANUAL (after operator handles error) → Checkpoint
       └─ good pin → Client pull pinned version (SB2) → Run Auth → Checkpoint
```

| Scenario | Behavior |
| --- | --- |
| Manual open without Tag | Allowed; skip Auth |
| Multiple Tags / Account | Only explicit Tag; never platform pick |
| Removed/unpublished pin | Fail validation; re-pin in staff UI; manual meantime |
| Missing credentials | Keep Browser; no Checkpoint PASS from Auth |
| Auth execution failure | Keep Browser; manual; Checkpoint not auto-PASS |
| Checkpoint failure | Existing taxonomy |
| Authz failure | HTTP error — do not pretend manual success |

---

## 5. SECURITY BLOCKERS (owner before prod)

| ID | Issue | Minimal options |
| --- | --- | --- |
| **SB1** | No Account↔Tag authz in SOURCE | A binding table · B open-intent ticket · C written risk acceptance (installation-wide Tag use if browser bind OK) |
| **SB2** | No Client pinned pull | PROPOSED client scripts/pull by `package_key`+`version` after resolve authz |
| **SB3** | Lease optional on client helpers | Require lease on resolve/pull |

---

## 6. Handoffs

- Laravel: `CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md`  
- React: `CP8_REACT_INTEGRATION_HANDOFF.md`  
- VPS checklist: `CP8_PRODUCTION_READINESS_CHECKLIST.md`  
- Plan: `WORDPRESS_FIRST_INTEGRATION_PLAN_CP7.md`
