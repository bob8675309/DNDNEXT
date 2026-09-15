# DNDNext Next-Chat Handoff Brief

Updated: 2026-09-15

Repository: `bob8675309/DNDNEXT`

Stack: Next.js Pages Router 16.1.6, React 19, Supabase/Postgres, Bootstrap/SCSS, Vercel.

## Current authoritative checkpoint

Current reconciled production `main`:

`663281753fc1f789bc7caa3092f6e9980f4458af` — merged PR #190, **Harden Vercel deployment maintenance**.

Recent important merges:

- PR #176 — Character Forge Training/browser-review continuation — merged 2026-09-11.
- PR #177 — Realistic Dice core plus Forge/Class/Species continuation — merged 2026-09-11.
- PR #189 — restored cinematic looping subclass carousel/Tarot presentation to production — merged 2026-09-15.
- PR #188 — Vercel preview guard plus bounded repository/deployment cleanup — merged 2026-09-15.
- PR #190 — Vercel deployment-maintenance hardening — merged 2026-09-15.

PR #187 (`agent/subclass-carousel-selector-20260911`) is still open at the time of this handoff, but it is **not** the production authority. Its important carousel/Tarot behavior was transplanted to `main` by PR #189. Do not merge #187 wholesale without first comparing it to current `main` and removing superseded/unrelated history.

Always re-fetch current `main`, open PRs, and the exact target branch before writing or merging. This SHA is a handoff anchor, not a permanent future truth.

## Mandatory startup sequence

1. Inspect current GitHub `main`, current open PRs, exact remote heads, and changed-file scopes.
2. Inspect live Supabase only for the subsystem relevant to the task.
3. Read `docs/README.md`, `Documentation_Refresh_Manifest.md`, this file, and the dedicated subsystem ledger.
4. Check exact-head CI/Vercel state before making acceptance/deployment claims.
5. Preserve existing runtime/persistence authority; presentation changes must not create parallel source-of-truth state.
6. Keep the requested patch bounded. Do not attach unrelated cleanup or feature work to an active branch merely because it is convenient.
7. Run focused validators plus protected-boundary/regression checks.
8. Before merge, re-fetch the PR head and use the expected validated head. Merge only after Paul explicitly approves it.

## Live Supabase checkpoint

Project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Verified 2026-09-15:

- status: `ACTIVE_HEALTHY`;
- Postgres 17;
- migration ledger rows: **214**;
- latest migration: `20260814161314 grim_hollow_heritage_catalog_support`.

Do not re-run SQL just because an old repo filename or document suggests a different migration number. Inspect the live effect first.

## Vercel / deployment-storage checkpoint

Project: `dndnext`, Node 22.x.

The September 15 cleanup removed **628 obsolete deployments**:

- 124 old failed/canceled deployments;
- 504 stale READY Preview deployments from `agent/*` branches.

Final stale READY audit found **0** `agent/*` Preview candidates older than seven days and explicitly protected **23** production deployments.

Current guard:

`vercel.json -> ignoreCommand -> scripts/vercel_ignore_build.mjs`

Ordinary `agent/*` commits skip a full Preview build. Add `[deploy-preview]` to a commit message only when an intentional full Preview is needed.

Permanent cleanup workflow:

`.github/workflows/vercel-deployment-maintenance.yml`

It is audit-first, excludes production, restricts stale READY cleanup to `agent/`, requires explicit delete confirmation, paces deletes, honors Vercel HTTP 429 `Retry-After`, retries with bounds, and verifies Vercel returned the expected deployment ID in `DELETED` state.

Recent CANCELED records created by the preview guard are expected lightweight skip records; do not confuse them with the old full READY Preview-storage backlog.

## How the site fits together

