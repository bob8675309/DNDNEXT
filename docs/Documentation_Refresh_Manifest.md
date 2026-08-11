# Documentation Refresh Manifest

Updated: 2026-08-11

## Trust order

For active PR #170 work, trust sources in this order:

1. live Supabase schema/migrations/grants/data;
2. current PR source and exact-head CI/Vercel;
3. dedicated runtime/progression/browser-smoke/source-presentation ledgers;
4. broader roadmap/history prose.

If prose conflicts with live source/database state, live authority wins until docs are corrected.

## Current PR #170 checkpoint

Production is accepted through **migration 91**.

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
- 89 — read-only post-rest runtime-choice aggregation and attention classification;
- 90 — source-aware standalone Rest restoration for sheet-side Barbarian Rage action state;
- 91 — catalogue-only MPMM Genasi subrace backfill supporting the unified Elemental Lineage Species selector.

Latest registered migration: `genasi_subrace_catalog` (`20260811062025`).

## Authoritative recent ledgers

Read before modifying these areas:

- `Forge_Source_Presentation_and_Species_Variants_Status.md`
- `PR170_Browser_Smoke_Corrections_Status.md`
- `PR170_Final_Acceptance_Status.md`
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`
- `Pending_Rest_Runtime_Choices_Status.md`
- `Defensive_Tactics_Runtime_Status.md`
- `Whispers_of_the_Dead_Runtime_Status.md`
- `Progression_RPC_ACL_Cleanup_Status.md`
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
- class action with source-defined recovery → action-state authority restored by the appropriate standalone Rest RPC without rewriting tactical state;
- per-use/per-cast choice → action/spell resolver;
- informational/always-on feature → display/consumer logic.

Accepted contrasts:

- Armor Model: immediate initial choice; Short/Long-Rest replacement; persists until changed.
- Bestial Soul: first choice after a qualifying Short/Long Rest; expires at the next qualifying rest.
- Aspect of the Wilds: immediate initial choice; Long-Rest-only replacement; persists until changed.
- Hunter's Prey / Defensive Tactics: PHB editions remain permanent acquisition choices; XPHB editions are persistent runtime choices with Short/Long-Rest replacement.
- Whispers of the Dead: first choice requires a qualifying rest; borrowed proficiency persists until replaced after a later qualifying rest.
- Astral Trance: current Long-Rest-cycle proficiencies expire at the next Long Rest and therefore require a new current-cycle choice.
- Rage: XPHB regains one spent use on Short Rest and all on Long Rest; PHB remains Long-Rest-only.

## Current Forge source-presentation model

The Player Forge now treats source structure as data rather than flattening every imported rule into prose.

- `SourceRuleContent` renders source paragraphs, named sections, lists, and tables.
- detailed Class features preserve `class_feature_catalog.entries` and use the shared structured renderer;
- Background feature presentation keeps mechanical source table/list structure while intentionally suppressing random/optional flavor tables such as `roll on this table` guidance;
- structured persistent Species decisions use their source-owned selector as the detailed comparison surface instead of repeating the entire option table/list in the feature prose.

Source-structure audit at this checkpoint found:

- Species: 160 rows before migration 91; 8 table-bearing source payloads, 20 list-bearing payloads, 17 version-bearing payloads;
- Background: 161 rows; 88 table-bearing source payloads and list structures across the imported set;
- Class features: 2,118 rows; 122 with source tables, 91 with source lists, 187 with nested named-entry blocks.

Read `Forge_Source_Presentation_and_Species_Variants_Status.md` for implementation details and browser re-smoke targets.

## Species variant-family model

Deep Species branches should normally be represented as a parent Species plus a source-owned nested selector when the source family can be modeled without losing edition/rule identity.

Current families:

- **Genasi (MPMM):** one Genasi parent + Air/Earth/Fire/Water Elemental Lineage options. Migration 91 restored the four child catalogue records omitted by the old importer. The importer now reads `races.json.subrace[]` so future reviewed imports reproduce the model.
- **Dragonborn:** the XPHB parent owns the ten standard Draconic Ancestry colors; the five FTD Gem ancestries are exposed in the same creation selector but are explicitly marked as the FTD Gem rule family and retain Gem-specific trait summaries. FTD source-family mechanics are not silently blended into XPHB rules.
- **Tiefling Fiendish Legacy / Goliath Giant Ancestry:** source tables/lists feed coherent selector choices with row/item-specific mechanics rather than prose walls.

Species skill proficiency choices remain routed to Training; Species magic remains routed to Spells; runtime-only rest choices remain outside permanent Forge authority.

## Migration 91 proof

`sql/20260811_91_genasi_subrace_catalog.sql` was tested in a rollback transaction first. The fixture produced all four MPMM child rows and then rolled back to zero residue.

After repository production-build gates passed, migration 91 was applied live as `20260811062025 genasi_subrace_catalog`.

Post-deploy verification:

- Genasi (Air), (Earth), (Fire), and (Water) rows exist with parent/variant identity;
- movement, resistance, and additional-spell metadata are present;
- Species catalogue count changed 160 → 164 as expected;
- characters 7;
- character_sheets 7;
- character_spells 30;
- character_progression 7;
- inventory_items 18;
- locations 20;
- map_routes 4;
- map_route_points 9.

No campaign/runtime/map rows changed.

## Exact-head gate before documentation reconciliation

Code head `dec7a45241bbe471978d0c0607a175b91327844c` completed **33/33 PR-triggered GitHub workflows successfully**.

Notable passing gates:

- `Validate Forge source presentation` including its production build;
- `Validate PR170 browser smoke corrections` including its production build;
- NPC Forge foundation;
- Character Forge nested choices;
- Player Forge source magic;
- starting magic/equipment;
- Artificer Magic Item Plans;
- progression/runtime/portrait/currency checks.

Vercel reported a failure marker only because the account hit the Vercel build-rate limit. The repository production build succeeded twice on the same exact code head. Do not describe the Vercel marker as an application compilation failure.

Documentation commits move the branch head beyond `dec7a452...`; exact-head GitHub gates must be checked again after documentation reconciliation.

## Remaining PR closure work

- focused user signed-in browser re-smoke of the Species cases listed in `Forge_Source_Presentation_and_Species_Variants_Status.md`;
- continue the user's Background/Class browser pass tomorrow and feed any malformed source structures back into the shared renderer rather than patching one entry at a time;
- exact-head CI check after documentation reconciliation;
- Vercel may remain externally rate-limited until its build allowance resets;
- final live migration/ACL/residue check immediately before any approved merge;
- merge only after explicit user approval.

## Protected boundaries

This work does not authorize changes to world-map, town/city-map, route/travel/weather, unrelated crafting/inventory execution, or tactical action execution. `components/MapPageClient.js` remains outside current scope unless explicitly requested.
