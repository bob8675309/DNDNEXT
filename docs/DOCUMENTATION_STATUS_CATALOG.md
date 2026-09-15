# DNDNext Documentation Status Catalog

Audited: 2026-09-15

This catalog classifies the human-facing `docs/` surface so older phase evidence cannot be mistaken for current project state. A file being historical does **not** mean it is useless or should be deleted; it means current source/live systems/current controlling docs outrank any old branch, SHA, migration, deployment, or “next step” statement inside it.

## Classification key

- **CURRENT** — living handoff/status/procedure; should be kept reconciled with current project state.
- **REFERENCE** — durable subsystem architecture/rules/art guidance; its dated metrics are evidence, but its ownership model remains useful.
- **HISTORICAL** — implementation/acceptance/phase evidence tied to a dated branch, PR, migration, or deployment.
- **RAW SNAPSHOT** — exported/reference data; never live-state authority.
- **ROADMAP / FUTURE** — design/planning document; verify what has since shipped before implementing from it.

## Current controlling documents

- **CURRENT** `README.md` — living documentation index/trust order.
- **CURRENT** `DNDNext_Current_Handoff_Prompt.md` — copy-ready takeover brief.
- **CURRENT** `Documentation_Refresh_Manifest.md` — latest repo/document reconciliation.
- **CURRENT** `Current_Development_Status_and_Roadmap.md` — present-tense high-level status and priority queue.
- **CURRENT** `CHATGPT_REPO_WRITE_PROCEDURE.md` — safe GitHub/Supabase/Vercel mutation procedure.
- **CURRENT** `DOCUMENTATION_STATUS_CATALOG.md` — this classification catalog.
- **CURRENT** `VERCEL_DEPLOYMENT_STORAGE_AND_MAINTENANCE_STATUS.md` — deployment-storage/Preview guard/cleanup authority.

## Character Forge — current/reference

- **REFERENCE** `Unified_Character_Forge_Status.md` — shared Player/NPC Forge architecture; old baseline SHA is dated evidence.
- **REFERENCE** `Character_Progression_Foundation.md` — progression ownership foundation.
- **REFERENCE** `Character_Progression_and_Higher_Level_Forge.md` — direct creation/progression convergence and higher-level choice architecture.
- **REFERENCE** `Character_Progression_v3_Implementation_Status.md` — implemented progression v3 reference/evidence.
- **REFERENCE** `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — source-choice lifecycle/routing authority.
- **REFERENCE** `Player_Forge_Starting_Equipment_Status.md` — starting equipment architecture/status.
- **REFERENCE** `Player_Forge_Starting_Magic_v3_Status.md` — starting magic architecture/status.
- **REFERENCE** `Pending_Rest_Runtime_Choices_Status.md` — rest/runtime choice lifecycle.
- **REFERENCE** `CHARACTER_FORGE_VIEWPORT_PORTAL_FIX.md` — Forge overlay/portal behavior reference.
- **REFERENCE** `Character_Forge_Background_Audit.md` — Background source/content audit; old counts are date-specific.

## Character Forge — Species

- **CURRENT/REFERENCE** `CHARACTER_FORGE_SPECIES_ARTWORK_ROLLOUT.md` — current Species art-direction/resolver rules; old #177 open-state corrected.
- **REFERENCE** `Forge_Post170_Species_Artwork_Status.md` — Species artwork rollout history/current architectural reference.
- **CURRENT/REFERENCE** `Forge_Species_Family_Submenu_Status.md` — family/child/source-row modeling; #171 state reconciled.
- **CURRENT/REFERENCE** `Forge_Source_Presentation_and_Species_Variants_Status.md` — source rendering/projection rules; #171 state reconciled.
- **REFERENCE** `Forge_Species_Art_and_Collapse_Handoff.md` — Species artwork/collapse history and acceptance references.
- **HISTORICAL** `PR170_Final_Acceptance_Status.md` — PR #170 acceptance evidence.
- **HISTORICAL** `PR170_Browser_Smoke_Corrections_Status.md` — PR #170 browser correction evidence.
- **REFERENCE/HISTORICAL** `Eladrin_Runtime_Status.md` — Eladrin runtime lifecycle implementation; old branch header is historical.
- **REFERENCE** `Species_Replaceable_Cantrip_Runtime_Status.md` — replaceable Species cantrip runtime lifecycle.
- **REFERENCE** `Species_Rest_Proficiency_Runtime_Status.md` — rest proficiency runtime lifecycle.

## Character Forge — Training

- **CURRENT/REFERENCE** `Character_Forge_Training_Redesign_Status.md` — merged Training architecture/current rules.
- **HISTORICAL** `Character_Forge_Training_Browser_Review_2026-08-21.md` — approved browser-review requirements at that date; old #176 merge gate is historical.
- **HISTORICAL** `Character_Forge_Training_Browser_Implementation_2026-08-21.md` — exact-head implementation/CI/Preview evidence at that date; old #176 merge gate is historical.

## Character Forge — Class and subclass art

- **REFERENCE** `CHARACTER_FORGE_CLASS_CINEMATIC_ARTWORK_ROLLOUT.md` — Class cinematic rollout/art provenance; #177 is merged.
- **REFERENCE** `CHARACTER_FORGE_CLASS_HERO_ARTWORK_STATUS.md` — Class hero/menu artwork resolver/composition reference; #177-era checkpoint is historical context.
- **HISTORICAL/SUPERSEDED** `CHARACTER_FORGE_CLASS_SUBCLASS_SELECTOR_ARTWORK.md` — old compact rectangular selector; do not use as current production layout.
- **CURRENT** `CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md` — current runtime-visible Tarot completion status.
- **CURRENT** `CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md` — active Tarot continuation handoff.
- **CURRENT** `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md` — active 149-target / 43-fallback checklist.
- **CURRENT** `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md` — authoritative 7:12 card visual/QA standard.

## Realistic Dice

- **CURRENT/ROADMAP** `Realistic_Dice_Roller_Architecture_Roadmap.md` — updated to reflect shipped custom JS/CSS dice core; Character Sheet/tactical integrations remain future phases.

## Character Sheet / profile / equipment

- **REFERENCE** `Character_Sheet_Formula_Reference.md` — sheet formula ownership.
- **REFERENCE** `NPC_Character_Sheet_Selection_Reconciliation.md` — selection/load identity and stale-response authority.
- **REFERENCE** `NPC_Profile_Inventory_Equipment_Reference.md` — NPC profile/inventory/equipment interaction reference.
- **REFERENCE** `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — shared equipment/effect authority pipeline.

