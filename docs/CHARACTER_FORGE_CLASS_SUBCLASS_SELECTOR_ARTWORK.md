# Character Forge Class Subclass Selector Artwork

Status date: 2026-09-18

This document records the current subclass-selector presentation and interaction authority. The completed Tarot deck itself is already merged on `main`; the active refinement is PR #194 (`agent/subclass-carousel-drag-crisp-20260918`).

The selector remains presentation-only. Canonical subclass availability, level gates, persistence, progression injection, feature rules, and Supabase-backed catalogue authority remain owned by the existing Forge class guide/context.

## Current selector target

The accepted visual foundation remains the gothic runic circular Tarot gallery:

- viewport-owned modal/portal;
- gothic cathedral scene;
- glowing runic table;
- layered purple smoke;
- all canonical `model.options` arranged around one circular path;
- prominent front cards plus smaller/dimmer rear cards;
- lower source-backed subclass summary/details panel;
- completed 7:12 Tarot artwork as the card face.

PR #194 refines that foundation rather than replacing it.

## Current orbit behavior

The carousel now uses one **continuous fractional orbit**.

- Every card keeps its stable React key and moves around the same ellipse.
- Orbital position is derived from `orbitOffset`, not a duplicated scroll rail.
- Pointer dragging updates the fractional offset continuously.
- Releasing after a drag applies a short bounded flick projection and then snaps to the nearest card position.
- Left/Right buttons and keyboard arrows still move exactly one option at a time.
- Modulo wrapping remains continuous; there is no rubber-band reset, `scrollLeft` recentering, or cloned rail.
- Four cards remain the prominent front group at the normal snapped desktop positions while the rest remain visible around the rear arc.
- The wider staging exposes more of the runic table and more background cards than the first production pass.

## Browse versus selection authority

This distinction is mandatory.

**Browsing/spinning is not selection.**

- The card nearest the front reading position becomes the local `browsedOption` for the lower information panel.
- Merely moving the carousel does **not** call `model.selectSubclass(...)`.
- Merely moving the carousel does **not** call `model.setPreviewKey(...)` as an automatic expression of player intent.
- An eligible subclass is persisted only when the player explicitly clicks its Tarot card.
- That click continues through the existing `choose(option)` path:
  - `onInspectSubclass?.(option)`;
  - level-gate check;
  - `model.setPreviewKey(option.key)`;
  - `model.selectSubclass(option)`;
  - close selector.
- A future-level card may still be inspected but cannot persist early.
- **View Details** may preview/inspect the currently browsed option without selecting it.

A drag threshold plus temporary click suppression prevents release-after-drag from accidentally selecting the card under the pointer.

## Drag / flick input

The orbit supports pointer input through:

- pointer capture on press;
- horizontal drag mapped to card-space rather than raw pixel scrolling;
- `touch-action: none` on the orbit surface;
- bounded flick projection on release;
- snap to the nearest card position;
- pointer cancel fallback;
- grab / grabbing cursor feedback.

Mouse and pointer behavior share the same path. Reduced-motion CSS still disables animated transitions.

## Tarot clarity / crispness

The source Tarot files remain the canonical **840x1440 WebP** assets. They were not upscaled or replaced.

The refinement reduces display softness by:

- removing image-level brightness/saturation/contrast filters from carousel Tarot faces;
- isolating border/glow/dimming treatment in `.class-subclass-carousel-card__surface`;
- using a lightweight overlay for rear-card dimming instead of filtering the raster image;
- using backface visibility / GPU surface hints on the card surface and image;
- reducing the maximum desktop card footprint from the earlier 220px treatment to a 190px presentation;
- reducing aggressive front-card scale inflation;
- widening the orbit/table view so crisp source pixels are not being repeatedly enlarged/shrunk as heavily.

Some perspective softening is unavoidable on heavily angled side/rear cards, which is appropriate to their depth. The front reading cards should remain materially sharper.

## Presentation assets

Runic scene assets remain:

`public/media/forge/subclass-carousel/`

- `subclass-selector-cathedral-bg.png`
- `subclass-selector-runic-table.png`
- `subclass-selector-smoke-back.png`
- `subclass-selector-smoke-front.png`

Tarot cards remain under:

`public/media/subclasses/<class-key>/`

Artwork resolution remains:

`ClassSubclassSection.js -> subclassArtworkFor(classKey, option) -> utils/classes/subclassArtwork.js`

Current production-visible coverage remains **149/149** dedicated cards, with **0** known current visible class-art fallbacks. The normalized resolver ledger remains **152** because historical compatibility identities and explicit aliases are retained.

## Current implementation files

Primary implementation:

- `components/ClassSubclassSection.js`
- `styles/character-forge-subclass-tarot-layout.css`

Focused guards:

- `scripts/validate_class_browser_polish.mjs`
- `scripts/validate_class_subclass_browser.mjs`
- existing broader Class/Species review guard remains intact

Scene assets:

- `public/media/forge/subclass-carousel/*`

## Validation checkpoint

Exact implementation head before this documentation refresh:

`5c4e3d3af1b3afe6d065de2fbb9b451fdd152c2d`

On that head:

- `Validate Class browser polish`: **success**;
- focused subclass-browser validator: **success**;
- Class hero framing guard: **success**;
- Artificer mockup lock: **success**;
- final Class browser correction guard: **success**;
- Species/Class browser review guard: **success**.

The final documentation commit deliberately requests one Vercel Preview so the entire production build can validate the exact refinement branch before merge.

## Acceptance / regression requirements

Before merging or extending this selector:

1. Re-fetch current PR #194 head and current `main`.
2. Every canonical visible subclass option must remain reachable on the one continuous orbit.
3. Arrow/keyboard movement must remain exactly one card per action.
4. Pointer drag must move the cards continuously and release to a stable snapped position.
5. Dragging must never select a subclass.
6. Only an explicit eligible card click may persist a subclass.
7. Future-level cards must remain non-persistable.
8. The details panel must remain source-backed.
9. The 149 current visible identities must retain dedicated Tarot coverage.
10. Unknown/future identities must retain safe class-art fallback.
11. Exact-head focused CI plus one intentional Vercel Preview should be green before merge.
12. Do not touch world-map or town/city-map behavior while maintaining this selector.


## 2026-09-18 interaction/crispness refinement

Follow-up refinement branch: `agent/subclass-carousel-drag-crisp-20260918`.

- Front interaction is now exactly **three cards** wide.
- Only those three front cards accept click/focus selection; side/rear cards are presentation-only until they rotate forward.
- Clicking a front card immediately becomes the lower details-panel inspection target instead of leaving the panel bound to the geometric center position.
- Eligible clicked cards persist through the existing `model.selectSubclass(option)` authority; future-level cards update inspection/details but do not persist early.
- Carousel drag/flick remains independent of subclass persistence and snaps to the nearest card position.
- Card orientation now follows the true table orbit. As cards pass the side they rotate through edge-on and reveal a dedicated runic **card back** on the rear half of the table.
- The three front cards render at scale 1 with no artwork filter so the 840x1440 source Tarot images remain as crisp as browser perspective allows.
- The stage is slightly wider/zoomed out so more of the runic table and rear orbit remain visible.
- Arrow and keyboard navigation still advance one card and loop continuously with no rubber-band recentering.
