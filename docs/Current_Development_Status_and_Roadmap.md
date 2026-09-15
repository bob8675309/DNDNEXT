# DNDNext Current Development Status and Roadmap

Last reconciled: 2026-09-15

This is the current high-level status/roadmap. Dated subsystem and phase ledgers remain implementation evidence, but this document controls present-tense project status when older prose conflicts with current source, live Supabase, current GitHub state, or deployed Vercel behavior.

## Current production checkpoint

Repository: `bob8675309/DNDNEXT`

Reconciled `main`:

`663281753fc1f789bc7caa3092f6e9980f4458af` — PR #190, Vercel maintenance hardening.

Recent major accepted work:

- #176 — Character Forge Training/browser continuation — merged.
- #177 — reusable Realistic Dice core + Forge/Class/Species continuation — merged.
- #189 — cinematic looping subclass carousel/Tarot presentation restored to production — merged.
- #188 — Vercel Preview guard + bounded repository/deployment cleanup — merged.
- #190 — Vercel cleanup workflow hardened — merged.

PR #187 remains open but is no longer production authority; its important carousel/Tarot behavior was transplanted through #189. Freshly reconcile it before any future use.

## Live platform baseline

### Supabase

Project `DnDWeb` / `ucggczovhmauhshvhusx` is healthy.

Migration ledger verified 2026-09-15:

- 214 rows;
- latest `20260814161314 grim_hollow_heritage_catalog_support`.

### Vercel

Project `dndnext`, Node 22.x.

The September 15 deployment-storage cleanup removed 628 obsolete deployments: 124 failed/canceled and 504 stale READY `agent/*` previews. Final audit found 0 stale READY `agent/*` candidates older than seven days and protected 23 production deployments.

Ordinary `agent/*` pushes now skip full Preview builds. Use `[deploy-preview]` only for intentional exact commits.

### Build/validation

Production uses `npm run build:vercel` -> `scripts/vercel_build_v2.mjs` -> focused validators -> Next.js build. The existing `utils/encounterHex.js` module-type warning remains non-fatal; do not confuse it with a failed production build.

## Platform systems already established

### Shared Character Forge and progression

Player and NPC creation share the current Forge architecture. Existing source-choice contexts, creation RPCs, progression logic, character sheet state, and runtime-rest authorities remain the source of truth.

Player flow:

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

Persistent source choices should converge between direct creation at level N and earned progression to level N. Rest-configurable and per-use decisions must remain runtime/action decisions rather than being forced into creation.

### Species

Species presentation/artwork is mature. Preserve canonical identity and source-choice authority, parent/child reveal, dedicated artwork routing, semantic facts, language/size/lineage choices, and guided validation. Re-open only for concrete defects or explicitly requested new art/content.

### Background

Background presentation/source-choice routing is accepted. Preserve source-derived grants and choice placement; audit parser/routing evidence before hardcoding exceptions.

### Training

The #176 redesign is merged. Preserve player/NPC isolation, source-granted versus paid Training accounting, mapped tool↔Trade Skill behavior, feat/class-choice routing, and completion rules.

### Class/subclass

Production uses the cinematic looping subclass carousel/Tarot presentation. The old compact rectangular/two-column selector is historical only.

Current Tarot completion definition:

- 149 runtime-visible subclass choices;
- 149 dedicated-card target;
- 43 visible choices still using generic/class fallback artwork.

Four normalized Wizard compatibility/reprint identities — Abjuration, Divination, Evocation, Illusion — are suppressed from the visible runtime list and are not missing cards.

Current validator still proves the historical 109 normalized concept set and fallback safety; it does not yet prove 149/149 runtime-visible dedicated art.

### Realistic Dice

A reusable Phase-1 dice core is implemented and merged. It uses a custom deterministic JavaScript simulation and DOM/CSS rendering, not the original Three/R3F/Rapier proposal.

Current Forge adapter exists. Mechanical result authority remains outside the physics system. Character Sheet and tactical dice adapters remain future bounded phases.

