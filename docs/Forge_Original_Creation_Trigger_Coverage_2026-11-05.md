# Forge original creation-trigger source and coverage matrix — 2026-11-05

**Source:** Read-only live `pg_trigger` + `pg_proc` inspection on DnDWeb (`ucggczovhmauhshvhusx`). Project `main` remained `51c351a142d03378dff8e47e05182afe21a15622` at last read. This is a **point-in-time source inventory**, not executed production testing. No live writes performed.

## Distinct original trigger coverage

| Public table | Live noninternal triggers | Source-installed in the combined PR #324 local JWT J12–J16 fixture | Still omitted |
|---|---:|---:|---:|
| `character_progression` | 19 | 1 (deferred starting-equipment materializer) | 18 |
| `character_sheets` | 4 | 2 (sheet→progression sync; deferred source equipment validator) | 2 |
| `characters` | 6 | 0 originals; separate **unapplied** #321 creator-attribution INSERT trigger loaded | 6 |
| `inventory_items` | 2 | 0 | 2 |
| **Total** | **31** | **3 original** + one new held creator trigger | **28 original** |

Original functions `materialize_player_forge_starting_equipment_trigger_v1`, `materialize_player_forge_starting_equipment_v1`, and `sync_character_progression_from_sheet_v1` have independently revalidated full live `md5(pg_get_functiondef)` hashes `23fa54dd0a6d7b42b802d613f39ea27c`, `653e1b9d7cc47dcff2cef33a674b97f4`, `bb1a3a2d1600ce33cd4fcadac5e0f3a9`. Their **function bodies** were copied intact from held #317 into the PR #324 fixture. The other six supporting source functions are **simplified test stubs**; item source metadata and RLS are reduced. The source-local JWT fixture's original `create_player_character_v2/v3` bodies are preserved apart from private routing and the reviewed one-clause #319 legacy snapshot safeguard.

## Complete live trigger inventory and missing-test register

