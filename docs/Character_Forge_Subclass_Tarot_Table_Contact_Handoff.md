# Character Forge Subclass Tarot — Floating Gothic Library Handoff

Updated: 2026-09-26

Status: **active implementation handoff / progress tracker**

Branch: `agent/subclass-tarot-scene-rebuild-20260922`  
Pull request: **#199 — Rebuild subclass Tarot selector**

## Superseding decision

The physical runic-table presentation is retired.

Browser review established that repeated attempts to make 2D Tarot cards convincingly stand, bend, fold, or occlude around a physical tabletop introduced more visual artifacts than value. The carousel itself, card scale progression, hero treatment, rear card backs, drag/flick behavior, and real DNDNext Tarot fronts are worth preserving.

The accepted new presentation is the **floating Tarot carousel in a dark, smoky ruined gothic library** shown in Paul's approved mockup.

This handoff supersedes the earlier table-contact / rune-band implementation notes in this file.

## User-approved visual target

Preserve:

- the real existing subclass Tarot fronts from `public/media/subclasses/**`;
- the existing shared Tarot back unless live review shows a concrete mismatch;
- the current hero-card scale and multi-stage side-card size falloff;
- the existing arrow, keyboard, drag, flick/snap, click-to-hero, and explicit-click selection behavior;
- face-up cards at full opacity;
- a 16:9 cinematic modal as the primary desktop composition.

Replace:

- the cathedral + runic table background;
- all table/rune foreground occlusion;
- all table-contact shadows, folds, seats, and surface-following assumptions;
- table-specific geometry comments and validator requirements.

New scene:

- very dark, dimly lit ruined gothic library / archive rotunda;
- moonlit broken roof and deep architectural shadows;
- warm candle clusters at the outer edges and galleries;
- LOTS of atmospheric smoke/fog, but card readability remains protected;
- cards float freely in open air and never touch a table, floor, altar, or other surface;
- title remains `Choose your Fate`;
- side navigation stays visually restrained and site-consistent.

## Ambient life / animation target

Animation must remain subtle. The selector should feel alive, not busy.

Required first pass:

1. **Back smoke layer**
   - slow horizontal/diagonal drift;
   - behind the cards;
   - low contrast;
   - long loop, approximately 24–36 seconds.

2. **Front smoke layer**
   - slow counter-drift;
   - in front of the lower/outer card region but never covering the hero text/art heavily;
   - long loop, approximately 18–30 seconds.

3. **Candle-light flicker**
   - restrained warm glow modulation over a few existing candle clusters;
   - no strobe;
   - asynchronous timing so both sides do not pulse together.

Optional after browser review:

4. **Distant mouse**
   - one tiny mouse crossing a distant lower shelf/walkway;
   - rare loop (roughly every 18–30 seconds);
   - must remain an easter-egg-scale ambient detail, never a focal element.

All ambient motion must disable under `prefers-reduced-motion: reduce`.

## Asset authority

Already approved / existing and should be reused:

- existing DNDNext Tarot fronts;
- existing `subclass-selector-card-back-20260922.webp`;
- existing repo smoke assets may be reused if they visually fit:
  - `subclass-selector-smoke-back.png`;
  - `subclass-selector-smoke-front.png`.

New accepted base plate prepared from the approved concept work:

- source: moonlit ruined gothic library rotunda, 1672×941;
- production target path:
  - `public/media/forge/subclass-carousel/subclass-selector-library-ruins-20260926.webp`;
- prepared production file:
  - 334,924 bytes;
  - SHA-256 `dcf3fd8ccebb4efcbdc7b821dc232f7f41ee3701c101cc664eaa1c8a9f866741`.

Do **not** regenerate the title, navigation buttons, Tarot fronts, or card back merely because concept-art versions exist. The current runtime UI already owns those elements.

## Protected boundaries

This is presentation-only. Do not change:

- canonical subclass catalogue/eligibility;
- subclass persistence/progression;
- Supabase schema/data/functions;
- world map/travel/routes/weather/camps/world clock;
- town/city-map behavior;
- tactical encounter authority;
- crafting/inventory/merchant/economy systems;
- existing approved subclass Tarot front artwork.

## Files intentionally in scope

Runtime:

- `components/ClassSubclassSection.js`
- `styles/character-forge-subclass-tarot-layout.css`

Validation:

- `scripts/validate_class_subclass_browser.mjs`

Presentation asset:

- `public/media/forge/subclass-carousel/subclass-selector-library-ruins-20260926.webp`

Documentation:

- this handoff;
- parent Tarot rebuild checklist only after a validated browser checkpoint.

## Phase 1 — remove table-specific runtime

- [ ] Remove `class-subclass-carousel-modal__rune-foreground`.
- [ ] Remove `subclass-rune-front-mask.svg` from runtime requirements.
- [ ] Remove table-contact/rune-band comments and table-specific validator assertions.
- [ ] Remove card-base contact shadow that implies a physical tabletop.
- [ ] Keep Tarot art intact and untouched.

## Phase 2 — install ruined-library stage

- [ ] Install the approved ruined-library production background.
- [ ] Make it the sole static stage background.
- [ ] Preserve 16:9 desktop framing.
- [ ] Keep the center airspace clear enough for hero readability.
- [ ] Ensure narrow-screen background cropping remains intentional.

## Phase 3 — convert ring geometry to free-floating carousel

Keep the current circular offset math and interaction authority, but remove the assumption that the path corresponds to a physical surface.

- [ ] Retain one continuous carousel path for all catalogue sizes.
- [ ] Keep hero at the current large physical width.
- [ ] Keep several intermediate physical card sizes.
- [ ] Keep whole-card roll at 0.
- [ ] Keep yaw restrained.
- [ ] Tune vertical travel only for attractive free-floating depth, not surface contact.
- [ ] Rear cards may rise/recede naturally because no table contact must be maintained.
- [ ] Keep dense Wizard catalogues legible.
- [ ] Keep four-option classes visually balanced.

## Phase 4 — ambient animation layers

- [ ] Re-enable/use a back smoke layer behind cards.
- [ ] Re-enable/use a front smoke layer above lower/outer card areas.
- [ ] Add independent slow keyframes so the two smoke layers do not move together.
- [ ] Add restrained CSS candle-glow flicker at a few fixed scene positions.
- [ ] Keep all ambient layers `pointer-events: none`.
- [ ] Disable ambient keyframes under reduced motion.
- [ ] Do not animate the background plate itself.

## Phase 5 — preserve working carousel authority

- [ ] Left/right button moves exactly one card step.
- [ ] Keyboard Left/Right mirrors buttons.
- [ ] Escape closes modal.
- [ ] Drag rotates continuously.
- [ ] Flick snaps to a legal card position.
- [ ] Click-vs-drag threshold prevents accidental selection.
- [ ] Clicking a visible face-up card rotates that exact card to hero.
- [ ] Only explicit eligible card click calls `model.selectSubclass(option)`.
- [ ] Locked future-level cards can inspect without illegal persistence.
- [ ] Reopening centers the selected subclass.

## Phase 6 — visual acceptance

Wizard / dense catalogue:

- [ ] hero remains crisp and dominant;
- [ ] multiple side-card size steps are obvious;
- [ ] rear backs read cleanly through the smoke;
- [ ] smoke never obscures the hero enough to harm readability;
- [ ] carousel feels suspended in the room rather than attached to a surface.

Small catalogue:

- [ ] four-option presentation does not feel empty;
- [ ] side cards remain face-up where expected;
- [ ] scene still feels composed with fewer cards.

Ambient motion:

- [ ] back smoke loop is subtle and seamless enough for normal use;
- [ ] front smoke loop adds depth without repeatedly crossing the hero title/art;
- [ ] candle glow flicker is visible only when noticed, not distracting;
- [ ] reduced-motion mode is effectively static.

Responsive:

- [ ] desktop 16:9;
- [ ] medium viewport;
- [ ] narrow/mobile fallback.

## Phase 7 — validation / delivery

- [ ] Rewrite the focused validator around the floating-library invariants.
- [ ] Reject the old table/rune foreground from returning.
- [ ] Preserve approved-Tarot coverage checks.
- [ ] Preserve explicit-click subclass persistence guard.
- [ ] Run focused Class/subclass validators.
- [ ] Run relevant Forge regressions.
- [ ] Verify exact changed-file scope.
- [ ] Verify exact-head Vercel Preview.
- [ ] Browser-review the preview against the approved ruined-library mockup.
- [ ] Update parent checklist only after browser acceptance.
- [ ] Keep PR #199 unmerged until Paul's explicit approval.

## Definition of done

The selector reads as a **floating Tarot carousel suspended in a dark, smoke-filled ruined gothic library**, using the real DNDNext Tarot deck and the already-working carousel interactions. The presentation has no physical table/surface dependency. Slow independent smoke movement and restrained candle flicker make the room feel alive without distracting from subclass selection. No canonical Forge authority or protected system is changed.
