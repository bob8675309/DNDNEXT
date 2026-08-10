# PR #170 Final Acceptance — Current Status

Status date: 2026-08-10
PR: #170 (`agent/character-forge-resilience-presentation`)
Status: **open and unmerged**.

## Current live checkpoint

Production is registered through migration 89:

- 83 `defensive_tactics_runtime` — `20260809235754`
- 84 `whispers_of_the_dead_runtime` — `20260810001351`
- 85 `progression_rpc_acl_cleanup` — `20260810002421`
- 86 `player_forge_source_magic_materialization` — `20260810075628`
- 87 `source_magic_level_parser_fix` — `20260810075645`
- 88 `source_magic_feat_name_normalization_fix` — `20260810075724`
- 89 `pending_rest_runtime_choices` — `20260810181530`

Migrations 83-85 were already live when their source files were discovered missing from the PR branch. Their source and reachable Defensive Tactics/Whispers panels were restored to GitHub without reapplying the migrations.

## Repository gate before migration 89 deployment

Exact branch head `a05c4b03f9a36cbf9021108aa07856cfab474fd1` completed **31/31 PR-triggered GitHub workflows successfully**, and Vercel reported success before migration 89 was deployed.

Two stale validators were corrected during that gate:

- the source-magic validator was updated to assert the actual migration-86 helper call markers rather than nonexistent literal source-type tuples;
- the nested-choice validator was updated to assert the intended higher-level feat routing in **Training → Feats & Class Abilities**, rather than requiring the retired Abilities-step placement.

No runtime behavior was reverted to satisfy those stale contracts.

## Migration 89 deployed acceptance

`get_character_pending_rest_choices_v1` separates post-rest state into:

- `needsSelection` — current rest-cycle benefit is inactive or the first rest-backed choice is now required;
- `optionalChanges` — current persistent benefit remains active and a rest only unlocked replacement;
- `availableActions` — optional post-rest action windows.

Rollback-only authenticated fixtures proved the key distinction:

### Astral Trance temporary/rest-cycle case

A rollback fixture on an editable, non-encounter character temporarily used AAG Astral Elf authority and completed a Long Rest. The aggregate returned:

- `hasAttention = true`
- exactly one `needsSelection` entry
- Astral Trance classified as `temporary`
- no optional persistent entry

### Wild Heart persistent case

A separate rollback fixture temporarily aligned the same character to XPHB Barbarian 6 / Wild Heart, seeded an active Owl Aspect with an older replacement anchor, and completed a newer Long Rest. The source getter returned the active Owl aspect with `canReplace = true`, while the aggregate returned:

- `hasAttention = false`
- zero `needsSelection`
- exactly one `optionalChanges` entry for Aspect of the Wilds

This proves a persistent choice does not falsely flash merely because a rest unlocks replacement.

## ACL and residue proof

Live privilege checks after migration 89:

- anon execute on `public.get_character_pending_rest_choices_v1(uuid)` — false
- authenticated execute — true
- service_role execute — true
- anon/authenticated execute on `private.safe_character_runtime_profile_v1(text,uuid)` — false
- service_role execute on the private helper — true

After all migration-89 fixtures:

- characters: 7
- character_sheets: 7
- character_spells: 30
- character_progression: 7
- inventory_items: 18
- locations: 20
- map_routes: 4
- map_route_points: 9
- runtime rows: 0
- rest-log rows: 0
- migration-89 QA residue: 0

## Previous authenticated server/API acceptance

Before the source-magic/pending-rest pass, rollback-only acceptance under a real PostgreSQL `authenticated` role plus JWT claims successfully exercised Hunter's Prey, Defensive Tactics, Whispers of the Dead, character currency, and the retained v2 class-choice compatibility getter. Those fixtures also rolled back completely.

## Remaining external acceptance

The connected toolset still does not provide a real signed-in interactive browser session. Therefore this PR does **not** claim manual browser acceptance.

A human browser smoke should confirm:

- current Forge routing for Aven, Deep Gnome, Astral Elf, Witherbloom, higher-level feats, Invocations, and noncaster source-owned magic;
- responsive Continue/Back reachability and scrolling;
- Known Spellbook persistence after creation;
- after a qualifying rest, inactive/rest-cycle choices such as Astral Trance visibly request attention;
- persistent replacement opportunities such as Wild Heart remain quiet/collapsed;
- resolving a runtime choice clears/reclassifies the notice.

## Merge rule

Do not merge PR #170 without explicit user approval. Re-check the exact current PR head, GitHub/Vercel status, live migration list, ACLs, and production residue immediately before any approved merge.

## Protected boundaries

No work in this closure authorizes changes to `components/MapPageClient.js`, world-map behavior, town/city-map behavior, route/travel/weather, unrelated crafting/inventory, or tactical combat execution.
