# Character Forge Class Cinematic Artwork Rollout

Status date: 2026-09-06

This document is the handoff authority for the mirrored cinematic Class artwork rollout on PR #177 (`agent/realistic-dice-core`). It is a presentation-layer program only. Existing Class selection, subclass selection, progression, feature inspection, Training/Spells/Equipment routing, and source-data authority remain unchanged.

## Approved presentation direction

The Class tab should visually mirror the Species cinematic system:

- Species: hero subject weighted to the left, lore/facts on the right.
- Class: hero subject weighted to the right, Class copy/facts on the left.
- Public cinematic Class artwork is a stable top-right layer. Expanding/collapsing subclass controls or progression content must not resize, shift, or recrop it.
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

New public cinematic hero exports use the `cinematic-<class>.webp` naming convention under `public/media/classes/`. The final Class framing layer detects those purpose-built cinematic paths and promotes their `<img>` into a stable, right-anchored background layer behind the upper Class content.

The cinematic rules must:

1. keep the image anchored to the top-right;
2. use `object-fit: cover` only for purpose-built cinematic hero exports;
3. preserve readable left-side copy with a dark blend;
4. remove redundant post-resolver scale/zoom;
5. use a content-independent height so subclass controls cannot move or rescale the art;
6. expose enough upper artwork that the subject reads as a full cinematic background rather than a framed insert;
7. keep foreground Class content above the artwork;
8. collapse safely back to a contained header presentation at narrow/mobile widths;
9. leave legacy fallback paintings untouched until a replacement is explicitly approved.

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

## Approved Class Overview layout: two-column subclasses + wide progression

The 2026-09-06 browser review selected the two-column mockup as the Class Overview target.

### Subclass selector

- Expanded state shows every canonical `model.options` subclass in a compact **two-column scrollable list** in the same area directly above Class Progression.
- Each card shows subclass name, a short source-backed summary, source badge, and eligibility/selected state without opening a bulky inline details panel.
- Clicking a card is the only interaction that sends subclass information to the movable Feature card. Hover/focus must not change Feature-card content.
- Clicking an eligible subclass continues to call the existing `model.setPreviewKey(...)` + `model.selectSubclass(...)` authority and then collapses the selector.
- Clicking a future-level subclass may show its details in the movable Feature card but must not persist it or alter Class Progression.
- Collapsed state shows **only the selected subclass** as a compact summary plus `Change Subclass`; expanding restores the two-column catalogue.
- Clearing a choice restores the expanded selector and existing required-choice guidance.
- No search box, source-filter toolbar, six-column pill wall, or separate inline subclass-detail browser is part of the approved Overview presentation.

### Feature-card interaction

The movable Class Feature card is **selection/click driven only** on the Class tab:

- clicking a subclass card shows that subclass summary/progression;
- clicking a base Class feature bubble shows that feature;
- clicking a selected-subclass feature bubble shows that feature;
- hover and focus alone do not replace the currently displayed Feature-card content;
- keyboard activation through Enter/Space remains supported for detailed-guide feature rows.

The Feature card remains viewport-owned, draggable, dismissible, and recoverable after resize. It is not moved back into the normal Class layout.

### Class Progression

- Only the actually selected subclass contributes subclass features to progression.
- Base Class features use the established purple pill/bubble styling; selected-subclass features use differentiated cyan pills.
- Spellcasting Classes use the wider Profile-inspired table layout: Level, PB, a large Features column, Cantrips, Known/Prepared, and individual **1st through 9th spell-slot columns** rather than a compressed one-cell slot summary.
- Pact-slot data remains source-backed; when represented in the per-level grid, a value ending in `p` denotes pact slots at that spell level.
- Non-spellcasting Classes do not reserve the nine spell-slot columns.
- The progression table remains horizontally scrollable at narrower widths rather than truncating data.

### Cinematic art position

- Public cinematic art remains content-height independent so subclass collapse/expand cannot move it.
- The approved correction exposes more of the upper/right artwork using the stable top-right anchor, a taller viewport-derived art layer, and a slightly lighter blend.
- The Class tabs and foreground copy remain above the artwork.

`components/ClassSubclassSection.js` remains presentation-only. Canonical subclass availability and persistence remain in `useNpcForgeClassGuideModel` / `NpcForgeClassChoiceContext` through `model.options`, `model.currentLevel`, `model.eligible`, and `model.selectSubclass`.

The Profile-panel Class workspace (`components/CharacterClassWorkspace.js` and `styles/character-class-workspace.css`) remains the presentation reference for subclass-feature injection and feature-pill styling; it is not replaced or made a second rules authority.

## Validation gate

Before a new Class hero or Class-tab presentation batch is called installed:

1. confirm exact intended Class-name mappings only;
2. confirm every new hero file exists and is a valid image;
3. confirm menu art remains separately resolved and readable;
4. confirm legacy Classes without approved cinematic art still use safe fallback framing;
5. confirm the cinematic subject is visible high/right and the left-side Class copy remains readable;
6. confirm subclass expand/collapse does not resize or reposition cinematic art;
7. verify every canonical subclass remains visible in the two-column scroll area when expanded;
8. verify collapsed state leaves only the selected subclass summary and `Change Subclass` control;
9. verify hover/focus does not replace Feature-card content and click/keyboard activation does;
10. verify only the selected subclass contributes features to progression;
11. verify spellcasting progression exposes individual 1st–9th slot columns without truncating them;
12. verify Overview and Detailed Guide views;
13. run `Validate Class browser polish`, including hero-framing and subclass-selector regression steps;
14. run the normal Forge validation suite and verify Vercel build/runtime state;
15. inspect the exact diff for unrelated systems before advancing PR #177.

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
