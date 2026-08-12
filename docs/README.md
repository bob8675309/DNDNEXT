# DNDNext Living Documentation Index

This directory contains the project's living handoff, roadmap, architecture, and evidence documents. For active work, live Supabase + current repository source/validators outrank prose if they conflict.

## Start here

- `DNDNext_Current_Handoff_Prompt.md` — copy-ready continuation prompt and protected boundaries.
- `Documentation_Refresh_Manifest.md` — documentation precedence and current PR #170 checkpoint.
- `PR170_Final_Acceptance_Status.md` — current migration/build/database/authenticated acceptance and remaining focused browser re-smoke.
- `PR170_Browser_Smoke_Corrections_Status.md` — real signed-in browser findings, migration 90 Rage restoration, Forge presentation corrections, and re-smoke targets.
- `Forge_Species_Art_and_Collapse_Handoff.md` — **active Species presentation/artwork handoff**: independent chevrons/collapse state, parent/child descriptions, dedicated generated child-art rollout, exact recovery commits, current asset queue, validation contracts, and protected boundaries.
- `Forge_Species_Family_Submenu_Status.md` — controlling Species family/setting-variant rules/persistence ledger through migrations 91-93, including Genasi, Dragonborn, Aven, Elf, Gnome, Shifter, Fairy, Kithkin, and grouped setting variants.
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — earlier source-presentation history, structured Species/Background/Class rendering, and the migration-91 Genasi source-catalog foundation.
- `Current_Development_Status_and_Roadmap.md` — broad platform roadmap/history; newer subsystem ledgers supersede older sections.
- `Unified_Character_Forge_Status.md` — controlling Forge/progression/runtime ledger.

## Active Character Forge / progression / runtime documents

- `Character_Progression_Foundation.md` — normalized creation/progression architecture.
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation vs earned progression.
- `Character_Forge_PR_A_Deployment_Evidence.md` — migration/build/rollback evidence.
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — current player-facing choice placement plus migrations 86-88 source-magic authority.
- `Pending_Rest_Runtime_Choices_Status.md` — migration 89 post-rest attention vs persistent optional-replacement classification.
- `Progression_RPC_ACL_Cleanup_Status.md` — migration 85 bounded v2 compatibility getter ACL hardening.
- `Wizard_Spell_Mastery_Runtime_Status.md` — Spell Mastery runtime.
- `Wizard_Memorize_Spell_Runtime_Status.md` — Short-Rest prepared-spell replacement.
- `Wizard_Cantrip_Formulas_Runtime_Status.md` — PHB Wizard TCE Cantrip Formulas Long-Rest replacement.
- `Armorer_Armor_Model_Runtime_Status.md` — EFA/TCE Armorer model authority and migration-78 cadence repair.
- `Bestial_Soul_Runtime_Status.md` — PHB/TCE Beast Bestial Soul rest-created, next-rest-expiring adaptation authority through migrations 79-80.
- `Wild_Heart_Aspect_Runtime_Status.md` — XPHB Wild Heart Aspect of the Wilds immediate choice plus Long-Rest replacement authority through migration 81.
- `Hunters_Prey_Runtime_Status.md` — PHB permanent vs XPHB Short/Long-Rest Hunter's Prey authority through migration 82.
- `Defensive_Tactics_Runtime_Status.md` — PHB permanent vs XPHB Short/Long-Rest Defensive Tactics authority through migration 83.
- `Whispers_of_the_Dead_Runtime_Status.md` — TCE Phantom persistent borrowed proficiency authority through migration 84.
- `Player_Forge_Starting_Magic_v3_Status.md` — starting-magic authority.
- `Player_Forge_Starting_Equipment_Status.md` — starting equipment, wealth, currency.
- `Astral_Trance_Runtime_Status.md` — Astral Trance runtime.
- `Species_Rest_Proficiency_Runtime_Status.md` — Astral Knowledge / Skill Versatility.
- `Species_Replaceable_Cantrip_Runtime_Status.md` — replaceable Species cantrips.
- `Eladrin_Season_Trance_Runtime_Status.md` — Eladrin season/Trance runtime.
- `Primal_Companion_Runtime_Status.md` — Beast Master companion runtime.
- `Dread_Allegiance_Runtime_Status.md` — linked allegiance/resistance/cantrip runtime.
- `Fiendish_Resilience_Runtime_Status.md` — Short/Long-Rest resistance runtime.
- `Circle_of_the_Land_Runtime_Status.md` — Circle Spell package runtime.
- `Artificer_Magic_Item_Plans_Status.md` — EFA learned-plan authority and canonical wildcard item pools.
- `Boon_Energy_Resistance_Runtime_Status.md` — Boon runtime resistance choices.
- `Feat_Runtime_Expertise_Status.md` — Echoing Soul / Zhentarim Expertise lifecycle.
- `Cartomancer_Runtime_Status.md` — Hidden Ace temporary access.

