# CP8 — Laravel Implementation Handoff (Auth Script)

**Date:** 2026-10-28  
**Update:** Checkpoint **7.2** — Security & production readiness (docs final review)  
**Repo:** `seo-ops-addons-rpa` (`main` surveyed @ `72b615d`)  
**Status:** Handoff for laptop implementers. All new fields/endpoints = **PROPOSED** until merged.  
**Authority:** `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md`, `CP7_OWNER_DECISIONS.md` (**D1–D4 locked — do not change**)  
**Checklist:** `CP8_PRODUCTION_READINESS_CHECKLIST.md`

**Do not** implement from the Web repo chat. No production migrate without owner approval.

---

## 0. CP7.2 executive security verdict

| Claim | Status |
| --- | --- |
| Staff Tag Auth pin (create/update/clear) can be designed safely | **PROCEED** with validation rules below |
| Client `auth-script/resolve` is **production-safe as previously sketched** | **NO** — **SECURITY BLOCKERS** remain |
| Endpoint may ship behind flag for non-prod after blockers addressed or owner accepts documented interim | Owner decision |

**Do not claim production readiness** while Account↔Tag authorization and Client pinned-package pull are unresolved.

---

## 1. Goal (CP8 slice)

1. `sa_packages.is_authentication` (**PROPOSED**, D4)  
2. `sa_action_tags.auth_script_id` + `auth_release_id` (**PROPOSED**, D1+D3)  
3. Staff create Tag **with optional Auth pin** (atomic) + `PUT` update/clear pin  
4. Extend `GET action-registry/data` with pin summary + Auth catalog  
5. Client resolve + **authorized** pinned pull path (see blockers)  

**Out of CP8:** Electron execution, React live wire, Browser inventory REST, Checkpoint schema changes, overloading `sa_action_tag_scripts`, platform-based Auth selection (D2).

---

## 2. SOURCE evidence (auth-relevant)

| Topic | Finding | Label |
| --- | --- | --- |
| Client key middleware | `EnsureRpaClientApiKey` — Bearer key; installation scope; **no lease check** | SOURCE_CONFIRMED |
| `authorizedClient()` | Requires key + agent registered by `client_api_key_id`; **no active-lease check** | SOURCE_CONFIRMED |
| Lease enforcement | register / heartbeat → 409 `CLIENT_KEY_IN_USE`; TTL 120s | SOURCE_CONFIRMED |
| Account access for Client | Same `installation_id` as key (`authorizeAccount`, `listBindableAccounts`) | SOURCE_CONFIRMED |
| Browser↔Account↔Agent | `sa_browser_sessions.agent_id` + `account_id`; sync enforces bind | SOURCE_CONFIRMED |
| Account↔Action Tag relation | **None** in migrations/controllers surveyed | SOURCE_CONFIRMED absence → **BLOCKER** |
| Platform matching for Auth | **Forbidden** by D2 | DESIGN |
| RPA Admin pull | `POST .../rpa-admin/scripts/pull` requires `package_key` + `version` (pinned) | SOURCE_CONFIRMED |
| Client package pull | **No** `/client/...` package/script pull route | SOURCE_CONFIRMED absence → **BLOCKER** |
| `content_digest` | On `sa_package_releases`; `PackageDigest` at publish; `findRelease` returns digest | SOURCE_CONFIRMED |
| Electron verifies digest | Not surveyed in this repo | UNKNOWN / gap |
| Create Tag | `storeTag` already **DB transaction** (tag + script request) | SOURCE_CONFIRMED |

---

## 3. SECURITY BLOCKERS

### SB1 — Account ↔ Action Tag authorization (**BLOCKER**)

**Requirement E:** Action Tag context must be **allowed for that Account**.  
**SOURCE:** No Account↔Tag binding table/API.  
**Forbidden workaround:** Platform matching to “infer” permission (violates D2 spirit + owner CP7.2 instruction).

**Minimal binding contract (**PROPOSED** — pick one before prod resolve):**

| Option | Shape | Notes |
| --- | --- | --- |
| **SB1-A** | Table `sa_account_action_tags` (`account_id`, `action_tag_id`, unique pair) staff-managed | Clearest authorization |
| **SB1-B** | Server-issued **Browser Open intent** (short-lived): staff/Electron registers `{browser_id, account_id, action_tag_id}` then resolve only accepts that tuple | Avoids long-lived N–N if UX is open-time select |
| **SB1-C** | Owner **explicit risk acceptance**: any Tag in installation may be resolved for any Account in installation **if** Browser↔Account↔Agent proven — document as interim **not** “secure by design” | Fail closed still on missing browser bind |

Until SB1 resolved: resolve MUST **fail closed** with **403** `account_tag_unauthorized` (or feature disabled), **not** 200 manual-login camouflage.

### SB2 — Client cannot pull pinned release under Client API Key (**BLOCKER**)