## Crafting / town / economy

- **REFERENCE** `Town_Crafter_Current_Status.md` — current town crafter architecture/status at its checkpoint.
- **REFERENCE/HISTORICAL** `Town_Handoff_Bake_Next_Steps.md` — source-bake/handoff plan; verify source before following old next steps.
- **REFERENCE/HISTORICAL** `Town_Route_Profile_Parent_Bake_Checklist.md` — bake checklist/evidence; not current world/town authority by itself.
- **REFERENCE** `Source_Patch_Pipeline_Audit.md` — source-patch retirement/bake audit.
- **REFERENCE** `DB_route_info_UPDATED.md` — route/database reference snapshot; live DB/source outrank it.

## Tactical encounter — high-level/current references

- **REFERENCE/ROADMAP** `Tactical_Encounter_Combat_Roadmap_Blueprint.md` — high-level tactical architecture/roadmap; verify source/live RPC state before resuming an old queue.
- **REFERENCE** `Tactical_Character_Resource_Bridge_Status.md` — tactical character resource bridge.
- **REFERENCE** `Tactical_Encounter_Milestone2_Durable_Start_Status.md` — durable start implementation/acceptance reference.
- **REFERENCE** `Milestone2_Multiplayer_Smoke_Setup.md` — smoke-test setup/reference.

## Tactical encounter — historical phase ledgers

The following are **HISTORICAL phase implementation/validation evidence**. Their old “next phase” wording is not the current project priority unless repeated in the current roadmap:

- `Tactical_Encounter_Phase0_Status.md`
- `Tactical_Encounter_Phase1_Foundation_Status.md`
- `Tactical_Encounter_Phase1E_Core_Combat_Status.md`
- `Tactical_Encounter_Phase1F_Weapon_Combat_Status.md`
- `Tactical_Encounter_Phase1G_LOS_Cover_Saves_Damage_Status.md`
- `Tactical_Encounter_Phase1H_Reactions_Effects_Status.md`
- `Tactical_Encounter_Phase1I_Spell_Foundation_Status.md`
- `Tactical_Encounter_Phase1J_Save_Spells_Status.md`
- `Tactical_Encounter_Phase1K_Toll_the_Dead_Status.md`
- `Tactical_Encounter_Phase1L_Poison_Spray_Status.md`
- `Tactical_Encounter_Phase1M_False_Life_Status.md`
- `Tactical_Encounter_Phase1N_Inflict_Wounds_Status.md`
- `Tactical_Encounter_Phase1O_Shocking_Grasp_Status.md`
- `Tactical_Encounter_Phase1P_Ray_of_Frost_Status.md`
- `Tactical_Encounter_Phase1Q_Chill_Touch_Status.md`
- `Tactical_Encounter_Phase1R_Mind_Sliver_Status.md`
- `Tactical_Encounter_Phase1S_Word_of_Radiance_Status.md`
- `Tactical_Encounter_Phase1T_Guiding_Bolt_Status.md`
- `Tactical_Encounter_Phase1U_Vicious_Mockery_Status.md`
- `Tactical_Encounter_Phase1V_Healing_Word_Status.md`
- `Tactical_Encounter_Phase1W_Acid_Splash_Status.md`
- `Tactical_Encounter_Phase1X_Magic_Missile_Status.md`
- `Tactical_Encounter_Phase1Y_Burning_Hands_Status.md`
- `Tactical_Encounter_Phase1Z_Lightning_Bolt_Status.md`
- `Phase1M_Production_Retry.md`

