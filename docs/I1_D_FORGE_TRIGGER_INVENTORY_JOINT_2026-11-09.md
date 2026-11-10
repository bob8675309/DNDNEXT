# I1-D — Source-pinned original 31-trigger gap and Story-nonce × Stage4 inventory integration

**Status: DRAFT, research-only. No production SQL, main merge, Vercel, map behavior change, or PR retirement.** This is the next November 9 I0–I6 integration task after I1-C's signed GoTrue/PG17 red-to-green [#351](https://github.com/bob8675309/DNDNEXT/pull/351). Source branch ancestry is #345 secure NPC/privacy → #350 signed I1-B negative → #351 I1-C source-preserving Story nonce. This research adds source and signed test evidence; it never installs an application/runtime migration.

## Original trigger census and provenance

The **original read-only** [Forge_Original_Creation_Trigger_Coverage_2026-11-05.md](Forge_Original_Creation_Trigger_Coverage_2026-11-05.md) is copied **byte-for-byte from #349 at Git blob `5d3a32c5b6661e47b36794bfe7723296c4b0631b`**. Its 31 noninternal original trigger names and original `pg_get_functiondef` handler MD5s are the authority; it is a dated census, not a current production schema query. [#349](https://github.com/bob8675309/DNDNEXT/pull/349) independently preserves its no-cost static ledger, positive JWT receipt IDs and all historical 31 source rows.

The new read-only `scripts/validate_i1d_trigger_gap_manifest.mjs` enumerates **every `scripts/fixtures/forge_*.sql` DDL** and verifies exact original trigger name, table, handler, timing and deferred CONSTRAINT identity against the pinned census. Baseline is **17 matching staged DDL / 14 not staged / zero mismatches** in that historical fixture collection. This is **not** one combined 17-trigger executable PG instance and not 17 separately signed acceptance receipts.

| Historical group | Original | In `forge_*.sql` staged DDL | Not staged there |
|---|---:|---:|---:|
| `character_progression` | 19 | 9 | 10 |
| `character_sheets` | 4 | 4 | 0 |
| `characters` | 6 | 2 | 4 |
| `inventory_items` | 2 | 2 | 0 |
| **Total** | **31** | **17** | **14** |

### All 14 historically omitted DDL entries

The MD5s below are **the original handler function source hashes**, not proof that their executable bodies have passed in the combined database.

| Trigger | Original function MD5 | Disposition |
|---|---|---|
| `cancel_invalid_level_up_session_v1` | `f6dcf56f72091961d0e9958e86367dd1` | Exact original C3.3 LevelUp SQL located; I1-D adds to joint disposable test |
| `character_progression_materialize_battle_master_maneuvers_v1` | `daf3fc12e7c30165dca50ca650f9d308` | Original full source + dependency fixture still unproven in joined runtime |
| `character_progression_materialize_eladrin_season_v1` | `b866a8dff88bbfe6fb2c4f6d4c102fee` | Full source/required species catalog still unproven |
| `character_progression_materialize_player_forge_artificer_plans_` | `67766989a466b82f170b5e00f9154e24` | Full source/Artificer option dependencies still unproven |
| `character_progression_materialize_player_forge_khoravar_skill_v` | `9d5fec42e2aefdd39d8a34adf1548460` | Full source/Khoravar option dependencies still unproven |
| `character_progression_materialize_player_forge_wizard_final_v1` | `3c71ad65cde45d74bef4ea63f25847ac` | Original full finalizer and Wizard source parity unproven |
| `character_progression_materialize_species_cantrip_v1` | `a09198d8e12df12371647fccd8479489` | Original species cantrip handler unproven |
| `character_progression_reject_unmarked_legacy_warlock_invocation` | `631fbb585f47e71a619ca8ac8e212407` | Source-exact legacy invocation rejection unproven in joined runtime |
| `character_progression_validate_battle_master_maneuvers_v1` | `8bc8a467e95b07e93df833bcfc585e80` | Original maneuver validator unproven |
| `character_progression_validate_player_forge_class_options_v2` | `4f1752db655b6ba490113f604c7583ef` | Original normalized Warlock invocation validator unproven |
| `guard_character_visual_asset_sprite_v1` | `7f9bda0599640617039a841b35e5d5a6` | Exact original C3.3 sprite guard SQL located; joined negative source test (no world-map movement changes) |
| `protect_mog_delete_v1` | `80798b0ae487f01f1b9c3025fbfe992b` | Exact original C3.3 protected-Mog SQL located; joined source-negative test |
| `trg_force_depart_on_route_assign` | `301f96ac864362f5e51210476fdbc37b` | **World-map movement protected: do not change/import by implication** |
| `trg_guard_locations_for_resting_and_camping` | `1dd2ebfe124200bceb6a3b52bbf8e1ed` | **World-map resting/camping protected: do not change/import by implication** |

