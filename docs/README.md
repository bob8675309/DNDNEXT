# DNDNext Living Documentation Index

This directory contains the project's living handoff, roadmap, architecture, and evidence documents. For active work, live Supabase + current repository source/validators outrank prose if they conflict.

## Start here

- `DNDNext_Current_Handoff_Prompt.md` — copy-ready continuation prompt and protected boundaries.
- `Documentation_Refresh_Manifest.md` — documentation precedence and current PR #170 checkpoint.
- `Current_Development_Status_and_Roadmap.md` — broad platform roadmap/history; newer subsystem ledgers supersede older sections.
- `Unified_Character_Forge_Status.md` — controlling Forge/progression/runtime ledger.

## Active Character Forge / progression / runtime documents

- `Character_Progression_Foundation.md` — normalized creation/progression architecture.
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation vs earned progression.
- `Character_Forge_PR_A_Deployment_Evidence.md` — migration/build/rollback evidence.
- `Wizard_Spell_Mastery_Runtime_Status.md` — Spell Mastery runtime.
- `Wizard_Memorize_Spell_Runtime_Status.md` — Short-Rest prepared-spell replacement.
- `Wizard_Cantrip_Formulas_Runtime_Status.md` — PHB Wizard TCE Cantrip Formulas Long-Rest replacement.
- `Armorer_Armor_Model_Runtime_Status.md` — EFA/TCE Armorer model authority and migration-78 cadence repair.
- `Bestial_Soul_Runtime_Status.md` — PHB/TCE Beast Bestial Soul rest-created, next-rest-expiring adaptation authority through migrations 79-80.
- `Wild_Heart_Aspect_Runtime_Status.md` — XPHB Wild Heart Aspect of the Wilds immediate choice plus Long-Rest replacement authority through migration 81.
- `Hunters_Prey_Runtime_Status.md` — PHB permanent vs XPHB Short/Long-Rest Hunter's Prey authority through migration 82.
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
- `Artificer_Magic_Item_Plans_Status.md` — EFA learned-plan authority.
- `Boon_Energy_Resistance_Runtime_Status.md` — Boon runtime resistance choices.
- `Feat_Runtime_Expertise_Status.md` — Echoing Soul / Zhentarim Expertise lifecycle.
- `Cartomancer_Runtime_Status.md` — Hidden Ace temporary access.

Current cadence rule: persistent source-owned decisions belong to Forge/progression; rest decisions belong to runtime; per-use choices belong to action UI. Do not turn runtime choices into permanent Forge locks.

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

Always inspect live grants/functions before modifying authenticated `SECURITY DEFINER` surfaces.

## Protected-boundary rule

Character Forge/progression/runtime work does not authorize changes to world-map, town/city-map behavior, route/travel/weather simulation, tactical encounter behavior, or unrelated crafting systems. `components/MapPageClient.js` remains outside current scope unless explicitly requested.