## Runtime feature ledgers

These are **REFERENCE/HISTORICAL** feature-specific implementation ledgers. Use them to understand lifecycle/accepted mechanics, but verify current source and live state before changing behavior:

- `Armorer_Armor_Model_Runtime_Status.md`
- `Artificer_Magic_Item_Plans_Status.md`
- `Astral_Trance_Runtime_Status.md`
- `Bestial_Soul_Runtime_Status.md`
- `Boon_Energy_Resistance_Runtime_Status.md`
- `Cartomancer_Runtime_Status.md`
- `Circle_of_the_Land_Runtime_Status.md`
- `Defensive_Tactics_Runtime_Status.md`
- `Dread_Allegiance_Runtime_Status.md`
- `Feat_Runtime_Expertise_Status.md`
- `Fiendish_Resilience_Runtime_Status.md`
- `Hunters_Prey_Runtime_Status.md`
- `Primal_Companion_Runtime_Status.md`
- `Progression_RPC_ACL_Cleanup_Status.md`
- `Whispers_of_the_Dead_Runtime_Status.md`
- `Wild_Heart_Aspect_Runtime_Status.md`
- `Wizard_Cantrip_Formulas_Runtime_Status.md`
- `Wizard_Memorize_Spell_Runtime_Status.md`
- `Wizard_Spell_Mastery_Runtime_Status.md`
- `Grim_Hollow_2024_Integration_Status.md`

## Spell/magic foundation

- **REFERENCE** `Spell_Magic_System_Foundation.md` — spell/magic architecture foundation. Current imports/runtime source outrank old catalogue counts.

## Sprite system

- **REFERENCE** `Sprite_Production_Art_Bible.md` — visual production standard.
- **REFERENCE/ROADMAP** `Sprite_Production_Work_Map.md` — production work map; verify current asset state before assuming old queue.
- **HISTORICAL** `Sprite_Production_Run_Log.md` — run history/acceptance evidence.
- **REFERENCE** `npc-portrait-art-direction.md` — NPC portrait art direction.

## Security / repository / operations

- **REFERENCE/ROADMAP** `Security_Hardening_Roadmap_Status.md` — security hardening status/roadmap; re-check current advisories/source before work.
- **REFERENCE** `REPO_ACCESS_STANDING_RULE.md` — repository access/standing rule.
- **REFERENCE** `ARTWORK_BINARY_TRANSFER_RUNBOOK.md` — guarded binary transfer procedure.
- **REFERENCE/HISTORICAL** `Loading_Root_Cause_Backlog.md` — loading issue/root-cause backlog; reproduce current defects before acting.
- **REFERENCE/HISTORICAL** `Deferred_UI_Polish_Backlog.md` — deferred UI ideas; not automatically current priority.
- **HISTORICAL** `Character_Forge_PR_A_Deployment_Evidence.md` — exact deployment evidence for its named checkpoint.
- **ROADMAP/HISTORICAL** `Dawn_High_Quality_Prototype_Plan.md` — prototype plan; verify whether any portion has since shipped.

## Raw snapshots / generated reference data

These are **RAW SNAPSHOT** or generated-reference artifacts. Do not use them instead of live Supabase/current source:

- `Cron INFO important.txt`
- `PublicDBFunctions .txt`
- `characters_TableInfo_2.txt`
- `advance_all_characters_v3' function.sql`
- `DNDNext_Alchemy_Ingredients_Codex.xlsx`
- `DNDNext_Alchemy_Potions_Codex.xlsx`
- `DNDNext_Alchemy_Potions_Codex_v3.xlsx`
- `DNDNext_Alchemy_Potions_Codex_v4.xlsx`
- `DNDNext_Alchemy_Potions_Codex_v5.xlsx`
- `DNDNext_Alchemy_Potions_Codex_v6.xlsx`
- `DNDNext_Alchemy_Potions_Codex_v7.xlsx`
- `DNDNext_Alchemy_Potions_Codex_v8.xlsx`
- `alchemy-brew-guide-v1.json`
- `alchemy-brew-guide-v2.json`
- `alchemy-brew-guide-v3.json`
- `alchemy-brew-guide-v4.json`

If additional generated/reference files appear in `docs/`, classify them by the same rule: exported data is not live authority.

## Permanent protected boundaries

- World map and town/city map remain distinct systems.
- Do not change world-map behavior unless Paul explicitly requests it.
- Forge/Tarot/dice documentation does not authorize crafting/inventory/merchant/economy/tactical/world changes.
- Tactical rules remain server/RPC authoritative.
- Historical evidence should be preserved, not rewritten to manufacture a false continuous “current” narrative.
