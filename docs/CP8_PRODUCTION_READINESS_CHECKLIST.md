# CP8 — Production Readiness Checklist (Auth Script)

**Date:** 2026-10-28 (CP7.2)  
**Repo:** `seo-ops-addons-rpa` (implement on laptop/VPS)  
**Status:** Documentation only — **no commands executed in CP7.2**.  
**Authority:** `CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md`, `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md`  
**Labels:** Steps are operational guidance. Do not treat this file as proof that production is ready.

> **Gate:** Do **not** claim Auth resolve is production-safe while **SECURITY BLOCKERS** in the Laravel handoff remain open (Account↔Tag authorization; Client pinned-package pull).

---

## BEFORE (VPS / owner)

| # | Check | Evidence to record |
| --- | --- | --- |
| B1 | Git revision of deployed addon matches intended release | `git rev-parse HEAD` / deploy tag |
| B2 | Confirm DB connection name `omi_social_automation` and host | Laravel config / `.env` (do not paste secrets into chat) |
| B3 | Migration status for Social Automation connection | pending vs ran list |
| B4 | Backup DB (at least `sa_packages`, `sa_package_releases`, `sa_action_tags`, related) | backup artifact id/time |
| B5 | Inventory current Tag / package counts (smoke) | row counts |
| B6 | Confirm migrate permission / deploy role | who can run |
| B7 | Maintenance / rollback window agreed | start/end |
| B8 | Feature flag / config default: Auth resolve **disabled** until VERIFY pass | config key |
| B9 | Re-read SECURITY BLOCKERS; owner accepts interim risks or defers prod | written owner note |
| B10 | Non-prod / test WordPress Account only for E2E | account uuid |

---

## IMPLEMENT

| # | Rule |
| --- | --- |
| I1 | Migration **additive** only (`is_authentication` default false; Auth pin nullable) |
| I2 | No destructive rewrite of Tags/scripts |
| I3 | Existing create Tag without Auth fields remains valid |
| I4 | Do not alter `sa_action_tag_scripts` for Auth |
| I5 | Keep existing routes functional (`data`, create/delete Tag, client validate/heartbeat, rpa-admin publish/pull) |
| I6 | Ship code with Auth client resolve behind flag / fail-closed until VERIFY |
| I7 | Update OpenAPI in same change set |
| I8 | No production Auth pin on critical Accounts until VERIFY |

---

## VERIFY (after apply)

| # | Check | Pass criteria |
| --- | --- | --- |
| V1 | Existing Tag create/delete | unchanged behavior |
| V2 | Script Registry / rpa-admin publish | still works |
| V3 | Client validate + heartbeat + lease 409 | unchanged |
| V4 | Staff `GET action-registry/data` | additive fields; old clients ignore unknowns |
| V5 | Auth pin validation | incomplete pair / non-Auth / yanked → 422 |
| V6 | Atomic create+pin / PUT attach / PUT clear | transaction; no orphan pin |
| V7 | Resolve authorization | see handoff matrix — **401/403/409** not masked as manual success |
| V8 | Resolve no-secrets | response has no password/cookies/tokens/raw key |
| V9 | Pinned pull path | Electron can fetch **exact** `package_key`+`version` under approved auth (BLOCKER until Client pull exists) |
| V10 | Schema after migrate | columns present; defaults correct |
| V11 | Feature flag enable on non-prod first | then limited prod |

---

## ROLLBACK

| Preference | Action |
| --- | --- |
| **1st** | Disable feature flag / stop serving resolve + Auth UI; revert application code |
| **2nd** | Leave DB columns in place (nullable / default false) — safe |
| **Avoid** | Blind `down()` drop of populated Auth columns without backup restore plan |
| **Never** | Delete packages/tags/scripts as “rollback” |
| Distinguish | **Code rollback** ≠ **DB rollback**; document which was done |

---

## Explicit non-claims

- This checklist does **not** make LIVE_CONFIRMED evidence.  
- Passing unit tests ≠ production Auth authorization complete.  
- Filament device-group is not React Browser-first contract.
