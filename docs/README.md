# DNDNext Living Documentation Index

This directory contains the project's living handoff, roadmap, architecture, and evidence documents. When starting a new work session, use the document matching the subsystem being changed and update it when a milestone, failure, acceptance decision, or architecture boundary changes.

## Start here

- [`DNDNext_Current_Handoff_Prompt.md`](./DNDNext_Current_Handoff_Prompt.md) — **copy-ready prompt for a new ChatGPT/Codex session.** It defines the required inspection workflow, protected boundaries, current Dawn focus, document precedence, and a map of the major subsystem references.
- [`Current_Development_Status_and_Roadmap.md`](./Current_Development_Status_and_Roadmap.md) — current production baseline, work in flight, completed foundations, remaining roadmap, and protected subsystem boundaries.
- [`Unified_Character_Forge_Status.md`](./Unified_Character_Forge_Status.md) — **current user-testing interruption and acceptance ledger.** Covers the Rinshin test evidence, shared NPC/player Forge consolidation, responsive reachability, multiple player characters, levels 1–20, guarded v2 ownership RPCs, and the remaining starting spell-selection parity gap.
- [`Dawn_High_Quality_Prototype_Plan.md`](./Dawn_High_Quality_Prototype_Plan.md) — **active visual-production plan after the Character Forge testing slice.** The primitive Dawn model is rejected as final art; this document defines the high-quality South-facing idle/walk prototype, external tool evaluation, reference hierarchy, body-family reuse, and the gate before another full atlas.
- [`Sprite_Production_Work_Map.md`](./Sprite_Production_Work_Map.md) — authoritative sprite status, completed pipeline infrastructure, current blocker, acceptance gates, remaining sequence, and the requested post-Dawn UI interruption.
- [`Sprite_Production_Art_Bible.md`](./Sprite_Production_Art_Bible.md) — canonical atlas, direction, animation, source-quality, tool, no-frame-shifting, visual approval, and runtime-readability rules.
- [`Sprite_Production_Run_Log.md`](./Sprite_Production_Run_Log.md) — real Dawn render and review evidence, including rejected approaches and the successful isolated-render pipeline.
- [`Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`](./Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md) — **required reading before changing Smithing completion, canonical inventory/equip state, character-sheet item bonuses, encounter participant snapshots, or tactical weapon profiles.** Explains the full item-catalogue → craft plan → attempt → completion → inventory → equip → sheet/tactical authority pipeline and its snapshot boundaries.
- [`Character_Sheet_Formula_Reference.md`](./Character_Sheet_Formula_Reference.md) — **required reading before changing ability modifiers, saves, skills, AC, Initiative, Passive Perception, or sheet roll formulas.** Defines the formulas, equipment overlay boundary, active-encounter snapshot rule, regression examples, and safe-change checklist.
- [`NPC_Character_Sheet_Selection_Reconciliation.md`](./NPC_Character_Sheet_Selection_Reconciliation.md) — **required reading before changing NPC roster selection, sheet/equipment/notes loading, controlled sheet drafts, or character identity synchronization.** Defines the `/npcs` ownership boundary, immediate clearing transaction, request-ID guards, and stale-response regression gate.
- The status ledgers below provide implementation evidence for individual phases. Older exports and one-time deployment notes are historical evidence, not current instructions.

## Active sprite-production documents

- [`Dawn_High_Quality_Prototype_Plan.md`](./Dawn_High_Quality_Prototype_Plan.md) — controlling next milestone and quality-source pivot after the Character Forge interruption is accepted.
- [`Sprite_Production_Work_Map.md`](./Sprite_Production_Work_Map.md) — current implementation map and acceptance sequence.
- [`Sprite_Production_Art_Bible.md`](./Sprite_Production_Art_Bible.md) — binding visual and technical production contract.
- [`Sprite_Production_Run_Log.md`](./Sprite_Production_Run_Log.md) — attempt evidence and rejected-path history.
- [`../tools/blender/DAWN_PROCEDURAL_MODEL.md`](../tools/blender/DAWN_PROCEDURAL_MODEL.md) — procedural R&D/operator handoff explaining what remains reusable and what is no longer the active art path.
- [`Tactical_Encounter_Phase0_Status.md`](./Tactical_Encounter_Phase0_Status.md) — runtime sprite/portrait independence and unified eight-direction context.

Current decision: preserve the proven isolated renderer, atlas, QA, and publishing systems; replace the primitive source-asset approach; approve one high-quality South idle/walk prototype before producing another 32-cell sheet.

## Long-term roadmaps

