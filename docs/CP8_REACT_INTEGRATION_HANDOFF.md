# CP8 — React Integration Handoff (Auth Script / Action Tags)

**Date:** 2026-10-28  
**Repo:** `rpa-social-automation-web`  
**Status:** Wire-up brief for **after** Laravel CP8 APIs exist. **No React code in CP7.1.**  
**Authority:** `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md`, `CP7_OWNER_DECISIONS.md`  
**UI lock:** Action Tags route only for Auth attach; do not expand menus.

---

## 1. Scope for React (post-CP8 API)

| In scope | Out of scope / later |
| --- | --- |
| Action Tags: load `auth_script` + `auth_scripts` from live `GET .../data` | Script Registry live `is_authentication` badge (needs staff scripts REST) |
| Action Tags: Update Tag Auth pin via **PROPOSED** `PUT .../tags/{id}` | Clients Browser inventory live |
| Loading / empty / error for Auth catalog | Electron resolve UI |
| Keep demo query / mock fallback until live proven | Client API Key usage in browser |

---

## 2. Existing mock fields (SOURCE in this repo)

| File | Field | Classification |
| --- | --- | --- |
| `src/features/action-tags/types.ts` | `AuthScriptOption.script_id`, `name`, `version`, `status`, `is_authentication` | MOCK / anticipates PROPOSED |
| | `compatible_site_keys` | MOCK-only filter; **deferred** on backend |
| | `ActionTagItem.auth_script` `{ script_id, name, version }` | MOCK — extend with `release_id` |
| | `ActionRegistryData.auth_scripts` | MOCK catalog |
| `use-action-registry-mock.ts` | Local create/update Auth; notes missing backend update | MOCK |
| `AddTagDrawer.tsx` | `auth_script_id` in submit payload | MOCK — must send **`auth_release_id`** when live (D3) |
| `script-registry/types.ts` | `is_authentication?` | MOCK; staff scripts API still MISSING |

---

## 3. Proposed backend field mapping

### 3.1 Tag row

| React (target) | Backend PROPOSED | Notes |
| --- | --- | --- |
| `tag.auth_script` | `tags[].auth_script` | null if unset |
| `auth_script.script_id` | `auth_script.script_id` | maps from `auth_script_id` |
| `auth_script.release_id` | `auth_script.release_id` | **required for pin UX** (add to types when wiring) |
| `auth_script.version` | `auth_script.version` | display |
| `auth_script.name` | `auth_script.name` | display |
| `auth_script.status` | `auth_script.status` | `published` \| `unavailable` \| … |

### 3.2 Catalog

| React | Backend PROPOSED |
| --- | --- |
| `auth_scripts[].script_id` | same |
| `auth_scripts[].name` | same |
| `auth_scripts[].is_authentication` | always true in catalog |
| `auth_scripts[].version` (mock single) | Prefer `releases[]` with `release_id`+`version`; UI must pick a **release** to pin |
| `compatible_site_keys` | **Remain MOCK / omit** until backend ships field |

### 3.3 Update mutation

| Mock today | Live PROPOSED |
| --- | --- |
| `{ auth_script_id }` only | `{ auth_script_id, auth_release_id }` both set or both null |
| Local state merge | `PUT /social-automation/api/action-registry/tags/{id}` staff session |

**UI change when wiring:** Auth select = script **and** published release (two-step or grouped select). Mock single-version shortcut is insufficient under D3.

---

## 4. API client boundaries

| Concern | Rule |
| --- | --- |
| Auth | SEO-OPS **staff session** (+ CSRF on mutate) — same as future Accounts/Keys live |
| Base path | `/social-automation/api/action-registry/...` |
| Forbidden | Client API Key in React; calling `/api/v1/social-automation/client/*` |
| Forbidden | RPA Admin Bearer for staff Action Tags page |
| Transport | Shared fetch/api helper (create when first live route wires); keep feature hooks thin |
| OpenAPI | Treat repo/live OpenAPI as contract after CP8 merge; do not invent paths |

**Existing SOURCE staff GETs (for later menus, not Auth-specific):** accounts, client-keys, action-registry data/sites/paths/tags create/delete.

---

## 5. Loading / empty / error behavior

| State | Behavior |
| --- | --- |
| Loading | Keep existing Action Tags loading demo / skeleton; disable Auth select |
| Empty Auth catalog | Select shows “Không có Auth Script published”; allow clear/null; do not fake options |
| Empty Tags | Existing empty-tags scenario |
| Error load `data` | Existing error demo / toast; no silent mock fallback once live mode on |
| Update 422 pin errors | Show server message / code (`auth_release_not_published`, etc.) |
| Update network fail | Toast; leave drawer open; do not claim saved |
| Pin `status=unavailable` | Show warning on row; force re-select before save |

Preserve query-driven demos (`?demo=`) for local UI without login until owner enables live mode.

---

## 6. Mock-to-live transition

1. **Gate:** Laravel CP8 verified (unit + staff session smoke) + owner approval for React live read (and mutate).  
2. Add API module for action-registry; map DTOs including `release_id`.  
3. Feature flag / env: `VITE_RPA_API_MODE=mock|live` (or project-equivalent) — default mock.  
4. Live read `GET .../data` first; keep Auth update mock until PUT proven.  
5. Enable live PUT Auth pin on non-prod installation only.  
6. Remove or quarantine Auth-only mock seeds once live catalog trusted.  
7. Do **not** auto-wire Script Registry / Clients in the same pass.

---

## 7. Features that must remain MOCK (until their contracts exist)

| Feature | Why |
| --- | --- |
| Clients Browser inventory grid | Staff Browser-first REST MISSING |
| Client API Keys lease/heartbeat badges | Not on keys index JSON |
| Script Registry `video_url` / `thumbnail_url` presentation | Media-by-id; no CDN assumption |
| Script Registry full staff list/remove | Staff scripts REST MISSING |
| `compatible_site_keys` catalog filter | Backend field not approved/implemented |
| Force Disconnect / Release Lease / Execute from Web | No contract |
| Electron Auth resolve UX | Client app, not React Web |
| Any Client password / raw key display | Forbidden in Web |

Action Tags Auth select may go live **only** for fields backed by CP8 APIs; keep MOCK label on deferred pieces (compatibility keys).

---

## 8. Acceptance for React Auth wire (later checkpoint)

- Live `data` shows pinned Auth version on WordPress Tag.  
- Staff can attach/clear pin; incomplete pair rejected.  
- Catalog lists only Auth packages with published releases.  
- Mock mode still works offline for UI QA.  
- No Client API Key in bundle/network from Web.  
- Visual QA per `rpa-visual-qa` after layout-touching changes.

---

## 9. Stop / ask

- Wiring React before Laravel PUT/data/catalog exist  
- Sending only `auth_script_id` without `auth_release_id`  
- Platform-based Auth filtering presented as backend truth  
- Expanding to Clients/Scripts live in same PR without owner scope
