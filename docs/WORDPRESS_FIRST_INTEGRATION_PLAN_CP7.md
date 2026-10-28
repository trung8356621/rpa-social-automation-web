# WordPress-First Integration Plan (CP7 / CP7.1 / CP7.2)

**Date:** 2026-10-28  
**Update:** CP7.2 — Security blockers + production checklist; D1–D4 unchanged.  
**Status:** Plan only until owner clears blockers / approves CP8 coding.  
**Contract:** `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md`  
**Laravel:** `CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md`  
**Checklist:** `CP8_PRODUCTION_READINESS_CHECKLIST.md`

## Locked design

D1=A · D2 explicit Tag · D3 pin release · D4 package `is_authentication`  
**Forbidden:** platform Auth selection; trust Client `action_tag_key` alone; 200-camouflage on authz failure; silent latest pull.

## Dependency order (CP7.2)

| Order | Work | Gate |
| --- | --- | --- |
| 1 | Package flag + publish validation | — |
| 2 | Tag pin columns + atomic create/PUT + `data` catalog | Staff can attach |
| 3 | **SB1** Account↔Tag authz (or written SB1-C) | Before prod resolve |
| 4 | Client resolve with HTTP taxonomy | After SB1 policy |
| 5 | **SB2** Client pinned pull (`package_key`+`version`) | Before Electron Auth download |
| 6 | Electron: Tag context → resolve → pull → Auth → Checkpoint | Test WP account only |
| 7 | React Action Tags live pin UX | After staff APIs |
| 8 | Clients inventory | Parallel; not blocking WP Auth |

## Blockers before production Auth resolve

| ID | Summary |
| --- | --- |
| **SB1** | No Account↔Tag in SOURCE |
| **SB2** | No Client API Key package pull (Admin pull-by-version exists) |
| **SB3** | Recommend lease required on resolve/pull |

## Steps (unchanged intent; security-aware)

1. Publish WordPress Auth Script with `is_authentication`  
2. Create/attach Tag pin (atomic preferred)  
3. Supply **explicit Tag** on Browser Open (not Account↔Tag table required for UX if SB1-B intent used)  
4. Open Browser (Account + partition)  
5. Resolve (authz then pin)  
6. Pull **pinned** version  
7. Execute Auth → Checkpoint  
8. Report via existing session confirm  
9. View in Filament interim (D5 recommendation)

## Checkpoints

| CP | Focus |
| --- | --- |
| 7–7.2 | Contracts + security review (**docs done**) |
| **CP8** | Laravel implement per handoff — **non-prod first**; use production checklist |
| **CP9** | Electron E2E (test credentials only) |
| CP10+ | Clients inventory / staff Script Registry |

## Hard stops

Secrets in chat · 401 bypass · changing D1–D4 · claiming resolve production-ready while SB1/SB2 open · auto-start CP8 without owner go-ahead.
