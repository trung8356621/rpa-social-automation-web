# Authentication Script — WordPress Contract (CP7 / CP7.1)

**Date:** 2026-10-28  
**Update:** Checkpoint 7.1 — Owner D1–D4 **APPROVED** (design only).  
**Status:** Finalized **PROPOSED** contract. **Not implemented.** Not production fields/APIs.  
**Business source:** `docs/RPA_CLIENT_AUTH_SCRIPT_WORDPRESS_FIRST_TEST_2026-10-28.md`  
**Decisions:** `docs/CP7_OWNER_DECISIONS.md`  
**Code survey:** `seo-ops-addons-rpa` @ `72b615d` (SOURCE). Live Auth endpoints not exercised.

## Goal (approved business)

When Electron opens a Browser for an Account **with explicit Action Tag context**:

1. Resolve **pinned** Authentication Script release on that Tag (if configured)  
2. Execute Auth Script in the same Browser / Account / Chromium partition  
3. Run **existing Checkpoint** (no new Checkpoint flags)  
4. Checkpoint — not “script finished” — decides login success  

If no Auth Script / context missing / resolve fail-closed: keep **manual login**.

**Out of scope:** Login Strategy module; Campaign/Task/Workflow; inventing staff Browser inventory; production credential tests in docs phase.

---

## Approved design decisions (summary)

| ID | Decision |
| --- | --- |
| **D1=A** | Auth refs on Action Tag columns; ≤1 Auth Script per Tag; do not overload `sa_action_tag_scripts` |
| **D2** | Explicit Action Tag context only; never platform-alone; missing/ambiguous → fail closed → manual |
| **D3=B** | Pin published release on Tag (`auth_script_id` + `auth_release_id`); no silent latest upgrade |
| **D4=A** | `is_authentication` on `sa_packages`; publish keeps consistent script kind |

---

## 1. PROPOSED data fields

### 1.1 `sa_packages.is_authentication` (**PROPOSED**)

| Item | Spec |
| --- | --- |
| Column | `is_authentication` boolean NOT NULL DEFAULT `false` |
| Applies to | Rows with `kind = 'script'` (Auth catalog ignores non-script kinds) |
| Source of truth | Package column — not manifest-only |
| Catalog rule | Selectable Auth option ⇒ `is_authentication = true` AND has a **published** release that matches attach rules |
| Publish validation | New releases for an Auth package must remain Auth; flipping `is_authentication` is a controlled package update (staff/Admin), not a silent side effect of publish |
| Existing SOURCE | **Absent** — migration required |

### 1.2 Action Tag Auth columns (**PROPOSED**)

On `sa_action_tags` (D1+D3):

| Column | Type | Meaning |
| --- | --- | --- |
| `auth_script_id` | string(128) NULL | Package/script identity (`script_id` / package_key convention used by registry) |
| `auth_release_id` | unsignedBigInteger NULL | FK-like to `sa_package_releases.id` — **pinned** published release |

**Invariants (PROPOSED):**

1. Both NULL = no Auth Script (manual path).  
2. Both non-NULL = Auth configured; release must belong to package identified by `auth_script_id`, `is_authentication=true`, `status=published` at attach time.  
3. Partial pair (one NULL) = **invalid** — reject on write.  
4. Clearing Auth = set both NULL.  
5. Changing Auth = set both to new pair (no orphan release id).  
6. **Never** write Auth into `sa_action_tag_scripts`.

Optional denormalized display (not required for resolve): `auth_script_version` string mirrored from release — may be returned in API without storing if join is cheap.

### 1.3 Regular vs Auth relations

| Relation | Table | Purpose |
| --- | --- | --- |
| Regular Tag↔Script | `sa_action_tag_scripts` (SOURCE) | Implements Action Tag behavior |
| Auth Tag↔Script | Columns on `sa_action_tags` (**PROPOSED**) | Pre-Checkpoint login prep only |

---

## 2. PROPOSED staff API — Action Tag update

**Today (SOURCE):** POST create tag, DELETE tag, POST script request — **no update**.

### 2.1 Update Tag (**PROPOSED**)

```http
PUT /social-automation/api/action-registry/tags/{id}
```

**Auth:** Staff Web Session (same family as existing action-registry routes).  
**Not** Client API Key. **Not** RPA Admin Bearer unless separately documented later.

**Request body (PROPOSED):**

```json
{
  "auth_script_id": "wordpress.login",
  "auth_release_id": 42
}
```

