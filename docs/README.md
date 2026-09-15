# DNDNext Living Documentation Index

Updated: 2026-09-15

This directory is the documentation surface for `bob8675309/DNDNEXT`. The project is a Next.js Pages Router campaign platform backed by Supabase/Postgres and deployed through Vercel.

## Documentation trust order

When documents disagree, use this order:

1. current `main` source and validators;
2. live Supabase schema/functions/data for the subsystem being inspected;
3. current GitHub PR/branch state and exact-head CI;
4. current Vercel production/preview state;
5. current controlling documents listed below;
6. dated subsystem ledgers and historical phase evidence.

Do not treat a historical SHA, PR state, migration number, or preview URL embedded in an older document as permanently current.

## Current repository checkpoint

Current reconciled `main` checkpoint for this documentation pass:

`663281753fc1f789bc7caa3092f6e9980f4458af` — merged PR #190, **Harden Vercel deployment maintenance**.

Recent important merges:

- PR #176 — Character Forge Training/browser continuation — merged 2026-09-11.
- PR #177 — reusable Realistic Dice core plus Forge/Class/Species continuation — merged 2026-09-11.
- PR #189 — restored the cinematic looping subclass carousel and Tarot presentation to production — merged 2026-09-15.
- PR #188 — Vercel preview guard plus bounded repository/deployment cleanup — merged 2026-09-15.
- PR #190 — hardened Vercel deployment-maintenance tooling — merged 2026-09-15.

PR #187 (`agent/subclass-carousel-selector-20260911`) remains open, but the production selector/Tarot behavior was restored by the narrower PR #189. Treat #187 as a historical/working branch that must be freshly reconciled before any future merge; do not merge it wholesale merely because it contains earlier carousel work.

## Live infrastructure checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`, healthy.

Migration ledger verified 2026-09-15:

- migrations: **214**;
- latest version: `20260814161314`;
- latest name: `grim_hollow_heritage_catalog_support`.

Vercel project: `dndnext`, Node 22.x. The 2026-09-15 cleanup removed **628 obsolete deployments**: 124 old failed/canceled deployments and 504 stale READY `agent/*` previews. Final stale-preview audit returned **0** READY `agent/*` candidates older than seven days while **23 production deployments were explicitly protected**.

`vercel.json` now uses `scripts/vercel_ignore_build.mjs`: ordinary `agent/*` commits skip full Preview builds; include `[deploy-preview]` in a commit message when an intentional full Preview is required.

## Start here

1. `DNDNext_Current_Handoff_Prompt.md` — copy-ready current takeover brief.
2. `Documentation_Refresh_Manifest.md` — current reconciliation record and documentation classification policy.
3. `Current_Development_Status_and_Roadmap.md` — current high-level product/engineering state and forward roadmap.
4. `CHATGPT_REPO_WRITE_PROCEDURE.md` — safe GitHub/Supabase/Vercel working procedure.
5. Read the dedicated subsystem ledger for the area being changed.

For subclass/Tarot work, also read:

- `CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`;
- `CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md`.

For deployment/storage work, read `VERCEL_DEPLOYMENT_STORAGE_AND_MAINTENANCE_STATUS.md`.

## Current Character Forge state

The shared Player/NPC Forge architecture is established. Species, Background, Training, Class, Abilities, Spells, Equipment, Identity, Story, and Review remain part of the player creation flow. Existing source-choice/persistence contexts and server-side creation/progression authority must remain authoritative; presentation changes must not invent duplicate save state.

The production subclass selector is now the cinematic looping carousel/Tarot experience, not the older compact two-column selector. Current production-art completion is defined by **runtime-visible choices**, not the historical preferred-source count:

- runtime-visible subclass choices: **149**;
- dedicated-card target: **149**;
- known visible choices still resolving to generic/class fallback artwork: **43**.

Four historical Wizard identities — Abjuration, Divination, Evocation, and Illusion — have normalized assets/mappings but are compatibility/reprint identities suppressed from the visible runtime list. They are not four additional missing cards.

