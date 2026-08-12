# Documentation Refresh Manifest

Updated: 2026-08-11/12

## Trust order

For active PR #170 work, trust sources in this order:

1. live Supabase schema/migrations/grants/data;
2. current PR source and exact-head CI/deployment state;
3. dedicated runtime/progression/browser-smoke/source-presentation ledgers;
4. broader roadmap/history prose.

If prose conflicts with live source/database state, live authority wins until docs are corrected.

## Current PR #170 checkpoint

PR #170 remains open and unmerged on `agent/character-forge-resilience-presentation`.

Exact validated source/runtime code head:

`d2b64bd1128a0457393283a463fddd71cc7c9094` — `Preserve canonical Species family labels`

Production database authority is accepted through migration 93:

`20260812042950 aven_subrace_catalog`

Recent catalogue/source migrations:

- 91 — `20260811062025 genasi_subrace_catalog`;
- 92 — `20260812033649 genasi_source_detail_restore`;
- 93 — `20260812042950 aven_subrace_catalog`.

## Exact-head validation

For code head `d2b64bd1128a0457393283a463fddd71cc7c9094`:

- **33/33 PR-triggered GitHub workflows succeeded**;
- `Validate Forge source presentation` passed the original structured-source contract, the established Genasi/Dragonborn family contract, the expanded Species-family contract, and its production build;
- `Validate PR170 browser smoke corrections` passed its contract and production build;
- NPC Forge, Character Forge nested-choice, source-magic, equipment, progression, runtime, portrait, currency, Artificer, and related regression gates all succeeded.

A later documentation-only descendant does not supersede this tested code checkpoint. Use `d2b64bd...` when referring to the exact runtime/source tree that received the full 33/33 gate.

## Authoritative recent ledgers

Read before modifying these areas:

- `Forge_Species_Family_Submenu_Status.md` — controlling Species family/setting-variant presentation ledger through migrations 91-93;
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — earlier structured source-presentation foundation/history;
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

`SourceRuleContent` remains the shared structured source renderer. The detailed Class path preserves structured `entries` rather than depending only on flattened descriptions.

### Background

Mechanical source rows remain organized while optional/random flavor-generation tables are suppressed where appropriate. Background presentation work should continue through shared rendering rather than per-entry hacks.

### Species

The current Species model has three presentation classes:

1. **parent-persisted family choices** — Genasi, Dragonborn, Aven, and source-owned lineage/subtype choices promoted for Elf, Gnome, Shifter, Fairy, and Kithkin;
2. **real setting/source Species rows visually nested beneath a semantic parent** — Human variants from Innistrad/Ixalan/Kaladesh/Zendikar, Dwarf (Kaladesh), Elf (Kaladesh/Zendikar), Orc (Ixalan), Minotaur (Amonkhet), Goblin (Dankwood);
3. **inline trait choices** — Goliath Giant Ancestry, Tiefling Fiendish Legacy, and other choices whose lifecycle or semantics do not define a catalogue child Species identity.

Setting children keep their real catalogue ID/source/rules and save identity. They are not projected through the modern parent ruleset.

Distinct species such as Sea Elf, Astral Elf, Eladrin, Shadar-kai, Duergar, and Deep Gnome remain independent unless their source explicitly defines a parent relationship.

Species skill choices remain routed to Training; Species magic remains routed to Spells; runtime-only rest choices remain outside permanent Forge authority.

## Live database verification

Migration 93 was transaction-tested with rollback before deployment and then applied live.

Current production counts:

- raw Species catalogue: 166;
- preferred Species view: 102;
- characters: 7;
- character_sheets: 7;
- character_spells: 30;
- character_progression: 7;
- inventory_items: 18;
- locations: 20;
- map_routes: 4;
- map_route_points: 9.

The only count change from the pre-migration-93 baseline is the two intended Aven source rows.

## Protected boundaries

Current Forge work does not authorize world-map, town/city-map, route/travel/weather, unrelated crafting/inventory execution, or tactical action execution. `components/MapPageClient.js` remains outside scope unless explicitly requested.

## Remaining PR closure work

- deploy/re-smoke the expanded Species family presentation in a real signed-in browser;
- continue remaining Background/Class visual QA through shared presentation fixes;
- perform final live migration/ACL/residue and exact-head checks immediately before any approved merge;
- merge only after explicit user approval.
