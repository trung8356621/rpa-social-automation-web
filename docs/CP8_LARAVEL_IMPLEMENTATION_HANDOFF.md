# CP8 — Laravel Implementation Handoff (Auth Script)

**Date:** 2026-10-28  
**Repo:** `seo-ops-addons-rpa`  
**Status:** Handoff for implementers. **PROPOSED** contracts only until merged/deployed.  
**Authority:** `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md`, `CP7_OWNER_DECISIONS.md` (D1=A, D2 explicit Tag, D3=B, D4=A)  
**Constraint:** Do not implement from this chat in the Web repo. No production migrate without owner approval.

---

## 1. Goal (CP8 slice)

Deliver Laravel SOURCE for WordPress-first Auth Script:

1. `sa_packages.is_authentication`  
2. `sa_action_tags.auth_script_id` + `auth_release_id`  
3. Staff `PUT` Action Tag (attach/clear Auth pin)  
4. Extend staff `GET action-registry/data` (+ optional auth-scripts catalog)  
5. Client `POST .../client/auth-script/resolve`  

**Out of CP8:** Electron execution, React live wire, Browser inventory REST, Checkpoint schema changes, overloading `sa_action_tag_scripts`.

---

## 2. Laravel files likely to change

| Area | Likely path (SOURCE tree) | Change |
| --- | --- | --- |
| Migration | `database/migrations/2026_10_28_*_auth_script_package_and_tag_pin.php` (**new**) | Columns |
| Model | `src/Models/SaPackage.php` | fillable/casts `is_authentication` |
| Model | `src/Models/SaActionTag.php` | auth pin attributes; helpers |
| Model | `src/Models/SaPackageRelease.php` | used for pin validation |
| Controller | `src/Http/Controllers/ActionRegistry/ActionRegistryController.php` | `updateTag`; extend `data` |
| Routes | `src/SocialAutomationServiceProvider.php` | register `PUT tags/{id}`; client resolve |
| Client API | `src/Http/Controllers/RpaClientApiController.php` | `resolveAuthScript` (**new method**) |
| Publish path | `src/Http/Controllers/RpaAdmin/RpaAdminScriptSyncController.php` (+ package services) | accept/persist `is_authentication`; kind consistency |
| UI service (optional) | `src/PackageRegistry/ScriptRegistryUiService.php` | expose flag in Filament list |
| OpenAPI | `openapi/openapi.yaml` | document PROPOSED→implemented paths |
| Tests | `tests/Unit/ActionTagAndManifestContractTest.php` (+ new Auth contract tests) | pin + resolve + fail-closed |
| Filament (optional same CP) | Action Tags page / Livewire | select Auth + release |

**Do not modify** `sa_action_tag_scripts` semantics for Auth.

---

## 3. Proposed migration

```php
// PROPOSED — illustrative; adjust naming/order to addon conventions
Schema::connection('omi_social_automation')->table('sa_packages', function (Blueprint $table): void {
    $table->boolean('is_authentication')->default(false)->after('kind');
    // optional index for catalog:
    // $table->index(['kind', 'is_authentication']);
});

Schema::connection('omi_social_automation')->table('sa_action_tags', function (Blueprint $table): void {
    $table->string('auth_script_id', 128)->nullable()->after('description');
    $table->unsignedBigInteger('auth_release_id')->nullable()->after('auth_script_id');
    $table->index('auth_script_id');
    $table->index('auth_release_id');
});
```

**Backfill:** existing rows → `is_authentication=false`; Tag pins NULL.  
**No cross-DB FKs** (addon convention). Validate release membership in application layer.  
**Rollback:** drop columns in `down()`; ensure OpenAPI/UI tolerate absence during partial deploy.

---

## 4. API request/response examples (**PROPOSED**)

### 4.1 Update Tag — attach pin

```http
PUT /social-automation/api/action-registry/tags/10
Content-Type: application/json
```

```json
{
  "auth_script_id": "wordpress.login",
  "auth_release_id": 42
}
```

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

### 4.2 Update Tag — clear

```json
{ "auth_script_id": null, "auth_release_id": null }
```

### 4.3 `GET /social-automation/api/action-registry/data` (delta)

Existing payload **SOURCE**. Add:

```json
{
  "tags": [
    {
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
  ],
  "auth_scripts": [
    {
      "script_id": "wordpress.login",
      "package_key": "wordpress.login",
      "name": "WordPress Login",
      "is_authentication": true,
      "releases": [
        { "release_id": 42, "version": "1.0.2", "status": "published" }
      ]
    }
  ]
}
```

### 4.4 Client resolve