| Area | Primary surfaces | Authority / boundary |
| --- | --- | --- |
| App shell | `pages/_app.js`, global profile/Forge surfaces | Shared shell; do not make unrelated global changes for a local feature. |
| Auth/profile | login/signup/profile pages and shared profile panels | Supabase Auth + player/profile/permission data; guard stale async identity loads. |
| Shared Character Forge | `NewNpcModalV3*`, `NpcForgeStepContent`, Forge contexts | Shared Player/NPC creation architecture. Existing contexts/RPCs own persisted choices. |
| Species | Species catalogue/context + `utils/speciesArtwork.js` | Parent/child presentation may differ from persisted source identity; do not duplicate lineage state. |
| Background | Background guide/context + source-choice routing | Source grants/choices remain canonical; Training/Spells own routed decisions. |
| Class/subclass | `NpcForgeClassGuide*`, `ClassSubclassSection.js`, subclass context/resolver | Model/context own subclass eligibility/persistence; carousel/Tarot is presentation only. |
| Abilities / dice | `NpcForgeAbilityStep.js`, `components/dice/*`, `utils/dice/*` | Forge roll objects determine results; dice simulation visualizes them. |
| Training | player Training modules + preserved NPC base path | Skills/tools/Trade Skills/feat choices; preserve player/NPC isolation. |
| Character Sheet | shared sheet/profile panels | Canonical formulas/equipment/spells/features; future dice adapters consume resolved roll data. |
| Inventory/crafting | inventory/equipment/crafting pages/components/RPCs | Separate canonical item/crafting authority. Forge/Tarot/dice work does not rewrite it. |
| World map | `pages/map.js`, `components/MapPageClient.js` | Protected world travel/location/weather/camp/clock authority. |
| Town/city | `pages/town/[id].js`, town sheets/crafters/merchants | Local town behavior; keep separate from world map. |
| Tactical encounter | `pages/encounters/*`, `components/encounter/*`, `utils/encounterHex.js`, encounter RPCs/logs | Server/RPC authoritative movement/combat/spells/resources. |
| Validation/deploy | `scripts/validate_*.mjs`, `.github/workflows/*`, Vercel | Semantic regression gates + exact deployment state. |

## Character Forge current state

Player creation steps remain:

1. Species
2. Background
3. Class
4. Abilities
5. Training
6. Spells
7. Equipment
8. Identity
9. Story
10. Review

Persistent source choices must reuse the existing source-choice/creation/progression authority. Rest-configurable choices belong to runtime/rest state; per-use transformations belong to action/spell UI; presentation-only information must not become a fake required creator choice.

### Species

Species is mature and should remain frozen unless a concrete defect is reproduced. Preserve family/child reveal, canonical identity routing, Common-language conventions, selectable source-owned Size/Language/lineage choices, semantic facts, and guided Continue validation.

### Background

Background is accepted. Preserve source-derived grants/choices and the compact family-art presentation. Audit source parsing/routing before inventing one-off corrections.

### Training

PR #176 is merged. Its Training redesign is no longer an open branch. Preserve player/NPC isolation, source-granted vs paid choice accounting, tool↔Trade Skill mappings, and existing completion authority.

### Class/subclass

Production now uses the **cinematic looping subclass carousel with standardized Tarot-card presentation** restored through PR #189. The old compact two-column selector documentation is historical only.

Current artwork audit:

- runtime-visible subclass choices: **149**;
- dedicated-card target: **149**;
- visible choices currently falling back to generic/class artwork: **43**.

Wizard compatibility suppresses four normalized duplicate/reprint identities from the visible runtime list: Abjuration, Divination, Evocation, and Illusion. Their assets/mappings remain; they are not missing cards.

Read:

- `CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

Do not call the deck complete based on the historical 109-concept validator checkpoint.

## Realistic Dice current state

The reusable Phase-1 Realistic Dice core **is implemented** on `main`; the old roadmap’s “not started” statement is obsolete.

Current implementation is not Three/R3F/Rapier. It uses a custom deterministic JavaScript simulation plus DOM/CSS transforms and includes:

- normalized roll/die contract;
- seeded visual randomness;
- fixed-step collision/settling simulation;
- `RealisticDiceTray`;
- Forge `ForgeAbilityDiceTray` adapter;
- focused validation.

Important files:

- `components/dice/RealisticDiceTray.js`;
- `components/dice/adapters/ForgeAbilityDiceTray.js`;
- `utils/dice/diceRollContract.js`;
- `utils/dice/diceVisualSeed.js`;
- `utils/dice/physics/dicePhysicsEngine.js`;
- `scripts/validate_realistic_dice_core.mjs`.

Locked rule: **mechanical results are authoritative before animation. Physics never decides D&D outcomes.**

Character Sheet and tactical adapters remain future phases unless current source has advanced beyond this handoff.

## Tarot artwork continuation

Current production target is **149 visible / 149 dedicated**. The known 43-card fallback queue is:

- Barbarian: Ancestral Guardian, Battlerager, Beast, Giant, Storm Herald, Totem Warrior, Wild Magic.
- Bard: Creation, Eloquence, Swords, Whispers.
- Fighter: Arcane Archer, Cavalier, Echo Knight, Purple Dragon Knight (Banneret), Rune Knight, Samurai.
- Monk: Ascendant Dragon, Astral Self, Drunken Master, Four Elements, Kensei, Long Death, Sun Soul.
- Mystic: Avatar, Awakened, Immortal, Nomad, Soul Knife, Wu Jen.
- Paladin: Conquest, Crown, Oathbreaker, Redemption, Watchers.
- Ranger: Drakewarden, Horizon Walker, Monster Slayer, Swarmkeeper.
- Rogue: Inquisitive, Mastermind, Scout, Swashbuckler.

Canonical card standard: 7:12, final 840×1440 WebP, full-bleed illustration through the lower title/emblem area, no opaque footer/title band, consistent antique-gold frame geometry, deliberate visual diversity, and full anatomy/prop QA.

After each wiring batch, re-audit actual runtime-visible choices rather than decrementing the list blindly.

## Known subclass validator gap

`scripts/validate_class_subclass_browser.mjs` still asserts the historical 109 approved normalized concepts and fallback safety. Before final Tarot completion, strengthen it to enumerate visible runtime choices and fail known visible generic/class fallbacks while preserving true unknown/future fallback and approved/suppressed compatibility identities.

Do not change subclass rules or visibility just to satisfy artwork validation.

## Character Sheet, crafting, tactical, sprites, and security

Read the dedicated ledgers before touching these systems:

- `Character_Sheet_Formula_Reference.md`;
- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`;
- `NPC_Character_Sheet_Selection_Reconciliation.md`;
- `Town_Crafter_Current_Status.md`;
- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus relevant phase ledgers;
- sprite production art/work/run documents;
- `Security_Hardening_Roadmap_Status.md`.

Dated tactical/spell/runtime phase files are historical implementation evidence, not a current priority queue by themselves.

## Non-negotiable boundaries

- Do not touch the world map unless Paul explicitly asks.
- Do not mix world-map behavior with town/city-map behavior.
- `components/MapPageClient.js`, world routes/travel/weather/camps/clock are protected outside explicit world-map work.
- Forge/Tarot/dice changes do not authorize crafting, inventory, merchant, economy, tactical movement/pathing, encounter authority, or unrelated character-runtime changes.
- Tactical rules stay server/RPC authoritative.
- Do not convert rest or per-use choices into permanent creator choices.
- Prefer additive database migrations; never rewrite deployed migration history.
- Never expose a Supabase service-role key to browser code.
- Before returning a patch, verify every new helper, hook, state variable, prop, callback, RPC argument, and data-contract field is defined and passed correctly.

## Immediate continuation priority

Unless Paul redirects or a production regression appears:

1. continue the 43-card Tarot fallback queue in small approved batches;
2. strengthen runtime-visible subclass artwork validation before declaring the deck complete;
3. keep Vercel Preview builds intentional with `[deploy-preview]`;
4. continue repository/document cleanup only when files are proven dead or stale;
5. keep larger crafting, Character Sheet dice, tactical dice, and unrelated subsystem work in separate bounded passes.