| Live table | Trigger | Handler | Handler source MD5 | Timing | Status in the candidate's genuine-local-JWT fixture |
| --- | --- | --- | --- | --- | --- |
| `character_progression` | `cancel_invalid_level_up_session_v1` | `cancel_invalid_level_up_session_v1` | `f6dcf56f72091961d0e9958e86367dd1` | Immediate | Not installed in research fixture |
| `character_progression` | `character_progression_apply_forge_subclass_v1` | `apply_character_forge_subclass_choice_v1` | `273be29420a7274d997642e302604cb7` | Immediate | Not installed in research fixture |
| `character_progression` | `character_progression_materialize_battle_master_maneuvers_v1` | `materialize_player_forge_battle_master_maneuvers_v1` | `daf3fc12e7c30165dca50ca650f9d308` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_materialize_eladrin_season_v1` | `materialize_player_forge_eladrin_season_v1` | `b866a8dff88bbfe6fb2c4f6d4c102fee` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_materialize_player_forge_artificer_plans_` | `materialize_player_forge_artificer_plans_v1` | `67766989a466b82f170b5e00f9154e24` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_materialize_player_forge_feat_instances_v` | `materialize_player_forge_feat_instances_v1` | `c27c4181a51cfd018bbb8244e9931550` | Immediate | Not installed in research fixture |
| `character_progression` | `character_progression_materialize_player_forge_khoravar_skill_v` | `materialize_player_forge_khoravar_skill_versatility_v1` | `9d5fec42e2aefdd39d8a34adf1548460` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_materialize_player_forge_source_magic_v1` | `materialize_player_forge_source_magic_v1` | `4c35eaab8dff7d3d15b64ed71881d4a6` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_materialize_player_forge_starting_equipme` | `materialize_player_forge_starting_equipment_trigger_v1` | `23fa54dd0a6d7b42b802d613f39ea27c` | Deferred | **Source-loaded in J12–J16** |
| `character_progression` | `character_progression_materialize_player_forge_wizard_final_v1` | `materialize_player_forge_wizard_final_v1` | `3c71ad65cde45d74bef4ea63f25847ac` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_materialize_species_cantrip_v1` | `materialize_player_forge_species_replaceable_cantrip_v1` | `a09198d8e12df12371647fccd8479489` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_reject_unmarked_legacy_warlock_invocation` | `reject_unmarked_legacy_warlock_invocations_v1` | `631fbb585f47e71a619ca8ac8e212407` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_validate_battle_master_maneuvers_v1` | `validate_existing_battle_master_maneuvers_v1` | `8bc8a467e95b07e93df833bcfc585e80` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_validate_player_forge_authority_v1` | `validate_player_forge_authority_payload_v1` | `48006f8db76e9b32c96fcd2b6a4b3080` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_validate_player_forge_class_options_v1` | `validate_and_materialize_player_forge_class_options_v1` | `6df5aee6f0519c9c77758d6e887ed8e4` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_validate_player_forge_class_options_v2` | `validate_existing_normalized_warlock_invocations_v2` | `4f1752db655b6ba490113f604c7583ef` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_validate_player_forge_nested_choices_v1` | `validate_player_forge_nested_choice_payload_v1` | `df2861cc76b0b74bb7cd57fbe61c9a05` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_validate_player_forge_spells_v1` | `validate_player_forge_starting_spells_v1` | `6870e810de909209c44aecd02f5c72e2` | Deferred | Not installed in research fixture |
| `character_progression` | `character_progression_validate_player_forge_starting_magic_exac` | `validate_player_forge_starting_magic_exactness_v1` | `ba645ad0f2c17addad0b40e0602c2ac8` | Deferred | Not installed in research fixture |
| `character_sheets` | `character_sheets_authority_fields_guard_v1` | `guard_direct_character_authority_mutation_v1` | `04596b0a3fdfb71c1b357056e8c6023b` | Immediate | Not installed in research fixture |
| `character_sheets` | `character_sheets_sync_player_tags_v1` | `sync_player_character_tags_from_sheet_v1` | `a135ca951f81d2a9546d783afe665c52` | Immediate | Not installed in research fixture |
| `character_sheets` | `character_sheets_validate_player_forge_starting_equipment_v1` | `validate_player_forge_starting_equipment_sheet_v1` | `41cb1758bd2e1eb9b3998389deabb49b` | Deferred | **Source-loaded in J17–J21** |
| `character_sheets` | `sync_character_progression_from_sheet_v1` | `sync_character_progression_from_sheet_v1` | `bb1a3a2d1600ce33cd4fcadac5e0f3a9` | Immediate | **Source-loaded in J12–J16** |
| `characters` | `characters_guard_player_tags_v1` | `guard_player_character_tag_update_v1` | `b8b0008a718de1aa3e74d66b30f1a679` | Immediate | Not installed in research fixture |
| `characters` | `guard_character_visual_asset_sprite_v1` | `guard_character_visual_asset_sprite_v1` | `7f9bda0599640617039a841b35e5d5a6` | Immediate | Not installed in research fixture |
| `characters` | `protect_mog_delete_v1` | `protect_mog_delete_v1` | `80798b0ae487f01f1b9c3025fbfe992b` | Immediate | Not installed in research fixture |
| `characters` | `sync_character_portrait_library_id_v1` | `sync_character_portrait_library_id_v1` | `74cb0bf9d7a614a860344f12cf787e05` | Immediate | Not installed in research fixture |
| `characters` | `trg_force_depart_on_route_assign` | `_force_depart_on_route_assign` | `301f96ac864362f5e51210476fdbc37b` | Immediate | Not installed in research fixture |
| `characters` | `trg_guard_locations_for_resting_and_camping` | `_guard_locations_for_resting_and_camping` | `1dd2ebfe124200bceb6a3b52bbf8e1ed` | Immediate | Not installed in research fixture |
| `inventory_items` | `inventory_items_apply_structured_crafting_traits_v1` | `apply_structured_crafting_traits_v1` | `108bfc2599d75e7298f65ce326f16173` | Immediate | Not installed in research fixture |
| `inventory_items` | `zz_inventory_items_apply_smithing_affinity_polish_v4` | `apply_smithing_affinity_polish_v4` | `5d51cf335ff880939ae0df4c4152bdbd` | Immediate | Not installed in research fixture |

### Why these gaps matter

The 28 omitted original triggers include progression source-authority checks, subclass/maneuver/feat and spell materialization, sheet validation and the NPC/portrait/movement/inventory asset guards. Even though the original two-function deferred-equipment path succeeds in isolation, that **does not prove** that its transaction, lock order, authorization or RLS behavior remains valid with the full deployed trigger and catalog graph. In particular, the P1.3 character progression (CP) / character sheet (CS) lock inversion is still a held research finding; it is **not** solved by immutable nonce serialization across different request IDs.

**Latest additional source acceptance:** [true local GoTrue run 42031055348](https://github.com/bob8675309/DNDNEXT/actions/runs/42031055348) **SUCCESS** at code SHA `1ec4d6fa6b0b39d3f898763d3d8de6b90a23a71b`. Source-exact deferred sheet validator `private.validate_player_forge_starting_equipment_sheet_v1` (MD5 `41cb1758bd2e1eb9b3998389deabb49b`) and its original deferred trigger were installed **after** J12–J16. Authenticated J17–J21 PASS: source-matched Soldier/XPHB Background package, inert nonce replay, missing/mismatched Background rejected with atomic rollback of item/currency/creator/reservation, two real concurrent identical nonce calls yield one result, changed Background nonce fails before any gear write.

**Next one source expansion:** inspect the original `character_sheets_authority_fields_guard_v1` and `character_sheets_sync_player_tags_v1` immediate sheet triggers, and their existing source-catalogue/account owner dependencies, before loading them into the true-JWT fixture. Then evaluate additional progression source-authority and class/feat/spell/materialization triggers by class eligibility, with full original source instead of stubbed validations. The six existing equipment helper functions and source catalogue still use test stubs; avoid inferring full production or global CP/CS lock safety from this three-trigger slice.

## Boundaries and policy

- Binding owner decision: same nonce, different character/starting spell/equipment intent **must reject**; same nonce with exact intent is an inert retry.
- All SQL and tests under [draft #324](https://github.com/bob8675309/DNDNEXT/pull/324) remain research, stacked on unmerged #321, and include PR #319's *single guard clause* only inside the private v2 copy. #317 global locks, GM/NPC and service actor nonce cases are separate held work.
- Production RLS/grants/character data/legacy GM secrets unchanged. **No merge, migration, deployment, browser acceptance or global lock-order proof.**
