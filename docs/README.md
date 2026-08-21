# DNDNext Living Documentation Index

Updated: 2026-08-20

This directory contains the project's living handoff, roadmap, architecture, subsystem, and evidence documents. For active work, **live Supabase + current GitHub source/validators/deployment state outrank prose** if they conflict.

## Start here

1. `DNDNext_Current_Handoff_Prompt.md` — copy-ready current takeover brief, accepted baseline, protected boundaries, live DB checkpoint, and next work priority.
2. `Documentation_Refresh_Manifest.md` — documentation trust order, merged PR chain, live migration checkpoint, and active work queue.
3. `Character_Forge_Training_Redesign_Status.md` — **active PR #176 Training redesign contract, checklist, tool/craft decision, Background→Training routing plan, feat chooser plan, and acceptance gates.**
4. `Unified_Character_Forge_Status.md` — shared Player/NPC Forge, progression, source-choice, and runtime authority.
5. The dedicated subsystem ledger for the area being changed.
6. `CHATGPT_REPO_WRITE_PROCEDURE.md` before direct GitHub/Supabase mutation.

## Current code checkpoint

Accepted runtime/code baseline on `main`:

`a2aecdd354346926afdf33efb1af320581563b68` — merged Character Forge Background polish/art system (PR #175).

Active work:

- PR #176 — `agent/training-tab-redesign` — **unmerged Character Forge Training redesign**.

Always inspect the current PR head before implementation; documentation and implementation commits on the branch will move it forward.

Recent accepted Forge chain:

- PR #170 — unified Character Forge/progression/runtime foundation — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — Species/Profile/Forge continuation — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`;
- PR #172 — Species readability continuation — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`;
- PR #173 — Simic Hybrid Animal Enhancement descriptions — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`;
- PR #175 — Background presentation/source-choice/art system — merged `a2aecdd354346926afdf33efb1af320581563b68`;
- PR #176 — Training redesign — active/unmerged.

Older documents that describe #170–#175 as open are historical snapshots only.

## Current live database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

The prior migration-ledger checkpoint contains 214 records with latest registered migration `20260814161314 grim_hollow_heritage_catalog_support`. Some later repo SQL effects are live even when repository filename and migration-ledger naming differ; inspect live effects before any deployment-traceability repair and do not re-run already-correct SQL by assumption.

For current Training work, `character_option_catalog` plus the preferred/configured views, `metadata`, and imported `raw_payload` are the source of truth for Background proficiency grants/choices.

## Character Forge / progression / runtime documents

- `Character_Forge_Training_Redesign_Status.md` — **active player Training redesign and exact handoff checklist.**
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

## Species baseline

- `Forge_Post170_Species_Artwork_Status.md` — accepted Species baseline after merged PRs #171–#173.
- `Forge_Species_Family_Submenu_Status.md` — Species family/setting-row identity and persistence rules.
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — structured source-presentation foundation/history.

Species is considered complete enough to freeze unless a concrete defect is reproduced. `Gift of the Aetherborn` remains visible/source-backed and its future unlock belongs to Game-Master-defined quest/NPC dialogue progression.

## Background baseline

Background is accepted after merged PR #175. Its reusable family banners/crests/icons and compact Background dossier are now baseline.

Important source-audit distinction for current Training work:

- Athlete (MOT) really does contain a language choice and Vehicles (land) in its imported source payload;
- Mist Wanderer (RHW), Clan Crafter (SCAG), and Rune Carver (BGG) really do contain artisan-tool proficiency grants/choices.

Audit omissions/parsing/routing against the source payload before changing anything that merely looks uneven. Do not silently rebalance source Backgrounds.

## Active Training review

The Training redesign is the current Forge priority. See `Character_Forge_Training_Redesign_Status.md`.

Locked direction:

- all selection controls stay on the left;
- right side is `Current Selection` information only;
- replace the confusing four independent top counters with one resolved/required tally and expandable provenance breakdown;
- actual Bonus Feat selection occurs in Training; Abilities selects only the Bonus Feat package;
- mapped crafting-tool proficiency and campaign Craft/Trade Skill should be one player-facing proficiency, not two paid picks;
- Background tool/craft choices should be acknowledged on Background and resolved in Training;
- Trade/Craft skills remain compact like Class Skills;
- replace the giant native feat dropdown with a compact catalogue/list-detail chooser inspired by the Profile `Feats & Boons` catalogue;
- preserve existing class/source-choice persistence authority.

After Training is accepted, continue Spells → Equipment → Identity → Story → Review as separate reviewable slices, revisiting earlier tabs only for reproduced dependencies/defects.

## Character sheet / inventory / crafting

- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — canonical item/inventory/equip/sheet/tactical boundaries.
- `Character_Sheet_Formula_Reference.md` — ability/save/skill/AC/initiative/passive formulas.
- `NPC_Character_Sheet_Selection_Reconciliation.md` — selection/stale-response ownership.
- `Town_Crafter_Current_Status.md` — town crafter/profile state.
- `Source_Patch_Pipeline_Audit.md` — source-bake / validator pipeline.

After the Forge is complete, the user wants to circle back to a broader crafting redesign: a unified crafting-material list whose material has craft-specific effects, plus possible expansion of individual tools into granular craft skills/recipe systems. That is deliberately outside PR #176.

## Tactical encounter / sprites / security

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus the latest tactical phase ledger — combat roadmap/status.
- `Dawn_High_Quality_Prototype_Plan.md`, `Sprite_Production_Work_Map.md`, `Sprite_Production_Art_Bible.md`, `Sprite_Production_Run_Log.md` — sprite work.
- `Security_Hardening_Roadmap_Status.md` — security/database hardening.

Always inspect live grants/functions before modifying authenticated `SECURITY DEFINER` surfaces.

## Protected boundaries

Character Forge work does not authorize changes to world-map, town/city-map behavior, route/travel/weather/camp/clock logic, tactical combat execution, crafting/inventory execution, merchants, or unrelated runtime systems.

`components/MapPageClient.js` remains protected unless Paul explicitly requests world-map work. World-map and town/city-map behavior must never be casually combined.