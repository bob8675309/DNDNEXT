# Subclass Tarot Selector — Reference Scene Rebuild Checklist

Updated: 2026-09-22

Status: **active implementation checklist**

Branch: `agent/subclass-tarot-scene-rebuild-20260922`

Visual source of truth: Paul's supplied cathedral/runic-table reference screenshot.

## Locked target

Rebuild the Character Forge subclass Tarot selector as a large cinematic modal that reproduces the supplied reference as closely as practical while using only the already-approved DNDNext subclass Tarot cards.

Locked requirements:

- preserve the existing approved Tarot deck; do **not** regenerate subclass card fronts;
- large modal scene;
- compact centered title: **Choose your Fate**;
- no design/debug annotation text in production;
- clean cathedral presentation; **no smoke by default**;
- large circular runic table as the physical carousel stage;
- cards travel continuously around the table as one real ring;
- card position/orientation/scale/depth follow ring geometry instead of fixed hand-authored slots;
- one exact front hero position;
- a clicked face-up card rotates to the hero position and uses the existing explicit subclass selection authority;
- hero card enlarges to the full intended Tarot presentation size only at the front;
- non-hero cards remain physically smaller on the table/rim;
- rear cards may show the approved card back so dense catalogues remain readable;
- prefer keeping every subclass physically on the ring; do not hide/trim options unless browser evidence proves it necessary;
- Left/Right buttons and keyboard arrows rotate the ring;
- drag/flick remains supported with a click-vs-drag threshold;
- carousel motion alone never creates a second persistence authority;
- preserve existing level gates, canonical catalogue, progression injection, selection persistence, and source-backed rules;
- world map, town/city map, tactical authority, crafting, inventory, merchants/economy, and unrelated Supabase state remain out of scope.

## Asset set

### Generated / intended new stage assets

- [x] Cathedral scene concept generated — clean gothic hall, purple-blue stained glass, gold candlelight, centered `Choose your Fate`.
- [x] Transparent runic table concept generated.
- [x] Transparent left navigation button generated.
- [x] Transparent right navigation button generated.
- [x] Transparent ornate Tarot card-back asset generated.
- [ ] Inspect each generated asset at full resolution for transparency, composition, edge artifacts, and suitability for the live modal.
- [ ] Decide whether the cathedral plate can be used as-is or needs one regeneration with a cleaner empty foreground to avoid a baked-table/double-table conflict.
- [ ] Normalize production filenames/dimensions/formats.
- [ ] Transfer approved assets into `public/media/forge/subclass-carousel/` through the guarded binary workflow.
- [ ] Verify MIME, dimensions, alpha where required, and exact diff after transfer.

## Phase 1 — establish clean implementation baseline

- [ ] Compare current `main` PR #193 selector with PR #194 and preserve only useful interaction logic.
- [ ] Do not copy PR #194's accumulated experimental CSS override stack wholesale.
- [ ] Keep `utils/classes/subclassArtwork.js` as the Tarot-card resolver authority.
- [ ] Keep all 149 current runtime-visible subclass cards and safe future fallback behavior.
- [ ] Confirm exact files in scope before runtime changes.
- [ ] Update focused validators to describe the new reference-scene contract rather than stale experimental layouts.

## Phase 2 — modal scene shell

- [ ] Make the selector a large viewport-owned modal.
- [ ] Match the reference's cinematic 16:9 composition as closely as responsive layout allows.
- [ ] Use the new cathedral scene as the background plate.
- [ ] Place the runic table as a separate controllable stage layer if that produces a closer match.
- [ ] Remove smoke assets/effects from the active scene.
- [ ] Replace the large old heading/copy with the small centered `Choose your Fate` heading.
- [ ] Keep a close control that is visible but visually subordinate to the scene.
- [ ] Position left/right navigation controls to match the reference.
- [ ] Remove old position-counter/hint/dossier clutter from the main table composition unless needed for accessibility.
- [ ] Keep subclass details accessible without covering the primary table scene.

## Phase 3 — true ring geometry

- [ ] Use one continuous parametric ring/ellipse for every subclass.
- [ ] Compute each card angle from ring offset and catalogue size.
- [ ] Anchor each card at its bottom-center so it appears to stand on the table rim.
- [ ] Make horizontal position, vertical position, scale, opacity, z-order, and yaw derive continuously from ring angle.
- [ ] Make card yaw follow the ring tangent so cards visibly bend around the table instead of sliding flat across the screen.
- [ ] Keep the front hero at one exact angle/position.
- [ ] Make hero pop forward/up from the table and enlarge smoothly.
- [ ] Keep all non-hero cards seated normally on the rim.
- [ ] Tune the ring against a small catalogue such as Monster Hunter (4 options).
- [ ] Tune the same geometry against Wizard's dense catalogue.
- [ ] Avoid a separate geometry mode for Wizard unless absolutely required.

## Phase 4 — front/back and density behavior

- [ ] Use existing Tarot fronts for the front-facing arc.
- [ ] Use the new common Tarot back for rear-facing cards.
- [ ] Flip/transition front-to-back from ring angle rather than arbitrary slot numbers.
- [ ] Keep rear motion visible so the player can understand the ring is continuous.
- [ ] Scale rear cards down enough to reduce overlap while preserving the real-ring illusion.
- [ ] Test Wizard/high-count spacing for collision/stacking.
- [ ] Prefer geometry/radius/scale/back-face treatment over hiding cards.
- [ ] Only introduce rear virtualization/windowing if full-ring browser evidence shows it is genuinely necessary.
- [ ] Ensure card fronts stay crisp at normal browser zoom.