Clear Auth:

```json
{
  "auth_script_id": null,
  "auth_release_id": null
}
```

**Validation (PROPOSED):**

| Rule | Error intent |
| --- | --- |
| Tag exists in installation scope | 404 |
| Pair both null or both set | 422 `auth_pin_incomplete` |
| Package exists, `kind=script`, `is_authentication=true` | 422 `auth_script_not_authentication` |
| Release exists, belongs to that script/package, `status=published` | 422 `auth_release_not_published` / `auth_release_mismatch` |
| Optional CP7.1+: release not tombstoned | 422 `auth_release_unavailable` |
| WordPress-first: do not require `compatible_site_keys` until that field is implemented | — |

**Response 200 (PROPOSED):**

```json
{
  "ok": true,
  "tag": {
    "id": 10,
    "tag_key": "wordpress.wp_admin.login",
    "auth_script": {
      "script_id": "wordpress.login",
      "release_id": 42,
      "version": "1.0.2",
      "name": "WordPress Login",
      "status": "published"
    }
  }
}
```

**Note:** Extending update to rename/description is out of Auth-minimal scope unless already needed; Auth attach is the CP8 priority.

### 2.2 Extended `GET .../action-registry/data` (**PROPOSED**)

Existing endpoint **SOURCE**: `GET /social-automation/api/action-registry/data`.

**Add (PROPOSED):**

- `tags[].auth_script`: `null` or `{ script_id, release_id, version, name, status }`  
- `auth_scripts`: Authentication Script **catalog** array (see §3)

If pinned release later becomes unavailable, still return stored ids with `status: "unavailable"` (or omit selectable flag) so UI can show broken pin without inventing a new Tag row.

---

## 3. PROPOSED Authentication Script catalog

**Purpose:** Staff Action Tags selectbox (React) / Filament parity.

**Shape (PROPOSED)** — aligns with React mock `AuthScriptOption`, extended for pin:

```json
{
  "script_id": "wordpress.login",
  "package_key": "wordpress.login",
  "name": "WordPress Login",
  "is_authentication": true,
  "releases": [
    {
      "release_id": 42,
      "version": "1.0.2",
      "status": "published"
    }
  ]
}
```

**Catalog inclusion (PROPOSED):**

- `sa_packages.is_authentication = true`
- `kind = script`
- At least one `published` release (list those releases only for attach)
- Yanked/draft releases may appear disabled or be omitted — **attach only published**

**Optional later:** `compatible_site_keys` — React mock only today; **not** required for CP8 WordPress-first if operator picks Tag+release consciously. Mark PROPOSED/deferred.

**Dedicated list endpoint (optional PROPOSED):**

```http
GET /social-automation/api/action-registry/auth-scripts
```

May be embedded in `data` only for minimal CP8 — either is fine; do not invent Client-key access to staff catalog.

---

## 4. PROPOSED Electron Auth resolution

### 4.1 Resolve request (**PROPOSED**)

Client API Key auth (Electron family — not staff session).

```http
POST /api/v1/social-automation/client/auth-script/resolve
```

```json
{
  "account_id": "acc_wp_01_a1b2c3d4",
  "browser_id": "brw-uuid-or-session-uuid",
  "action_tag_id": 10,
  "action_tag_key": "wordpress.wp_admin.login"
}
```

**Rules:**

- `account_id` required (Account business identity — uuid or numeric id: implementer must match existing client account id convention; prefer same as bindable accounts).  
- `browser_id` required when Browser already exists; may be optional only if open+resolve is atomic in Client (Electron concern).  
- **Action Tag context required:** at least one of `action_tag_id` / `action_tag_key`. If both sent, they must refer to the same Tag.  
- **Forbidden:** resolve by `platform` alone.

### 4.2 Resolve responses (**PROPOSED**)

**Configured + valid pin:**

```json
{
  "ok": true,
  "auth_required": true,
  "action_tag_key": "wordpress.wp_admin.login",
  "script_id": "wordpress.login",
  "release_id": 42,
  "version": "1.0.2",
  "content_digest": "sha256:…",
  "pull": { "package_key": "wordpress.login", "version": "1.0.2" }
}
```

**No Auth on Tag (both pins null):**

```json
{
  "ok": true,
  "auth_required": false,
  "reason": "no_auth_script_configured"
}
```

**Fail closed (manual login):**

```json
{
  "ok": true,
  "auth_required": false,
  "fail_closed": true,
  "reason": "missing_action_tag_context"
}
```

