# Character Forge Class Cinematic Artwork Rollout

Status date: 2026-09-05

This document is the handoff authority for the mirrored cinematic Class artwork rollout on PR #177 (`agent/realistic-dice-core`). It is a presentation-layer program only. Existing Class selection, subclass selection, progression, feature inspection, Training/Spells/Equipment routing, and source-data authority remain unchanged.

## Approved presentation direction

The Class tab should visually mirror the Species cinematic system:

- Species: hero subject weighted to the left, lore/facts on the right.
- Class: hero subject weighted to the right, Class copy/facts on the left.
- Class hero artwork should extend through the full visible Class content height rather than being confined to a shallow header crop.
- Artwork may sit behind foreground Class content, but readability must be protected by a dark left-to-right blend and appropriately opaque content surfaces.
- Art direction is realistic cinematic fantasy, matching the approved Species portrait family.
- Poses, environments, and lighting should vary by Class rather than repeating one generic heroic stance.

## Hero artwork and menu artwork are separate roles

Do not force one asset to serve both surfaces.

### Hero artwork

Purpose-built for the selected-Class presentation:

- right-weighted subject;
- enough negative/dark space on the left for text;
- full-height crop tolerance;
- realistic environmental storytelling;
- no text, logos, borders, or UI baked into the image.

### Menu artwork

Purpose-built or separately approved for the compact left Class catalogue:

- readable at thumbnail scale;
- tighter crop than hero art;
- subject centered for the catalogue slot;
- must not be produced by destructively cropping the wide/full-height hero.

`utils/classes/classArtwork.js` remains the exact-name authority for both roles through `classHeroArtworkFor` and `classMenuArtworkFor`.

## Rendering contract

Legacy/core square paintings remain safe fallbacks and continue using non-destructive `contain` framing.

New public cinematic hero exports use the `cinematic-<class>.webp` naming convention under `public/media/classes/`. The final Class framing layer detects those purpose-built cinematic paths and promotes their `<img>` from the shallow header slot into a full-height, right-anchored background layer behind the Class content.

The full-height cinematic rules must:

1. keep the image anchored to the right;
2. use `object-fit: cover` only for purpose-built cinematic hero exports;
3. preserve readable left-side copy with a dark blend;
4. remove redundant post-resolver scale/zoom;
5. keep foreground Class content above the artwork;
6. collapse safely back to a contained header presentation at narrow/mobile widths;
7. leave legacy fallback paintings untouched until a replacement is explicitly approved.

Artificer and Barbarian retain their existing generated hero/menu pair until browser review approves replacement or promotion under the same standard.

## First approved production batch — installed

The first new Class hero batch was browser-approved and installed on 2026-09-05:

1. Fighter — `/media/classes/cinematic-fighter.webp`
2. Wizard — `/media/classes/cinematic-wizard.webp`
3. Rogue — `/media/classes/cinematic-rogue.webp`
4. Cleric — `/media/classes/cinematic-cleric.webp`
5. Ranger — `/media/classes/cinematic-ranger.webp`

Binary asset commit: `74d21a011f02239ee9913d39709c42448afea6fd` (`Add first cinematic Class hero batch`).

Resolver mapping commit: `569a714fd5d31b14b94b1dadda07e1f2cce723bc` (`Map first approved cinematic Class hero batch`).

The transfer used the established Dropbox `/DNDNext-Transfer` bridge and a one-shot GitHub Actions materializer with exact-head, ZIP SHA-256, per-file SHA-256, MIME, 1600×1200 dimension, exact-diff, and focused Class-framing guards before pushing the five binary files to `agent/realistic-dice-core`.

The menu-art map remains separate and intentionally unchanged for this batch. Existing compact catalogue artwork remains in use until dedicated menu portraits are explicitly approved.

Environmental/art direction represented in this batch:

- Fighter — fortified battlefield/stronghold atmosphere.
- Wizard — arcane study/observatory atmosphere.
- Rogue — moonlit urban rooftop/shadowed city atmosphere.
- Cleric — sanctified temple/divine-light atmosphere.
- Ranger — mountain/forest frontier atmosphere.

All five use the same realistic cinematic fantasy family while varying pose, gaze, elevation, lighting, and environment.

## Validation gate

Before a new Class hero batch is called installed:

1. confirm exact intended Class-name mappings only;
2. confirm every new hero file exists and is a valid image;
3. confirm menu art remains separately resolved and readable;
4. confirm legacy Classes without approved cinematic art still use safe fallback framing;
5. confirm the cinematic subject is visible on the right and the left-side Class copy remains readable;
6. verify Overview and Detailed Guide views;
7. verify subclass, progression, feature hover/focus/click, and deferred-choice routing still behave identically;
8. run `Validate Class browser polish`, including the Class hero framing regression step;
9. run the normal Forge validation suite and verify Vercel build/runtime state;
10. inspect the exact diff for unrelated systems before advancing PR #177.

## Protected boundaries

This rollout does not authorize changes to:

- Class mechanics or progression data;
- subclass eligibility or selection;
- Training, Spells, or Equipment choice authority;
- Supabase schema/data;
- Character Sheet mechanics;
- world-map behavior;
- town/city-map behavior;
- travel, routes, weather, encounters, crafting, merchants, or inventory.

## Binary artwork transfer

Use `docs/ARTWORK_BINARY_TRANSFER_RUNBOOK.md` for approved image installation. The preferred DNDNext route is the Dropbox `/DNDNext-Transfer` + one-shot GitHub Actions materializer path with checksum, exact-head, MIME/dimension, and exact-diff guards. Do not regress to giant inline-base64 transfer attempts.
