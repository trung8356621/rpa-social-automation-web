# Checkpoint 7 — Owner Decisions

**Date:** 2026-10-28  
**Update:** 2026-10-28 — Checkpoint 7.1 (Auth Script contract finalization)  
**Rule:** Only decisions that cannot be closed by reading source.  
**Survey:** Laravel `seo-ops-addons-rpa` @ `72b615d` + React mocks + canonical docs.

> **IMPORTANT:** Approved choices below are **DESIGN DECISIONS**. They are **not** existing production fields or APIs until CP8+ implements them. All new fields/endpoints remain labeled **PROPOSED**.

---

## D1 — How to store Action Tag ↔ Authentication Script — **APPROVED: A**

**Question:** Where should the Auth Script link live?

| | |
| --- | --- |
| **Option A** | Nullable FK columns on `sa_action_tags` (`auth_script_id`, optional version/release) |
| **Option B** | New table `sa_action_tag_auth_scripts` (tag_id, script_id, release_id, …) |
| **Option C** | Reuse `sa_action_tag_scripts` with a `role` column (`regular` \| `authentication`) |

**Owner decision:** **A**

- Auth Script reference stored **on Action Tag**.
- At most **one** Auth Script per Tag.
- Do **not** overload regular `sa_action_tag_scripts` relations.

**Consequence:** Requires **PROPOSED** Update Tag API + columns `auth_script_id` + `auth_release_id` (see D3). Regular script links stay unchanged.

---

## D2 — Account with multiple Action Tags: Auth resolve rule — **APPROVED: Explicit Action Tag context**

**Question:** How does Electron pick Auth Script when an Account could map to multiple Tags?

| | |
| --- | --- |
| **Option A** | Explicit `auth_action_tag_id` / primary Tag on Account |
| **Option B** | Platform match: Tags where `site_key == account.platform` and Auth set; fail-closed if ≠1 |
| **Option C** | User selects Tag/context at Browser open (Client UI) |
| **Option D** | Always manual if ambiguous; never auto-pick |

**Owner decision:** **Explicit Action Tag context** (Browser Open / resolve request must carry Action Tag identity).

- **Never** select Auth Script using **platform alone**.
- If context is **missing or ambiguous** → **fail closed** → preserve **manual login**.
- Multiple Tags for one Account are allowed; Auth only runs when Tag context is explicit and valid.

**Consequence:** Electron (and any resolve API) require `action_tag_id` and/or `action_tag_key`. No Account↔Tag table required for WordPress-first. Platform inference is **forbidden**.

---

## D3 — Auth Script identity at attach / execute time — **APPROVED: B**

**Question:** Does the Tag store a floating `script_id` (always latest published) or a pinned release/version?

| | |
| --- | --- |
| **Option A** | Store `script_id` only; resolve latest **published** at Browser open |
| **Option B** | Pin `script_id` + `script_version` / `release_id` on Tag |

**Owner decision:** **B**

- Pin **published** script **release/version** on Tag (`auth_script_id` + `auth_release_id`).
- **No silent upgrade** to latest published when a newer release appears.

**Consequence:** Staff must re-attach / update Tag to change Auth release. Resolve uses pinned release only; if pinned release is unpublished/yanked/missing → fail closed → manual login.

---

## D4 — Where `is_authentication` lives — **APPROVED: A**

**Question:** Package column vs release manifest only?

| | |
| --- | --- |
| **Option A** | Column on `sa_packages` (script kind) + validate on publish |
| **Option B** | Manifest-only boolean inside each release |

**Owner decision:** **A**

- `is_authentication` belongs to **`sa_packages`**.
- Publish validation must preserve **consistent script kind** (Auth package stays Auth; non-Auth stays non-Auth unless explicit controlled change — see contract).

**Consequence:** Migration on `sa_packages` (PROPOSED). Catalog filter is cheap. Manifest may mirror for Creator UX but DB column is source of truth.

**Source note:** Field does **not** exist today (SOURCE absence confirmed in CP7).

---

## D5 — WordPress-first result viewer — open (not blocking Auth contract)

**Question:** Must React Clients be live before WordPress Auth E2E acceptance?

| | |
| --- | --- |
| **Option A** | Accept Filament Sessions / device-group as interim operator view |
| **Option B** | Block WP E2E until staff Browser inventory REST + React Clients read-only live |

**Recommendation:** **A** — Clients inventory is parallel track.  
**Status:** Not re-litigated in CP7.1; Auth contract finalization does not depend on it.

---

## D6 — Authenticated API evidence access — open (ops)

**Question:** How should agents obtain **read-only** authenticated evidence against production OpenAPI/staff APIs?

| | |
| --- | --- |
| **Option A** | Owner-operated session / approved cookie jar / VPN jump host documented offline |
| **Option B** | Dedicated read-only staff service account with documented retrieval process (not pasted in chat) |
| **Option C** | Defer LIVE confirmation; continue SOURCE-only until CP8 coding on non-prod |

**Recommendation:** **C** until CP8 coding; **B** before LIVE_CONFIRMED / React live wiring.  
**Do not:** paste Client API Keys, passwords, or session cookies into chat.

---

## Closed by source (no owner ask)

| Topic | Finding |
| --- | --- |
| Does Update Action Tag exist? | **No** — controller/routes/OpenAPI (SOURCE) |
| Does `is_authentication` exist? | **No** (SOURCE) |
| Is `sa_action_tag_scripts` Auth-specific? | **No** — regular script links only |
| Staff Accounts CRUD? | **Yes** |
| Staff Client Keys list/create/revoke/reveal? | **Yes** |
| Staff Browser-first inventory REST? | **No** — Filament `clientDashboard` only |
| Client Active vs Online? | Domain: key active ≠ lease/heartbeat online |
| Force Disconnect / Release Lease in Web? | Do not invent; client `disconnect` exists for Electron |
| Web vs Realtime repo split? | Follow `docs/README.md` / Reset update over stale `01` wording |

---

## Related CP7.1 docs

- `AUTH_SCRIPT_WORDPRESS_CONTRACT_CP7.md` — finalized PROPOSED data + Browser Open behavior  
- `WORDPRESS_FIRST_INTEGRATION_PLAN_CP7.md` — sequence updated to approved decisions  
- `CP8_LARAVEL_IMPLEMENTATION_HANDOFF.md` — Laravel implementer brief  
- `CP8_REACT_INTEGRATION_HANDOFF.md` — React wire-up brief (still mock until APIs exist)