```http
POST /api/v1/social-automation/client/auth-script/resolve
Authorization: Bearer <client_api_key>
```

```json
{
  "account_id": "acc_wp_01_a1b2c3d4",
  "browser_id": "11111111-2222-3333-4444-555555555555",
  "action_tag_key": "wordpress.wp_admin.login"
}
```

Success with Auth:

```json
{
  "ok": true,
  "auth_required": true,
  "action_tag_key": "wordpress.wp_admin.login",
  "script_id": "wordpress.login",
  "release_id": 42,
  "version": "1.0.2",
  "content_digest": "sha256:abcdef",
  "pull": { "package_key": "wordpress.login", "version": "1.0.2" }
}
```

Fail closed (no Tag context):

```json
{
  "ok": true,
  "auth_required": false,
  "fail_closed": true,
  "reason": "missing_action_tag_context"
}
```

---

## 5. Validation rules (summary)

| Surface | Rules |
| --- | --- |
| Package flag | Boolean; only meaningful for `kind=script` |
| Publish | Must not silently change Auth kind; Auth package releases stay Auth; reject attaching non-Auth as Auth pin |
| Tag update | Both pin fields null **or** both set; release published; release belongs to script; script `is_authentication=true` |
| Resolve | Require Tag context; verify Account (+ browser binding if browser_id sent); return pinned release only; if pin broken → `fail_closed` + reason |
| Forbidden | Platform-only resolve; latest-published fallback; writing Auth into `sa_action_tag_scripts` |

**Suggested error codes:** `auth_pin_incomplete`, `auth_script_not_authentication`, `auth_release_not_published`, `auth_release_mismatch`, `auth_release_unavailable`, `missing_action_tag_context`, `ambiguous_action_tag_context`.

---

## 6. Backward compatibility

| Consumer | Impact |
| --- | --- |
| Existing Action Tags without pins | Unchanged behavior; Auth skipped |
| Existing `sa_action_tag_scripts` | Untouched |
| Existing `GET .../data` clients | Additive fields only — should ignore unknown keys |
| Electron without resolve | Continues manual open; no forced upgrade |
| RPA Admin publish clients | Need optional `is_authentication` field; default false |
| OpenAPI | Update in same PR as routes |

**Feature flag (optional):** config `social_automation.auth_script.enabled` to no-op resolve (`auth_required=false`) during rollout.

---

## 7. Production deployment risks

| Risk | Mitigation |
| --- | --- |
| Migration on `omi_social_automation` | Backup; run on maintenance window; verify connection name |
| Partial deploy (code before migrate) | Guard `Schema::hasColumn` in read paths (pattern already used in ActionRegistryController) |
| Publish registry write failures (historical 503) | Fix/verify before relying on Auth publish |
| Lease migration status still unverified (`02_ADDON_BACKEND.md`) | Do not couple Auth migrate to lease cleanup |
| Wrong pin to production Accounts | Use non-prod / test WordPress account only for E2E |
| Client resolve exposed | Client API Key + lease middleware only; no staff secrets |

---

## 8. Required verification

1. Unit: pin attach/clear/reject incomplete/non-Auth/yanked release.  
2. Unit: resolve with Tag / without Tag / mismatched id+key / broken pin.  
3. Feature: staff session `PUT` + `GET data` shows catalog.  
4. Feature: client key resolve happy path returns digest matching release.  
5. Regression: create/delete Tag; regular script links unchanged.  
6. OpenAPI regenerated/updated; Swagger paths listed.  
7. **No** production login E2E in CP8 — that is CP9 Electron.

---

## 9. Rollback considerations

1. Feature-flag off resolve + hide Update Auth UI.  
2. Revert route registration if needed.  
3. Migration `down()` drops columns only after confirming no critical dependency.  
4. Leave packages `is_authentication` values if column retained; safe default false.  
5. Do not delete script packages as rollback.  
6. Communicate to Electron/Web: treat missing fields as “no Auth”.

---

## 10. Auth families reminder

| Endpoint family | Auth |
| --- | --- |
| `/social-automation/api/action-registry/*` | Staff session |
| `/api/v1/social-automation/client/auth-script/resolve` | Client API Key (+ lease rules as other client routes) |
| `/api/v1/social-automation/rpa-admin/scripts*` | RPA Admin Bearer (publish flag) |

Never put Client API Key in React. Never use staff session for Electron resolve.

---

## 11. Stop / ask owner

- Changing D1–D4  
- Production migrate without backup/approval  
- Adding platform-based resolve “for convenience”  
- Checkpoint schema changes  
- Force Disconnect / Release Lease on staff Web
