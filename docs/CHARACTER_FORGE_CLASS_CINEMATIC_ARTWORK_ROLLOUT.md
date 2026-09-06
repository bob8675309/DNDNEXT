# Character Forge Class Cinematic Artwork Rollout

Status date: 2026-09-06

This document is the handoff authority for the mirrored cinematic Class artwork rollout on PR #177 (`agent/realistic-dice-core`). It is a presentation-layer program only. Existing Class selection, subclass selection, progression, feature inspection, Training/Spells/Equipment routing, and source-data authority remain unchanged.

## Approved presentation direction

The Class tab should visually mirror the Species cinematic system:

- Species: hero subject weighted to the left, lore/facts on the right.
- Class: hero subject weighted to the right, Class copy/facts on the left.
- Public cinematic Class artwork is a stable top-right layer. Expanding controls or progression content must not resize, shift, or recrop it.
- Artwork may sit behind foreground Class content, but readability must be protected by a dark left-to-right blend and appropriately opaque content surfaces.
- Art direction is realistic cinematic fantasy, matching the approved Species portrait family.
- Poses, environments, and lighting should vary by Class rather than repeating one generic heroic stance.

## Hero artwork and menu artwork are separate roles

Do not force one asset to serve both surfaces.

### Hero artwork

Purpose-built for the selected-Class presentation:

- right-weighted subject;
- enough negative/dark space on the left for text;
- stable top-right crop tolerance;
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

New public cinematic hero exports use the `cinematic-<class>.webp` naming convention under `public/media/classes/`. The final Class framing layer detects those purpose-built cinematic paths and promotes their `<img>` from the shallow header slot into a stable, right-anchored background layer behind the upper Class content.

The cinematic rules must:

1. keep the image anchored to the top-right;
2. use `object-fit: cover` only for purpose-built cinematic hero exports;
3. preserve readable left-side copy with a dark blend;
4. remove redundant post-resolver scale/zoom;
5. use a content-independent height so opening subclass controls cannot move or rescale the art;
6. keep foreground Class content above the artwork;
7. collapse safely back to a contained header presentation at narrow/mobile widths;
8. leave legacy fallback paintings untouched until a replacement is explicitly approved.

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

## Browser-review refinement: compact visible subclasses + progression integration

The 2026-09-06 browser/video review replaced the temporary expandable subclass browser with a lighter model that matches the established Profile-panel Class workspace:

- Every canonical `model.options` subclass remains visible directly on the Class screen in a compact grid. Nothing is hidden behind a browser, search panel, or `More` disclosure.
- Hover/focus on a subclass sends its introduction and feature progression to the existing movable Class Feature card instead of expanding a large inline detail surface.
- Clicking an eligible subclass uses the existing `model.selectSubclass(...)` authority. Clicking a future-level subclass is inspection-only until its entry level is reached.
- Only the actually selected subclass contributes subclass features to the Forge progression table. Merely hovering or inspecting another subclass does not alter the table.
- The progression table reuses the Profile-panel visual language: base features are purple pill/bubbles, subclass features are differentiated cyan pill/bubbles, and each bubble routes detailed rules to the movable Feature card.
- The empty in-flow dock lane is no longer reserved in Overview because the Feature card is viewport-owned and draggable. That width is returned to Class Progression so spell/progression columns can remain visible.
- Public cinematic artwork uses a stable content-independent height and top-right anchor, preventing subclass interaction or table growth from moving/rescaling the painting.

`components/ClassSubclassSection.js` remains presentation-only. Canonical subclass availability and persistence remain in `useNpcForgeClassGuideModel` / `NpcForgeClassChoiceContext` through `model.options`, `model.currentLevel`, `model.eligible`, and `model.selectSubclass`.

The Profile-panel Class workspace (`components/CharacterClassWorkspace.js` and `styles/character-class-workspace.css`) is the presentation reference for subclass-feature injection and feature-pill styling; it is not replaced or made a second rules authority.

## Validation gate

Before a new Class hero or Class-tab presentation batch is called installed:

1. confirm exact intended Class-name mappings only;
2. confirm every new hero file exists and is a valid image;
3. confirm menu art remains separately resolved and readable;
4. confirm legacy Classes without approved cinematic art still use safe fallback framing;
5. confirm the cinematic subject is visible on the right and the left-side Class copy remains readable;
6. confirm subclass interaction does not resize or reposition cinematic art;
7. verify every canonical subclass remains inspectable and only eligible choices are selectable;
8. verify only the selected subclass contributes features to progression and those feature bubbles open the movable Feature card;
9. verify Overview and Detailed Guide views;
10. run `Validate Class browser polish`, including the Class hero framing and compact subclass-selector regression steps;
11. run the normal Forge validation suite and verify Vercel build/runtime state;
12. inspect the exact diff for unrelated systems before advancing PR #177.

## Protected boundaries

This rollout does not authorize changes to:

- Class mechanics or progression data;
- subclass eligibility or selection authority;
- Training, Spells, or Equipment choice authority;
- Supabase schema/data;
- Character Sheet mechanics;
- world-map behavior;
- town/city-map behavior;
- travel, routes, weather, encounters, crafting, merchants, or inventory.

## Binary artwork transfer

Use `docs/ARTWORK_BINARY_TRANSFER_RUNBOOK.md` for approved image installation. The preferred DNDNext route is the Dropbox `/DNDNext-Transfer` + one-shot GitHub Actions materializer path with checksum, exact-head, MIME/dimension, and exact-diff guards. Do not regress to giant inline-base64 transfer attempts.
