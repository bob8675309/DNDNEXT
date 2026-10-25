# DNDNext Living Documentation Index

Updated: 2026-10-24

This directory contains the project's living handoff, roadmap, architecture, subsystem, and evidence documents. For active work, **live Supabase + current GitHub source/validators/deployment state outrank prose** if they conflict.

## Start here — authoritative 2026-10-24 reading order

1. **[DNDNext_Effects_AI_Current_Handoff_2026-10-24.md](DNDNext_Effects_AI_Current_Handoff_2026-10-24.md)** — **CURRENT ACTIVE WORK** and fastest recovery: draft PR #250–253 topology, source/consumer gaps, future AI read-only tool, safety rules and next parity gates.
2. [DNDNext_Current_Handoff_Prompt.md](DNDNext_Current_Handoff_Prompt.md) — project-wide handoff. Its dated 2026-10-24 override supersedes prior Oct 11–19 work queues. Older content remains architecture/history.
3. [Documentation_Refresh_Manifest.md](Documentation_Refresh_Manifest.md) — live authority trust order and docs map.
4. [DNDNEXT_AI_INTEGRATION_FOUNDATION.md](DNDNEXT_AI_INTEGRATION_FOUNDATION.md) — **future** provider-neutral local AI/Actor AI direction and proposed safe use of authoritative effect read models; not implemented.
5. Draft [PR #250](https://github.com/bob8675309/DNDNEXT/pull/250) Physical Specimen feature and lifecycle gate; draft [PR #251](https://github.com/bob8675309/DNDNEXT/pull/251) common resolver; draft [PR #252](https://github.com/bob8675309/DNDNEXT/pull/252) effect-source coverage; draft [PR #253](https://github.com/bob8675309/DNDNEXT/pull/253) limited actual-SQL/synthetic-catalogue parity. **PR branch docs are not on main until merged**. Never merge without owner approval.
6. [Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md](Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md), [Character_Sheet_Formula_Reference.md](Character_Sheet_Formula_Reference.md) and [Tactical_Encounter_Equipped_Damage_Mitigation_Status.md](Tactical_Encounter_Equipped_Damage_Mitigation_Status.md) — established numeric and combat authority.
7. [Unified_Character_Forge_Status.md](Unified_Character_Forge_Status.md), [Character_Progression_and_Higher_Level_Forge.md](Character_Progression_and_Higher_Level_Forge.md), [Pending_Rest_Runtime_Choices_Status.md](Pending_Rest_Runtime_Choices_Status.md), source-specific runtime ledgers — creation/acquisition and rest behavior.
8. [CHATGPT_REPO_WRITE_PROCEDURE.md](CHATGPT_REPO_WRITE_PROCEDURE.md) and [REPO_ACCESS_STANDING_RULE.md](REPO_ACCESS_STANDING_RULE.md) — safe direct GitHub/Supabase editing.
9. For historic/resumed artwork only: [Next_Chat_Handoff_2026-10-07_Grim_Hollow_Tarot.md](Next_Chat_Handoff_2026-10-07_Grim_Hollow_Tarot.md) and relevant CHARACTER_FORGE_* art ledgers. Those are no longer the first stop for the active effects work.

## 2026-10-24 live/source checkpoint — overrides older sections below

- Production authority: main. Last observed main head f55c224006dbc9c3613470cafa2cf65e7c350f00; **always re-fetch** current head. Current work is in **draft, unmerged** PR #250 Physical Specimen, #251 common effect calculation, #252 source coverage audit, #253 synthetic-payload/real-SQL parity (base #251).
- Live DnDWeb Supabase read-only sample (2026-10-24): PostgreSQL 17.4; items_catalog 2,739; inventory_items 19; spell_effects 1,037. Draft PR #250/#251 SQL is **not deployed**.
- PR #253's relevant isolated PostgreSQL, contracts and validation jobs succeeded at head 5cfeef36541d6a882144ec00aed56d30bdc5a92a. Do **not** claim full real-catalogue parity or tactical integration from those synthetic fixtures.
- User-confirmed future AI integration should consume server-authorized effect/rules **read models** and later server-provided legal actions; it must **not** compute trusted bonuses or execute state writes from model output. See the linked current handoff and AI foundation.
- All dates/SHAs and preexisting implementation descriptions below remain useful **historical snapshots**, not current PR/deployment status. Confirm live repo, DB, CI and Vercel before action. World map and town/city map are separate protected systems.

## Current code checkpoint

Current production authority is `main`.

Consolidated state as of 2026-10-11:

- PRs #199, #202, #203/#204, #206, #207, and #208 are merged into current `main`.
- Current production code checkpoint: `5937d5e960e8de117be6f5605754306137f0ae0a` (PR #208).
- Exact PR #208 head passed **17 / 17** triggered workflows; Vercel production deployment `dpl_3f2vpd1AcmgWXkLEpc4Kv8swJ1tF` is **READY**, and `/profile` returned HTTP 200.
- Live migration `20261011142727 player_forge_homebrew_starting_budget` establishes the DNDNext/vanilla starting-equipment ruleset seam.
- DNDNext Homebrew currently uses a **300 gp minimum** starting market purse while preserving vanilla class/background cash, Package A/B/C source data, higher-level wealth logic, transactional merchant checkout, and character-scoped inventory/currency.
- Starting Level no longer overlays Class hero art; Feat rows have direct Select/Deselect controls with selected/granted visual parity; source-owned Spell choice groups auto-collapse when complete; `?forgeStep=equipment` supports direct browser-review navigation.
- Runtime-visible subclass choices remain **185 / 185** covered by dedicated approved Tarot cards; the Grim Hollow Tarot creation queue remains **0**.
- Next broad product priority remains completion/reconciliation of the ten-step Character Forge, with merchant NPC/portrait expansion available as a separate content/art pass and future AI implementation still deferred until Forge completion.

Live Grim Hollow catalogue checkpoint: **101 spells, 40 subclasses / 258 subclass-feature rows, 106 items**. The full item seeder preserves generated `price_gp` values so raw 5etools copper-piece values cannot inflate catalog prices by 100×.

Always re-fetch current `main` and live Supabase when requested work is database-backed.

## Current live database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Latest relevant registered migrations include:

- `20260921152546 admin_site_activity_v1`;
- `20260921153151 admin_site_activity_acl_fix`;
- `20260921153328 admin_site_activity_retention_v1`;
- `20260921185225 admin_site_activity_hardening_v1`;
- `20261011060110 fighting_initiate_2024_adaptation`;
- `20261011142727 player_forge_homebrew_starting_budget`.

Read `Auth_Navigation_Admin_Activity_Status.md` for the privacy model, grants, rate-bound anonymous ingestion, and signed-out attribution fix.

The planned Realistic Dice Phase 1 still does **not** require a Supabase migration. Later tactical dice presentation should consume existing authoritative encounter RPC/combat-log outcomes rather than introduce client-side combat authority.

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