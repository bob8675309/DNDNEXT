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

## GM owner decision — strict two-part Secret authority (2026-11-04)

The GM explicitly approved separating **GM Secrets** from **player-editable character backstory secrets**. These are independent data classifications, not alternate labels for the same `sheet.secret` field. A delegated NPC controller or `can_edit` sheet editor must not automatically receive or modify GM Secrets. This overrides earlier provisional questions about `can_edit` exposing `characters.secret`; no legacy content is auto-deleted or transformed.

**Read-only live counts, no contents inspected:** 15 canonical characters, 7 with non-empty legacy `characters.secret`, 10 `character_sheets` rows and **zero** top-level `sheet.secret` keys. Legacy `characters.secret` values are classified as GM-only and retained in place. Source shows authenticated `characters.secret` column SELECT and UPDATE are currently denied, but `get_character_secrets_v1` and `set_character_secret_v1` SECURITY DEFINER RPCs accept any `can_edit` subject; also both tagged-PC readers serialize `characters.secret` when `can_edit`. **Existing app behavior is not secure solely because the column is private.**

A third **unapplied** candidate, `sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql`, requires stages 1+2 and source fingerprints. It proposes:

- Keep all existing `characters.secret` values in place, **no destructive migration**; gate the existing secret read/write RPC names to the *authenticated GM* only. Direct columns remain denied.
- New `character_backstory_secrets` table for authored character secrets, with separate RLS: current Admin or `can_edit` may read/edit; inventory-only, convert-only, temporary combat-only and outsiders may not. Direct source `can_edit` remains the limited legacy authorization until separate capability grants are deployed.
- Separate `character_public_secret_revelations` table, **Admin-only** for authoring/publication. A player or sheet editor cannot publish a GM secret by changing `sheet.profileReveal.secret`.
- Rewrite both tagged-PC SECURITY DEFINER readers so even `can_edit` return data omits the legacy `characters.secret` column. Canonical sheet remains intact for editors; further confidential sheet-content migration is a distinct gate.
- Rewrite the public-safe `get_npc_profile_visible_v1` so it **never reads legacy `characters.secret` or `sheet.secret`**. It may return only a specifically GM-authored, published *clue* from the new publication table. Revocation immediately hides that clue from future reads.

**Important residual blocker:** a raw `character_sheets.sheet` can still contain arbitrary narrative keys and remains readable to a legitimate `can_edit` holder. The disposable fixture intentionally has a `sheet.secret` key to show that this class of leakage must be audited and prevented; live snapshot finds **no** such top-level keys, but this does not rule out nested private content in future sheets. No existing `sheet.secret` is automatically renamed to player-backstory secret or moved to GM secret. The current `NpcPanel`, `/npcs` secret editing UI, player Forge and older PDF consumers all need coordinated field renaming and server-backed reads before any cutover.

New true-GoTrue cases **V09–V15** cover original editor-GM-secret access (intentionally unsafe baseline), GM-only old secret read/write, tagged-PC v1/v2 server serialization removal, player-editable backstory isolation, explicitly curated GM reveal/revoke, residual raw sheet leak, and revocation of editor grants. The exact-head CI is **PENDING until confirmed by run logs**. This is research only and does not authorize deploying any of the three SQL files. A joint UI + RLS + legacy RPC/notes rollback and GM browser acceptance remains required.

### 2026-11-04 first V09–V15 run: fixture assembly issue (not source/auth failure)

