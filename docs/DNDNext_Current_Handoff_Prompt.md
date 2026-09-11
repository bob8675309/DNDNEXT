# DNDNext Next-Chat Handoff Brief

Updated: 2026-08-30

Repository: `bob8675309/DNDNEXT`

Stack: Next.js **Pages Router** 16.1.6, React 19, Supabase/Postgres, Bootstrap/SCSS, Vercel.

## Current authoritative checkpoint

Accepted runtime/code baseline on `main`:

`a2aecdd354346926afdf33efb1af320581563b68` — merged Character Forge **Background** polish/art system (PR #175).

Active work is **not on `main`**. The current open continuation branch is:

- PR #176 — `agent/training-tab-redesign` — still **open / unmerged**.

PR #176 began as the player Training redesign and has since accumulated broader Character Forge browser-review work, including later Class/Abilities presentation polish. Immediately before the 2026-08-30 documentation-only Realistic Dice handoff updates, the remote PR head was:

`9447be566f8383e8227c6fccb37a0bde2bdbe078`

Documentation commits made after that checkpoint advance the branch. **Always re-fetch the exact current PR head before writing, validating, deploying, or merging.**

Recent accepted Forge chain:

- PR #170 — unified Character Forge / progression / runtime foundation — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`.
- PR #171 — Species artwork/presentation, Profile/Forge window continuation, Heritage/Profile integration — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`.
- PR #172 — Eladrin/Hexblood/shared Species readability refinements — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`.
- PR #173 — source-backed Simic Hybrid Animal Enhancement descriptions — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`.
- PR #175 — Background layout, source-choice polish, and reusable Background art system — merged `a2aecdd354346926afdf33efb1af320581563b68`.
- PR #176 — **active / unmerged** Character Forge browser-review continuation.

Species and Background are accepted enough to freeze unless a concrete browser regression is reproduced. Current Character Forge work should stay incremental and exact-head validated.

## Most important new future plan: Realistic Dice Roller

Read:

- `docs/Realistic_Dice_Roller_Architecture_Roadmap.md`

This is now the controlling design document for the planned reusable Realistic Dice subsystem.

The current Abilities page contains a CSS-based dice-tray/result-die prototype. It is **not the final architecture**. The next reusable dice implementation should support:

- Forge ability generation;
- Character Sheet checks/saves/initiative;
- damage/healing dice later;
- future tactical combat roll presentation;
- true d6, d8, d10, d12, and d20 geometry;
- a Forge-only aggregate `resultCube` for generated totals such as 4d6-drop-lowest results.

Locked architectural rule:

> **D&D rules/RPCs/Forge generation determine the outcome. The Realistic Dice physics engine only visualizes that already-known outcome.**

Do not let client rigid-body physics become authoritative for attacks, saves, damage, initiative, generated ability scores, tactical movement, LOS, or any other rules result.

### Current dice prototype files

At the pre-documentation PR checkpoint, relevant Forge files include:

- `components/NpcForgeAbilityStep.js`;
- `styles/character-forge-ability-dice-tray.css`;
- `styles/character-forge-ability-dice-bounce.css`;
- style imports in `pages/_app.js`.

The current prototype usefully preserves:

- six generated totals;
- hidden results until the player rolls;
- hover math showing individual dice and the dropped die;
- drag/select assignment into ability slots;
- reroll behavior;
- reduced-motion presentation.

Preserve those behaviors while replacing the CSS trajectory system later.

### Realistic Dice implementation boundary

Do **not** keep widening PR #176 into the permanent physics-engine PR.

Once Paul accepts the current Forge checkpoint, the Realistic Dice Core should be implemented on a **new bounded branch/PR from the accepted Forge state**. Documentation about that future system can live on #176, but the actual Three/Rapier subsystem deserves a separate review boundary.

Preferred initial technology direction, subject to a fresh compatibility check at implementation time:

- `three`;
- `@react-three/fiber`;
- direct `@dimforge/rapier3d-compat`.

Initial Realistic Dice Phase 1 should require **no Supabase migration** and should not touch the world map, town/city maps, tactical movement/pathfinding, crafting, inventory, merchants, or economy.

## Copy-ready takeover instruction

You are taking over DNDNext as a senior developer and technical advisor. Before changing anything, inspect current GitHub `main`, PR #176 and its exact head, the live Supabase project, CI, and Vercel. Then read this brief plus `Realistic_Dice_Roller_Architecture_Roadmap.md` and the dedicated ledger for whichever Forge/tactical subsystem you are touching. Reconcile source, live data, validators, deployment state, and documentation before writing. Preserve working systems and verify every helper, hook, state variable, prop, callback, RPC argument, dice-contract field, and physics-world reference is defined and passed correctly. Do not touch the world map unless Paul explicitly requests world-map work, and never mix world-map behavior with town/city-map behavior.

GitHub, live Supabase, current source, exact-head validators, and deployed behavior outrank prose when they disagree.

## Mandatory startup sequence

1. Inspect `main`, PR #176, exact remote head, changed-file scope, GitHub workflows, and Vercel state.
2. Inspect Supabase project `ucggczovhmauhshvhusx` (`DnDWeb`) and only the tables/functions relevant to the requested subsystem.
3. Read `docs/README.md`, `Documentation_Refresh_Manifest.md`, this file, and the dedicated active subsystem ledger.
4. If continuing dice work, read `Realistic_Dice_Roller_Architecture_Roadmap.md` in full before proposing code.
5. Inspect the existing consumer path end to end before extending/replacing presentation.
6. Preserve existing source-choice/runtime/persistence authority; do not create parallel state for presentation convenience.
7. Continue on the current branch only when the requested change belongs to its accepted scope. For the actual reusable Realistic Dice engine, use a dedicated branch/PR after the current Forge checkpoint is accepted.
8. Run focused validators plus regression/protected-boundary checks and verify Vercel exact-head readiness.
9. Before merge, re-read the PR head, confirm all triggered checks succeeded, and use an expected-head guard.
10. Never use a merge action as a substitute for finding branch-write tooling.

## Non-negotiable boundaries

- World-map and town/city-map behavior are separate systems.
- `components/MapPageClient.js`, world travel, routes, weather, camps, and world clock are protected unless Paul explicitly asks for world-map work.
- A Forge/UI/dice patch does not authorize route, travel, tactical movement, crafting-runtime, inventory, merchant, or economy changes.
- Tactical encounter rule resolution remains server/RPC authoritative.
- Dice rigid-body collisions must **not** replace `encounterHex`, pathing, occupancy, LOS, cover, or turn/action rules.
- Do not convert rest-configurable or per-use decisions into permanent Character Forge choices.
- Persistent source choices must reuse existing source-choice authority; do not add duplicate React or database state.
- Prefer additive database migrations. Never rewrite already-deployed migration history.
- Never expose a Supabase service-role key to the browser.

## Live Supabase checkpoint

Project: `DnDWeb` / `ucggczovhmauhshvhusx`.

The prior migration-ledger checkpoint was 214 records with latest registered migration `20260814161314 grim_hollow_heritage_catalog_support`. Some repository SQL effects may be live under different migration-ledger naming, so inspect live effects before any database action and do not re-run already-correct production SQL by assumption.

The Realistic Dice Phase 1 architecture does not require a database write. Tactical integration later should consume the existing authoritative encounter RPC/combat-log result path rather than inventing a second roll authority.

Relevant tactical live objects already include:

- `encounters`;
- `encounter_participants`;
- `encounter_combat_log`;
- `encounter_command_requests`;
- encounter conditions/effects/spell-slot/reaction/map tables;
- `encounter_weapon_attack_v1`;
- `encounter_unarmed_strike_v1`;
- `encounter_roll_save_v1`;
- current encounter spell-casting RPC family;
- `encounter_move_active_participant_v1`.

## How the site fits together

| Area | Primary entry points | Authority / important boundary |
| --- | --- | --- |
| Global shell | `pages/_app.js`, `components/AppNavbar.js` | Mounts persistent Profile/Forge shell and global runtime surfaces. A future global dice host should be considered only after multiple consumers exist. |
| Auth/profile | `pages/login.js`, `pages/signup.js`, `pages/profile.js`, `PlayerCharacterProfilePanelUnified.js` | Supabase Auth plus player/profile/permission rows; stale async identity loads must not overwrite the active character. |
| Shared Character Forge | `NewNpcModalV3.js`, `NewNpcModalV3Refined.js`, `NpcForgeStepContent.js` | One creation architecture for NPCs and players. Player creation uses existing creation RPC authority. |
| Forge context/choices | Species/Class/Source choice contexts | Explanation and canonical choices are separated by lifecycle/placement. Existing context state serializes into the creation payload. |
| Abilities / current dice prototype | `NpcForgeAbilityStep.js`, `character-forge-ability-dice-tray.css`, `character-forge-ability-dice-bounce.css` | Existing Forge roll objects are math authority. Current motion is presentation only; planned Realistic Dice replaces presentation, not generation/allocation. |
| Training | `NpcForgeTrainingStep.js`, preserved `NpcForgeTrainingStepBase.js`, player Training modules | Player redesign on PR #176; NPC legacy path remains intentionally isolated unless deliberately reconciled. |
| Character/profile sheet | shared Profile/Sheet panels, `CharacterInteractionPanel.js`, `CharacterSheetPanel.js`, `CharacterSheet5e.js`, `pages/npcs.js` | Canonical character sheet, features, spellbook, equipment, runtime choices, permissions. Existing `onRoll` callback path is the future dice adapter seam. |
| Inventory/equipment/crafting | `pages/inventory.js`, `EquipmentDiagram.js`, `CraftingWorkspace.js`, crafting RPCs | Canonical inventory/equip/crafting authority. Dice work does not alter recipes/formulas/consumption. |
| World map | `pages/map.js`, `components/MapPageClient.js` | Protected world-location/travel/weather/camp/clock system. Do not embed dice rules/physics here. |
| Town/city | `pages/town/[id].js`, `TownSheet.js` | Local town profiles, merchants, crafters, interaction. Keep separate from world-map behavior. |
| Tactical encounters | `pages/encounters/*`, `components/encounter/*`, `utils/encounterHex.js`, encounter RPCs | Separate server-authoritative turn/action/spell/reaction/movement authority. Future dice adapter consumes resolved rolls only. |
| Tactical roll presentation | `TacticalAttackResultPanel.js`, combat log | Existing result/log seam that can later feed a tactical dice overlay. |
| Admin/content | `pages/admin*`, item/spell/class/species/background catalogues | Source/catalogue administration. Inspect live catalogue rows before one-off UI hardcoding. |
| Validation/deploy | `scripts/validate_*.mjs`, `.github/workflows/*`, Vercel | Focused semantic validators + exact-head deployment are acceptance gates. |

## Character Forge architecture

Player steps:

1. Species;
2. Background;
3. Class;
4. Abilities;
5. Training;
6. Spells;
7. Equipment;
8. Identity;
9. Story;
10. Review.

Choice placement follows lifecycle/dependency:

- permanent Species identity/lineage decisions → Species source-choice authority;
- skills, tools/craft proficiencies, Expertise, and proficiency-dependent choices → **Training**;
- specific Bonus Feat selection → **Training**;
- spell-centric Species/Background/Feat/Class choices → Spells;
- persistent higher-level acquisitions → Forge/progression;
- rest-configurable persistent choices → runtime panels/state;
- next-rest-expiring choices → rest-cycle runtime authority;
- per-use transformations/combat choices → action/spell UI;
- informational features → presentation only.

Direct creation at level N and earned progression to level N should converge on the same source-owned state.

## Character Sheet roll architecture relevant to future dice

`CharacterSheet5e` already performs/structures sheet checks and calls `onRoll`. `CharacterSheetPanel` forwards that callback, and `NpcPanel`/player profile presentation stores/displays the result through `CharacterSheetRollResult`.

Future `CharacterSheetDiceOverlay` should adapt that structured result first. Do not rewrite save/skill/initiative formulas solely to add 3D dice.

A later separate project may decide whether local sheet RNG should move server-side. The dice visualization contract should survive that change because it consumes a resolved result rather than owning RNG.

## Tactical roll architecture relevant to future dice

`EncounterTurnBoard` is an authoritative tactical **hex presentation**, not a physics simulation. Movement, blocking, pathing, targeting lines, area shapes, and participants are represented in discrete encounter coordinates.

`TacticalAttackResultPanel` already reads `encounter_combat_log` and formats resolved attack information. The combat log currently carries roll-oriented fields such as `roll`, `secondRoll`, `attackRoll`, `damageRoll`, `saveRoll`, `healingRoll`, `critical`, `total`, and `requestId` depending on event type.

Future tactical dice should:

- animate the RPC/log result;
- optionally use `requestId` as visual-seed input;
- never reroll the attack/save/damage independently on the client;
- never change movement/path/LOS/collision rules.

## Accepted Species baseline

Species is frozen as the accepted baseline unless a concrete defect is reproduced. Key accepted behaviors include full-height searchable catalogue, parent/child reveal, high-resolution artwork, semantic facts, Common implicit language handling, source-driven Size/Language/lineage choices, Darkvision guidance, affinity-aware Dragonborn copy, structured Aasimar/Goliath/Eladrin/Hexblood presentation, source-backed Simic choices, and guided Continue validation.

`Gift of the Aetherborn` remains source-backed and unchanged for now. Future acquisition belongs to Game-Master-defined quest/NPC dialogue progression rather than a universal Forge prerequisite.

## Accepted Background baseline

Background redesign/polish is merged and accepted. The visual system uses reusable family banners/crests/icons and compact grant/feature presentation. Do not re-open broad Background layout work unless a specific defect is reproduced.

Audit for omissions/parsing/routing mistakes, not subjective rebalancing. House-rule rebalance is a separate decision.

## Training subledger

`Character_Forge_Training_Redesign_Status.md` remains the detailed Training design/history ledger for PR #176. It is no longer the only document needed to understand the branch because later Forge browser polish also exists.

Continue to preserve:

- player/NPC Training isolation;
- source-owned proficiency/tool/feat choices;
- the large player Skills / Feats toggle direction;
- mapped tool↔Trade Skill no-double-spend behavior;
- existing completion/Continue authority.

Do not regress Training while working on Abilities/dice presentation.

## Immediate future development plan

Unless a production regression intervenes:

1. **Finish browser acceptance of the current PR #176 Forge checkpoint.** Do not reconstruct old work from chat; inspect the exact current branch and preview.
2. Keep the current CSS ability dice tray as the temporary prototype until the reusable subsystem is ready.
3. After Paul accepts the Forge checkpoint, branch a dedicated **Realistic Dice Core** PR from that accepted commit.
4. Implement Realistic Dice Phase 1 exactly as scoped in `Realistic_Dice_Roller_Architecture_Roadmap.md`:
   - normalized roll-resolution contract;
   - d6/d8/d10/d12/d20 + `resultCube` geometry;
   - Three/R3F/direct Rapier world;
   - true die-to-die and tray collisions;
   - authoritative-result final face guidance;
   - fallback/reduced-motion path;
   - Forge adapter only;
   - no Supabase/map/tactical/crafting runtime changes.
5. Browser-tune repeated rolls until paths/collisions/settling are genuinely varied and natural.
6. After Phase 1 is accepted, add the Character Sheet adapter in a separate reviewable phase.
7. When tactical work resumes, add a tactical dice adapter that consumes existing server-authoritative combat-log results.
8. Consider a global `DiceOverlayHost` only after at least two real consumers justify it.
9. Continue the remaining Forge slices and broader crafting redesign according to user priority; do not mix those projects into the dice core without an explicit scope decision.

## Documents to read by task

- Current precedence/status: `README.md`, `Documentation_Refresh_Manifest.md`, this brief.
- **Realistic Dice controlling plan:** `Realistic_Dice_Roller_Architecture_Roadmap.md`.
- Training history/contract: `Character_Forge_Training_Redesign_Status.md`, `Character_Forge_Training_Browser_Implementation_2026-08-21.md`.
- Accepted Background audit/history: `Character_Forge_Background_Audit.md`.
- Accepted Species baseline: `Forge_Post170_Species_Artwork_Status.md`.
- Shared source rendering: `Forge_Source_Presentation_and_Species_Variants_Status.md`.
- Unified creation/progression/runtime: `Unified_Character_Forge_Status.md`.
- Starting magic / source-choice routing: `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`.
- Sheet/equipment/crafting: `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`, `Character_Sheet_Formula_Reference.md`.
- Tactical combat: `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus current tactical phase ledgers and live encounter source/RPCs.
- Town/crafter: `Town_Crafter_Current_Status.md`, `Town_Route_Profile_Parent_Bake_Checklist.md`.
- GitHub/Supabase write discipline: `CHATGPT_REPO_WRITE_PROCEDURE.md`.

## Publishing discipline

Use exact-head guarded, non-forced GitHub writes. After every coherent slice:

1. inspect changed paths;
2. run applicable focused workflows/regressions;
3. verify protected boundaries and symbol/prop/callback integrity;
4. for dice work, also verify result-contract fields, physics-world lifecycle, face mapping, fallbacks, and consumer adapter wiring;
5. confirm exact Vercel deployment if triggered;
6. re-read PR head immediately before merge;
7. merge only the validated expected head.