Other `reason` values (**PROPOSED**): `ambiguous_action_tag_context`, `auth_release_unavailable`, `auth_script_not_authentication`, `tag_not_found`, `account_not_found`, `browser_account_mismatch`.

HTTP 4xx reserved for auth/lease/validation hard failures (invalid key, 409 lease, malformed body). Prefer `ok:true` + `fail_closed` for business skip-to-manual so Electron can proceed without treating as transport error.

---

## 5. Browser Open behavior (normative for CP9 Electron)

```
Open Browser
  · Account identity = Account ID (required)
  · Chromium partition / browser_id = session identity for that Account binding
  · Explicit Action Tag context supplied by operator/job UI
        │
        ├─ missing/ambiguous Tag context → fail closed → MANUAL LOGIN → Checkpoint
        │
        └─ Tag context present
              → Resolve pinned Auth (auth_script_id + auth_release_id)
                    │
                    ├─ none configured → MANUAL LOGIN → Checkpoint
                    ├─ pin invalid/unpublished/missing → fail closed → MANUAL LOGIN → Checkpoint
                    └─ pin valid → Execute Auth Script (same partition)
                                      → Existing Checkpoint
                                      → Report session/checkpoint outcome
```

### Identities

| Concept | Rule |
| --- | --- |
| Account | Account ID / `account_uuid` — never Username as key |
| Browser / partition | `browser_id` (= `session_uuid` in Laravel SOURCE); isolated per Account |
| Action Tag context | Explicit `action_tag_id` and/or `action_tag_key` on open/resolve |
| Auth release | Pinned `auth_release_id` only — no latest published fetch |

### Auth execution vs Checkpoint

- Auth Script uses same DOM/coords engine as normal scripts.  
- Auth completion ≠ login success.  
- Checkpoint unchanged — no new flags.  
- Use existing credential path (`GET .../client/accounts/{id}/password` SOURCE) — never embed secrets in script/WSS/logs/screenshots.

---

## 6. Clarified scenarios

| Scenario | Behavior |
| --- | --- |
| **Manual Browser Open without Action Tag** | Allowed. Skip Auth resolve. Manual login → Checkpoint. |
| **Browser Open with Tag but Auth columns null** | `auth_required=false`. Manual → Checkpoint. |
| **Multiple Tags for one Account** | Allowed. Auth runs only for the **explicit** Tag context on that open. Never pick among Tags by platform. |
| **Ambiguous Tag context** (none / conflicting id+key) | Fail closed → manual → Checkpoint. Surface reason to operator. |
| **Removed / unpublished / yanked pinned release** | Fail closed → manual → Checkpoint. Staff UI should show pin unavailable; operator re-pins via Update Tag. |
| **Package no longer `is_authentication`** | Treat pin invalid → fail closed → manual. |
| **Missing credentials** | Do not invent password. Auth Script fails or cannot start → keep Browser open → manual → Checkpoint not PASS from Auth. |
| **Auth execution failure / timeout** | Report error; **keep Browser**; allow manual; **do not** Checkpoint PASS. Then still run Checkpoint / manual verification as today. |
| **Checkpoint failure after Auth** | Existing taxonomy (`needs_login` / candidate / etc.). Auth must not override. |
| **Checkpoint success after Auth** | Normal verified path. |
| **Silent upgrade to newer published Auth** | **Forbidden** (D3). |

---

## 7. SOURCE vs PROPOSED checklist

| Item | Status |
| --- | --- |
| `GET/POST/PUT/DELETE` action-registry sites/paths/tags (create/delete) | SOURCE (no tag update) |
| `is_authentication` column | **PROPOSED** |
| `auth_script_id` / `auth_release_id` | **PROPOSED** |
| `PUT .../tags/{id}` | **PROPOSED** |
| `auth_scripts` in `data` | **PROPOSED** (React MOCK today) |
| Client `auth-script/resolve` | **PROPOSED** |
| Client account password fetch | SOURCE (Electron only) |
| `session-confirm-login` | SOURCE (Checkpoint-adjacent) |
| Overload `sa_action_tag_scripts` for Auth | **Rejected** (D1) |

---

## 8. Handoffs

- Laravel CP8: `docs/CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md`  
- React (post-API): `docs/CP8_REACT_INTEGRATION_HANDOFF.md`  
- Sequence: `docs/WORDPRESS_FIRST_INTEGRATION_PLAN_CP7.md`