**Accounting:** 3 of the 14 have independently exact-source C3.3 fixtures and are now tested by name in the I1-D joint setup; 2 have explicit protected world-map dependencies; the **other 9 require source-original executable bodies and matching branch/catalog prerequisites** before the 31/31 combined gate can be claimed. Do not manufacture original handler SQL. Other original grants/triggers outside the 31-table census and original Forge feat creator/grant authority remain separate.

## Same-database genuine GoTrue/PG17 joined fixture

- `scripts/fixtures/i1d_forge_story_inventory_setup_pg17.sql` requires the **real #324** nonce reservation table and the unmodified I1-C private-Story wrapper (the earlier C3.3 fixture only had a fake guard table). It loads the unmodified original deferred equipment and sheet-to-progression functions with source MD5 guards, plus the three original C3.3 source-exact non-map triggers. **Two other guard-only tables and six reduced equipment helper functions remain test substitutes**; this is not full source/catalog parity.
- `scripts/test_i1d_forge_story_inventory_joint_local_auth.mjs` carries forward all I1-C tests using real local GoTrue-issued JWT and adds the following checks in the SAME disposable PG17 database:

| Case | Required proof |
|---|---|
| I1D-01 | Source-exact deferred gear and currency, creator-private Story and **real** immutable nonce reservation in one transaction |
| I1D-02 | Two original item BEFORE triggers, BOTH historic owner CHECKs, four original-shaped inventory policies |
| I1D-03 | Original `NOT VALID` owner CHECK rejects new Forge-v3-with-Story equipment at deferred COMMIT; character/nonce rollback |
| I1D-04 | Unchanged Stage4 CHECK removal + four policy alterations are **transactionally abortable** before COMMIT with exact preflight fingerprints |
| I1D-05 | Exact Stage4 original candidate blob `4532ddb8db642d0d0ab14646a3e87c034d4134c6` passes source/role/preflight on disposable DB; inventory/item/spell/merchant stock, Story and nonce preserved |
| I1D-06 | Previously failed nonce can create after whole Stage4; unchanged retry cannot duplicate gear/currency/Story; changed-only Story still rejects |
| I1D-07 | Source-original public v2 still creates equipment/currency and repeats inertly |
| I1D-08 | Creator reads canonical gear but cannot mint/launder/delete character-owned rows; outsider cannot see |
| I1D-09 | Noncharacter personal item direct DML and explicit authenticated Admin item grant remain |
| I1D-10 | Revoked `can_edit/can_inventory` hides gear and blocks creator nonce replay; Admin retains access |
| I1D-11 | Three original omitted-in-Forge triggers: progression session cancellation, invalid 8-direction sprite rejection, protected Mog deletion refusal |
| I1C-01–11 | All prior Story nonce, caller, replay, rollback and conflicting/identical signed concurrency checks rerun first |

**CI:** `.github/workflows/validate-i1d-forge-trigger-inventory-local-auth.yml`, pinned Supabase CLI `2.120.0`, Node 22, localhost PostgreSQL17 and GoTrue/PostgREST only; disposable containers removed after run. The workflow first runs the static 31-trigger source gap audit, then genuine signed source-based SQL and DML assertions. Never point this fixture to any hosted project.

## I1-D verified execution and live read-only source recheck (November 9 local / November 10 UTC)

