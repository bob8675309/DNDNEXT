# DNDNext Living Documentation Index

Updated: 2026-08-16

This directory contains the project's living handoff, roadmap, architecture, subsystem, and evidence documents. For active work, **live Supabase + current GitHub source/validators/deployment state outrank prose** if they conflict.

## Start here

1. `DNDNext_Current_Handoff_Prompt.md` — copy-ready current takeover brief, accepted baseline, protected boundaries, live DB checkpoint, and next work priority.
2. `Documentation_Refresh_Manifest.md` — documentation trust order, merged PR chain, live migration checkpoint, and active work queue.
3. `Unified_Character_Forge_Status.md` — shared Player/NPC Forge, progression, source-choice, and runtime authority.
4. The dedicated subsystem ledger for the area being changed.
5. `CHATGPT_REPO_WRITE_PROCEDURE.md` before direct GitHub/Supabase mutation.

## Current code checkpoint

Accepted runtime/code baseline:

`8c37e30063d2523a5f488073d3ea60c5571c7182` — merge of PR #173.

A documentation-only merge may advance `main` without changing runtime behavior. Always inspect the current remote head before implementation.

Recent merged chain:

- PR #170 — unified Character Forge/progression/runtime foundation — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — Species/Profile/Forge continuation — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`;
- PR #172 — Species readability continuation — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`;
- PR #173 — Simic Hybrid Animal Enhancement descriptions — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`.

Older documents that describe #170–#173 as open are historical snapshots only.

## Current live database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

At this documentation refresh:

- `supabase_migrations.schema_migrations` contains 214 records;
- latest registered migration is `20260814161314 grim_hollow_heritage_catalog_support`.

The old “migration 93 is current” wording is obsolete. Some later repo SQL effects are live even when the exact repository filename does not match a migration-ledger entry; inspect live effects before any deployment-traceability repair and do not re-run already-correct SQL by assumption.

## Character Forge / progression / runtime documents

- `Unified_Character_Forge_Status.md` — controlling shared Forge/progression/runtime architecture.
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — player-facing choice placement and source-magic authority.
- `Character_Progression_Foundation.md` — normalized creation/progression model.
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation vs earned progression.
- `Pending_Rest_Runtime_Choices_Status.md` — post-rest attention vs optional replacement classification.
- `Progression_RPC_ACL_Cleanup_Status.md` — progression getter ACL hardening.
- `Player_Forge_Starting_Magic_v3_Status.md` — starting magic.
- `Player_Forge_Starting_Equipment_Status.md` — starting equipment/wealth/currency.
- `Astral_Trance_Runtime_Status.md` — Astral Trance runtime.
- `Species_Rest_Proficiency_Runtime_Status.md` — Astral Knowledge / Skill Versatility.
- `Species_Replaceable_Cantrip_Runtime_Status.md` — replaceable Species cantrips.
- `Eladrin_Runtime_Status.md` — initial season, Long-Rest replacement, and Trance runtime.
- `Primal_Companion_Runtime_Status.md`, `Dread_Allegiance_Runtime_Status.md`, `Fiendish_Resilience_Runtime_Status.md`, `Circle_of_the_Land_Runtime_Status.md` — feature-specific runtime ledgers.
- `Wizard_Spell_Mastery_Runtime_Status.md`, `Wizard_Memorize_Spell_Runtime_Status.md`, `Wizard_Cantrip_Formulas_Runtime_Status.md` — Wizard runtime families.
- `Armorer_Armor_Model_Runtime_Status.md`, `Bestial_Soul_Runtime_Status.md`, `Wild_Heart_Aspect_Runtime_Status.md`, `Hunters_Prey_Runtime_Status.md`, `Defensive_Tactics_Runtime_Status.md`, `Whispers_of_the_Dead_Runtime_Status.md` — class/subclass runtime families.
- `Artificer_Magic_Item_Plans_Status.md` — learned-plan authority and canonical item pools.

Core cadence rule: persistent source-owned acquisitions belong to Forge/progression; proficiency-dependent choices belong to Training; spell-centric choices belong to Spells; rest decisions belong to runtime; per-use decisions belong to action UI; future campaign-event unlocks belong to quest/dialogue authority when that subsystem exists.

## Species documents

- `Forge_Post170_Species_Artwork_Status.md` — **accepted Species baseline after merged PRs #171–#173**, not an active PR queue.
- `Forge_Species_Family_Submenu_Status.md` — Species family/setting-row identity and persistence rules.
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — structured source-presentation history/foundation.
- `Forge_Species_Art_and_Collapse_Handoff.md` — historical/superseded handoff.

Species is considered complete enough to freeze unless a concrete defect is reproduced.

Accepted final Species refinements include:

- compact Goliath/Eladrin selected-detail choices;
- Hexblood Eerie Token structured benefit cards;
- source-backed Simic Hybrid Animal Enhancement descriptions;
- accepted high-resolution Forge portraits and Profile framing;
- semantic fact presentation for Size, Speed, Creature Type, Vision, Languages, and Gender & Alignment.

`Gift of the Aetherborn` remains visible and unchanged for now. Its eventual unlock is intended to be Game-Master-defined quest/NPC dialogue progression rather than a hardcoded universal Forge prerequisite.

## Next active Forge review

The next planned bounded review is **Background**, followed by Class → Abilities → Training → Spells → Equipment → Identity → Story → Review unless a higher-priority production defect intervenes.

## Character sheet / inventory / crafting

- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — canonical item/inventory/equip/sheet/tactical boundaries.
- `Character_Sheet_Formula_Reference.md` — ability/save/skill/AC/initiative/passive formulas.
- `NPC_Character_Sheet_Selection_Reconciliation.md` — selection/stale-response ownership.
- `NPC_Profile_Inventory_Equipment_Reference.md` — profile/inventory/equipment presentation.
- `Town_Crafter_Current_Status.md` — town crafter/profile state.
- `Source_Patch_Pipeline_Audit.md` — source-bake / validator pipeline.
- `Deferred_UI_Polish_Backlog.md` — deferred presentation work.

Known future crafting item: GitHub issue #76, covering player-facing crafting/material card cleanup and smithing material-quality simplification. Preserve internal metadata and formulas when that work begins.

## Tactical encounter / sprites / security

- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus the latest tactical phase ledger — combat roadmap/status.
- `Dawn_High_Quality_Prototype_Plan.md`, `Sprite_Production_Work_Map.md`, `Sprite_Production_Art_Bible.md`, `Sprite_Production_Run_Log.md` — sprite work.
- `Security_Hardening_Roadmap_Status.md` — security/database hardening.

Always inspect live grants/functions before modifying authenticated `SECURITY DEFINER` surfaces.

## Protected boundaries

Character Forge work does not authorize changes to world-map, town/city-map behavior, route/travel/weather/camp/clock logic, tactical combat execution, crafting/inventory execution, merchants, or unrelated runtime systems.

`components/MapPageClient.js` remains protected unless Paul explicitly requests world-map work. World-map and town/city-map behavior must never be casually combined.
