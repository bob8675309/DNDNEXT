# DNDNext Next-Chat Handoff Brief

Updated: 2026-08-20

Repository: `bob8675309/DNDNEXT`

Stack: Next.js **Pages Router** 16.1.6, React 19, Supabase/Postgres, Bootstrap/SCSS, Vercel.

## Current authoritative checkpoint

Accepted runtime/code baseline on `main`:

`a2aecdd354346926afdf33efb1af320581563b68` — merged Character Forge **Background** polish/art system (PR #175).

Active work is **not on `main`**. The current bounded work branch is:

- PR #176 — `agent/training-tab-redesign` — Character Forge **Training** redesign.

At the documentation checkpoint created on 2026-08-20, the pre-doc Training head was `4e2c93d77fd3e1f7c0d3b08ef7a75051203bc368`; later documentation/implementation commits will advance it. Always inspect the current remote PR head before writing or merging.

Recent accepted Forge chain:

- PR #170 — unified Character Forge / progression / runtime foundation — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`.
- PR #171 — Species artwork/presentation, Profile/Forge window continuation, Heritage/Profile integration — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`.
- PR #172 — Eladrin/Hexblood/shared Species readability refinements — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`.
- PR #173 — source-backed Simic Hybrid Animal Enhancement descriptions — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`.
- PR #175 — Background layout, source-choice polish, and reusable Background art system — merged `a2aecdd354346926afdf33efb1af320581563b68`.
- PR #176 — **active / unmerged** Training redesign.

Species and Background are accepted enough to freeze unless a concrete browser regression is reproduced. Training is the active Forge slice.

## Copy-ready takeover instruction

You are taking over DNDNext as a senior developer and technical advisor. Before changing anything, inspect current GitHub `main`, PR #176 and its exact head, the live Supabase project, CI, and Vercel. Then read this brief plus `Character_Forge_Training_Redesign_Status.md`. Reconcile source, live data, validators, deployment state, and documentation before writing. Preserve working systems and verify every helper, hook, state variable, prop, callback, and RPC argument is defined and passed correctly. Do not touch the world map unless Paul explicitly requests world-map work, and never mix world-map behavior with town/city-map behavior.

GitHub, live Supabase, current source, exact-head validators, and deployed behavior outrank prose when they disagree.

## Mandatory startup sequence

1. Inspect `main`, PR #176, exact remote head, changed-file scope, GitHub workflows, and Vercel state.
2. Inspect Supabase project `ucggczovhmauhshvhusx` (`DnDWeb`) and only the tables/functions relevant to the requested subsystem.
3. Read `docs/README.md`, `Documentation_Refresh_Manifest.md`, this file, and `Character_Forge_Training_Redesign_Status.md`.
4. Inspect the current Training source path end to end before proposing or extending a patch.
5. Preserve existing source-choice/runtime/persistence authority; do not create parallel state for presentation convenience.
6. Continue on the current validated Training branch unless there is a concrete reason to branch anew. Never overwrite an older unrelated handoff branch.
7. Run focused validators plus regression/protected-boundary checks and verify Vercel exact-head readiness.
8. Before merge, re-read the PR head, confirm all triggered checks succeeded, and use an expected-head guard.
9. Never use a merge action as a substitute for finding branch-write tooling.

## Non-negotiable boundaries

- World-map and town/city-map behavior are separate systems.
- `components/MapPageClient.js`, world travel, routes, weather, camps, and world clock are protected unless Paul explicitly asks for world-map work.
- A Forge/UI patch does not authorize route, travel, tactical combat, crafting-runtime, inventory, merchant, or economy changes.
- Do not convert rest-configurable or per-use decisions into permanent Character Forge choices.
- Persistent source choices must reuse existing source-choice authority; do not add duplicate React or database state.
- Prefer additive database migrations. Never rewrite already-deployed migration history.
- Never expose a Supabase service-role key to the browser.

## Live Supabase checkpoint

Project: `DnDWeb` / `ucggczovhmauhshvhusx`.

The prior migration-ledger checkpoint was 214 records with latest registered migration `20260814161314 grim_hollow_heritage_catalog_support`. Some repository SQL effects may be live under different migration-ledger naming, so inspect live effects before any database action and do not re-run already-correct production SQL by assumption.

For the current Training pass, the relevant content authority is primarily:

- `public.character_option_catalog` and preferred/configured views;
- source `metadata` and `raw_payload` for Background skill/tool/language/feat grants;
- existing Forge/source-choice/progression RPC authority.

No Training documentation work itself authorizes a Supabase schema/data write.

## How the site fits together

| Area | Primary entry points | Authority / important boundary |
| --- | --- | --- |
| Global shell | `pages/_app.js`, `components/AppNavbar.js` | Mounts persistent Profile/Forge shell and global runtime surfaces. |
| Auth/profile | `pages/login.js`, `pages/signup.js`, `pages/profile.js`, `PlayerCharacterProfilePanelUnified.js` | Supabase Auth plus player/profile/permission rows; stale async identity loads must not overwrite the active character. |
| Shared Character Forge | `NewNpcModalV3.js`, `NewNpcModalV3Refined.js`, `NpcForgeStepContent.js` | One creation architecture for NPCs and players. Player creation uses `create_player_character_v3`. |
| Forge context/choices | `NpcForgeContextPanelRefined.js`, `NpcForgeSpeciesChoiceContext.js`, `NpcForgeClassChoiceContext.js`, `NpcForgeSourceChoiceContext.js` | Explanation and canonical choices are separated by lifecycle/placement. Existing context state serializes into the creation payload. |
| Training | `NpcForgeTrainingStep.js`, preserved `NpcForgeTrainingStepBase.js`, Training/source/class choice contexts | **Active player redesign.** NPC Forge must continue through the preserved legacy Training path until deliberately reconciled. |
| Character/profile sheet | shared Profile/Sheet panels, `CharacterInteractionPanel.js`, `CharacterSheetPanel.js`, `pages/npcs.js` | Canonical character sheet, features, spellbook, equipment, runtime choices, permissions. |
| Inventory/equipment/crafting | `pages/inventory.js`, `EquipmentDiagram.js`, `CraftingWorkspace.js`, `AlchemyPanel.js`, crafting RPCs | Canonical inventory/equip/crafting authority. Training may route craft proficiency; it must not silently change recipes/formulas/consumption. |
| World map | `pages/map.js`, `components/MapPageClient.js` | Protected world-location/travel/weather/camp/clock system. Not a Forge dependency. |
| Town/city | `pages/town/[id].js`, `TownSheet.js` | Local town profiles, merchants, crafters, interaction. Keep separate from world-map behavior. |
| Tactical encounters | `pages/encounters/*`, `components/encounter/*`, encounter RPCs | Separate turn/action/spell/reaction authority. |
| Admin/content | `pages/admin*`, item/spell/class/species/background catalogues | Source/catalogue administration. Inspect live catalogue rows before one-off UI hardcoding. |
| Validation/deploy | `scripts/validate_*.mjs`, `.github/workflows/*`, Vercel | Focused semantic validators + production deployments are acceptance gates. |

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
- specific Bonus Feat selection → **Training** (Abilities selects only the Bonus Feat package);
- spell-centric Species/Background/Feat/Class choices → Spells;
- persistent higher-level acquisitions → Forge/progression;
- rest-configurable persistent choices → runtime panels/state;
- next-rest-expiring choices → rest-cycle runtime authority;
- per-use transformations/combat choices → action/spell UI;
- informational features → presentation only.

Direct creation at level N and earned progression to level N should converge on the same source-owned state.

## Accepted Species baseline

Species is frozen as the accepted baseline unless a concrete defect is reproduced. Key accepted behaviors include full-height searchable catalogue, parent/child reveal, high-resolution artwork, semantic facts, Common implicit language handling, source-driven Size/Language/lineage choices, Darkvision guidance, affinity-aware Dragonborn copy, structured Aasimar/Goliath/Eladrin/Hexblood presentation, source-backed Simic choices, and guided Continue validation.

`Gift of the Aetherborn` remains source-backed and unchanged for now. Future acquisition belongs to Game-Master-defined quest/NPC dialogue progression rather than a universal Forge prerequisite.

## Accepted Background baseline

Background redesign/polish is merged and accepted. The visual system uses reusable family banners/crests/icons and compact grant/feature presentation. Do not re-open broad Background layout work unless a specific defect is reproduced.

Source audit remains relevant because Training ownership is changing. Important confirmed examples from live source payloads:

- Athlete (MOT) genuinely grants **one language** and Vehicles (land); do not delete the language merely because it feels unusual.
- Mist Wanderer (RHW), Clan Crafter (SCAG), and Rune Carver (BGG) genuinely contain artisan-tool proficiency choices/grants.

Audit for omissions/parsing/routing mistakes, not subjective rebalancing. House-rule rebalance is a separate decision.

## Active Training design contract

Read `Character_Forge_Training_Redesign_Status.md` for the full checklist. The key locked decisions are:

- every Training decision stays on the **left**;
- the right side is a focused **Current Selection** information panel only;
- Training should use one primary resolved/required tally with a clickable provenance breakdown rather than four confusing independent counters;
- the actual Bonus Feat is selected in Training;
- player-facing tool proficiency and craft/trade proficiency are being unified where a canonical crafting mapping exists;
- Background tool/craft choices should be acknowledged on Background but resolved in Training;
- craft/trade skills should sit as a compact subsection like Class Skills, not a separate large dashboard;
- the feat chooser should become a catalogue/list-detail experience inspired by the Profile `Feats & Boons` catalogue, not a giant native select;
- preserve source-owned nested choices and eligibility authority.

### Tool / Craft direction

Paul's current decision is that if a source grants a crafting-tool proficiency, it intends the character to be able to use that craft. Therefore a mapped crafting tool and its campaign Craft/Trade Skill should be one player-facing proficiency, not two separately purchased picks.

Current canonical pairs:

- Alchemist's Supplies ↔ Alchemy;
- Smith's Tools ↔ Smithing;
- Calligrapher's Supplies ↔ Scribe/Scribing;
- Enchanter's Tools ↔ Enchanting.

Do not force unrelated tools, vehicles, instruments, or kits into one of these four families. Longer-term, each meaningful crafting tool may become its own recipe/progression craft, but that is a future crafting-system project.

## Next development priority

Continue **Training PR #176** in this order unless a production regression intervenes:

1. route Background proficiency/tool choices into Training without changing source data;
2. build one Skill & Training resolved/required tally with source breakdown;
3. consolidate mapped tool/craft proficiency with a canonical helper and prevent double-spending;
4. redesign feat selection using Profile-catalogue interaction language;
5. complete the all-75 Background source audit for omissions/routing errors;
6. run exact-head validators/Vercel/browser review and merge only after user acceptance.

After Training is accepted, continue the remaining Forge slices in reviewable chunks: Spells → Equipment → Identity → Story → Review, with Class/Abilities revisited only for reproduced defects or dependencies. After the Forge is complete, circle back to the broader crafting-material/craft-system redesign discussed with the user.

## Documents to read by task

- Current precedence/status: `README.md`, `Documentation_Refresh_Manifest.md`, this brief.
- **Active Training checklist:** `Character_Forge_Training_Redesign_Status.md`.
- Accepted Background audit/history: `Character_Forge_Background_Audit.md`.
- Accepted Species baseline: `Forge_Post170_Species_Artwork_Status.md`.
- Shared source rendering: `Forge_Source_Presentation_and_Species_Variants_Status.md`.
- Unified creation/progression/runtime: `Unified_Character_Forge_Status.md`.
- Starting magic / source-choice routing: `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`.
- Sheet/equipment/crafting: `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`, `Character_Sheet_Formula_Reference.md`.
- Town/crafter: `Town_Crafter_Current_Status.md`, `Town_Route_Profile_Parent_Bake_Checklist.md`.
- GitHub/Supabase write discipline: `CHATGPT_REPO_WRITE_PROCEDURE.md`.

## Publishing discipline

Use exact-head guarded, non-forced GitHub writes. After every coherent slice:

1. inspect changed paths;
2. run applicable focused workflows/regressions;
3. verify protected boundaries and symbol/prop/callback integrity;
4. confirm exact Vercel deployment if triggered;
5. re-read PR head immediately before merge;
6. merge only the validated expected head.