**EXACT SIGNED SOURCE HEAD `03b9250748a5355005b4146c0727efabf96c2ba6`: [GitHub Actions run 42756250666](https://github.com/bob8675309/DNDNEXT/actions/runs/42756250666) — SUCCESS** for new `forge-inventory-story-joint-signed` job. Its output includes all **I1D-01 through I1D-11 PASS**, plus prior I1C-01–11. Repository-wide original PG17 replay, genuine local JWT regression, validation, handoff registry, and docs-only checks also succeeded: **six successful checks, one intentionally skipped Supabase Preview** at that tested head. **No hosted data were mutated.** Supabase local Docker transient image rate-limit messages recovered automatically; the final signed SQL/role assertions completed and all disposable services stopped.

Actual signed joint results (not static text matches): original v3+Story+nonce+deferred equipment/currency commit; three source-original C3.3 trigger paths (level-up cancellation, invalid sprite refusal, Mog delete guard); both historic owner CHECKs and original two inventory item handlers; legacy NOT VALID deferred failure with full character/Story/nonce rollback; unchanged exact Stage4 `4532ddb8` four-policy + CHECK DDL abort/rollback and then successful local install; preservation hashes of spells/items/merchant stock/existing gear/Story/nonce; signed v2 and private Story wrapper after Stage4, no duplicated equipment/currency/replay; creator, outsider, legitimate player inventory, Admin and revoked permissions.

**Read-only current Supabase metadata review:** DnDWeb database Postgres 17.4 reported as healthy. A SELECT-only `pg_proc` / `md5(pg_get_functiondef)` inspection of the **nine other historically unstaged non-world-map original handlers** found all nine with source MD5s **identical to the November 5 original census**. None of those bodies were installed/tested in the joined I1-D fixture; **metadata equality does not imply complete execution or dependency parity**.

| Original missing handler (source-only SELECT; no writes) | Current live MD5 | Source text characters |
|---|---|---:|
| `materialize_player_forge_artificer_plans_v1` | `67766989a466b82f170b5e00f9154e24` | 3,610 |
| `materialize_player_forge_battle_master_maneuvers_v1` | `daf3fc12e7c30165dca50ca650f9d308` | 3,238 |
| `materialize_player_forge_eladrin_season_v1` | `b866a8dff88bbfe6fb2c4f6d4c102fee` | 2,021 |
| `materialize_player_forge_khoravar_skill_versatility_v1` | `9d5fec42e2aefdd39d8a34adf1548460` | 1,811 |
| `materialize_player_forge_species_replaceable_cantrip_v1` | `a09198d8e12df12371647fccd8479489` | 3,531 |
| `materialize_player_forge_wizard_final_v1` | `3c71ad65cde45d74bef4ea63f25847ac` | 432 |
| `reject_unmarked_legacy_warlock_invocations_v1` | `631fbb585f47e71a619ca8ac8e212407` | 1,886 |
| `validate_existing_battle_master_maneuvers_v1` | `8bc8a467e95b07e93df833bcfc585e80` | 1,612 |
| `validate_existing_normalized_warlock_invocations_v2` | `4f1752db655b6ba490113f604c7583ef` | 6,955 |

A further **read-only** lookup confirmed `materialize_player_forge_wizard_final_v1()` is a deferred AFTER INSERT trigger calling **two dependent original functions**, not a self-contained 432-character handler: `materialize_player_forge_wizard_savant_for_character_v1` (current MD5 `49594930f540d308b43ce00461462829`, 6,529 characters) and `materialize_player_forge_wizard_signature_for_character_v1` (MD5 `02395e9d544ef6d5d1e6e5436d080294`, 3,368 characters). Its authentic dependencies and preferred Wizard source catalog need to be reconstructed, not stubbed away.

**ONE NEXT TASK (I1-E bounded source extraction):** preserve the complete source-original Wizard final trigger and both subfunction bodies with exact MD5 provenance, identify their true table/catalog/RLS dependencies, and create a **small signed positive + negative + rollback** addition to the existing I1-D disposable suite. Do not claim its acceptance merely from metadata MD5. Other eight non-map trigger handlers and two protected world-map behaviors stay in the explicit 31-trigger backlog.

## Unproven release gates and next work

- **NOT 31/31** installed/executed. The historical 17/31 staged names occur across separate fixtures; I1-D joins a smaller source-original subset plus three C3.3 originals and two inventory crafting triggers. Nine historical original handler source/dependency paths remain unresolved, two world-map handlers are expressly protected.
- Full original option/feat/grant trigger graph, real source-qualified catalogs, merchandise/economy and multiuser lock-order tests remain unverified together. I1-C race only serializes a *shared nonce*; it does not prove CP/CS/G/I opposite-order transaction deadlocks are resolved.
- Stage4 itself is unchanged; this is a **disposable review of the original candidate**, not a migration file or live rollout. Source signer/auth tests and field-level RLS need production-shaped release preflight. The existing backup capture is complete; isolated full PostgreSQL + 340-object Storage byte restore, encrypted second copy, original ten-step Forge Chromium and approved map visual presentation remain unverified.

**ONE NEXT ENGINEERING TASK once this exact-head CI is verified:** preserve original source definitions and their full dependencies for one missing non-world-map original trigger, preferably the high-impact `character_progression_materialize_player_forge_wizard_final_v1` only if its original `pg_get_functiondef` body and authentic source-qualified catalog fixture can be obtained. Build bounded signed positive/negative/deferred rollback; re-run I1-D joined test. Do not expand to unrelated features, do not alter the world map or invent source definitions.
