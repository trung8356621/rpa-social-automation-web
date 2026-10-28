# WordPress-First Integration Plan (CP7 / CP7.1)

**Date:** 2026-10-28  
**Update:** Checkpoint 7.1 — D1–D4 approved; plan locked to explicit Tag context + pinned release.  
**Status:** Plan only until CP8+ coding under owner approval.  
**Goal:** Minimal end-to-end path for WordPress Auth Script before Checkpoint.  
**Contract:** `docs/AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md`  
**Decisions:** `docs/CP7_OWNER_DECISIONS.md`

## Locked design inputs

| Decision | Implication for plan |
| --- | --- |
| D1=A | Auth on Tag columns; never `sa_action_tag_scripts` |
| D2 explicit Tag | Electron open/resolve **must** pass Action Tag; no platform resolve |
| D3=B | Pin `auth_release_id`; no silent latest |
| D4=A | `is_authentication` on `sa_packages` |

## Priority vs dependency (adjusted)

| Order | Work | Owner repo | Blocks |
| --- | --- | --- | --- |
| 1 | `is_authentication` + publish validation | Laravel (+ Creator checkbox later) | Auth catalog |
| 2 | Tag columns + **Update Tag** + `data`/`auth_scripts` | Laravel | Staff attach |
| 3 | Client **auth-script/resolve** | Laravel | Electron auto Auth |
| 4 | Electron: open with Tag context → resolve → Auth → Checkpoint | Electron | WP E2E |
| 5 | Session/checkpoint reporting (existing confirmLogin) | Electron + Laravel | Operator visibility |
| 6 | React Action Tags live Auth select | React Web | Staff UX (Filament interim OK) |
| 7 | Staff Browser inventory / React Clients | Laravel + React | **Not** blocking WP Auth E2E |
| 8 | Staff Script Registry REST | Laravel + React | Parallel; Admin publish sufficient for WP-first |

---

## End-to-end steps

### Step 1 — Create / publish WordPress Login Auth Script

| | |
| --- | --- |
| **Owner** | Creator + Laravel rpa-admin publish |
| **Existing** | Publish/pull APIs (SOURCE) |
| **Missing** | `is_authentication` on `sa_packages` (PROPOSED); Creator checkbox |
| **Risk** | Historical `503 package_registry_write_failed` |
| **Verification** | Package `is_authentication=true`; published release id known |
| **Stop** | Cannot publish test package |

### Step 2 — Attach Auth Script to WordPress Action Tag

| | |
| --- | --- |
| **Owner** | Laravel Action Registry (+ React/Filament UI) |
| **Existing** | Tag create/delete; `GET .../data` |
| **Missing** | `auth_script_id` + `auth_release_id`; `PUT .../tags/{id}`; catalog |
| **Risk** | Pinning wrong/non-published release |
| **Verification** | `data.tags[].auth_script` shows pinned version |
| **Stop** | CP8 Laravel incomplete |

### Step 3 — Account + explicit Tag context (not Account↔Tag table)

| | |
| --- | --- |
| **Owner** | Electron UX / ops procedure |
| **Existing** | Account CRUD; Browser requires Account ID |
| **Missing** | Client UI to choose Action Tag on Browser Open (or test harness passes Tag) |
| **Risk** | Operators opening Browser without Tag → always manual (by design) |
| **Verification** | Open with Tag key for WordPress login Tag succeeds resolve |
| **Stop** | No way to supply Tag context in Client |

**Note:** No Account↔Tag association API required for WordPress-first under D2.

### Step 4 — Open Browser from Electron

| | |
| --- | --- |
| **Owner** | Electron |
| **Existing** | Client lease, browser-sync, Account bind |
| **Required context** | Account ID + Browser partition + **Action Tag id/key** |
| **Risk** | `422 account_browser_duplicate_on_device` |
| **Verification** | Session bound; Tag context retained for resolve |
| **Stop** | Lease/migration issues on VPS |

### Step 5 — Resolve Auth Script

| | |
| --- | --- |
| **Owner** | Laravel PROPOSED resolve + Electron caller |
| **Existing** | None Auth-specific |
| **Contract** | Pinned release only; fail closed on missing Tag / bad pin |
| **Verification** | Returns `release_id`/`version`/`digest` matching Tag pin |
| **Stop** | Resolve not deployed |

### Step 6 — Execute Auth Script

| | |
| --- | --- |
| **Owner** | Electron |
| **Existing** | Script engine (assumed) |
| **Missing** | Pre-Checkpoint hook; credential mapping audit |
| **Risk** | Secret leakage |
| **Verification** | Runs in correct partition; no secrets in logs/WSS |
| **Stop** | Unsafe credentials handling |

### Step 7 — Existing Checkpoint

| | |
| --- | --- |
| **Owner** | Electron + `session-confirm-login` (SOURCE) |
| **Rule** | Auth finish ≠ PASS |
| **Verification** | Checkpoint independent of Auth exit code |
| **Stop** | Checkpoint path unclear in Client (audit in CP9) |

### Step 8 — Report outcome

| | |
| --- | --- |
| **Owner** | Electron → Laravel |
| **Existing** | Session signal / confirmLogin |
| **Verification** | `verified` / `needs_login` reflects truth |
| **Stop** | None if confirmLogin sufficient |

### Step 9 — Show result in Web Admin

| | |
| --- | --- |
| **Owner** | Filament interim (**recommended**) or React Clients later |
| **Existing** | Filament session_state / signal |
| **Missing** | Staff Browser-first REST (separate track) |
| **Stop** | Do not block WP E2E on React Clients |

---

## Checkpoints

| CP | Focus | Stop before |
| --- | --- | --- |
| **7 / 7.1** | Contract finalization (this doc set) | Coding |
| **CP8** | Laravel: migration + Update Tag + catalog + resolve (non-prod first) | Unapproved production migrate |
| **CP9** | Electron Tag-context open + Auth before Checkpoint (test WP account) | Real user passwords / OTP |
| **CP10** | Staff Browser inventory + React Clients read-only | Force Disconnect inventions |
| **CP11** | Staff Script Registry REST + remaining CRUD | Scope explosion |

Handoffs: `CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md`, `CP8_REACT_INTEGRATION_HANDOFF.md`.

---

## Hard stops

- Secrets in chat → stop.  
- 401/403 → record; no bypass.  
- Platform-only Auth resolve → **rejected** by D2; do not reintroduce.  
- Silent latest Auth upgrade → **rejected** by D3.  
- Do not auto-start CP8 coding without owner go-ahead.