### Character Sheet / inventory / equipment

Canonical character sheets, formulas, equipment, inventory, quick actions, class/spell/feature state, and permission-aware player/NPC flows are established. Preserve the documented item/equip/sheet/tactical authority pipeline.

### Crafting/economy/town

Alchemy, Smithing, Enchanting, profession, material, recipe, storefront, and merchant foundations exist. A larger future crafting redesign — including more unified/material-centric craft effects and potentially richer tool-specific craft skills — should remain a separate project from Forge/Tarot/dice work.

### World and town maps

World-map and town/city-map behavior are separate protected systems. World routes, travel windows, weather, camps, clock, and location simulation are not general-purpose UI work surfaces. Do not modify them unless explicitly requested.

### Tactical encounter engine

The tactical engine remains separate from world/town systems and server/RPC authoritative. Current foundations include axial hex movement, turns/actions/resources, melee/ranged/thrown attacks, saves, typed damage/healing, cover/LOS, conditions/effects, reactions, spell resources, combat logs, and reviewed spell adapters.

The historical `Tactical_Encounter_Phase*.md` files document how these slices were delivered; current source/live RPCs outrank their old next-step wording.

### Sprites

The project has an 8-direction sprite production/runtime direction and retained production/QA documentation. Sprite art production remains separate from Character Forge portrait/Tarot artwork.

## Current priority queue

Unless Paul redirects or a production regression appears:

1. finish the current subclass Tarot artwork backlog in small approved batches;
2. strengthen subclass-art validation so it evaluates actual runtime-visible choices rather than only the historical 109 concept list;
3. keep Preview deployments intentional and monitor Deployment Storage after the 628-deployment cleanup;
4. continue repository vestige cleanup only when a file is proven unused/superseded;
5. continue Character Forge polish only for reproduced defects or explicit user-directed presentation work;
6. address Character Sheet dice integration as a separate consumer phase when requested;
7. address tactical dice presentation separately, consuming already-resolved RPC/combat-log results;
8. resume broader crafting redesign/tactical roadmap/sprite production according to user priority, without mixing those scopes into current artwork work.

## Known follow-up risks / technical debt

### Subclass artwork validation

The current validator can allow a known visible subclass to use generic fallback art. Final deck completion requires runtime-visible enumeration plus explicit intentional-alias handling.

### Open PR #187

Do not assume #187 should eventually merge. It diverged while production was restored and infrastructure cleanup proceeded through separate PRs. Audit it against current `main`; salvage only still-needed deltas.

### Historical documentation drift

Many dated ledgers correctly preserve historical PR/migration/deployment evidence. Future handoffs must not interpret those embedded historical states as current. `docs/README.md` and `Documentation_Refresh_Manifest.md` define the trust model.

### Module-type warning

Production builds currently warn that `utils/encounterHex.js` is reparsed as an ES module because package type is not declared. This is a performance/build hygiene warning, not a current production failure. Any fix should be separately scoped and regression-tested because package-wide module-mode changes can have broad effects.

## Architectural invariants

- World map and town/city map are distinct systems.
- Tactical state never writes world travel/route/weather/camp/clock state.
- Game mechanics determine results before dice animation.
- Presentation code does not replace canonical persistence/rules authority.
- Source-owned persistent choices reuse existing contexts/RPCs rather than parallel state.
- Realtime is synchronization; database state remains authoritative.
- New helpers/hooks/state/props/callbacks/RPC arguments must be defined and passed everywhere they are used.
- Prefer additive migrations and never rewrite deployed migration history.
- Exact-head validation and explicit merge approval remain release gates.

## Documentation map

Read `README.md` and `DNDNext_Current_Handoff_Prompt.md` first. Then use the subsystem-specific ledgers for Character Forge, progression, runtime choices, sheet/equipment/crafting, tactical phases, sprites, security, or Vercel maintenance.

Historical phase ledgers remain valuable; they are not deleted merely because their old active-branch statements are no longer current.
