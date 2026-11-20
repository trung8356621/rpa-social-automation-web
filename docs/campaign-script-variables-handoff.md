# Handoff — Staff Script Registry variables for Campaign Shortcode Mapping

**Repo (Web):** `rpa-social-automation-web` (DESKTOP)  
**Repo (Addon):** `seo-ops-addons-rpa` (LAPTOP) — do not patch from Desktop  
**Context:** Campaign Shortcode V2 mapping UI needs published Script variables.

## Endpoint

```http
GET /social-automation/api/script-registry/{package_key}
```

Staff Session cookie auth. Path `{package_key}` = Script package identity (e.g. `mayhopphat.create_post`).

## Current response gap (addon `af4a652`)

`ScriptRegistryUiService::scriptDetail` loads `manifest['variables']` into each release.

`StaffScriptRegistryController::mapRelease` then **strips** full rows and projects only:

- `releases[].variable_count`
- `releases[].step_count`
- `releases[].asset_count`

**Missing for Web:** `releases[].variables` (sanitized rows).

Asset paths / `video_demo` path stripping must remain. Variables need a safe projection only.

## What Web needs

For the **exact pinned published release version** selected on Create Campaign:

```json
{
  "releases": [
    {
      "id": 1,
      "version": "1",
      "status": "published",
      "variable_count": 1,
      "variables": [
        {
          "key": "title",
          "type": "string",
          "required": true,
          "label": "Title"
        }
      ]
    }
  ]
}
```

Shape must match what `CampaignScriptVariableSchema::fromManifest` already accepts (`key` | `name`, optional bare string entries). Same source: published release manifest `variables`.

## Web behavior (already shipped)

- Does **not** hardcode WordPress / `title`.
- Preserves `variable_count`; treats omitted `variables` as `null` (not empty list).
- When `variable_count > 0` but `variables` absent → **CONTRACT GAP**, fail-closed.
- Mapping UI stays fail-closed until authoritative schema is available.
- When `variables[]` is projected, extractor aligns with Backend (`key`|`name`, `required` default true).

## Addon change (Laptop)

File: `src/Http/Controllers/ScriptRegistry/StaffScriptRegistryController.php` → `mapRelease`.

Add sanitized `variables` array (key/type/required/label only). Keep stripping internal asset paths.

Update Staff Script Registry contract tests + OpenAPI if documented.

## Acceptance

1. Create Campaign → Script `mayhopphat.create_post` v1 → dropdown shows published variable(s) from API (e.g. `title` when present).
2. `[body]` can bind to that variable.
3. No client-side invented variables.
4. Releases with zero variables still show empty/fail-closed correctly.
