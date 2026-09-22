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
- [x] Inspect each generated asset at full resolution for transparency, composition, edge artifacts, and suitability for the live modal.
- [x] Use the generated cathedral plate as the primary scene: it already contains the clean integrated table and matches the reference more closely. Keep the separately generated transparent table as an optional fallback layer rather than stacking both by default.
- [x] Normalize the two active production assets: 1280×720 cathedral WebP and 315×540 7:12 shared card-back WebP.
- [x] Commit the active cathedral/card-back assets through exact blob → tree → commit → non-forced ref update. Generated standalone table/nav assets remain optional and are not active.
- [x] Verify active asset format/dimensions and exact branch diff after transfer.

### 2026-09-22 browser-review repair

Paul's first preview video exposed a binary-transfer defect rather than a carousel failure: the cathedral scene and shared card back had been committed as ~15 KB placeholder/corrupt blobs, so the ring rendered over the modal's dark fallback background. The actual generated artwork was re-exported unchanged as production WebPs and installed through the guarded Dropbox → one-shot GitHub Actions binary workflow.

Verified replacement assets:

- `subclass-selector-cathedral-20260922.webp` — 1672×941, 395,594 bytes, SHA-256 `de5a16e6580070ee223406564cb513db10aa35f81341407e174a025191cf74da`;
- `subclass-selector-card-back-20260922.webp` — 958×1642, 457,926 bytes, SHA-256 `91870d716588b5b4f92c6bc5991a56294b147a384444fb72abda185f4b90bb80`.

The transfer workflow guarded target head `1017a9aeddc6f9f7f1699798aa404508d574ff88`, verified ZIP/file hashes, MIME, dimensions, exact two-file diff, and the focused subclass selector validator before pushing binary-repair commit `e384423745b2b1f416edd1c51d32c2818434a72a`.

## Phase 1 — establish clean implementation baseline

- [x] Compare current `main` PR #193 selector with PR #194 and preserve only useful interaction logic.
- [x] Replace the selector stylesheet with one clean reference-scene stylesheet rather than copying PR #194's override stack.
- [x] Keep `utils/classes/subclassArtwork.js` as the Tarot-card resolver authority.
- [x] Keep all 149 current runtime-visible subclass cards and the existing safe future fallback behavior.
- [x] Confirm initial runtime scope: `components/ClassSubclassSection.js`, `styles/character-forge-subclass-tarot-layout.css`, focused Class/subclass validators, new selector stage assets, and directly related selector docs only.
- [x] Update focused validators to describe the reference-scene contract and remove the stale automatic browsed-card expectation.

## Phase 2 — modal scene shell

- [x] Make the selector a large viewport-owned modal.
- [x] Use a centered 16:9 desktop scene shell matching the reference composition.
- [x] Use the new cathedral/runic-table scene as the active background plate.
- [x] Keep the separately generated transparent table out of the active composition for now because the accepted cathedral plate already contains the table; retain it only as an optional fallback if browser tuning needs independent table control.
- [x] Remove smoke assets/effects from the active scene.
- [x] Replace old heading/copy with the small centered `Choose your Fate` integrated into the scene; retain only a visually-hidden semantic heading in React.
- [x] Keep a small subordinate close control in the upper-right.
- [x] Position compact gold-ring left/right navigation controls at the table sides.
- [x] Remove the old visible position counter, hint, and dossier from the table composition; retain an aria-live status only.
- [x] Keep details routed through the existing `onInspectSubclass`/Class detail authority rather than restoring an in-modal dossier that covers the scene.

## Phase 3 — true ring geometry

- [x] Use one continuous parametric ring/ellipse for every subclass.
- [x] Compute each card angle from ring offset and catalogue size (`360 / N`).
- [x] Anchor each card at bottom-center with `translate(-50%, -100%)` and bottom transform origin.
- [x] Derive position, scale, opacity, z-order, and yaw continuously from ring angle/depth.
- [x] Make yaw follow ring angle so cards bend around the table.
- [x] Keep one exact front hero position.
- [x] Enlarge the exact hero through physical card width with smooth position/size transitions.
- [x] Keep non-hero cards on their natural ring positions.
- [ ] Tune the ring against a small catalogue such as Monster Hunter (4 options).
- [ ] Tune the same geometry against Wizard's dense catalogue.
- [x] Use the same ring equations for every catalogue size; only bounded radius/card-size density adjustments vary with N.

