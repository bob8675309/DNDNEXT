# P1.3 — Server-safe NPC Profile, full-sheet RLS and limited character reader (2026-11-04)

> **Unmerged research candidate, NOT a shippable security fix. No live Supabase writes, grants or policies.** The GM wants a centered Profile-first experience across the app, while the NPC Admin page remains separate. Unrevealed lore must not reach unauthorized clients.

## Verified live evidence

Read-only DnDWeb SQL confirms that current `character_sheets_select_visible_or_assigned` grants authenticated full sheet JSON whenever the character row is visible. Also, most `characters` lore columns (`background`, `motivation`, `quirk`, `mannerism`, `voice`) are SELECT-granted to authenticated, despite `characters.secret` being column-denied. In the live snapshot 0/15 character rows were currently visible: this is a dangerous policy conditional, **not** proof a player actually accessed a production NPC secret.

An independent bypass is the deployed SECURITY DEFINER `public.get_my_player_characters_v2()`, MD5 `deca87aaad0dce214743c87cdca03f36`: any user with `can_inventory` or `can_convert` on a tagged player-character receives `to_jsonb(c)` (including `secret`) and the full `character_sheets.sheet`. The deployed `private.can_access_character_v1` MD5 is `97b5e6b059e6467e24c4283fe420c83e`.

## Bounded candidate

The source-drift-guarded, unapplied SQL in `sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql` would:

1. Restrict raw `character_sheets` SELECT to existing Admin or `can_edit` authorities, leaving current INSERT/UPDATE/DELETE policies alone.
2. Provide `get_npc_profile_visible_v1(uuid)`, a server-filtered allowlist for authenticated users: basic identity, portrait and first-impression description, plus lore fields only when their `sheet.profileReveal` or `npcProfileReveal` boolean is exactly true. A hidden character without assigned access produces null. The existing explicit secret reveal remains a GM-controlled choice; private `character_notes` are never included.
3. Keep `get_my_player_characters_v2` account roster rows and permission metadata but return full character serialization/sheet **only** when `can_edit=true`. Inventory-only and convert-only grants retain only minimal public identifying metadata and an empty sheet payload.

The candidate contains no destructive DDL or data writes. The existing API SQL definitions and authorization function hashes are checked before any replacement. **Neither the candidate nor a passing scratch test authorizes applying this live.**

## Planned real local JWT acceptance

Five isolated GoTrue user identities (Admin, Editor, Inventory-only, Convert-only, outsider). Source-authentic starting policies and original definer functions are installed in a disposable PostgreSQL 17 Supabase stack. V00 deliberately reproduces both baseline leaks; V01 tests restricted raw sheet reads; V02 preserves Admin/editor full sheet; V03 verifies allowlisted revealed lore and hidden/anonymous denial; V04 verifies restricted grant shape and editor compatibility; V05 checks a subsequent GM reveal; V06 **intentionally confirms the remaining direct characters lore column leak**. Passing V06 is evidence of a release blocker, not a security success.

Test artifacts: `scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql`, `scripts/fixtures/p1_3_npc_safe_profile_local_auth_pg17.sql`, `scripts/test_p1_3_npc_profile_safe_local_auth.mjs`, `scripts/validate_p1_3_npc_profile_rls_source.mjs`, and isolated free GitHub workflow.

## Critical unrepaired release blocker

PostgreSQL row-level security cannot selectively hide ordinary columns from one authenticated user while exposing them to an Admin via the **same** table grants. The existing `characters` SELECT grants directly expose unrevealed lore even if a new Profile RPC would filter it. Revoking those column grants changes existing NPC Admin, Forge, town, and map readers. Before any production cutover we need to inventory all consumers, provide an authorized GM-private dossier API, migrate the relevant clients (including `NpcPanel`) and demonstrate genuine JWT browser parity. Check other SECURITY DEFINER readers and `character_notes` audiences too. The centered Profile UI PR #320 and this security research should not be released independently as a completed privacy solution.

P1.3 concurrency/lock-order, TC1, R1/R2 and masking policies are separate unresolved release gates. Full client/server rollback and source drift review are required. **Production effects: NONE.**

## Exact-head test evidence and consumer audit

