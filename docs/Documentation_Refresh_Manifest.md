# Documentation Refresh Manifest

Updated: 2026-08-11

## Trust order

For active PR #170 work, trust sources in this order:

1. live Supabase schema/migrations/grants/data;
2. current PR source and exact-head CI/deployment state;
3. dedicated runtime/progression/browser-smoke/source-presentation ledgers;
4. broader roadmap/history prose.

If prose conflicts with live source/database state, live authority wins until docs are corrected.

## Current PR #170 checkpoint

PR #170 remains open and unmerged on `agent/character-forge-resilience-presentation`.

Production database authority is accepted through migration 91:

`20260811062025 genasi_subrace_catalog`

Latest validated source-presentation code head:

`6106eea26f5de0f43b435a1d41563b8549daeb95` — `Tighten Forge source and species variant presentation`

No new migration or Supabase write was required by that continuation patch.

## Exact-head validation

For code head `6106eea26f5de0f43b435a1d41563b8549daeb95`:

- **33/33 PR-triggered GitHub workflows succeeded**;
- `Validate Forge source presentation` passed its focused contract and production build;
- `Validate PR170 browser smoke corrections` passed its contract and production build;
- the broader NPC Forge, Character Forge nested-choice, source-magic, equipment, progression, runtime, portrait, currency, Artificer, and related regression gates all succeeded.

A later documentation-only descendant does not supersede this tested code checkpoint; use `6106eea...` when referring to the exact code that received the full 33/33 gate.

## Authoritative recent ledgers

Read before modifying these areas:

- `Forge_Source_Presentation_and_Species_Variants_Status.md`;
- `PR170_Browser_Smoke_Corrections_Status.md`;
- `PR170_Final_Acceptance_Status.md`;
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`;
- `Pending_Rest_Runtime_Choices_Status.md`;
- `Defensive_Tactics_Runtime_Status.md`;
- `Whispers_of_the_Dead_Runtime_Status.md`;
- `Progression_RPC_ACL_Cleanup_Status.md`;
- `Wizard_Memorize_Spell_Runtime_Status.md`;
- `Wizard_Cantrip_Formulas_Runtime_Status.md`;
- `Armorer_Armor_Model_Runtime_Status.md`;
- `Bestial_Soul_Runtime_Status.md`;
- `Wild_Heart_Aspect_Runtime_Status.md`;
- `Hunters_Prey_Runtime_Status.md`;
- `Boon_Energy_Resistance_Runtime_Status.md`;
- `Feat_Runtime_Expertise_Status.md`;
- `Cartomancer_Runtime_Status.md`;
- `DNDNext_Current_Handoff_Prompt.md`.

Older runtime ledgers remain authoritative for their accepted slices unless contradictory live evidence exists.

## Core modeling rule

- permanent source-owned acquisition → Forge/progression authority;
- rest-configurable persistent choice → runtime authority whose current selection remains active until changed;
- next-rest-expiring choice → rest-anchored runtime state whose getter treats stale state as inactive;
- first choice unlocked only by a rest → attention only while no benefit is active;
- class action with source-defined recovery → action-state authority restored by the appropriate standalone Rest RPC without rewriting tactical state;
- per-use/per-cast choice → action/spell resolver;
- informational/always-on feature → display/consumer logic.

Accepted cadence contrasts remain unchanged, including Armor Model, Bestial Soul, Aspect of the Wilds, Hunter's Prey/Defensive Tactics source differences, Whispers of the Dead, Astral Trance, and Rage.

## Current Forge source-presentation model

### Class

`SourceRuleContent` is the shared structured source renderer. The current detailed Class path covers paragraphs/named sections, item/itemSpell, lists/tables, class/subclass/optional-feature/feat references, statblock references, source options, ability DC/attack modifier formulas, and quotes.

The live audit found 2,118 Class feature rows. Seventy-five have blank flattened descriptions but all 75 retain structured `entries`; zero are blank and structureless. The detailed guide therefore continues to preserve `class_feature_catalog.entries` as the richer source authority.

### Background

All 161 live Background rows have nonblank stored descriptions and no raw 5etools markup. Existing structured Background presentation keeps mechanical source rows organized and suppresses explicitly optional/random flavor-generation tables.

### Species

All 164 live Species rows have nonblank descriptions. The shared player-facing formatter now handles alphanumeric source tag names, fixing the Custom Lineage `{@5etools feat|feats.html}` leak without mutating catalogue data.

Rich persistent Species choices use compact initial buttons and full selected detail.

Current deep-family behavior:

- **Genasi (MPMM):** one parent + Air/Earth/Fire/Water Elemental Lineage. Selected child facts/traits project into the right-side information panel without changing persisted parent identity or spell authority.
- **Dragonborn:** one XPHB parent selector with ten standard XPHB ancestries + five explicitly FTD Gem choices. An FTD Gem selection projects the FTD Gem source presentation and removes incompatible XPHB-only surrounding cards for that selected rule family.
- **Tiefling Fiendish Legacy:** compact three-package selector; row-specific resistance/spell mechanics remain intact in selected detail.
- **Goliath Giant Ancestry:** compact six-choice selector; item-specific mechanics remain intact in selected detail.

Other parenthetical live Species entries are mostly distinct setting/source variants and were intentionally not collapsed into generic parent selectors.

Species skill choices remain routed to Training; Species magic remains routed to Spells; runtime-only rest choices remain outside permanent Forge authority.

## Migration 91 remains authoritative

`sql/20260811_91_genasi_subrace_catalog.sql` was rollback-tested before deployment and applied live as `20260811062025 genasi_subrace_catalog`.

The four MPMM Genasi child rows exist with parent/variant identity and source-derived metadata. Species catalogue count changed 160 → 164 as expected. No campaign/runtime/map rows were changed by migration 91.

The 2026-08-11 continuation patch made no database changes.

## Protected boundaries

Current Forge work does not authorize world-map, town/city-map, route/travel/weather, unrelated crafting/inventory execution, or tactical action execution. `components/MapPageClient.js` remains outside scope unless explicitly requested.

## Remaining PR closure work

- confirm a deployment containing validated code head `6106eea...` or a code-identical descendant;
- focused signed-in browser re-smoke of Tiefling, Goliath, Genasi, Dragonborn, Custom Lineage, representative Class source-node examples, and Background structured rules;
- continue any remaining Background/Class visual QA through shared presentation fixes rather than entry-specific patches;
- final live migration/ACL/residue check immediately before any approved merge;
- merge only after explicit user approval.