## Phase 4 — front/back and density behavior

- [x] Use the existing approved Tarot fronts for the front-facing arc.
- [x] Use the new shared Tarot back for rear-facing cards.
- [x] Derive front/back state from ring angle (±78° face-up arc).
- [x] Keep every rear card in the DOM/on the same physical ring with reduced depth/opacity rather than removing it.
- [x] Scale non-hero/rear cards continuously by ring depth.
- [ ] Test Wizard/high-count spacing for collision/stacking.
- [x] Prefer geometry/radius/scale/back-face treatment; no visible-card cap or hiding window exists.
- [x] No rear virtualization/windowing in the initial implementation.
- [ ] Ensure card fronts stay crisp at normal browser zoom.

## Phase 5 — selection and interaction

- [x] Left arrow rotates one subclass step.
- [x] Right arrow rotates one subclass step.
- [x] Keyboard Left/Right mirrors button navigation.
- [x] Escape closes the modal.
- [x] Mouse/touch pointer drag rotates the ring continuously.
- [x] Flick velocity projects to a bounded snapped card position.
- [x] Drag threshold + short click suppression prevents accidental selection after a drag.
- [x] Clicking a visible face-up card rotates that exact card to hero.
- [x] Explicit eligible click uses the existing `model.selectSubclass(option)` authority.
- [x] Locked/future-level card click publishes inspection but does not call subclass persistence.
- [x] Carousel motion alone never calls subclass persistence; validators enforce exactly one explicit `model.selectSubclass(option)` call.
- [x] Selection still flows through the existing Class guide model; no parallel subclass state was introduced.
- [x] Reopening centers the currently selected subclass.

## Phase 6 — hero-card presentation

- [x] Hero uses the existing 7:12 Tarot front in a 7:12 container.
- [x] Hero has a dedicated larger physical width (bounded up to 306px desktop) instead of rendering every card at hero size.
- [x] Hero enlargement is driven by card width; transform scale remains 1 at hero.
- [x] Hero receives restrained gold/purple outline/glow with no artwork-covering label.
- [x] Non-hero cards remain smaller and depth-scaled.
- [x] Selected/hero state does not change the Tarot front asset.
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

- [x] Desktop/wide 16:9 is the primary implementation target.
- [x] Add medium-screen sizing fallback without changing selection authority.
- [x] Add a narrow/mobile modal fallback while preserving the same option/ring authority.
- [x] Maintain focusable front cards, close control, and navigation buttons.
- [x] Keep semantic button roles, list semantics, labels, posinset/setsize, and aria-live hero status.
- [x] Respect reduced motion by collapsing transition duration only.
- [x] Lock body scrolling while modal is open and restore the prior overflow value on cleanup.

## Phase 9 — validation / regression protection

- [x] Rewrite `scripts/validate_class_subclass_browser.mjs` around the new ring/asset/authority invariants.
- [x] Fix `scripts/validate_class_browser_polish.mjs` so it no longer requires obsolete `browsedOption` dossier-follow behavior.
- [x] Validate that only the explicit card-choice path calls `model.selectSubclass(option)`.
- [x] Validate canonical subclass catalogue ownership remains in the existing guide model.
- [x] Validate all 152 normalized approved Tarot concepts remain installed/mapped (149 current runtime-visible choices).
- [x] Validate safe fallback for genuinely future/unknown subclasses.
- [x] Run Class browser/subclass validators on PR #199; all focused selector/Class validators pass.
- [ ] Run relevant Forge foundation/progression regressions.
- [ ] Run production build.
- [x] Confirm PR #199 changed-file scope contains no protected map/town/tactical/crafting/inventory/merchant/economy/Supabase runtime files.

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
- [x] Use a clean replacement selector stylesheet; no copied PR #194 late override stack.
- [ ] Update selector/artwork status docs to the accepted implementation.
- [ ] Record exact validated head and preview.
- [x] Open bounded PR #199 from `agent/subclass-tarot-scene-rebuild-20260922`.
- [ ] Do not merge without Paul's explicit approval.

## Definition of done

The selector is done when the live modal reads as a near reproduction of the supplied reference: a clean gothic cathedral scene, large magical table, existing DNDNext Tarot cards physically traveling around one convincing circular ring, one enlarged hero card at the front, dense catalogues handled without losing options, explicit click-owned subclass selection, keyboard/drag navigation, and no regressions to canonical Forge authority or protected systems.