**SOURCE:** Pinned pull exists for **RPA Admin Bearer** (`package_key` + `version`).  
**Missing:** Client-auth download of Auth script package/assets.

**PROPOSED:** `POST /api/v1/social-automation/client/scripts/pull` (or GET) with body `{ package_key, version }`, Client API Key + same authz as resolve (only after resolve authorized that pin). Return same shape as Admin `findRelease` / pull (`content_digest`, manifest, assets completeness).  
**Do not** give Client unbounded catalog of all packages.

### SB3 — Lease not enforced on all client routes (**HARDENING**)

**SOURCE:** `authorizedClient` does not verify `connection_token` / lease expiry.  
**PROPOSED for resolve + client pull:** require valid active lease (token header/body consistent with heartbeat) or documented owner waiver. Prefer **409/401** when lease invalid.

---

## 4. Client Auth resolve — security contract (**PROPOSED**)

```http
POST /api/v1/social-automation/client/auth-script/resolve
Authorization: Bearer <client_api_key>
```

### 4.1 Mandatory checks (ordered)

| # | Check | Fail |
| --- | --- | --- |
| A | Valid Client API Key (`EnsureRpaClientApiKey`) | **401** |
| B | Active lease if required by CP8 policy (PROPOSED strengthen) | **401/409** |
| C | Agent registered for `client_api_key_id` | **404** `client_not_registered` |
| D | Account in key’s `installation_id` | **403** `installation_forbidden` / `account_forbidden` |
| E | `browser_id` belongs to **this agent** AND `account_id` matches session bind | **403** `browser_binding_mismatch` |
| F | Action Tag loaded **server-side** by `action_tag_id` (preferred) or key→id lookup; **never** trust client-supplied pin fields | **404/422** |
| G | SB1 binding: Tag allowed for Account | **403** `account_tag_unauthorized` |
| H | If pin null → business “no auth” | **200** `auth_required=false`, `reason=no_auth_script_configured` |
| I | Package `is_authentication=true`, kind script | **422/403** `auth_script_not_authentication` |
| J | `auth_release_id` exists, `status=published`, belongs to package of `auth_script_id` | **422** `auth_release_*` |
| K | Ambiguous Tag context (id/key conflict / missing) | **422** `missing_action_tag_context` / `ambiguous_action_tag_context` |

**Never:** authorize solely because Client sent `action_tag_key`.  
**Never:** return password, cookies, session tokens, raw Client API Key, or decrypted secrets in resolve body.  
**Never:** map authorization failures to **200** + `auth_required=false` (that disguises denial as manual-login success).

### 4.2 Response taxonomy

| Situation | HTTP | Body intent |
| --- | --- | --- |
| No Auth configured (pin null) after authz OK | **200** | `ok`, `auth_required=false`, `reason=no_auth_script_configured` |
| Missing Tag context | **422** | `ok:false`, `error=missing_action_tag_context` |
| Ambiguous Tag context | **422** | `ok:false`, `error=ambiguous_action_tag_context` |
| Unauthorized binding (account/browser/tag/lease/key) | **401/403/409** | `ok:false`, specific `error` |
| Invalid / yanked / mismatched release | **422** | `ok:false`, `error=auth_release_*` |
| Backend fault | **500** | `ok:false`, `error=internal` (no stack/secrets) |
| Success with pin | **200** | `auth_required=true` + pinned pull coordinates |

### 4.3 Success body (**PROPOSED** — identifiers from SOURCE conventions)

Use existing registry identities — **do not invent new id types**:

| Field | SOURCE basis |
| --- | --- |
| `script_id` | Manifest `script_id` or `package_key` (ScriptRegistryUiService / publish) |
| `package_key` | `sa_packages.package_key` |
| `release_id` | `sa_package_releases.id` (pin column) |
| `version` | `sa_package_releases.version` string |
| `content_digest` | `sa_package_releases.content_digest` (sha256 hex) |
| `status` | release status (`published`) |

```json
{
  "ok": true,
  "auth_required": true,
  "action_tag_id": 10,
  "action_tag_key": "wordpress.wp_admin.login",
  "script_id": "wordpress.login",
  "package_key": "wordpress.login",
  "release_id": 42,
  "version": "1.0.2",
  "content_digest": "a".repeat ? "64-hex-from-db" : "…",
  "pull": {
    "package_key": "wordpress.login",
    "version": "1.0.2"
  }
}
```

Electron must pull **exactly** `pull.package_key` + `pull.version`. **No latest fallback.**

### 4.4 Integrity

| Layer | Status |
| --- | --- |
| Publish-time digest | SOURCE `PackageDigest` |
| Resolve returns `content_digest` | PROPOSED |
| Client verifies digest vs bytes | UNKNOWN — Electron audit required; **do not claim integrity guaranteed** until verified |
| Asset sha256 in manifest | SOURCE pattern in Admin pull `assets_complete` |

---

## 5. Staff Create Tag + Auth pin

### 5.1 Atomic create (**PROPOSED** — preferred)

