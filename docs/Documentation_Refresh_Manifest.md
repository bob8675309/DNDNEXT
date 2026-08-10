# Documentation Refresh Manifest

Updated: 2026-08-10

## Trust order

For active PR #170 work, trust sources in this order:

1. live Supabase schema/migrations/grants/data;
2. current PR source and exact-head CI/Vercel;
3. dedicated runtime/progression ledgers;
4. broader roadmap/history prose.

If prose conflicts with live source/database state, live authority wins until docs are corrected.

## Current PR #170 checkpoint

Production is accepted through **migration 89**.

Recent sequence:

- 74-75 — Wizard Memorize Spell;
- 76 — shared Wizard runtime helper repair;
- 77 — PHB Wizard Cantrip Formulas;
- 78 — Armorer Armor Model + shared `short_or_long_rest` cadence repair;
- 79-80 — Bestial Soul runtime + source-list resolver fix;
- 81 — XPHB Wild Heart Aspect of the Wilds;
- 82 — XPHB Hunter's Prey while PHB Hunter's Prey remains permanent Forge authority;
- 83 — XPHB Defensive Tactics while PHB Defensive Tactics remains permanent Forge authority;
- 84 — TCE Phantom Whispers of the Dead persistent borrowed proficiency runtime;
- 85 — bounded progression v2 compatibility RPC ACL cleanup;
- 86 — Player Forge source-magic materialization;
- 87 — source-magic level/choice parser correction;
- 88 — source-magic feat-name normalization correction;
- 89 — read-only post-rest runtime-choice aggregation and attention classification.

Latest registered migration: `pending_rest_runtime_choices` (`20260810181530`).

## Source-control parity note

During the migration-89 startup audit, live Supabase contained migrations 83-85 while their SQL files and the Defensive Tactics/Whispers reachable panels were missing from the PR branch. The missing source was restored. Migrations 83-85 were **not** re-applied to production.

## Authoritative recent ledgers

Read before modifying these areas:

- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`
- `Pending_Rest_Runtime_Choices_Status.md`
- `Defensive_Tactics_Runtime_Status.md`
- `Whispers_of_the_Dead_Runtime_Status.md`
- `Progression_RPC_ACL_Cleanup_Status.md`
- `PR170_Final_Acceptance_Status.md`
- `Wizard_Memorize_Spell_Runtime_Status.md`
- `Wizard_Cantrip_Formulas_Runtime_Status.md`
- `Armorer_Armor_Model_Runtime_Status.md`
- `Bestial_Soul_Runtime_Status.md`
- `Wild_Heart_Aspect_Runtime_Status.md`
- `Hunters_Prey_Runtime_Status.md`
- `Boon_Energy_Resistance_Runtime_Status.md`
- `Feat_Runtime_Expertise_Status.md`
- `Cartomancer_Runtime_Status.md`
- `DNDNext_Current_Handoff_Prompt.md`

Older runtime ledgers remain authoritative for their accepted slices unless contradictory live evidence exists.

## Modeling rule

- permanent source-owned acquisition → Forge/progression authority;
- rest-configurable persistent choice → runtime authority whose current selection remains active until changed;
- next-rest-expiring choice → rest-anchored runtime state whose getter treats stale state as inactive;
- first choice unlocked only by a rest → attention only while no benefit is active;
- per-use/per-cast choice → action/spell resolver;
- informational/always-on feature → display/consumer logic.

Accepted contrasts:

- Armor Model: immediate initial choice; Short/Long-Rest replacement; persists until changed.
- Bestial Soul: first choice after a qualifying Short/Long Rest; expires at the next qualifying rest.
- Aspect of the Wilds: immediate initial choice; Long-Rest-only replacement; persists until changed.
- Hunter's Prey / Defensive Tactics: PHB editions remain permanent acquisition choices; XPHB editions are persistent runtime choices with Short/Long-Rest replacement.
- Whispers of the Dead: first choice requires a qualifying rest; borrowed proficiency persists until replaced after a later qualifying rest.
- Astral Trance: current Long-Rest-cycle proficiencies expire at the next Long Rest and therefore require a new current-cycle choice.

## Forge choice-routing/source-magic pass

The player Forge now separates explanation from resolution:

- Species/Class surfaces explain rules;
- Training resolves skills/proficiencies plus Feats & Class Abilities;
- Spells resolves spell-centric Species/Feat/Background/Class-feature decisions;
- Abilities is score generation/allocation rather than a higher-level feat decision surface;
- fixed source languages and fixed Strixhaven college identity are automatic source authority;
- allowed casting ability is automatically resolved where choosing a weaker permitted stat has no gameplay benefit.

Migrations 86-88 materialize validated source-owned Species/Feat magic into `character_spells`. Rollback acceptance covers Astral Elf, Deep Gnome levels 3/5, Witherbloom Student, and Magic Initiate.

## Post-rest presentation pass

Migration 89 and `CharacterRestChoiceNotice` divide post-rest state into:

- `needsSelection` — flashes/pulses because a current benefit is inactive or the initial rest-backed choice is waiting;
- `optionalChanges` — current persistent benefit remains active; quiet/collapsed;
- `availableActions` — optional post-rest actions; quiet/collapsed.

Rollback acceptance directly proved Astral Trance as attention and Wild Heart Aspect as a non-flashing optional persistent replacement.

## Current production integrity

After migration 89 and rollback-only acceptance:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 18 inventory rows;
- 0 runtime rows;
- 0 rest-log rows;
- 0 migration-89 QA residue;
- 20 locations;
- 4 map routes;
- 9 map route points.

Exact head `a05c4b03f9a36cbf9021108aa07856cfab474fd1` passed 31/31 PR-triggered workflows and Vercel immediately before migration 89 deployment. Documentation-only closure commits must be gated again after they move the head.

## Remaining PR closure work

- re-run exact-head CI/Vercel after final documentation reconciliation;
- real interactive signed-in browser smoke across representative Forge/source-magic/runtime-rest cases;
- keep unrelated Supabase security-advisor findings as separately audited backlog rather than scope-creeping this PR;
- merge only after explicit user approval and a final live/head/residue check.

## Protected boundaries

This work does not authorize changes to world-map, town/city-map, route/travel/weather, unrelated crafting/inventory, or tactical action execution. `components/MapPageClient.js` remains outside current scope unless explicitly requested.