At `17d5e345ff5f9acbeabb75fe46ce9155f4cbe289`, [local JWT workflow 41955486446](https://github.com/bob8675309/DNDNEXT/actions/runs/41955486446) failed **before fixture installation completed**: `psql:scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql:121: ERROR: syntax error at or near "CREATE"`. Three original live `pg_get_functiondef` strings ended in `$function$` without an executable-file SQL semicolon; the concatenation caused the following function `CREATE` to be parsed within the prior statement. The same assembly issue was detected in stage-three candidate before running it. Added **only** terminating `;` to those original-function DDL statements, preserving their live-defined bodies and authorization logic. V09–V15 were **NOT EXECUTED** in this first run; rerun required. Production effects: **NONE**.

### 2026-11-04 second expanded run — anonymous function-EXECUTE hardening

At `11fb82a9693bbed41fbba6a8b69841f49ddb5876`, [GoTrue run 41956051455](https://github.com/bob8675309/DNDNEXT/actions/runs/41956051455) executed **V00–V09 successfully**, including source-authentic proof that can_edit lets a player read/change the GM Secret and the full tagged-PC v1/v2 serializers leak that secret. **V10 stopped** because the proposed GM-secret getter still inherited the original default `EXECUTE` for `PUBLIC`: an anon caller was permitted to call it, but got **zero rows** because `auth.uid()` did not match Admin. This is a function invocation-surface hardening gap, **not a demonstrated anonymous secret-value leak**. The stage-three candidate now explicitly revokes `EXECUTE` from `PUBLIC,anon` on both legacy GM secret getter/setter, then grants authenticated; the real Admin check remains in each function. V10–V15 require a fresh exact-head CI run before any PASS claim. No production SQL/grants were executed.


## 2026-11-04 validated stage-three split-secret checkpoint

**Exact-head tested SHA** `143584050ddf9054ddfbe67666a4cb2ad75d5216`, [GoTrue/Postgres17 run 41956440837](https://github.com/bob8675309/DNDNEXT/actions/runs/41956440837) **SUCCESS; all three triggered GitHub checks green**. Inspected job `127012351502` confirmed **V00–V15 PASS** (16 test cases). The test distinguishes **EXPECTED UNSAFE SOURCE BASELINES** V00, V06 and V09 from successful safety results V10–V13 and V15. **V14 deliberately retains a synthetic raw `sheet.secret` visible to a legitimate editor**, identifying a remaining future sheet-content classification/authoring problem: passing V14 does *not* mean that arbitrary GM secrets in raw sheets are protected.

- **V09 expected unsafe source:** authenticated `can_edit` reads and changes legacy `characters.secret` via original RPCs; both tagged-PC v1 and v2 privileged serializers deliver the old GM field to sheet editors.
- **V10:** proposed GM-only old secret read/write APIs deny the delegated editor; authenticated Admin can access/revise and anonymous caller cannot invoke the API.
- **V11:** staged tagged-PC v1/v2 readers remove legacy `characters.secret` from returned JSON while keeping the canonical editor sheet.
- **V12:** separate player backstory record is editable by Admin/sheet-editor but inaccessible to inventory-only and outsiders, with original GM secret unchanged.
- **V13:** even when the old `sheet.profileReveal.secret` flag is true, the safe Profile cannot disclose `characters.secret`; only an independently GM-authored, explicitly published clue is exposed, and GM unpublish hides it.
- **V14 expected residual content risk:** if future GM-only content is stored in raw `character_sheets.sheet.secret`, an otherwise legitimate sheet editor still sees it; use reviewed UI/data classification rather than renaming/copying historic sheet fields. At the actual read-only live checkpoint, `0/10` sheets had that top-level key; nested keys and future content are not exhaustively audited.
- **V15:** authenticated character-edit grant revocation hides player backstory from the former editor, without deleting the record or affecting GM reading.

**Complete creation-source inventory (read-only live):** `public.create_character_v1` MD5 `b58311c817d8648ef75ae35b66d831c5`, `public.create_player_character_v1` MD5 `e2db5802f1f51b93f5b9d374a835e4b9`, and `public.create_player_character_v2` MD5 `0351f0a00acae023278e1b8b065b00c9` each accept a `v_payload->>'secret'` and store it into `characters.secret`. `public.create_player_character_v3` MD5 `6ba73e6f12fcf826cc0a739cce45ff40` delegates creation to v2. Their payload handling must be redesigned for GM-only vs player-authored secrets in a **coordinated, verified creation-RPC and Forge UI migration**, including immediate alternate/underling creation and idempotency. No source RPG function or creation data was changed here.

**Repaired failed experiments preserved:** first expanded head `17d5e345` failed SQL fixture assembly due missing exported function terminators (before V09); `11fb82a9` passed V00–V09 but stopped at V10 because anon could execute the old getter and receive zero rows. The candidate was then adjusted to revoke PUBLIC/anon EXECUTE from both GM-secret endpoints. Neither failure demonstrated live leakage beyond the already observed baseline logic. **All changes are research-only**: no numbered migration, player GUI switch, live RLS or role grant update, `main` merge, deployment, or actual data relocation.

**One next bounded task:** review and stage the synchronized `/npcs` GM dossier editor, shared `NpcPanel` player-safe Profile, PlayerCharacterProfilePanelUnified fallback, Forge client + all four creation RPC paths, and existing sheet narrative conventions. Design real creator/editor/GM/outsider browser and genuine JWT tests for all. Do **not** deploy stage1, stage2 or stage3 SQL independently, and ask the owner before any large data migration or destructive change.
