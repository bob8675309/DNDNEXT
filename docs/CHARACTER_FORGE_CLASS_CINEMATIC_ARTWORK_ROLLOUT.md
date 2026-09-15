# Character Forge Class Cinematic Artwork Rollout

Status reconciled: 2026-09-15

Classification: **reference / merged rollout history**.

This artwork rollout was developed during PR #177 (`agent/realistic-dice-core`). PR #177 is now merged. Current `main`, `utils/classes/classArtwork.js`, current browser behavior, and current Class catalogue/source data outrank old branch/head wording.

## Scope

This document records the durable presentation direction for Character Forge Class cinematics. It is presentation-only. Existing Class selection, subclass eligibility/persistence, progression, feature inspection, Training/Spells/Equipment routing, and source-data authority remain separate.

## Approved cinematic direction

- Full-width Class cinematics and Class-list/menu portraits are separate asset roles.
- The Forge workspace owns the cinematic composition; nested cards should not paint competing copies.
- Source artwork should include enough negative/readability space for the left-side Class information rather than relying on heavy CSS overlays.
- Public cinematics should remain sharp and appropriately cropped across desktop/narrow layouts.
- Class-specific focal-position overrides should be minimal and justified by a current reproduced composition need.
- Menu artwork should be independently authored/cropped for its portrait role rather than blindly reusing a panoramic hero.

## Resolver authority

Class hero/menu artwork remains centralized through `utils/classes/classArtwork.js` and its current exported resolver/maps. Presentation helpers must not become Class rules authority.

When adding/replacing art:

- preserve Class key normalization;
- preserve menu-vs-hero separation;
- preserve shared Sidekick presentation only where intentionally defined;
- preserve synthetic Civilian/non-UUID handling;
- do not change Class/subclass persistence or catalogue source data merely to make artwork resolve.

## Current production relationship to subclass Tarot

The Class cinematic is background/hero presentation. The subclass selector is now the cinematic looping 7:12 Tarot carousel restored through PR #189.

Do not use a Class cinematic or Class-list portrait as a substitute for a completed subclass Tarot card. Generic Class art may remain a safe runtime fallback, but the current production Tarot target is tracked separately in:

- `CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

## Binary artwork handling

Use the established guarded binary transfer/materialization route for large image batches. Validate exact base/head, file scope, checksums, dimensions, resolver wiring, and focused Class regressions before publication.

Ordinary `agent/*` commits skip full Vercel Preview builds. Use `[deploy-preview]` only on the exact commit needing browser review.

## Validation expectations

- current Class/Forge validators pass;
- public hero/menu resolver entries point to existing non-empty assets;
- synthetic/non-UUID Class presentation does not issue invalid UUID catalogue queries;
- artwork does not change class/subclass selection authority;
- desktop and narrow composition remains usable;
- no unrelated subsystem files are changed.

## Protected boundaries

Class artwork work does not authorize world-map or town/city-map changes, routes/travel/weather/camps/clock, Supabase mutation, crafting, inventory, merchants, economy, encounter/tactical rules, or unrelated Character Sheet runtime work.
