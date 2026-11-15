# C34 T23 — NPC and merchant manager non-map roster/privacy boundary (research only)

Date: 2026-11-14. Draft [#379](https://github.com/bob8675309/DNDNEXT/pull/379). **HOLD — not deployed, not mounted, not release-authorized.**

## Baseline examined

- Main/current C34 `pages/npcs.js` exact blob `7fc00b9b3ace6233d1648a3d017f8a05e072d722`.
- Held original #345 `pages/npcs.js` exact blob `2e08fa07384958478f323516c4e1b342228bd436`, commit `4f5f8ff7587aff1a68f21581ad68a4752789f54a`.
- Already-green T21 unmounted safe reader `utils/c34/readNonMapNpcProfileCandidate.mjs` and T22 unmounted Bootstrap/Next Chromium shell remain untouched.

## Source-level findings

1. Current `loadNpcs` selects `background,motivation,quirk,mannerism,voice` and calls `loadCharacterSecrets` for **every NPC**; `loadMerchantProfiles` repeats both patterns for **every merchant**. This creates a privacy release incompatibility when original stage2 column SELECT ACLs are applied, and needlessly requests all GM-private records.
2. Current `charPerm` is accepted without binding rights to a character or current actor. Its loader requests only `can_inventory,can_edit,can_convert`; old granted rights could be rendered on a newly selected character before a new permission query finishes.
3. Held #345 removes both bulk private roster readers; loads only the selected GM dossier through `get_npc_dossier_admin_v1` or editor narrative through `get_character_editor_narrative_v1`; joins `charPerm.character_id` to `selected.id`, and gates narrative edits on selection-bound private response. Stage2 SQL enforces the editor/GM authorization server-side. **However, held #345 display grant binding does not additionally check actor ID**; T23 research helper tests both.
4. Existing selection logic guards sheet/notes/equipment asynchronous responses with request keys and deadlines. Preserve it. The narrative state also needs explicit synchronously-cleared current-character AND current-actor ownership when switching selection/logout; do not assume the held implementation's `useEffect` cleanup alone prevents one render of stale private content.
5. The manager's print/profile/save consumers need selection-bound data. The original official PDF utility trusts its supplied `profile` data and can render `secret` if the UI passes it. No untrusted sheet/background/secret may be forwarded to print. Preserve real 3-page PDF, merchant storefront, `/npcs?focus=npc:<id>`, NPC inventory flows and admin notifications.
6. Original stage2 SQL revokes five character narrative column SELECT rights from **all authenticated users**, including GMs; do not apply until *all* mounted direct-read consumers are cut over as one coordinated release. Original `get_npc_dossier_admin_v1` and `get_character_editor_narrative_v1` cannot be treated as deployed: they exist only in disposable research and held SQL.

## Actual T23 branch change

- Add **unmounted only** `utils/c34/nonMapNpcManagerCandidate.mjs` with public NPC/merchant roster allowlist, actor+character-bound permission display guard, request-identity stale response guard, and separate editor-narrative allowlist.
- Add `scripts/integration/c34/test_t23_nonmap_npc_manager_candidate.mjs`, six cases: NPC roster private removal; merchant private removal; account+character permission gating; stale selected/account response rejection; editor GM-secret exclusion; active-route non-import guard.
- Add a single `node --test scripts/integration/c34/test_t23_nonmap_npc_manager_candidate.mjs` command to the existing C34 source validation step. Retain all signed T1–T22 checks unchanged.

**These are client-side, synthetic, static/unit guards only.** They do not prove original database security by themselves, and this helper does not change an active route. GitHub CI on the new exact HEAD must be checked independently; do not call these tests green based on their presence.

## Non-map mounted cutover plan — still not authorized

1. Source-lock active `pages/npcs.js` and inspect account/session lifecycle and all NPC + merchant data consumer edges. Decide how to share T21 reader results between selected narrative, Profile and canonical Sheet without raw fallback.
2. In a disposable Next.js current-app probe only, replace bulk roster selection with original #345 public basic fields; selected GM dossier/editor narrative from original stage2 via actor- and character-bound guards; no bulk secrets. Clear previous private dossier/draft/permissions synchronously before any new selection or actor render.
3. Validate current app under signed local Auth/PG17/Chromium: GM NPC + merchant; selected editor; inventory-only, convert-only and outsider; revoked permissions mid-session; rapid switch while a dossier request is in flight; signout/signin with different user; anonymous; stale raw caches; profile/real storefront/real 3-page PDF content positive and negative; /npcs focus link; no requests to hosted Supabase.
4. Verify original stage1–3 SQL + stage4 inventory RLS + production schema dependencies, all mounted consumers (especially shared map-connected NpcPanel, which must remain untouched until separately approved), prior T1–T22 signed regressions, both protected original map triggers, backup/restore and full owner release gate before merging any active route.
5. No main merge, production SQL, deployment, PR close, branch deletion, world-map edit or paid agent activation without separate approval.

## Release blockers carried forward unchanged

22/34 original Option A legacy account-sheet writer paths; original class/species/Warlock and tactical catalog/security acceptance; original feature/source disposition across all 44 open and 80 closed-unmerged PRs; independent encrypted PostgreSQL 17 restore plus all 340 Storage object bytes; staged migration/rollback; signed full mounted browser acceptance and explicit owner go/no-go.