`scripts/validate_class_subclass_browser.mjs` still protects the historical 109 approved normalized concepts and safe fallback behavior. It does not yet prove that all 149 runtime-visible choices have dedicated cards. The final validator follow-up must close that gap without changing subclass eligibility or persistence.

## Realistic Dice state

The old roadmap described a future Three/R3F/Rapier implementation. That proposal is historical. A reusable Phase-1 dice core is now implemented on `main` through the merged PR #177 using the project’s own deterministic JavaScript simulation and CSS/DOM presentation.

Current important paths include:

- `components/dice/RealisticDiceTray.js`;
- `components/dice/adapters/ForgeAbilityDiceTray.js`;
- `utils/dice/diceRollContract.js`;
- `utils/dice/diceVisualSeed.js`;
- `utils/dice/physics/dicePhysicsEngine.js`;
- `scripts/validate_realistic_dice_core.mjs`.

The locked rule remains: **game rules decide the result; dice physics only visualizes it**. Character Sheet and tactical adapters remain future work unless current source shows otherwise at the time of implementation.

## Character Sheet / inventory / crafting

Read these as subsystem authority before changing their areas:

- `Character_Sheet_Formula_Reference.md`;
- `NPC_Character_Sheet_Selection_Reconciliation.md`;
- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`;
- `Town_Crafter_Current_Status.md`;
- `Source_Patch_Pipeline_Audit.md`.

The broader future crafting redesign remains separate from Forge/Tarot/dice work.

## Tactical encounter system

`Tactical_Encounter_Combat_Roadmap_Blueprint.md` is the high-level tactical reference. The many `Tactical_Encounter_Phase*.md` files are implementation/validation ledgers for their named phases. Preserve them as historical evidence; do not infer that a phase document’s old “next step” is still the project’s current priority.

Current tactical authority lives in `pages/encounters/*`, `components/encounter/*`, `utils/encounterHex.js`, and the live encounter RPC/log state. Tactical rules remain server/RPC authoritative.

## Species, Background, Training, and Class ledgers

Use the following as architecture/history references, not as substitutes for current Git/DB state:

- `Unified_Character_Forge_Status.md`;
- `Forge_Post170_Species_Artwork_Status.md`;
- `Forge_Species_Family_Submenu_Status.md`;
- `Forge_Source_Presentation_and_Species_Variants_Status.md`;
- `CHARACTER_FORGE_SPECIES_ARTWORK_ROLLOUT.md`;
- `Character_Forge_Background_Audit.md`;
- `Character_Forge_Training_Redesign_Status.md`;
- `CHARACTER_FORGE_CLASS_HERO_ARTWORK_STATUS.md`;
- `CHARACTER_FORGE_CLASS_CINEMATIC_ARTWORK_ROLLOUT.md`.

`CHARACTER_FORGE_CLASS_SUBCLASS_SELECTOR_ARTWORK.md` documents the **superseded compact selector** and is historical design provenance only. Current selector authority is the Tarot/carousel documentation above plus current source.

## Historical/runtime feature ledgers

Feature-specific `*_Runtime_Status.md`, `PR170_*`, dated browser-review documents, tactical phase ledgers, and sprite-production run logs intentionally retain their original checkpoints. They are evidence of what was implemented/tested at that time. Their embedded “current branch”, “open PR”, migration, or deployment statements are historical unless repeated in one of the current controlling documents above.

## Raw reference snapshots

Files such as `Cron INFO important.txt`, `PublicDBFunctions .txt`, `characters_TableInfo_2.txt`, `DB_route_info_UPDATED.md`, the alchemy workbook/JSON codices, and retained SQL/reference snapshots are not live-state authority. Use live Supabase/source inspection before acting on them.

## Protected boundaries

- Do not touch world-map behavior unless Paul explicitly requests world-map work.
- Never casually combine world-map and town/city-map behavior.
- `components/MapPageClient.js`, world travel, routes, weather, camps, and world clock are protected outside explicit world-map work.
- Forge/Tarot/dice work does not authorize crafting, inventory, merchant, economy, tactical movement/pathing, or unrelated runtime changes.
- Tactical outcomes remain server/RPC authoritative.
- Verify every new helper, hook, state variable, callback, prop, RPC argument, and data-contract field is defined and passed correctly.
