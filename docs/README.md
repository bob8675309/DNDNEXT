# DNDNext Living Documentation Index

This directory contains the project's living handoff, roadmap, architecture, and evidence documents. When starting a new work session, use the document matching the subsystem being changed and update it when a milestone, failure, acceptance decision, or architecture boundary changes.

## Start here

- `DNDNext_Current_Handoff_Prompt.md` — copy-ready prompt for a new development session. It defines the required inspection workflow, protected boundaries, document precedence, and current continuation point.
- `Documentation_Refresh_Manifest.md` — current documentation-precedence overlay and active PR #170 checkpoint.
- `Current_Development_Status_and_Roadmap.md` — broad platform roadmap/history. Active subsystem ledgers below supersede older subsystem sections when newer.
- `Unified_Character_Forge_Status.md` — controlling Character Forge/progression/runtime acceptance ledger for PR #170.

## Active Character Forge / progression / runtime documents

- `Unified_Character_Forge_Status.md` — shared NPC/player Forge state, runtime cadence boundary, and remaining blockers.
- `Character_Progression_Foundation.md` — server-authoritative creation/progression architecture and normalized source ownership.
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation vs earned-progression convergence.
- `Character_Forge_PR_A_Deployment_Evidence.md` — migration/build/rollback evidence.
- `Wizard_Spell_Mastery_Runtime_Status.md` — Wizard Spell Mastery Long-Rest runtime authority.
- `Player_Forge_Starting_Magic_v3_Status.md` — native class, Background-expanded, Eldritch Knight, and Arcane Trickster starting-magic authority.
- `Player_Forge_Starting_Equipment_Status.md` — source-backed starting equipment, higher-level wealth, and character-scoped currency authority.
- `Astral_Trance_Runtime_Status.md` — AAG Astral Elf Long-Rest skill + weapon/tool runtime proficiency authority.
- `Species_Rest_Proficiency_Runtime_Status.md` — MPMM Githyanki Astral Knowledge and EFA Khoravar Skill Versatility Long-Rest proficiency authority, migrations 63-66, ACL corrections, and rollback acceptance.
- `Species_Replaceable_Cantrip_Runtime_Status.md` — XPHB High Elf and EFA Khoravar fixed-initial / Long-Rest-replaceable Species cantrip authority, migration 67, normalized Species spell ownership, and rollback acceptance.
- `Primal_Companion_Runtime_Status.md` — Beast Master current-companion and Long-Rest replacement authority.
- `Dread_Allegiance_Runtime_Status.md` — linked allegiance/resistance/cantrip runtime authority.
- `Fiendish_Resilience_Runtime_Status.md` — Short/Long-Rest resistance runtime authority.
- `Circle_of_the_Land_Runtime_Status.md` — source-derived Long-Rest Circle Spell package authority.
- `Artificer_Magic_Item_Plans_Status.md` — EFA learned-plan instances, wildcard concrete-item identity, and progression/Forge parity.

Current cadence rule: persistent source-owned decisions belong to Forge/progression authority; Long-/Short-Rest decisions belong to runtime configuration; per-use choices belong to action UI. Do not turn runtime choices back into permanent Forge locks.

## Character sheet / inventory / crafting

- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — required before changing canonical item/inventory/equip/sheet/tactical authority.
- `Character_Sheet_Formula_Reference.md` — required before changing ability/save/skill/AC/initiative/passive formulas.
- `NPC_Character_Sheet_Selection_Reconciliation.md` — selection and stale-response ownership boundary.
- `NPC_Profile_Inventory_Equipment_Reference.md` — profile, inventory workbench, equipment diagram, transfers, and presentation.
- `Town_Crafter_Current_Status.md` — town crafter/profile-panel state and guardrails.
- `Source_Patch_Pipeline_Audit.md` — source-bake / validator / retired patch-pipeline handoff.
- `Deferred_UI_Polish_Backlog.md` — deferred presentation work.

## Tactical encounter roadmap and active ledgers

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` — master encounter-system roadmap.
- `Tactical_Encounter_Phase0_Status.md` — portrait/sprite independence and eight-direction runtime.
- `Tactical_Encounter_Phase1_Foundation_Status.md` — board/session/movement foundation.
- `Tactical_Encounter_Phase1E_Core_Combat_Status.md` through the later Phase 1 spell/action ledgers — incremental server-authoritative combat adapters.
- `Tactical_Encounter_Milestone2_Durable_Start_Status.md` — active durable-start / lifecycle checkpoint.

Use the specific phase ledger matching the subsystem before modifying combat behavior. Do not recreate existing tactical primitives.

## Sprite production

- `Dawn_High_Quality_Prototype_Plan.md` — quality-source pivot to resume after the current Character Forge interruption is accepted.
- `Sprite_Production_Work_Map.md` — current sprite implementation map and acceptance sequence.
- `Sprite_Production_Art_Bible.md` — canonical atlas/direction/animation/source-quality contract.
- `Sprite_Production_Run_Log.md` — render/review evidence and rejected-path history.
- `../tools/blender/DAWN_PROCEDURAL_MODEL.md` — procedural R&D/operator handoff; useful infrastructure, not final art direction.

## Security / database

- `Security_Hardening_Roadmap_Status.md` — completed and deferred security/database hardening work.

Always inspect live grants/functions before changing authenticated `SECURITY DEFINER` surfaces. Do not blanket-revoke guarded RPCs without checking their internal authorization contract.

## Historical exports and archived runbooks

Files containing raw table/function exports, dated SQL snapshots, or completed retry/bake instructions are retained for provenance. They must not override:

1. live Supabase schema and migration history;
2. current repository source and validators;
3. `Documentation_Refresh_Manifest.md` plus the current subsystem status/evidence document;
4. broader roadmap/phase ledgers;
5. historical exports/runbooks.

Never execute a historical SQL export or restore a retired patch pipeline without reconciling it against the live database and current source first.

## Protected-boundary rule

Character Forge/progression/runtime work does not authorize changes to the world map, town/city-map behavior, route/travel/weather simulation, tactical encounter behavior, or unrelated crafting systems. Read the matching subsystem handoff before crossing those boundaries.