- [`Tactical_Encounter_Combat_Roadmap_Blueprint.md`](./Tactical_Encounter_Combat_Roadmap_Blueprint.md) — master roadmap for the future hex-grid encounter/dungeon system, multiplayer turn engine, D&D 5e combat automation, portrait/sprite strategy, GM tools, and phased delivery plan.
- [`Tactical_Encounter_Phase0_Status.md`](./Tactical_Encounter_Phase0_Status.md) — Phase 0 ledger for portrait/sprite independence, the unified 8-direction sprite runtime, renderer migration, and first production sprite batches. **Its explicit Phase 0 amendments supersede older master-roadmap statements about retaining the retired 4-direction sprite format.**
- [`Tactical_Encounter_Phase1_Foundation_Status.md`](./Tactical_Encounter_Phase1_Foundation_Status.md) — Phase 1 board/session/movement foundation through authoritative player turn movement.
- [`Tactical_Encounter_Phase1E_Core_Combat_Status.md`](./Tactical_Encounter_Phase1E_Core_Combat_Status.md) — first server-authoritative action economy, Unarmed Strike, HP/AC encounter state, and Realtime combat log.
- [`Tactical_Encounter_Phase1F_Weapon_Combat_Status.md`](./Tactical_Encounter_Phase1F_Weapon_Combat_Status.md) — canonical equipped weapon profiles plus melee/thrown/ranged attack and typed weapon-damage foundations.
- [`Tactical_Encounter_Phase1G_LOS_Cover_Saves_Damage_Status.md`](./Tactical_Encounter_Phase1G_LOS_Cover_Saves_Damage_Status.md) — deterministic LOS, cover, server saves, generic typed damage, and damage-affinity foundations.
- [`Tactical_Encounter_Phase1H_Reactions_Effects_Status.md`](./Tactical_Encounter_Phase1H_Reactions_Effects_Status.md) — opportunity-reaction timing, Disengage suppression, healing, generic effects, and structured-condition foundations.
- [`Tactical_Encounter_Phase1I_Spell_Foundation_Status.md`](./Tactical_Encounter_Phase1I_Spell_Foundation_Status.md) — canonical caster profiles and encounter-local spell-slot snapshots before guarded casting RPCs.
- [`Tactical_Encounter_Phase1J_Save_Spells_Status.md`](./Tactical_Encounter_Phase1J_Save_Spells_Status.md) through [`Tactical_Encounter_Phase1S_Word_of_Radiance_Status.md`](./Tactical_Encounter_Phase1S_Word_of_Radiance_Status.md) — incremental reviewed cantrip, leveled-spell, attack, save, healing, effect, and multi-target tactical adapters.
- [`Tactical_Encounter_Phase1T_Guiding_Bolt_Status.md`](./Tactical_Encounter_Phase1T_Guiding_Bolt_Status.md) — shared one-shot attack-roll modifier authority plus Guiding Bolt.
- [`Tactical_Encounter_Phase1U_Vicious_Mockery_Status.md`](./Tactical_Encounter_Phase1U_Vicious_Mockery_Status.md) — Vicious Mockery and next-attack Disadvantage consumption.
- [`Tactical_Encounter_Phase1V_Healing_Word_Status.md`](./Tactical_Encounter_Phase1V_Healing_Word_Status.md) — Healing Word, Bonus Action casting, and the 2024 one-slotted-spell-per-turn authority rule.
- [`Tactical_Encounter_Phase1W_Acid_Splash_Status.md`](./Tactical_Encounter_Phase1W_Acid_Splash_Status.md) — point-targeted Sphere authority and server-derived Acid Splash membership.
- [`Tactical_Encounter_Phase1X_Magic_Missile_Status.md`](./Tactical_Encounter_Phase1X_Magic_Missile_Status.md) — allocated multi-target dart authority for Magic Missile.
- [`Tactical_Encounter_Phase1Y_Burning_Hands_Status.md`](./Tactical_Encounter_Phase1Y_Burning_Hands_Status.md) — directional 15-foot Cone authority for Burning Hands.
- [`Tactical_Encounter_Phase1Z_Lightning_Bolt_Status.md`](./Tactical_Encounter_Phase1Z_Lightning_Bolt_Status.md) — production-deployed directional 100-foot Line authority and isolated Lightning Bolt client presentation.
- [`Tactical_Encounter_Milestone2_Durable_Start_Status.md`](./Tactical_Encounter_Milestone2_Durable_Start_Status.md) — active Milestone 2 ledger covering atomic staged startup, lifecycle compatibility, the production `/encounters/smoke` preparation helper, validation, and authenticated smoke acceptance work.
- [`Security_Hardening_Roadmap_Status.md`](./Security_Hardening_Roadmap_Status.md) — completed and deferred security/database hardening work.

## Current subsystem handoffs

- [`Unified_Character_Forge_Status.md`](./Unified_Character_Forge_Status.md) — shared player/NPC Forge, multi-character ownership, responsive testing, and follow-up spell-selection work.
- [`NPC_Profile_Inventory_Equipment_Reference.md`](./NPC_Profile_Inventory_Equipment_Reference.md) — profile, inventory workbench, equipment diagram, item-card, transfer, and sheet presentation reference. Use it together with the shared pipeline document for equipment-derived rules.
- [`Town_Crafter_Current_Status.md`](./Town_Crafter_Current_Status.md) — current town crafter/profile-panel state and guardrails.
- [`Source_Patch_Pipeline_Audit.md`](./Source_Patch_Pipeline_Audit.md) — source-bake / validator / retired patch-pipeline handoff.
- [`Deferred_UI_Polish_Backlog.md`](./Deferred_UI_Polish_Backlog.md) — deferred UI and presentation work.

## Historical exports and archived runbooks

Files containing raw table/function exports, dated SQL snapshots, or completed retry/bake instructions are retained for provenance. They must not override:

1. the live Supabase schema and migration history;
2. current repository source and validators;
3. the current status document and active subsystem plan or phase ledger.

Never execute a historical SQL export or restore a retired patch pipeline without first reconciling it against the live database and source.

## Tactical encounter roadmap rule

`Tactical_Encounter_Combat_Roadmap_Blueprint.md` is the source of truth for the encounter system's end goals. The linked active phase ledger may explicitly amend implementation decisions for its phase; when it does, the amendment takes precedence until the master roadmap is synchronized. As implementation progresses:

1. update phase/task checkboxes or the linked active phase ledger;
2. record meaningful commits/migrations in its Progress Ledger or active phase ledger;
3. record major architecture choices in its Decision Log or active phase amendment;
4. add unresolved decisions to Open Design Decisions instead of silently deciding them inside unrelated patches;
5. preserve the roadmap's world-map separation and server-authority guardrails unless those guardrails are explicitly revised.