Current cadence rule: persistent source-owned decisions belong to Forge/progression; rest decisions belong to runtime; per-use choices belong to action UI. Do not turn runtime choices into permanent Forge locks. A post-rest replacement opportunity is not automatically a missing choice: migration 89 distinguishes an inactive rest-cycle benefit from a still-active persistent selection. Migration 90 adds source-aware standalone Rest restoration for the sheet-side Rage action state without altering tactical combat state. Migrations 91-93 are catalogue/source-presentation work: Genasi subrace restoration, Genasi source-detail restoration, and Aven subrace restoration. They do not authorize unrelated runtime changes.

## Character sheet / inventory / crafting

- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — canonical item/inventory/equip/sheet/tactical authority.
- `Character_Sheet_Formula_Reference.md` — ability/save/skill/AC/initiative/passive formulas.
- `NPC_Character_Sheet_Selection_Reconciliation.md` — selection/stale-response ownership.
- `NPC_Profile_Inventory_Equipment_Reference.md` — profile/inventory/equipment presentation.
- `Town_Crafter_Current_Status.md` — town crafter/profile state.
- `Source_Patch_Pipeline_Audit.md` — source-bake / validator pipeline.
- `Deferred_UI_Polish_Backlog.md` — deferred UI work.

## Tactical encounter / sprites / security

Use the specific tactical phase ledger before changing encounter behavior; do not recreate existing tactical primitives.

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` and phase ledgers — combat roadmap/status.
- `Dawn_High_Quality_Prototype_Plan.md`, `Sprite_Production_Work_Map.md`, `Sprite_Production_Art_Bible.md`, `Sprite_Production_Run_Log.md` — sprite work.
- `Security_Hardening_Roadmap_Status.md` — security/database hardening.

Always inspect live grants/functions before modifying authenticated `SECURITY DEFINER` surfaces. Supabase advisor warnings outside the current audited slice are separate security backlog, not permission to scope-creep a Forge/runtime patch.

## Current exact Forge checkpoint

PR #170 remains open and unmerged on `agent/character-forge-resilience-presentation`.

Exact validated Species presentation/artwork checkpoint:

`7e69443a13058e2e9399a9c26922b2b82253f898` — `Promote Fire Genasi dedicated Forge artwork`

That exact head completed **33/33 PR-triggered workflows successfully** and Vercel deployment succeeded. It preserves the established family/chevron behavior, keeps canonical artwork resolution stable outside the Forge, and has two newly committed dedicated child assets:

- `public/media/species/fire-genasi.webp`
- `public/media/species/gold-dragonborn.webp`

The active continuation ledger is `Forge_Species_Art_and_Collapse_Handoff.md`. It records the Fire Genasi binary-upload recovery, exact Git-blob integrity check, remaining art queue, validation contracts, database boundary, and browser re-smoke checklist. Documentation-only descendants do not supersede `7e69443...` as the exact tested runtime/source/art tree.

Live database authority remains migration 93:

`20260812042950 aven_subrace_catalog`

Production Species counts are 166 raw / 102 preferred. Protected campaign/runtime/map counts remain 7 characters, 7 sheets, 30 character-spell rows, 7 progression rows, 18 inventory rows, 20 locations, 4 map routes, and 9 route points.

## Protected-boundary rule

Character Forge/progression/runtime work does not authorize changes to world-map, town/city-map behavior, route/travel/weather simulation, tactical encounter behavior, or unrelated crafting systems. `components/MapPageClient.js` remains outside current scope unless explicitly requested.
