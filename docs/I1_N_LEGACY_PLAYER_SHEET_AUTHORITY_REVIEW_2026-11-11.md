# I1-N — Live legacy player-sheet writer/reader census and authority decision

**Research only — November 10 local / November 11 UTC, 2026.** Branch is stacked on signed [I1-M #361](https://github.com/bob8675309/DNDNEXT/pull/361), preserving #360 original Artificer source RED and scratch candidate GREEN, #319 source research, #324 nonce safeguards and the owner's November 9 [I0–I6 program in #348](https://github.com/bob8675309/DNDNEXT/pull/348). No live write, migration, deployment, merge, world-map modification or paid agent.

## Evidence and method

Used read-only `pg_proc`, `pg_namespace`, `pg_get_functiondef`, `md5`, `pg_policies`, privilege/introspection queries on the connected DnDWeb PostgreSQL 17.4. The [machine-readable source-pinned inventory](I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json) records **all 34 found original updater functions**, complete signatures, MD5 fingerprints and short live function excerpts; **three direct `public.players` inserters/UPSERTs** and **six explicit DB row-lookup functions**. Source-only [recheck SQL](../scripts/research/i1n_legacy_player_sheet_live_readonly_census.sql) repeats the census without accessing user rows.

**This is an exact observed snapshot, not an assertion that PostgreSQL contains no other dynamic SQL, triggers, views, indirect references, client-side writes or external consumers.** In this snapshot, `public.players` has no non-internal table triggers. `public.get_my_player_characters_v2()` has original source MD5 `deca87aaad0dce214743c87cdca03f36`; it reads from `character_sheets` by `character_permissions`, not `players.sheet`. Legacy account snapshots are not the canonical per-character data authority.

## Source results

| Classification | Confirmed count | Why it matters |
|---|---:|---|
| Progression / class-choice writers | 18 | Independent character level and option workflows can update an account-wide snapshot |
| Projection / source materializers | 9 | One is the I1-L/I1-M Artificer collision; others can overwrite later |
| Action / rest resource writers | 3 | HP, rest and per-use events may change a different character's legacy sheet |
| Additional feature helpers | 3 | Feature application/restoration has the same shared-mirror concern |
| Legacy `create_player_character_v1` | 1 | Direct account update, distinct from 33 permission-based writers |
| **Total update functions** | **34** | Source-observed UPDATE statements targeting `public.players` |
| Account-row insert/UPSERT functions | 3 | `create_player_character_v1`, `create_player_character_v2`, and `sync_user_profile` |
| Explicit database player-row lookups | 6 | Targeting, crafting, activity and transfer lookup; no observed `players.sheet` read in those six |

Of the **33 permission-based** update statements, **4 include `cp.can_edit` in their account-mirror UPDATE filter** and **29 include a `character_permissions` lookup without that predicate**. This classification describes *that UPDATE statement*, **not** complete RPC authorization or caller privileges. A function might perform earlier authorization checks. The legacy v1 creator has a `cp.can_edit` token elsewhere in its body but its own `UPDATE public.players` targets `user_id=v_user` directly.

**Live privilege/row access observation:** `players` RLS is enabled; `players_select_self`, `players_update_self`, `players_insert_self`, and `players_admin_all` are in effect. Authenticated users have table SELECT privilege (subject to RLS) and can read their own account row including `sheet` if they request that column. Anonymous SELECT privilege is absent. Authenticated roles can execute original `create_player_character_v1(jsonb,jsonb)` and v2; anonymous cannot execute v1. The private Artificer projector is not executable directly by authenticated users. No user data was read or modified.

## Complete 34-function source fingerprint matrix

### Progression and class choices (18)

| Original function (schema/name) | Source MD5 | Account update predicate |
|---|---|---|
| `private.apply_additional_level_class_choices_v1` | `c847b3656b1f006f4020d2b23f73efcc` | Permission row, without update-level `can_edit` |
| `private.apply_character_level_advancement_v1` | `46dd0af4f6ca816422a75e91a292c634` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_battle_master_maneuvers_v1` | `4154e92e9228cdc42bad2bc9fed37562` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_lore_discoveries_replacement_v1` | `f3c2e92a7df5c388c4f92cfbe3f6bf25` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_magic_initiate_replacements_v1` | `01f21c1f197aa4d1fa138b05de238690` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_metamagic_replacement_v1` | `96b9b4d327057d34af9e59f49219de0d` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_mystic_arcanum_replacement_v1` | `6c181bbb230a7c7021b48140906cb58d` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_subclass_choices_v1` | `53fc79f26851efbc698d6e7c8546af00` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_warlock_invocation_replacement_v1` | `434994105f465b6ed92fdb80942f9942` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_warlock_invocations_v1` | `ed0655adf02e9413157efe8a8bd414f9` | Permission row, without update-level `can_edit` |
| `private.apply_level_up_wizard_savant_v1` | `77f643e44aa6048689a66ff4d01c4694` | Permission row, without update-level `can_edit` |
| `private.apply_simple_level_class_choices_v1` | `e2078d079f8bbb1a397c2a43d13bae9b` | Permission row, without update-level `can_edit` |
| `private.apply_tough_progression_bonus_v1` | `2b8bca48b7067e2e67b66defcb7f2c10` | Permission row, without update-level `can_edit` |
| `private.complete_character_level_up_base_v3` | `e33639d549ef557976a3970ea51f5238` | Permission row, without update-level `can_edit` |
| `private.complete_epic_level_up_base_v1` | `0688ae4f53e4a5e02e8228473ff4d0e0` | Permission row, without update-level `can_edit` |
| `public.complete_character_level_up_v1` | `1500703592c3cb8e1738126eac508e6a` | Permission row, without update-level `can_edit` |
| `public.complete_character_level_up_v2` | `28a227a1dfb9a3cc5516c5b7afb874b0` | Permission row, without update-level `can_edit` |
| `public.set_character_progression_v2` | `c4ea1c7993912f6b4c6fe9ee7b25343f` | Permission row + `cp.can_edit` |

### Projection and source materialization (9)

| Original function (schema/name) | Source MD5 | Account update predicate |
|---|---|---|
| `private.apply_source_owned_origin_feat_v1` | `b7d69d8643a6b2ba2be8efbb4ee41243` | Permission row, without update-level `can_edit` |
| `private.ensure_character_source_choices_v1` | `69bedf66148d2ce3dab97baa5de606cc` | Permission row, without update-level `can_edit` |
| `private.remove_source_owned_origin_feat_v1` | `ca278b2eb83d2a70aec369edf79a32a6` | Permission row, without update-level `can_edit` |
| `private.set_species_runtime_projection_v1` | `7f6e7d7d99ff79db1372462b4320c21b` | Permission row, without update-level `can_edit` |
| `private.sync_admin_feature_array_v1` | `f2b6190ecc9400772e054892f63cdc47` | Permission row, without update-level `can_edit` |
| `private.sync_character_artificer_plan_projection_v1` | `5ebf572db01143e9b523c7dba0d43ad5` | Permission row, without update-level `can_edit` |
| `private.sync_character_eldritch_invocations_v1` | `69361283a0ba3b9d83a2104256a86f66` | Permission row, without update-level `can_edit` |
| `private.sync_character_runtime_weapon_mastery_projection_v1` | `851b6da1a2b26e8652df20746fb0aa60` | Permission row, without update-level `can_edit` |
| `private.sync_player_forge_class_spell_summary_v1` | `5b1b275a268a57591a2e35a05ce7480d` | Permission row, without update-level `can_edit` |

### Actions and rest resources (3)

| Original function (schema/name) | Source MD5 | Account update predicate |
|---|---|---|
| `private.restore_character_rest_action_state_v1` | `d75edf2ac583e3790882155c702e2165` | Permission row + `cp.can_edit` |
| `public.adjust_character_hit_points_v1` | `f855be60d971aa63e32ade327d14c369` | Permission row + `cp.can_edit` |
| `public.update_character_sheet_action_state_v1` | `313a533250724b2e2abc754899d0f8d4` | Permission row + `cp.can_edit` |

### Additional feature helpers (3)

| Original function (schema/name) | Source MD5 | Account update predicate |
|---|---|---|
| `private.apply_wizard_signature_spell_ids_v1` | `c6d23dc8eccb824e9199ca027139a7da` | Permission row, without update-level `can_edit` |
| `public.configure_character_weapon_mastery_v1` | `32fa55b69478af07f8f0002b967a5704` | Permission row, without update-level `can_edit` |
| `public.recover_character_invocations_v1` | `05f6d19a7e2f45d890c62c27cb419e7f` | Permission row, without update-level `can_edit` |

### Legacy direct creator (1)

| Original function (schema/name) | Source MD5 | Account update predicate |
|---|---|---|
| `public.create_player_character_v1` | `e2db5802f1f51b93f5b9d374a835e4b9` | Direct user-account update |

## Read consumer cross-check

### Six database functions using `FROM/JOIN public.players`

This is the set of matching stored-function source references; all six were inspected at the relevant lookup excerpt. None of the six uses `players.sheet` in its observed source path. This does **not** rule out dynamic SQL or external clients.

| Function | Source observation |
|---|---|
| `private.complete_craft_plan_v1_impl` | Player identity/target lookup; no source-level sheet token |
| `private.complete_enchanting_craft_plan_v1_impl` | Player identity/target lookup; no source-level sheet token |
| `public.get_recent_site_activity_v1` | Player identity/target lookup; no source-level sheet token |
| `public.list_item_send_targets_v1` | Player identity/target lookup; no source-level sheet token |
| `public.list_transfer_targets` | Player identity/target lookup; no source-level sheet token |
| `public.transfer_inventory_item_v1` | Player identity/target lookup; no source-level sheet token |

### Seven application files with explicit `.from("players")` access

These source files were inspected on the same application lineage (PR #361 changes no app components). Their selected `players` columns are identity fields rather than the legacy sheet. The full search can miss dynamically built queries and outside applications.

| Client source | Observed selected fields | Purpose |
|---|---|---|
| `components/PlayerAccountPanel.js` | `id,user_id,name` | account identity and profile name |
| `components/PlayerCharacterProfilePanelUnified.js` | `id,user_id,name` | identity fallback; canonical sheet from get_my_player_characters_v2 |
| `components/OfferTradeButton.js` | `user_id,name` | recipient labels |
| `pages/admin.js` | `user_id,name` | Admin player choices |
| `pages/npcs.js` | `user_id,name` | NPC page player choices |
| `pages/inventory.js` | `user_id,name` | inventory player targeting and name lookup |
| `pages/encounters/live.js` | `user_id,name` | encounter controller options |

The modern Player Character Profile uses `get_my_player_characters_v2` and explicit character selection. NPC/GM components directly use canonical `character_sheets`. This is consistent with treating `players.sheet` as a compatibility snapshot, **not** the authoritative active character.

## Recommended contract for owner review — not an approved production policy

1. **Canonical authority:** `characters.id` + `character_sheets.character_id` identify per-character sheets; `character_permissions` defines access. Inventory, class grants, Story, spells, and resources keep their independent guarded authorities. A user may own/edit several characters; no implicit account-wide active character selection by `players.sheet`.
2. **Legacy sheet preservation:** existing nonempty `players.sheet` must not be silently reassigned by creating or editing another character. Missing historical creation IDs must fail closed, not be guessed or backfilled. An empty mirror may be initialized once. An existing mirror may be synchronized only after **server-verifying** the same canonical character and stable immutable creation ID, and only when the owner-authorized policy defines this mirror's continued purpose. The I1-M Artificer predicate is a scratch demonstration, **not** an approved global retrofit.
3. **Authorization:** editing one canonical sheet must never overwrite a co-editor's, controller's or inventory-only delegate's unrelated legacy account sheet. A row in `character_permissions` alone is not evidence that the destination account snapshot belongs to the source character. A later RLS/ACL cutover cannot rely on browser-only checks.
4. **Compatibility and privacy:** preserve account profile names, legacy assets, existing `players` rows, independent canonical sheets, NPC GM Secrets versus creator Story, inventory/merchant ownership, tactical resources and map behavior. Since authenticated users can SELECT their own player record, never copy another character's restricted/private data into an unrelated `players.sheet` account.
5. **Concurrency:** coordinate the account mirror's row locks with canonical character-sheet writes, grant mutations, creation nonce reservations, and the global CP/CS/G/I lock ordering workstream #317. Avoid a late mirror update resurrecting stale sheet state or deadlocking on alternate-character writes.
6. **Explicit migration decision:** determine whether `players.sheet` will be *frozen legacy snapshot*, *explicitly user-selected compatibility mirror*, or *deprecated and replaced entirely*. **This choice requires owner approval and consumer compatibility tests**, not an arbitrary blanket update to all functions.

## Suggested release gates and priority

- **I1-N now:** preserve this complete source-hash inventory, run static app/manifest guard, and keep PRs #319/#324/#360/#361 open or historically traceable without dropping their unique RED controls.
- **I2 candidate design:** reproduce cross-character corruption for at least representative creation, level-up, action/rest, and feature/projection families in disposable signed PostgreSQL; test existing populated legacy sheet without `creationRequestId`, multi-editor/delegated account, rollback, repeat nonce, and cross-character concurrent updates.
- **Before production:** review every original write caller and RLS, 31 original Forge trigger definitions, actual source-qualified catalog, full browser character selection, backup+Storage isolated restore, exact release hashes and owner approval. Protect world/town/tactical maps and paid #325 agent state.

**Next single work item:** build the first representative signed *cross-family* legacy-sheet overwrite test on top of the I1-M scratch Artificer specimen (level-up vs action/rest vs projection), preserving original failing source evidence; do not implement broad migrations until the owner selects the legacy mirror authority contract.

## Verification scope

This research records database-source fingerprints and current repo consumers. It does not assert that a full 34-function behavioral test has been performed, that original production is repaired, or that all DB/app/external readers are exhausted. Changes in the underlying DB or app must re-run the source checks and update this snapshot explicitly; never silently loosen an MD5 guard or accept a failing original-source RED as a successful production repair.
