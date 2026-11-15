# C34 P345 — secure NPC Profile/creator-backstory recovery plan and inactive source capsule

**Date:** 2026-11-14. **Status:** SOURCE PRESERVED / RUNTIME AND RELEASE HOLD. The plan is for DNDNext's Next.js **Pages Router + Bootstrap/SCSS**. It is **not** a Supabase migration, a production release, a merge, a change to the world map, or a claim that the current host implements #345. Full source lineage and original changed-file ledger: [C34 preservation audit](C34_HELD_PR324_PR345_UI_SOURCE_PRESERVATION_2026-11-14.md).

## Pinned references, actual current work and evidence

| Source | Immutable inspected SHA | Meaning |
|---|---|---|
| [held original #345](https://github.com/bob8675309/DNDNEXT/pull/345) | `4f5f8ff7587aff1a68f21581ad68a4752789f54a` | Full integrated centered NPC Profile, three coordinated SQL candidates, privacy/creator Story signed tests, browser/print/rollback evidence, **27 CI workflows SUCCESS** at this exact source head |
| [held original #324](https://github.com/bob8675309/DNDNEXT/pull/324) | `f1a2c564046ab93a0bfa0732e3acc2179da9c064` | Immutable Forge/creator and historical negative/test/agent source; stacked on #323, not an independent frontend migration |
| current inspected `main` | `6637b14f807ebec79542deb7eef4b2bc3abfb5fd` | Existing active pre-cutover client, not the original #345 server-safe reader |
| C34 T18 signed executable | `f687879871ecb684cf3a3f98e991b956ef04fea5` | [genuine local PG17/GoTrue #43621097008](https://github.com/bob8675309/DNDNEXT/actions/runs/43621097008), seven workflows green, **29/31 original DDL** limited to its actual fixture |
| C34 P345 preservation source base | `c7994f53f0fbe1ab605a1ec49f043b7d43b9caa4` | Previous #324/#345 full-tree comparison |
| C34 exact four-file inactive capsule | `d39f5401ae75776e02038fd58636760666cc43c8` | Copy of four byte-identical #345 Git blobs, unreferenced by the application |
| C34 pinned static/negative tests | `74423edf541db2c8545218199bdbbb336a1e9f9d` | Inactive gate plus three source tests; exact-head full signed CI must be checked independently |

All source files for the inactive capsule live under `scripts/integration/c34/preserved/held345/`; the active `components`, `pages`, `styles`, `utils`, town and map sources are deliberately **unchanged**. The original files remain on #345 itself. A matched Git blob checksum means **identical original bytes**, not that the component has been ported or tested in the current app.

## Four original files: source identity, exact consumer and disposition

| Original path | Original Git blob SHA | Real held #345 consumer | Disposition in #379 |
|---|---|---|---|
| `components/GlobalNpcProfileOverlay.js` | `a0e133a7c2446cba3f8c672a1df78f6a5aa73763` | `pages/_app.js` renders one shared dialog outside page routes; dynamically mounts `components/character/CharacterInteractionPanel.js`, which renders `NpcPanel.js` | **exact_copy** as inactive archive; runtime consumer **deferred_preserved** |
| `utils/npcProfileOverlay.js` | `3d809c47a9aaae18d0e7e5ec6500199a9266baac` | `pages/inventory.js` invokes the UUID-validated event for both character owner headings/links; shared overlay subscribes | **exact_copy** inactive; inventory event/entry **deferred_preserved** |
| `components/CreatorBackstoryPanel.js` | `23b0e86aab7a80b7243365ba107c1d37a5ec5812` | `components/NpcPanel.js` mounts the creator-private editor only inside Profile, using server capability and RLS-locked `character_backstory_secrets` | **exact_copy** inactive; active panel/RLS capability **deferred_preserved** |
| `styles/npc-profile-centered.css` | `150eb9ad78aeba268be955e63c8451e3c0ed0e14` | `pages/_app.js` globally imports CSS; selectors cover map's existing Bootstrap offcanvas, town and global Profile with responsive/focus-safe layout | **exact_copy** inactive; **NOT** imported because map selectors are owner-protected |

Original #345 source verifies the overlay reads only `PROFILE_COLUMNS`, ignores invented event Admin claims, uses signed `is_admin` lookup, discards stale in-flight requests, clears privileged React state synchronously on genuine SIGNED_OUT or account switch, closes on route change, restores focus and traps Tab/Escape. **That safety depends on the nested server-safe `NpcPanel`**: mounting the original overlay with current main's direct raw `characters` read and `loadCharacterSecrets` is not an acceptable preservation successor. The creator panel's `can_edit_creator_backstory_v1` RPC is permission reporting only: the private table's RLS is final authority, not the React `authorized` state.

### Twelve additional #345 application consumer differences — all unresolved until role/browser evidence

`components/MapPageClient.js`, `components/NewNpcModalV3.js`, `components/NewNpcModalV3Refined.js`, `components/NpcForgeStepContent.js`, `components/NpcPanel.js`, `components/PlayerCharacterProfilePanelUnified.js`, `components/town/TownCrafterInteractionPanel.js`, `pages/_app.js`, `pages/inventory.js`, `pages/npcs.js`, `pages/town/[id].js`, `utils/officialCharacterSheetPdf.js`. A different Git blob is a **review obligation**, not proof of beneficial or harmful behavior. The original #345 `pages/town/[id].js` has explicit logout cleanup and focus trapping absent from the inspected main; likewise original inventory clears stale Admin state on logout. Restore those behaviors only in a separately signed browser-tested patch, not by wholesale file replacement. **Never touch `MapPageClient.js` or import CSS affecting its offcanvas before explicit owner map discussion.**

## Mandatory coupled SQL and frontend dependency graph

**Stage 1, original candidate:** `sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql`. Tightens raw `character_sheets.sheet` SELECT to genuine editors/GM, introduces allowlisted `get_npc_profile_visible_v1`, and sanitizes `get_my_player_characters_v2` SECDEF player-inventory/convert serializers. Visible NPC/merchant Profile is **not** permission to read arbitrary canonical Sheet/GM narratives.

**Stage 2, original candidate:** `sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql`. Revokes direct authenticated SELECT on five GM-private narrative columns **for the role, including Admin clients**; introduces Admin-authenticated `get_npc_dossier_admin_v1` and current-`can_edit` but non-GM `get_character_editor_narrative_v1`. Cannot deploy without auditing `pages/npcs.js`, `PlayerCharacterProfilePanelUnified.js`, printing, merchants and all direct character queries. An unrelated `can_inventory`/`can_convert` permission is not `can_edit`.

**Stage 3, original candidate:** `sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql`. Creates transaction-bound immutable original creator provenance, a source-original BEFORE INSERT guard preventing player-supplied GM-only `characters.secret`, private author backstory table/RLS and `can_edit_creator_backstory_v1`, safe GM clue separation, hardened legacy secret RPCs and atomic `create_player_character_with_private_backstory_v1`. Creator + **current can_edit** or signed GM are authorized; other co-editors are not. Seven historical GM-secret texts were to stay untouched, with **no guessed or automatic migration**. Original #345 stage1/2/3 are research SQL candidates; this plan neither confirms nor performs hosted installation. Verify live schema/readiness separately before proposing production cutover.

**Source status on #379:** all three original SQL candidates are already archived with Git-blob guards in C34's original source custody, and T18 has proven a narrower 29/31 original trigger fixture. That does **not** prove these three privacy candidates co-reside with every T18 trigger, option/currency, NPC Profile and live role consumer; especially do not miscount stage3 held creator/GM hooks as originals among the 31.

## Implementation sequence; no premature frontend commit

**Gate A — complete source/consumer inventory, still read-only.** Diff each of the 16 runtime files in held #345 against pinned `main` and #379; record old/new endpoint, direct table columns, edit capability, focus/state events, inventory/print outputs and all error branches. Check 56 absent #345 research/tests and 22 absent #324 paths individually before retirement. Keep source originals/negative evidence. The 4-file capsule and fail-closed check can be accepted independently because nothing is mounted.

**Gate B — local privacy authority first, using production-original bodies only.** On disposable PG17 + real local GoTrue/PostgREST, apply original stage1–3 as a **single preflighted transaction** alongside original source v2/v3, Option A canonically scoped character sheet, progression, inventory CHECK/RLS and T18's co-resident 29/31 non-map originals. Preserve exact original source hashes and RED/rollback tests, test genuine six-plus roles, report any genuine source conflict. Do not fake missing SQL, weaken constraints, enable a test-only Admin RPC in production, or write hosted Supabase. Independent world-map triggers remain owner-protected.

**Gate C — coordinated UI source port only on held research branch.** With signed local SQL green, port the original `NpcPanel` allowlisted Profile + GM dossier, editor-gated canonical sheet and private creator panel *together* with `GlobalNpcProfileOverlay`, `utils/npcProfileOverlay`, `pages/_app`, `pages/inventory`, `pages/npcs` and the full creator Forge input/Story serialization. Preserve original entire component and its negative browser cases. The town/merchant Profile-first focus/logout changes are a separately reviewed compatible slice. Do not import world-map centered CSS or change world-map offcanvas until the owner approves that specific presentation. No partial UI with old raw secret loader.

**Gate D — real full-application acceptance.** Reuse untouched held #345 original signed matrix `scripts/test_p1_3_npc_profile_safe_local_auth.mjs` (V00–V24) and `scripts/test_c33_forge_privacy_original_local_auth.mjs` (C3J, C3I, C3S, creator), original Chromium `scripts/browser/verify_c33_creator_backstory_dom.mjs` (C3B00–07, C3P), actual Next `scripts/browser/verify_c33_next_town_route.mjs` (C3T01–05 and C3I00–05), and late-failure rollback `scripts/browser/verify_c33_privacy_stage_abort_pg17.mjs` (C3R). Re-run `scripts/validate_centered_npc_profile_entrypoints.mjs`, `scripts/validate_npc_private_profile_cutover.mjs`, `scripts/validate_npc_profile_consumer_acl.mjs`, `scripts/validate_npc_secure_centered_integration.mjs`, Next production build and role-aware official PDF tests. Restore missing tests **as preserved source**, not superficially similar replacements.

**Required behavioral cases (not satisfied by this archive):**

| Actor/transition | Safe Profile and private Story requirement |
|---|---|
| Anonymous, outsider, inventory-only, convert-only | Public/revealed NPC/merchant identity/lore only; no raw Sheet, GM dossier, printed private sheet or creator Story |
| Original signed creator with current editor rights | Can edit own private backstory via RLS, regular Sheet if permitted, never write/read GM-only `characters.secret` |
| Co-editor with `can_edit` but not original creator | May access authorized canonical Sheet/Print; **must not** read/edit private creator backstory or GM-only dossier |
| GM/Admin | Signed Admin dossier, secret and explicit reveal/print behavior; cannot rely on direct private columns after stage2 REVOKE |
| Revoked creator/editor and changed character selection | Old capability immediately revoked, stale private text, in-flight requests, cached form and PDF path cleared |
| Signed OUT or user A→B switch, including pending RPC | Global/town Profile closes; old GM details, Admin controls and inventory state disappear before next authenticated read |
| Merchant/town/inventory routes | Profile-first, wares via Profile then return, no secret field in public roster; old map/merchant sprites untouched |
| Genuine same nonce/concurrent creation | One creator, Story, permissions, canonical Sheets and inventory; changed-Story/forged-identity and forbidden GM secret abort atomically |

## Rollback / production release gate

No release until a separately owner-approved **single coordinated migration/UI cutover**, exact-head green CI, full original user-role browser/consumer acceptance, source-priority catalog and legacy account-writer coverage, no protected world-map regression, and independently encrypted full PostgreSQL + **all 340 Storage-object bytes** restored to an isolated target with a rehearsed rollback. Deployment order, ACL grant reversal, RLS policy restoration, correct original source hashes, legacy SECRETS untouched and Vercel main automatic deploy must be in the owner-signed go/no-go record. Branch history, historic red tests and archived source remain preserved even if research is rolled back. This dossier does not authorize a merge, Supabase/Vercel mutation or retirement of any of the 44 open / 80 closed-unmerged historical PR candidates.

## Current boundary and **ONE NEXT TASK**

**Current executable success:** local-only T18 Forge/Warlock 29/31, all seven exact-head checks; original #345 standalone 27 check workflows green **at its own head**, not integrated to #379. Four missing UI sources archived verbatim and now pinned/inactive with negative static guards. **No original #345 browser test has been rerun on #379's mounted application** because it has deliberately not been mounted.

**Next one bounded task:** design and execute the **disposable-only** combined C34 T18 + original #345 privacy stage1/2/3 source-compatibility RED/GREEN and signed role matrix, taking original #345 failing legacy readers/GM secret as RED without exposing hosted records. A successful source-only plan is not a license to mount Profile components or change world map, town, production SQL or main.
