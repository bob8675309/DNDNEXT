# DNDNext Next-Chat Handoff Brief

Updated: 2026-08-16

Repository: `bob8675309/DNDNEXT`

Stack: Next.js **Pages Router** 16.1.6, React 19, Supabase/Postgres, Bootstrap/SCSS, Vercel.

## Current authoritative checkpoint

Accepted runtime/code baseline on `main`:

`8c37e30063d2523a5f488073d3ea60c5571c7182` — `Merge PR #173: restore Simic Animal Enhancement descriptions`

A documentation-only merge after this checkpoint may advance `main` without changing runtime behavior. Always inspect the current remote ref before writing code.

Recent merged chain:

- PR #170 — unified Character Forge / progression / runtime foundation — merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`.
- PR #171 — Species artwork/presentation, Profile/Forge window continuation, Heritage/Profile integration — merged at `ed93331b946dffee1e63183e969f115d0c8a1a18`.
- PR #172 — Eladrin/Hexblood/shared Species readability refinements — merged at `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`.
- PR #173 — source-backed Simic Hybrid Animal Enhancement descriptions — merged at `8c37e30063d2523a5f488073d3ea60c5571c7182`.

There is no remaining broad Species redesign task. Treat the accepted Species UI as a frozen baseline unless a concrete browser defect is reproduced.

## Copy-ready takeover instruction

You are taking over DNDNext as a senior developer and technical advisor. Before changing anything, inspect the current GitHub `main`/active PR and the live Supabase project, then read this brief plus the dedicated ledger for the requested subsystem. Reconcile source, live data, CI, deployment state, and documentation before writing. Propose a bounded safe patch plan first. Preserve working systems and verify every new helper, hook, state variable, prop, callback, and RPC argument is defined and passed correctly. Do not touch the world map unless Paul explicitly requests world-map work, and never mix world-map behavior with town/city-map behavior.

GitHub, live Supabase, current source, and exact-head validators outrank prose when they disagree.

## Mandatory startup sequence

1. Inspect current `main`, active branches/PRs, exact remote head, changed-file scope, GitHub workflows, and Vercel state.
2. Inspect Supabase project `ucggczovhmauhshvhusx` (`DnDWeb`) and only the tables/functions relevant to the requested subsystem.
3. Read `docs/README.md`, `Documentation_Refresh_Manifest.md`, this file, and the dedicated subsystem ledger.
4. Inspect the current source path end to end before proposing a patch.
5. State a bounded patch plan before implementation.
6. Branch from the exact current `main` head. Never overwrite an older dirty handoff branch.
7. Reuse existing source-choice/runtime/persistence authority; do not add parallel state for visual convenience.
8. Run focused validators plus regression/protected-boundary checks and a production build gate when the touched workflow provides one.
9. Before merge, re-read the PR head, confirm all triggered checks succeeded, and use an expected-head guard.
10. Never use a merge action as a substitute for finding branch-write tooling.

## Non-negotiable boundaries

- World-map and town/city-map behavior are separate systems.
- `components/MapPageClient.js`, world travel, routes, weather, camps, and world clock are protected unless Paul explicitly asks for world-map work.
- A Forge/UI patch does not authorize route, travel, tactical combat, crafting, inventory, merchant, or economy changes.
- Do not convert rest-configurable or per-use decisions into permanent Character Forge choices.
- Persistent source choices must reuse existing source-choice authority; do not add duplicate React or database state.
- Prefer additive database migrations. Never rewrite already-deployed migration history.
- Never expose a Supabase service-role key to the browser.

## Live Supabase checkpoint

Project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Latest migration recorded in `supabase_migrations.schema_migrations` at this handoff:

`20260814161314 grim_hollow_heritage_catalog_support`

The ledger contains 214 migration records at this checkpoint. Recent registered entries include:

- `20260814161314 grim_hollow_heritage_catalog_support`;
- `20260814160725 enable_http_for_grim_hollow_pg24_import`;
- `20260812042950 aven_subrace_catalog`;
- `20260812033649 genasi_source_detail_restore`;
- `20260811062025 genasi_subrace_catalog`.

Some later repository SQL files were applied to live data without being represented by the same repository filename in the Supabase migration ledger. Treat that as deployment-traceability drift, not permission to re-run already-correct production SQL. Inspect live effects before any corrective database action.

## How the site fits together

| Area | Primary entry points | Authority / important boundary |
| --- | --- | --- |
| Global shell | `pages/_app.js`, `components/AppNavbar.js` | Mounts the persistent Profile/Forge shell and global runtime surfaces. |
| Auth/profile | `pages/login.js`, `pages/signup.js`, `pages/profile.js`, `PlayerCharacterProfilePanelUnified.js` | Supabase Auth plus player/profile/permission rows; stale async identity loads must not overwrite the active character. |
| Shared Character Forge | `NewNpcModalV3.js`, `NewNpcModalV3Refined.js`, `NpcForgeStepContent.js` | One creation architecture for NPCs and players. NPC creation uses `create_character_v1`; player creation uses `create_player_character_v3`. |
| Forge context/choices | `NpcForgeContextPanelRefined.js`, `NpcForgeSpeciesChoiceContext.js`, `NpcForgeClassChoiceContext.js`, `NpcForgeSourceChoiceContext.js` | Explanation and canonical choices are separated by lifecycle/placement. Existing context state serializes into the creation payload. |
| Character/profile sheet | shared Profile/Sheet panels, `CharacterInteractionPanel.js`, `CharacterSheetPanel.js`, `pages/npcs.js` | Canonical character sheet, features, spellbook, equipment, runtime choices, permissions. |
| Inventory/equipment/crafting | `pages/inventory.js`, `EquipmentDiagram.js`, `CraftingWorkspace.js`, `AlchemyPanel.js`, crafting RPCs | Canonical inventory/equip/crafting authority. Presentation cleanup must not silently change formulas or consumption. |
| World map | `pages/map.js`, `components/MapPageClient.js` | Protected world-location/travel/weather/camp/clock system. Not a Forge dependency. |
| Town/city | `pages/town/[id].js`, `TownSheet.js` | Local town profiles, merchants, crafters, and interaction. Keep separate from world-map behavior. |
| Tactical encounters | `pages/encounters/*`, `components/encounter/*`, encounter RPCs | Separate turn/action/spell/reaction authority on the combat board. |
| Admin/content | `pages/admin*`, item/spell/class/species catalogues | Source/catalogue administration. Inspect live catalogue rows before one-off UI hardcoding. |
| Database | `sql/*.sql`, Supabase RPCs, RLS | Live schema/grants/data must be checked before DB work. |
| Validation/deploy | `scripts/validate_*.mjs`, `.github/workflows/*`, Vercel | Focused semantic validators + production builds are acceptance gates. |

