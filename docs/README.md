# DNDNext Living Documentation Index

Updated: 2026-08-30

This directory contains the project's living handoff, roadmap, architecture, subsystem, and evidence documents. For active work, **live Supabase + current GitHub source/validators/deployment state outrank prose** if they conflict.

## Start here

1. `DNDNext_Current_Handoff_Prompt.md` — copy-ready current takeover brief, accepted baseline, protected boundaries, current Forge/PR state, and immediate future work.
2. `Documentation_Refresh_Manifest.md` — documentation trust order, merged PR chain, live migration checkpoint, and active/future work queue.
3. `Realistic_Dice_Roller_Architecture_Roadmap.md` — **controlling future plan for the reusable realistic dice subsystem: d6/d8/d10/d12/d20/resultCube, Three/Rapier architecture, Forge/Sheet/Tactical adapters, authority boundaries, implementation phases, and acceptance criteria.**
4. `Character_Forge_Training_Redesign_Status.md` — detailed PR #176 Training subledger, source-choice/tool↔Trade Skill rules, and acceptance history.
5. `Unified_Character_Forge_Status.md` — shared Player/NPC Forge, progression, source-choice, and runtime authority.
6. The dedicated subsystem ledger for the area being changed.
7. `CHATGPT_REPO_WRITE_PROCEDURE.md` before direct GitHub/Supabase mutation.

## Current code checkpoint

Accepted runtime/code baseline on `main`:

`a2aecdd354346926afdf33efb1af320581563b68` — merged Character Forge Background polish/art system (PR #175).

Active work:

- PR #176 — `agent/training-tab-redesign` — **open/unmerged Character Forge browser-review continuation**.

PR #176 began as the Training redesign and now also contains later Forge browser-polish work, including Class/Abilities presentation changes. Immediately before the 2026-08-30 documentation-only Realistic Dice handoff commits, its remote head was `9447be566f8383e8227c6fccb37a0bde2bdbe078`.

Always inspect the current PR head before implementation; documentation and implementation commits move it forward.

Recent accepted Forge chain:

- PR #170 — unified Character Forge/progression/runtime foundation — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — Species/Profile/Forge continuation — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`;
- PR #172 — Species readability continuation — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`;
- PR #173 — Simic Hybrid Animal Enhancement descriptions — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`;
- PR #175 — Background presentation/source-choice/art system — merged `a2aecdd354346926afdf33efb1af320581563b68`;
- PR #176 — Character Forge browser-review continuation — active/unmerged.

Older documents that describe #170–#175 as open are historical snapshots only.

## Current live database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

The prior migration-ledger checkpoint contains 214 records with latest registered migration `20260814161314 grim_hollow_heritage_catalog_support`. Some later repo SQL effects are live even when repository filename and migration-ledger naming differ; inspect live effects before any deployment-traceability repair and do not re-run already-correct SQL by assumption.

The planned Realistic Dice Phase 1 does **not** require a Supabase migration. Later tactical dice presentation should consume existing authoritative encounter RPC/combat-log outcomes rather than introduce a client-side combat roll authority.

## Realistic Dice future subsystem

Read `Realistic_Dice_Roller_Architecture_Roadmap.md` before implementing or modifying the future roller.

### Why this exists

The current Character Forge Abilities tab contains a CSS-based dice-tray/result-die prototype. It preserves the correct Forge roll objects and allocation behavior, but its trajectories are presentation-only and should not become the permanent cross-site engine.

The reusable subsystem is planned to support:

- Forge generated ability totals;
- Character Sheet ability/skill/save/initiative rolls;
- damage/healing dice later;
- future tactical combat roll presentation;
- true d6, d8, d10, d12, and d20 polyhedral dice;
- a Forge-specific aggregate `resultCube` for values such as 4d6-drop-lowest totals.

### Locked dice boundary

**Rules decide the result; physics only visualizes it.**

Do not let Rapier/Three client physics decide or replace:

- attack/save/damage outcomes;
- generated ability totals;
- advantage/disadvantage choice;
- tactical pathing/occupancy;
- LOS/cover/range;
- initiative ordering;
- encounter turn/action state.

Dice rigid-body collision rules are deliberately separate from the existing discrete tactical hex rules.

### Planned implementation order

1. finish/accept the current Forge checkpoint;
2. create a dedicated Realistic Dice branch/PR from the accepted commit rather than widening #176 indefinitely;
3. build the reusable core + Forge adapter first;
4. add Character Sheet adapter only after Phase 1 acceptance;
5. add tactical adapter when tactical work resumes;
6. consider a global overlay host only after multiple real consumers justify it.

## Character Forge / progression / runtime documents

- `Character_Forge_Training_Redesign_Status.md` — player Training design/history subledger.
- `Character_Forge_Training_Browser_Implementation_2026-08-21.md` — Training browser implementation details.
- `Character_Forge_Background_Audit.md` — accepted Background audit/presentation history after merged PR #175; use for provenance, not as an active layout queue.
- `Unified_Character_Forge_Status.md` — controlling shared Forge/progression/runtime architecture.
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — player-facing choice placement and source-magic authority.
- `Character_Progression_Foundation.md` — normalized creation/progression model.
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation vs earned progression.
- `Pending_Rest_Runtime_Choices_Status.md` — post-rest attention vs optional replacement classification.
- `Player_Forge_Starting_Magic_v3_Status.md` — starting magic.
- `Player_Forge_Starting_Equipment_Status.md` — starting equipment/wealth/currency.
- feature-specific `*_Runtime_Status.md` ledgers — runtime cadence and restoration authority.

Core cadence rule: persistent source-owned acquisitions belong to Forge/progression; proficiency-dependent choices belong to Training; spell-centric choices belong to Spells; rest decisions belong to runtime; per-use decisions belong to action UI; future campaign-event unlocks belong to quest/dialogue authority when that subsystem exists.

## Character Sheet / roll integration

Current reusable sheet flow includes `CharacterSheet5e` → `onRoll` → `CharacterSheetPanel` → profile/NPC parent → `CharacterSheetRollResult`.

This existing structured-result seam should be adapted by a future `CharacterSheetDiceOverlay`. Do not rewrite all sheet formulas solely to introduce 3D presentation.

## Tactical encounter / roll integration

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus current tactical phase ledgers — combat roadmap/status.
- `pages/encounters/*`, `components/encounter/*`, `utils/encounterHex.js`, and live encounter RPCs are current tactical authority.
- `TacticalAttackResultPanel.js` already consumes authoritative combat-log attack results.

Future tactical dice should consume the existing RPC/combat-log result and may use command/request identity as visual-seed input. Do **not** reuse Rapier dice collision rules for encounter movement/pathfinding.

## Species baseline

- `Forge_Post170_Species_Artwork_Status.md` — accepted Species baseline after merged PRs #171–#173.
- `Forge_Species_Family_Submenu_Status.md` — Species family/setting-row identity and persistence rules.
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — structured source-presentation foundation/history.

Species is considered complete enough to freeze unless a concrete defect is reproduced. `Gift of the Aetherborn` remains visible/source-backed and its future unlock belongs to Game-Master-defined quest/NPC dialogue progression.

## Background baseline

Background is accepted after merged PR #175. Its reusable family banners/crests/icons and compact Background dossier are now baseline.

Audit omissions/parsing/routing against the source payload before changing anything that merely looks uneven. Do not silently rebalance source Backgrounds.

## Training subledger

Training remains important because PR #176 started there. Preserve the accepted direction and source ownership documented in `Character_Forge_Training_Redesign_Status.md`, including player/NPC isolation, Skills/Feats view separation, canonical tool↔Trade Skill mapping, no double-spend, and existing completion authority.

Do not regress Training while working on Class/Abilities/dice presentation.

## Character sheet / inventory / crafting

- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — canonical item/inventory/equip/sheet/tactical boundaries.
- `Character_Sheet_Formula_Reference.md` — ability/save/skill/AC/initiative/passive formulas.
- `NPC_Character_Sheet_Selection_Reconciliation.md` — selection/stale-response ownership.
- `Town_Crafter_Current_Status.md` — town crafter/profile state.
- `Source_Patch_Pipeline_Audit.md` — source-bake / validator pipeline.

After the Forge is complete, the user wants to circle back to a broader crafting redesign: a unified crafting-material list whose material has craft-specific effects, plus possible expansion of individual tools into granular craft skills/recipe systems. That is deliberately separate from Realistic Dice and PR #176.

## Tactical encounter / sprites / security

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus latest tactical phase ledgers — combat roadmap/status.
- `Dawn_High_Quality_Prototype_Plan.md`, `Sprite_Production_Work_Map.md`, `Sprite_Production_Art_Bible.md`, `Sprite_Production_Run_Log.md` — sprite work.
- `Security_Hardening_Roadmap_Status.md` — security/database hardening.

Always inspect live grants/functions before modifying authenticated `SECURITY DEFINER` surfaces.

## Protected boundaries

Character Forge or Realistic Dice work does not authorize changes to world-map, town/city-map behavior, route/travel/weather/camp/clock logic, tactical combat execution/movement/pathing, crafting/inventory execution, merchants, or unrelated runtime systems.

`components/MapPageClient.js` remains protected unless Paul explicitly requests world-map work. World-map and town/city-map behavior must never be casually combined.