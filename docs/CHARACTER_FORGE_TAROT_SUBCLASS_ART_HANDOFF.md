# DNDNext Subclass Tarot Artwork — Current Handoff

Updated: 2026-09-21

Status: **current maintenance handoff for the completed runtime-visible Tarot deck.**

This file restores the handoff path that current documentation already references. The older PR #187 artwork-production handoff tracked an incomplete 43-card queue; that queue is superseded.

## Current completion state

- runtime-visible subclass choices: **149**;
- dedicated approved Tarot coverage: **149 / 149**;
- known runtime-visible class/generic fallbacks: **0**;
- normalized installed artwork concepts in the repository ledger: **152**;
- current missing-card queue: **0**.

PR #193 completed the runtime-visible deck and merged on 2026-09-18 as:

`1e5c0795010a4714250d309ecefc68ee67977e2d`

Read the detailed completion ledger:

- `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`;
- `CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md`.

## Canonical card standard

`CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md` is the detailed visual/QA authority.

Core requirements:

- 7:12 aspect ratio;
- 840 × 1440 WebP final export;
- continuous full-bleed illustration through the title/emblem area;
- no opaque footer/title band;
- consistent antique-gold frame/title/emblem geometry;
- restrained readability gradient;
- crisp cinematic fantasy realism;
- deliberate species/gender/presentation/pose/environment diversity;
- mandatory full-resolution anatomy, hands, weapon, prop, companion, and species QA.

## Current selector work is separate from card production

Active presentation continuation is PR #194:

- branch: `agent/subclass-carousel-drag-crisp-20260918`;
- reviewed head at the 2026-09-21 reconciliation: `f21a81435946b1ae8ec6112e5376062cfc2b62f4`;
- exact-head Vercel preview: READY;
- current architecture: flexible equal-angle table ring with one exact front hero.

Selector geometry/stage work must preserve the completed Tarot deck. Do not regenerate cards merely to solve carousel layout.

## Future artwork workflow

When a future catalogue change adds a runtime-visible subclass:

1. verify the exact visible identity against current Forge/catalogue behavior;
2. confirm it is genuinely new rather than a compatibility alias/reprint;
3. create artwork using the canonical card standard;
4. obtain explicit artwork approval;
5. export 840 × 1440 WebP;
6. install under `public/media/subclasses/<class-key>/`;
7. wire the exact identity in `utils/classes/subclassArtwork.js` unless an intentional alias is explicitly approved;
8. run the focused subclass validators;
9. confirm runtime-visible fallback count returns to zero.

Unknown/future identities may retain the safe class-art fallback temporarily, but fallback does not count as completed artwork.

## Binary transfer

For approved binary artwork, use the established guarded route documented in:

- `ARTWORK_BINARY_TRANSFER_RUNBOOK.md`;
- `REPO_ACCESS_STANDING_RULE.md`.

Do not use giant inline base64 transfer attempts when the established binary bridge is available.

## Protected boundaries

Subclass artwork/selector maintenance is presentation-only. It does not authorize changes to:

- subclass eligibility/persistence/progression;
- Supabase schema/data;
- world-map or town/city-map behavior;
- travel/routes/weather/camps/world clock;
- crafting/inventory/merchant/economy mechanics;
- tactical encounter authority.