Extend existing `POST /social-automation/api/action-registry/tags` inside the **same transaction** as today’s tag + script request create (**SOURCE** already transactional):

1. Validate site/path/action (existing).  
2. If Auth fields present → validate pin pair + Auth package + published release membership.  
3. Create Tag **including** pin columns.  
4. Create script request (existing).  
5. Commit.

**Request (**PROPOSED** additive — backward compatible):**

```json
{
  "site_id": 1,
  "path_id": 2,
  "action_key": "login",
  "auth_script_id": "wordpress.login",
  "auth_release_id": 42
}
```

Omit both Auth fields **or** send both null → identical to today’s create (**SOURCE** behavior preserved).

**Response 200/201 (**PROPOSED**):** existing `tag` + `request`, plus `tag.auth_script` summary when pinned.

### 5.2 Fallback create → PUT (only if atomic unsafe)

If implementer cannot extend create safely: create Tag without pin, then `PUT` pin.  
**Partial failure:** Tag exists without Auth — operator must retry PUT; return explicit warning in create response if pin was requested but deferred. Prefer atomic.

### 5.3 Update / clear / read

| Op | Method | Path | Body |
| --- | --- | --- | --- |
| Attach/replace pin | PUT (**PROPOSED**) | `/social-automation/api/action-registry/tags/{id}` | both ids set |
| Clear pin | PUT | same | both null |
| Read summary | GET | `/social-automation/api/action-registry/data` (**SOURCE** + PROPOSED fields) | `tags[].auth_script` |

### 5.4 Validation (create + PUT)

- `auth_script_id` + `auth_release_id` same-null or same-set.  
- Release belongs to package identified by script/package key.  
- `is_authentication=true`.  
- `status=published` only.  
- No silent latest.  
- No writes to `sa_action_tag_scripts` for Auth.

---

## 6. Files likely to change

| Area | Path | Change |
| --- | --- | --- |
| Migration | `database/migrations/*_auth_script_*.php` | columns |
| Models | `SaPackage`, `SaActionTag`, `SaPackageRelease` | casts/helpers |
| Action registry | `ActionRegistryController` | create pin + `updateTag` + `data` |
| Service provider | `SocialAutomationServiceProvider` | PUT + client resolve (+ client pull) |
| Client API | `RpaClientApiController` | resolve (+ pull); authz helpers |
| Optional binding | new model/migration if SB1-A/B | Account↔Tag or open intent |
| Publish | `RpaAdminScriptSyncController` / `PackageRegistryService` | `is_authentication` |
| OpenAPI | `openapi/openapi.yaml` | document |
| Tests | new Auth security contract tests | authz matrix + pin + no-secret |

---

## 7. Migration (**PROPOSED** additive)

```php
// sa_packages.is_authentication boolean default false
// sa_action_tags.auth_script_id string(128) nullable
// sa_action_tags.auth_release_id unsignedBigInteger nullable
// optional SB1 table — only if owner picks SB1-A
```

Safe defaults; nullable pins; no destructive rewrite. See production checklist for BEFORE/VERIFY/ROLLBACK.

**Rollback preference:** disable feature + revert code; avoid dropping populated columns blindly.

---

## 8. Backward compatibility

| Case | Behavior |
| --- | --- |
| Create Tag without Auth fields | Unchanged |
| Tags with null pins | Resolve → 200 no auth (after authz) |
| `sa_action_tag_scripts` | Untouched |
| Admin pull by version | Remains source of truth for Creator; Client needs SB2 |
| Old `GET data` clients | Ignore additive keys |

---

## 9. Verification / tests (minimum)

1. Pin validation unit matrix.  
2. Create without Auth; create with Auth atomic; PUT clear.  
3. Resolve: 401 no key; 403 wrong installation account; 403 browser mismatch; 403 SB1; 422 missing tag; 200 no pin; 200 pinned; **never** 200 on 403 cases.  
4. Response redaction: no password fields.  
5. Regression: heartbeat lease 409; Tag delete with regular scripts.  
6. OpenAPI updated.

---

## 10. Production risks (short)

- Shipping resolve before SB1/SB2 → Clients can over-fetch Auth manifests or call resolve without Tag entitlement.  
- Partial migrate without `hasColumn` guards.  
- Historical publish `503 package_registry_write_failed`.  
- Coupling Auth migrate to unrelated lease cleanup.

Full checklist: `CP8_PRODUCTION_READINESS_CHECKLIST.md`.

---

## 11. Owner decisions still required (security)

| ID | Question |
| --- | --- |
| **SB1** | Choose SB1-A / SB1-B / SB1-C (risk acceptance) before prod resolve |
| **SB2** | Approve Client pinned pull endpoint shape |
| **SB3** | Require active lease on resolve/pull? (recommended: yes) |
| **D5/D6** | Interim Filament viewer; LIVE evidence path (unchanged) |

**D1–D4 remain locked.**