## Phase 5 — selection and interaction

- [ ] Left arrow rotates one subclass step.
- [ ] Right arrow rotates one subclass step.
- [ ] Keyboard Left/Right mirrors button navigation.
- [ ] Escape closes modal.
- [ ] Mouse/touch drag rotates the ring continuously.
- [ ] Flick projects to a sensible snapped card position.
- [ ] Drag threshold prevents accidental card selection.
- [ ] Clicking a visible face-up non-hero card rotates that exact card to the hero position.
- [ ] Explicit eligible click uses existing `model.selectSubclass(option)` authority.
- [ ] Locked/future-level subclass can be inspected without illegal persistence.
- [ ] Carousel motion alone never calls subclass persistence.
- [ ] Selected subclass state remains synchronized with the existing Class guide after modal close.
- [ ] Reopening the modal starts from the currently selected subclass when appropriate.

## Phase 6 — hero-card presentation

- [ ] Hero card uses the existing 7:12 Tarot artwork without crop/stretch distortion.
- [ ] Hero card enlarges to the reference-like full presentation size.
- [ ] Hero enlargement is physical/layout sizing first, not excessive transform scaling that softens the image.
- [ ] Hero receives restrained gold/purple emphasis only; do not cover the artwork with large labels.
- [ ] Non-hero cards remain smaller and visually subordinate.
- [ ] Selected/hero state does not change the underlying card artwork asset.
- [ ] Hero transition stays smooth during arrow, click, and drag-snap motion.

## Phase 7 — visual fidelity pass

- [ ] Match reference framing: cathedral depth, table size, table height, and card horizon.
- [ ] Match front-arc card spacing and perspective.
- [ ] Match warm gold + cool violet lighting balance.
- [ ] Keep the scene clean; no purple smoke unless a later browser comparison demonstrates a specific depth problem.
- [ ] Prevent cards from appearing to float above or sink into the table.
- [ ] Make the table visually support the ring rather than act as a decorative background only.
- [ ] Check that the scene still reads correctly at 100% browser zoom.
- [ ] Remove any leftover experimental styling that fights the final geometry.

## Phase 8 — responsive and accessibility

- [ ] Desktop/wide layout is the primary fidelity target.
- [ ] Preserve a usable modal on medium screens without changing selection authority.
- [ ] Provide a safe narrow/mobile fallback that keeps every option reachable.
- [ ] Maintain keyboard focus visibility.
- [ ] Keep semantic button roles/labels.
- [ ] Respect reduced-motion preferences without changing the selected result.
- [ ] Prevent body/background scrolling while the modal is open and restore it on close.

## Phase 9 — validation / regression protection

- [ ] Rewrite `scripts/validate_class_subclass_browser.mjs` around the final reference-scene invariants.
- [ ] Fix `scripts/validate_class_browser_polish.mjs` so it no longer requires the obsolete automatic `browsedOption` dossier-follow behavior.
- [ ] Validate that only the explicit card-choice path calls `model.selectSubclass(option)`.
- [ ] Validate canonical subclass catalogue ownership remains in the existing guide model.
- [ ] Validate all current approved Tarot assets still resolve.
- [ ] Validate safe fallback for genuinely future/unknown subclasses.
- [ ] Run Class browser/subclass validators.
- [ ] Run relevant Forge foundation/progression regressions.
- [ ] Run production build.
- [ ] Confirm no protected map/town/tactical/crafting/inventory/merchant files changed.

## Phase 10 — browser acceptance matrix

- [ ] Monster Hunter or another 4-option class — ring still looks natural, not empty or awkward.
- [ ] Wizard — dense ring remains legible and visually continuous.
- [ ] Mid-size class — normal reference-composition case.
- [ ] Selected subclass reopening behavior.
- [ ] Future-level/locked subclass behavior.
- [ ] Arrow navigation.
- [ ] Keyboard navigation.
- [ ] Drag slowly around full ring.
- [ ] Fast flick + snap.
- [ ] Click side card -> rotate -> hero -> select.
- [ ] Rear front/back transition.
- [ ] Hero crispness and full-size presentation.
- [ ] Modal close/reopen.
- [ ] Responsive desktop, medium, and narrow viewport.
- [ ] Direct visual comparison against Paul's supplied reference screenshot.

## Phase 11 — delivery / cleanup

- [ ] Remove obsolete scene assets only after the new scene is accepted.
- [ ] Remove superseded experimental CSS instead of leaving late override stacks.
- [ ] Update selector/artwork status docs to the accepted implementation.
- [ ] Record exact validated head and preview.
- [ ] Open/refresh a bounded PR for review.
- [ ] Do not merge without Paul's explicit approval.

## Definition of done

The selector is done when the live modal reads as a near reproduction of the supplied reference: a clean gothic cathedral scene, large magical table, existing DNDNext Tarot cards physically traveling around one convincing circular ring, one enlarged hero card at the front, dense catalogues handled without losing options, explicit click-owned subclass selection, keyboard/drag navigation, and no regressions to canonical Forge authority or protected systems.
