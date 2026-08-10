# PR #170 Final Acceptance — Current Status

Status date: 2026-08-10
PR: #170 (`agent/character-forge-resilience-presentation`)
Status: **open and unmerged**.

## Current live checkpoint

Production is registered through migration 90:

- 83 `defensive_tactics_runtime` — `20260809235754`
- 84 `whispers_of_the_dead_runtime` — `20260810001351`
- 85 `progression_rpc_acl_cleanup` — `20260810002421`
- 86 `player_forge_source_magic_materialization` — `20260810075628`
- 87 `source_magic_level_parser_fix` — `20260810075645`
- 88 `source_magic_feat_name_normalization_fix` — `20260810075724`
- 89 `pending_rest_runtime_choices` — `20260810181530`
- 90 `rest_class_feature_restoration` — `20260810205646`

Migrations 83-85 were already live when their source files were discovered missing from the PR branch. Their source and reachable Defensive Tactics/Whispers panels were restored to GitHub without reapplying the migrations.

## Real signed-in browser smoke

The user completed a real signed-in browser smoke after migration 89. This is stronger presentation evidence than the previous server/API-only state, but it exposed several concrete defects that required a correction pass. The pre-fix browser findings included:

- XPHB Barbarian Rage did not recover through the standalone sheet Rest RPC;
- Deep Gnome could still receive an isolated casting-ability prompt before its level-gated spell grant;
- Witherbloom/Strixhaven background display had non-mechanical flavor copy, low-contrast secondary text, and no expanded-spell description hover;
- long Class feature option lists could open but were difficult/impossible to collapse;
- the Class detail dock was not useful through a very tall guide;
- Species Bonus feat follow-up decisions were appearing on Abilities instead of being acknowledged there and resolved later;
- same-name subclass reprints could appear more than once;
- Artificer Magic Item Plan availability and canonical item detail needed clearer presentation.

Those findings are documented in `PR170_Browser_Smoke_Corrections_Status.md`.

The corrected build has not yet been re-smoked by the user, so this PR does **not** claim final browser acceptance yet.

## Migration 89 deployed acceptance

`get_character_pending_rest_choices_v1` separates post-rest state into:

- `needsSelection` — current rest-cycle benefit is inactive or the first rest-backed choice is now required;
- `optionalChanges` — current persistent benefit remains active and a rest only unlocked replacement;
- `availableActions` — optional post-rest action windows.

Rollback-only authenticated fixtures proved Astral Trance as an attention-required current-cycle case and Wild Heart Aspect as a quiet persistent optional replacement.

## Migration 90 — deployed Rage/rest acceptance

Migration 90 extends the existing standalone character-sheet Rest authority to the class action state the sheet currently persists: Barbarian Rage.

Accepted behavior:

- XPHB Rage regains one spent use on a Short Rest and all spent uses on a Long Rest;
- PHB Rage remains Long-Rest-only;
- a qualifying rest clears the sheet-side active Rage flag;
- the public Rest RPC returns the updated sheet and `restoredClassFeatureUses`;
- no encounter/tactical state is mutated;
- the existing active-encounter rest-log guard remains transactional authority.

Rollback-only tests against the **deployed** migration-90 functions proved:

- XPHB 1/3 + Short -> 2/3, restored 1, inactive;
- second XPHB Short -> 3/3, restored 1;
- Short at maximum -> remains 3/3, restored 0;
- XPHB 1/3 + Long -> 3/3, restored 2;
- PHB 1/3 + Short -> remains 1/3, restored 0;
- PHB 1/3 + Long -> 3/3, restored 2;
- an authenticated Varges-owner fixture from 2/3 + Long returned `restoredClassFeatureUses=1` and a returned sheet containing 3/3 Rage.

All fixtures rolled back. Varges's real sheet remains 2/3 until a normal user rest is performed; QA did not silently repair the valued character.

### Migration 90 ACL

- anon execute on `public.complete_character_rest_v1(uuid,text)` — false
- authenticated execute — true
- service_role execute — true
- anon/authenticated execute on `private.restore_character_rest_action_state_v1(uuid,text)` — false
- service_role execute on the private helper — true

## Browser-correction repository gate

Before migration 90 deployment, exact code head `98b55355ed92d3d3309c09b8c534095d13859089` completed **32/32 PR-triggered GitHub workflows successfully**, including the dedicated browser-smoke correction validator and production build gate. Vercel also reported success on that exact code head.

The subclass compatibility gate caught and preserved an important existing rule: a complete older/supplemental definition must not be hidden by a newer incomplete placeholder. Final same-name deduplication therefore uses complete-definition-first, then newest-source ordering among complete reprints.

The smoke workflow uses the repository's existing relative-JS Node loader so its semantic fixtures execute under the same extensionless import convention as the project.

## Current production integrity

After migration 90 deployed acceptance and rollback-only lifecycle tests:

- characters: 7
- character_sheets: 7
- character_spells: 30
- character_progression: 7
- inventory_items: 18
- character_rest_log: 2 legitimate user-created browser-smoke rows
- Varges Rage: 2/3, unchanged by QA
- locations: 20
- map_routes: 4
- map_route_points: 9

The two rest rows are real browser-smoke actions and are intentionally retained. Migration-90 QA added no persistent rest rows.

## Previous authenticated server/API acceptance

Rollback-only acceptance under a real PostgreSQL `authenticated` role plus JWT claims has also exercised Hunter's Prey, Defensive Tactics, Whispers of the Dead, character currency, the retained v2 class-choice compatibility getter, pending-rest aggregation, and the migration-90 Rest RPC. Those fixtures rolled back completely.

## Remaining external acceptance

The remaining browser work is a focused **re-smoke of the corrected cases**, not a repeat of the entire PR:

- Varges or another XPHB Barbarian: spent Rage + Short/Long Rest restoration;
- Deep Gnome low-level no-op prompt removal and level 3/5 source magic;
- Witherbloom flavor cleanup, higher text contrast, and spell-description hover/focus;
- long Class list open/collapse behavior;
- sticky Class feature detail dock on tall guides;
- Species Bonus feat acknowledgement on Abilities with owned follow-up decisions later;
- same-name subclass deduplication retaining the best/newest complete definition;
- Artificer plan availability/future unlock presentation and canonical item detail.

## Merge rule

Do not merge PR #170 without explicit user approval. Re-check the exact current PR head, GitHub/Vercel status, live migration list, ACLs, and production residue immediately before any approved merge.

## Protected boundaries

No work in this closure authorizes changes to `components/MapPageClient.js`, world-map behavior, town/city-map behavior, route/travel/weather, unrelated crafting/inventory execution, or tactical combat execution.
