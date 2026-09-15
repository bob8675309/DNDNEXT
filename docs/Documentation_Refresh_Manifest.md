# DNDNext Documentation Refresh Manifest

Updated: 2026-09-15

This manifest records the repository-wide documentation reconciliation performed after the September 2026 Character Forge/Tarot work, repository vestige cleanup, and Vercel deployment-storage cleanup.

## What was audited

The pass reviewed the human-facing documentation surface under `docs/`, current `main`, recent merged/open pull requests, the live Supabase migration ledger, the production Vercel project, and the current source/validator paths most likely to invalidate older prose.

The goal is not to rewrite every dated phase report into present tense. Historical phase reports are evidence. The goal is to make it impossible for a future handoff to mistake historical status for current status.

## Current authority checkpoint

Repository: `bob8675309/DNDNEXT`

Current reconciled `main`: `663281753fc1f789bc7caa3092f6e9980f4458af`.

Recent accepted chain:

- #176 — Character Forge Training/browser continuation — merged 2026-09-11.
- #177 — Realistic Dice core + Forge/Class/Species continuation — merged 2026-09-11.
- #189 — production subclass Tarot/carousel restoration — merged 2026-09-15.
- #188 — Vercel preview guard + bounded repository/deployment cleanup — merged 2026-09-15.
- #190 — Vercel maintenance hardening — merged 2026-09-15.

PR #187 remains open on `agent/subclass-carousel-selector-20260911`, but its important selector/Tarot production behavior was restored by #189. It is not the current production branch and must not be merged wholesale without a fresh source/diff reconciliation.

## Live database checkpoint

Supabase: `DnDWeb` / `ucggczovhmauhshvhusx`.

Verified 2026-09-15:

- status: healthy;
- migration count: **214**;
- latest migration version: `20260814161314`;
- latest migration name: `grim_hollow_heritage_catalog_support`.

Repository SQL filenames and old migration references do not outrank the live database. Inspect live effects before any migration/data action.

## Deployment/storage checkpoint

The Vercel audit established that repeated READY Preview deployments from `agent/*` branches were the primary historical deployment-storage churn source.

Cleanup completed 2026-09-15:

- old failed/canceled deployments removed: **124**;
- stale READY `agent/*` previews removed: **504**;
- total removed: **628**;
- final stale READY candidates older than seven days: **0**;
- production deployments explicitly protected during the final audit: **23**.

Ordinary `agent/*` commits now skip full Vercel Preview builds through `scripts/vercel_ignore_build.mjs`; `[deploy-preview]` intentionally opts a commit into a full Preview build.

Permanent maintenance authority: `.github/workflows/vercel-deployment-maintenance.yml`.

## Character Forge / subclass correction

The old documentation had three conflicting eras:

1. compact rectangular/two-column subclass selector;
2. historical 109-concept normalized artwork checkpoint;
3. runtime cinematic looping Tarot carousel.

Production now uses era 3.

Current artwork-completion definition:

- visible runtime subclass choices: **149**;
- dedicated Tarot-card target: **149**;
- current real visible fallbacks: **43**.

The historical **109** remains useful provenance for the first normalized artwork set but is not the final production target.

Wizard compatibility note: Abjuration, Divination, Evocation, and Illusion have normalized assets/mappings but are suppressed duplicate/reprint identities in the visible runtime selector. They are not additional missing cards.

The 43-card queue is tracked in `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`.

## Validator gap recorded by this refresh

`scripts/validate_class_subclass_browser.mjs` still checks the historical 109 installed/mapped concepts and verifies fallback safety. That is not enough to prove the runtime-visible deck is complete.

Before declaring the Tarot deck complete, validation must enumerate the visible Forge subclass set and fail if a known visible choice resolves to generic class artwork, while preserving:

- explicitly approved intentional aliases;
- the four suppressed Wizard compatibility identities;
- safe fallback for truly unknown/future content;
- existing class-guide/model selection and persistence authority.

Do not alter subclass eligibility merely to make an artwork count pass.

## Realistic Dice correction

The 2026-08-30 roadmap said implementation had not started and proposed Three + React Three Fiber + direct Rapier.

Current source proves that statement is obsolete. Merged PR #177 established a reusable dice baseline using a custom deterministic JavaScript simulation and CSS/DOM rendering. Current implementation includes `RealisticDiceTray`, `ForgeAbilityDiceTray`, a normalized dice contract, seeded visual randomness, a fixed-step custom physics engine, and focused validation.

The architectural rule survived unchanged: **rules determine outcomes; dice presentation visualizes resolved outcomes**.

The original Three/R3F/Rapier proposal is retained only as historical design exploration. It is not the current dependency/runtime architecture.

## Documentation classification policy

### A. Current controlling documents

These should be read first and kept reconciled with current source/infrastructure:

- `README.md`;
- `DNDNext_Current_Handoff_Prompt.md`;
- `Documentation_Refresh_Manifest.md`;
- `Current_Development_Status_and_Roadmap.md`;
- `CHATGPT_REPO_WRITE_PROCEDURE.md`;
- current active subsystem handoffs such as the Tarot and Vercel maintenance ledgers.

### B. Current subsystem architecture/reference

These explain durable ownership/rules even when their status date is older:

- `Unified_Character_Forge_Status.md`;
- `Character_Progression_Foundation.md`;
- `Character_Progression_and_Higher_Level_Forge.md`;
- `Character_Sheet_Formula_Reference.md`;
- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`;
- `NPC_Character_Sheet_Selection_Reconciliation.md`;
- `Source_Patch_Pipeline_Audit.md`;
- `Tactical_Encounter_Combat_Roadmap_Blueprint.md`;
- `Security_Hardening_Roadmap_Status.md`;
- sprite art/production architecture documents.

Their embedded old SHAs/counts remain evidence for their date. Re-check live/current source before mutation.

### C. Historical implementation/evidence ledgers

Dated browser-review files, `PR170_*`, `Tactical_Encounter_Phase*.md`, individual spell-phase/status ledgers, runtime-choice feature ledgers, and sprite run logs preserve implementation history. Do not silently rewrite their original acceptance evidence.

If a historical file says an old PR was open, that statement describes the historical checkpoint unless a current controlling document repeats it.

### D. Raw snapshots/reference artifacts

Database dumps/function listings, route/table snapshots, SQL files, workbook codices, and generated JSON reference data are snapshots, not live-state authority.

## Documents corrected/superseded in this refresh

The refresh updates or replaces the most misleading current-status documents, including:

- the living index;
- current handoff;
- this manifest;
- high-level development roadmap;
- repository-write procedure;
- Realistic Dice roadmap/status;
- subclass artwork status;
- compact subclass-selector document;
- Training current status;
- Species artwork current-branch status;
- new Tarot handoff/checklist/card standard on `main`;
- new Vercel deployment-storage/maintenance status.

Older evidence documents remain available and are deliberately classified instead of rewritten into false present-tense history.

## Standing protected boundaries

- World map is protected unless Paul explicitly requests world-map changes.
- World-map and town/city-map behavior remain separate.
- Character Forge/Tarot/dice work does not authorize travel/routes/weather/camps/clock, crafting-runtime, inventory, merchants, economy, encounter movement/pathing, or unrelated tactical rules.
- Tactical resolution remains server/RPC authoritative.
- Supabase service-role credentials never belong in browser code.
- Existing validators should be strengthened when necessary, not weakened to make a patch pass.
- Before any merge, re-fetch the PR head and merge only the exact validated head after explicit approval.
