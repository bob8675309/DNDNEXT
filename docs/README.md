# DNDNext Living Documentation Index

## Latest draft #294 — production helper parity

**Current combat/effects continuation: draft #294.** The actual production damage helper applies Resistance **before** structured flat equipment reduction, and the roll helper consumes both Guiding Bolt Advantage and Vicious Mockery Disadvantage, which cancel if simultaneous. Latest PR #294 tests original source function bodies in isolated PG16 and preserves complete mitigation in the private multiattack candidate result. No real game UI/RPC or production DB was modified. See [Canonical Roll/Damage Parity](Canonical_Roll_Damage_Parity_2026-10-27.md) and [master handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).


## 2026-10-27 Atomic Attack candidate, draft #293

Latest staged [PR #293](https://github.com/bob8675309/DNDNEXT/pull/293) adds an **unconnected service-role-only transactional Attack-action candidate** following the source-budget shadow sequence in #291 and read-only resolver preflight in #292. It can spend one Action and resolve separate attacks in isolated tests, while rolling back a failed attack and preventing duplicate requests. It is **NOT deployed gameplay**; no public attack RPC was replaced. See [technical documentation](Attack_Action_Atomic_Weapon_Candidate_2026-10-27.md) and [integration handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).


## Latest Attack resolver safety audit — #292 (2026-10-27)

[PR #292](https://github.com/bob8675309/DNDNEXT/pull/292) connects a **read-only shadow attack-slot preflight** to the real canonical weapon profile and targeting context. Its tests block unowned/unknown sources, bad range/LOS, stale slots and spent Actions while leaving all rolls/damage/logs untouched. The actual roll helper consumes Guiding Bolt's one-shot advantage, so calling it before committed execution would be unsafe. Read [Attack_Resolver_Preflight_Parity_2026-10-27.md](Attack_Resolver_Preflight_Parity_2026-10-27.md) and [master handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). No live multiattack change.



## Most recent effects/combat work — draft #291 (2026-10-27)

[PR #291](https://github.com/bob8675309/DNDNEXT/pull/291) derives baseline Attack-action attack slots from exact PHB/XPHB class-feature catalogue grants and tests an idempotent per-attack **shadow** sequence. The canonical combat writer still spends the Action on ONE attack. This branch is **not** an Extra Attack gameplay fix or a live hand/focus consumer. See [Attack_Action_Source_Budget_Shadow_2026-10-27.md](Attack_Action_Source_Budget_Shadow_2026-10-27.md) and [current effects handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). No production merge/deployment.



## Latest active development — draft #290 Attack action blocker (2026-10-26)

[PR #290](https://github.com/bob8675309/DNDNEXT/pull/290) documents and tests a live tactical **Extra Attack integration gap**: current canonical weapon/unarmed RPCs spend the whole Action on a single attack and do not expose an Attack-action subattack sequence. Shield Utilize also lacks a verified canonical handler. The new SQL is only a private, read-only event-log audit; no combat/effects behavior changed. Start with [Canonical_Attack_Action_Sequence_Gap_2026-10-26.md](Canonical_Attack_Action_Sequence_Gap_2026-10-26.md) and [current effects handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md) before implementing real draw/stow rules.



## Latest development — draft #289 hand rules audit (2026-10-26)

[PR #289](https://github.com/bob8675309/DNDNEXT/pull/289) adds **read-only exact-source** Two-Handed/Versatile weapon, Shield don/doff and somatic/material spell component checks, based on real `items_catalog.payload.property` and typed `spells_catalog.components_*` fields. These are **signals**, not real action or focus eligibility. See [Encounter_Hand_Rules_Constraints_Shadow_2026-10-26.md](Encounter_Hand_Rules_Constraints_Shadow_2026-10-26.md) and [the active dependency handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). Action economy, active grip, focus and spell source rules remain unenforced.



## Latest continuation — #288 shadow encounter hand commands (2026-10-26)

The newest stacked [PR #288](https://github.com/bob8675309/DNDNEXT/pull/288) atomically records **shadow-only** participant hand draw/stow/replace choices with exact request replay, turn/version checks and no gameplay spending. It is **not** a live hand action or verified focus-casting source. See [Encounter_Hand_Transition_Command_Shadow_2026-10-26.md](Encounter_Hand_Transition_Command_Shadow_2026-10-26.md) and [current effects ledger](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). All enforcement flags remain false; nothing merged to production.



## Latest attunement work — #287 encounter hand snapshot (2026-10-26)

[PR #287](https://github.com/bob8675309/DNDNEXT/pull/287) stages a precombat **participant-scoped** copy of #286 main/off hand intentions and an **active-turn-only dry-run** for draw/stow/replace. Physical changes invalidate the **entire snapshot**; no actual hand transition, action economy, spell effect or live combat is changed. See [Encounter_Hand_Snapshot_Transition_Preflight_2026-10-26.md](Encounter_Hand_Snapshot_Transition_Preflight_2026-10-26.md) and [current effects ledger](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). All readiness flags still false.



## Latest continuation (2026-10-26) — PR #286

The current leaf [#286](https://github.com/bob8675309/DNDNEXT/pull/286) stages **separate, exact-character hand-item intentions** without converting `weapon_1`–`weapon_3` equipment slots into actual held hands. See [Character_Hand_Loadout_Staging_2026-10-26.md](Character_Hand_Loadout_Staging_2026-10-26.md) and the [current integration ledger](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). All consumer, cast-time holding, spell provenance and attunement readiness flags remain **false**; this is an isolated draft SQL migration, not deployed production functionality.



## 2026-10-26 next continuation — exact class spell-list and hand-collision evidence

[PR #285](https://github.com/bob8675309/DNDNEXT/pull/285) extends the draft #284 focus audit with [exact spell catalogue class-list checks and explicit hand-slot collision diagnostics](Attuned_Spell_List_Hand_Evidence_2026-10-26.md). It still cannot prove how a character acquired a spell or which focus is held during combat. The [central current ledger](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md) now includes this continuation. **All attunement, source readiness and focus consumer flags stay false; no production rollout.**



Updated: 2026-10-26

## CURRENT active attunement/effects continuation (2026-10-26)

**Read [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md) first** when working on inventory attunement, equipment magic effects, tactical attacks, sheet spells, focus eligibility, or rest authorization. It supersedes the **active PR status only** of the October 24 sections below; their architecture/history remains intact.

- Current draft stack: [#267](https://github.com/bob8675309/DNDNEXT/pull/267) → ... → [#283](https://github.com/bob8675309/DNDNEXT/pull/283) → **#284** (focus physical/equipment and spell-source provenance), with [#266](https://github.com/bob8675309/DNDNEXT/pull/266) rest-popup separately to reconcile. [#257](https://github.com/bob8675309/DNDNEXT/pull/257) is **superseded draft**, not the release path. Details and per-PR purposes are in the linked ledger.
- The player reuses the existing **Equipment/Inventory** view for attunement selection; the Admin readiness status remains **NOT ENFORCED**. The max-three selection RPC is a staged **candidate**, not a deployed effects engine; attunement remains OFF by default. No live Supabase migrations, gameplay writer swaps or production merge were performed in the staged effects chain.
- Highest remaining gates: authenticated server rest opportunity, active held/worn truth (equip slots only hint), legal spell-list source and focus stacking, account-shared physical custody, full canonical effect consumers, and signed-in player/admin/tactical regression.
- Protected boundaries: do not change world-map travel/weather/clock, town/city maps, Character Forge visuals or existing spell-slot/canonical rest recovery authority as part of this work.

**The prior “Start here — reconciled 2026-10-24” and #257 queue below are historical snapshots.**



This directory contains the project's living handoff, roadmap, architecture, subsystem, and evidence documents. For active work, **live Supabase + current GitHub source/validators/deployment state outrank prose** if they conflict.

## Start here — current development and handoff (reconciled 2026-10-24)

1. **[DNDNext_Effects_AI_Current_Handoff_2026-10-24.md](DNDNext_Effects_AI_Current_Handoff_2026-10-24.md)** — current system map, open PR dependency graph, effect owners and release gates. The dated live status at the top overrides old snapshot tables.
2. [DNDNext_Current_Handoff_Prompt.md](DNDNext_Current_Handoff_Prompt.md) — cross-subsystem recovery and protected boundaries. Everything beneath its current opening section is historical unless independently reverified.
3. [Documentation_Refresh_Manifest.md](Documentation_Refresh_Manifest.md) and [Current_Development_Status_and_Roadmap.md](Current_Development_Status_and_Roadmap.md) — trust hierarchy and current priorities, with old checkpoints preserved as history.
4. **Merged into `main`:** [#249](https://github.com/bob8675309/DNDNEXT/pull/249) Workspace preflight, [#252](https://github.com/bob8675309/DNDNEXT/pull/252) effects coverage and cross-chat audit, [#254](https://github.com/bob8675309/DNDNEXT/pull/254) effects/AI handoff, [#256](https://github.com/bob8675309/DNDNEXT/pull/256) PR reconciliation. Their documents are **on main**; do not call them open drafts.
5. **Still draft/unmerged:** [#250](https://github.com/bob8675309/DNDNEXT/pull/250) Physical Specimen independently; [#251](https://github.com/bob8675309/DNDNEXT/pull/251) common effects resolver → [#253](https://github.com/bob8675309/DNDNEXT/pull/253) actual equipment-resolver parity → [#255](https://github.com/bob8675309/DNDNEXT/pull/255) genuine catalogue-source parity. Green isolated tests do not authorize gameplay deployment.
6. **New staged attunement:** [#257](https://github.com/bob8675309/DNDNEXT/pull/257) offers an admin **Standard (three)/Unlimited** cap toggle and character-item bonds while preserving existing equip slots. SQL and UI are **not deployed**; Short Rest, prerequisites, class exceptions and gameplay-consumer gates remain pending. Its detailed [status ledger](https://github.com/bob8675309/DNDNEXT/blob/feature/campaign-attunement-policy-20261024/docs/Campaign_Attunement_Policy_Status_2026-10-24.md) resides on the draft branch.
7. [Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md](Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md), [Character_Sheet_Formula_Reference.md](Character_Sheet_Formula_Reference.md), [Tactical_Encounter_Equipped_Damage_Mitigation_Status.md](Tactical_Encounter_Equipped_Damage_Mitigation_Status.md) — existing numeric and tactical authority.
8. [Unified_Character_Forge_Status.md](Unified_Character_Forge_Status.md), [Character_Progression_and_Higher_Level_Forge.md](Character_Progression_and_Higher_Level_Forge.md), [Pending_Rest_Runtime_Choices_Status.md](Pending_Rest_Runtime_Choices_Status.md) and specific runtime ledgers — creation/acquisition and rest semantics.
9. [CHATGPT_REPO_WRITE_PROCEDURE.md](CHATGPT_REPO_WRITE_PROCEDURE.md), [REPO_ACCESS_STANDING_RULE.md](REPO_ACCESS_STANDING_RULE.md) — exact-head safe GitHub/Supabase procedure.

## Reconciled main / live database checkpoint

- Last verified `main`: `0e925958b49505e010a011b1de4d6de28f30b7b7` after #249/#252/#254/#256 merges. **Always re-fetch**; this is an anchor, not a promise of current HEAD.
- DnDWeb Supabase `ucggczovhmauhshvhusx` continues using the original equipment/tactical/rest implementations. Neither the draft effects SQL nor the attunement migration was applied during this audit.
- Read-only catalogue sample: 2,739 `items_catalog` entries, 19 inventory instances and 1,037 spell-effect records (point-in-time figures).
- Existing numeric equipment resolver merges catalogue payload then item-instance overrides; tactical weapon bonuses and typed resistance/DR have specialized consumers. The current tactical order follows `20261016_08_resistance_before_flat_reduction.sql`: Resistance before flat damage reduction.
- Important: *equipped*, *attuned*, *rest-eligible* and *active magic effects* are separate states. Unlimited attunement must never loosen helmet/boots/body/weapon slot restrictions.

Older archive sections and former dated "active" queues in other files remain useful for chronology, but are not active merge/deployment instructions.

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