## Character Forge architecture

The shared Forge is the intended creation surface for both NPCs and player-owned characters.

Player steps are:

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

Choice placement follows lifecycle and dependency:

- permanent Species identity/lineage decisions → Species source-choice authority;
- skills, tools, Expertise, and proficiency-dependent choices → Training;
- spell-centric Species/Background/Feat/Class choices → Spells;
- persistent higher-level acquisitions → Forge/progression;
- rest-configurable persistent choices → runtime panels/state;
- next-rest-expiring choices → rest-cycle runtime authority;
- per-use transformations or combat choices → action/spell UI;
- informational features → presentation only.

Direct creation at level N and earned progression to level N should converge on the same source-owned state.

## Accepted Species baseline

The Species tab is considered complete enough to freeze as the current baseline.

Accepted behavior includes:

- full-height desktop Species catalogue with its own scrolling;
- search reveals matching parent and child together;
- larger parent/child portraits and high-resolution Forge-only artwork;
- concise semantic facts for Speed, Size, Creature Type, Vision, Languages, and Gender & Alignment;
- Common remains implicit for ordinary player characters;
- source-driven Size/Language/lineage choices reuse canonical source-choice state;
- Darkvision hover/focus explains dim light, darkness, and grayscale;
- Dragonborn damage affinity reaches Breath Weapon/resistance copy;
- Aasimar transformations are structured readable information, not false permanent locks;
- Goliath Giant Ancestry uses compact option buttons plus selected detail;
- Eladrin Seasonal Fey Step keeps universal Fey Step rules above the selector and uses the same compact option + selected-detail pattern; its starting season remains replaceable after Long Rest through runtime authority;
- Hexblood Eerie Token presents Distant Message, Remote Viewing, and Hex Magic as readable simultaneous benefit cards;
- Simic Hybrid Animal Enhancement retains source descriptions for all level-1 and level-5 choices while preserving the distinct second-pick rule;
- guided Continue validation points the user to the first unresolved required choice;
- Profile portrait framing and bleed were accepted after browser testing with multiple portraits.

### Aetherborn — future quest/dialogue hook

`Gift of the Aetherborn` remains visible and source-backed **as it currently behaves**. Do not change or remove it during ordinary Forge cleanup.

Future design decision: when quest and NPC dialogue systems are developed, acquiring/unlocking the dark Gift should be tied to those systems. The **Game Master decides the actual prerequisite, research, quest, NPC, cost, or narrative condition** required to unlock it. Do not hardcode a universal unlock requirement now, and do not prematurely build a parallel Forge state just for this future gate.

## Next development priority

The next bounded Forge review is **Background**. After Background, continue through Class, Abilities, Training, Spells, Equipment, Identity, Story, and Review as separate reviewable slices unless a higher-priority production bug intervenes.

Other known deferred work:

- crafting issue #76 — player-facing crafting-card metadata cleanup and smithing material-quality simplification;
- stale repository issue/PR housekeeping after verifying each old item rather than blindly closing it;
- quest/dialogue-driven Aetherborn Gift gating when those systems are actually designed.

## Documents to read by task

- Current precedence/status: `README.md`, `Documentation_Refresh_Manifest.md`, this brief.
- Accepted Species baseline: `Forge_Post170_Species_Artwork_Status.md`.
- Species family identity/persistence: `Forge_Species_Family_Submenu_Status.md`.
- Shared source rendering: `Forge_Source_Presentation_and_Species_Variants_Status.md`.
- Unified creation/progression/runtime: `Unified_Character_Forge_Status.md`.
- Eladrin lifecycle: `Eladrin_Runtime_Status.md`.
- Starting magic / source-choice routing: `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`.
- Sheet/equipment/crafting: `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`, `Character_Sheet_Formula_Reference.md`.
- Tactical: `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus latest tactical phase ledger.
- Town/crafter: `Town_Crafter_Current_Status.md`, `Town_Route_Profile_Parent_Bake_Checklist.md`.
- GitHub/Supabase write discipline: `CHATGPT_REPO_WRITE_PROCEDURE.md`.

## Publishing discipline

Use exact-head guarded, non-forced GitHub writes. After every coherent slice:

1. inspect the changed paths;
2. run the applicable focused workflows/builds;
3. verify protected boundaries and symbol/prop/callback integrity;
4. confirm Vercel if a deploy is triggered;
5. re-read the PR head immediately before merge;
6. merge only the validated expected head.