**Research SHA `a399da28df9aafed116537d44e1f072fe9583c85`:** [genuine local GoTrue/PG17 workflow 41943448100](https://github.com/bob8675309/DNDNEXT/actions/runs/41943448100) **SUCCESS**, and all three triggered checks passed. Inspected job 126969689500 logs show **V00–V06 all PASS**, where **V00 is intentionally unsafe original behavior and V06 intentionally demonstrates the remaining direct-column disclosure**. The positive tests show candidate behavior only in a reduced synthetic schema, not production or browser acceptance.

**Actual source consumers that would break or need behavior adaptation if direct lore-column SELECT grants were removed:**

| Path | Exact current behavior | Proposed separate cutover owner |
| --- | --- | --- |
| `pages/npcs.js` | Admin NPC/merchant roster calls SELECT with `background,motivation,quirk,mannerism,voice`; selected Admin sheet loads raw `character_sheets.sheet`; authoring uses direct `characters` UPDATE and sheet editing | **Admin-specific, auth-checked private dossier read RPC**; retain existing edit and GM notes, no duplication or data loss |
| `components/NpcPanel.js` | Shared all-player panel selects the same private lore columns and whole sheet, then hides via `profileReveal` in React | Public viewers use server-allowlisted Profile RPC; only independently authorized GM/editor gets full sheet and private fields; no player-side secret reads |
| `components/PlayerCharacterProfilePanelUnified.js` | Player self-account profile uses `get_my_player_characters_v2`, with a `characters` column SELECT fallback including private lore | Editor gets source full shape; limited-grant users must receive restricted character with safe tabs and a compatible fallback, never full sheet |
| `utils/charactersDb.js` | `fetchCharacterById` selects motivation, quirk, mannerism, voice and background on characters | Separate safe public fetch vs explicitly authorized GM/editor dossier; preserve unrelated map-state and position columns |
| `components/MapPageClient.js` | Tested active movement/merchant/NPC SELECT columns concern map position/route/status/icon, not direct lore; map Profile supplies a canonical character row to `NpcPanel` | **No movement/route/drag changes**; keep existing map queries, integrate disclosure at Profile presenter only |
| `pages/town/[id].js` | Town roster/merchant lists use selected identity/position/role fields and delegate full interactions to shared `CharacterInteractionPanel` | Keep town roster and profile opening, then use safe presenter; do not couple town-map system to tactical data |
| `components/NewNpcModalV3.js` | Forge created-character sheet follow-up reads and updates raw `character_sheets.sheet` | Creator has `can_edit` after verified creation; validate unchanged production Forge post-create flow and deferred equipment triggers |
| `public.get_my_player_character_v1()` | Exact live SECURITY DEFINER source MD5 `b6049deb0b4d59daf15d7dd6e8ac1079` requires `cp.can_edit` before returning full char/sheet | **Not** the limited-grant bypass; preserve full editor semantics (still source- and role-test before release) |
| `public.encounter_spellcasting_profile_v1` | SECURITY DEFINER requires `encounter_can_control_participant_v1`, projects spell capability metadata but not full sheet JSON | Separate P1.3 control and masked-event privacy audit; don't conflate controlled spellcasting with full sheet visibility |

**Next bounded engineering task:** implement and test a **private Admin/editor dossier RPC** plus an explicit source-indexed inventory of all private-lore readers and SECURITY DEFINER character serialization; then stage one coordinated column ACL / safe-public UI cutover with genuine Admin/editor/outsider browser acceptance. Do not modify world-map movement, bypass character editor RLS, automatically reveal private notes or deploy this partial research candidate alone.

## Stage-two simulated GM dossier and private-column ACL (additional research)

A second **unapplied** file, `sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql`, explicitly depends on stage one and models the final field confidentiality gate. It would REVOKE direct authenticated SELECT on `characters.background`, `motivation`, `quirk`, `mannerism`, `voice` **for Admin clients as well as regular users**. Thus the NPC editor, old shared Profile, direct character DB helper, and player-profile fallback will fail **until their readers are switched**. This disruptive column-privilege operation must NOT be used on production without owner-reviewed coordinated cutover and rollback.

It also adds `get_npc_dossier_admin_v1(uuid)`: a GM-only SECURITY DEFINER RPC returning the full canonical NPC, including hidden records, private legacy fields and sheet. The function explicitly checks authenticated `auth.uid()` and the *live-style* private Admin helper; it does not trust caller-supplied role, and it denies any editor, limited controller or outsider who is not a GM. GM notes retain their existing separate `character_notes` audience-policy reads; this RPC does not include notes.

Added signed-in cases: **V07** tests the private-column revocation against ordinary and Admin direct-table reads while retaining the public-safe Profile RPC and basic identity; **V08** tests the GM-only hidden dossier and denial to editor, outsider and anon, preserving the separate editor full-sheet grant. These cases prove a future DB boundary *only after actual execution on disposable auth*, and they explicitly expose the need for a new Admin UI read path. Editor-accessible legacy tagged-player RPCs still return character `secret` to `can_edit` holders by original contract, which requires a separate GM privacy decision and permission modernization before release. No actual production API, grants, users, or records are touched.
