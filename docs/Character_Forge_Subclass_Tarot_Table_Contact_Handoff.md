# Character Forge Subclass Tarot — Table Contact / Base Mask Handoff

Updated: 2026-09-23

Status: **active implementation handoff / progress tracker**

Branch: `agent/subclass-tarot-scene-rebuild-20260922`  
Pull request: **#199 — Rebuild subclass Tarot selector as cathedral table ring**

## User-approved target

Continue the cathedral/table Tarot selector, but correct the remaining card-to-table illusion.

The cards should:

- remain mostly upright rather than leaning/rolling with the ellipse;
- travel around one continuous physical ring inside the **middle of the blue rune band** on the tabletop;
- remain visually connected to that rune band throughout arrow, drag, flick, and snap motion;
- use yaw/perspective/physical size to show circular distance;
- avoid severe whole-card roll;
- gain a subtle shared bottom contact treatment so each card appears to stand in or immediately above the table surface;
- preserve the existing approved Tarot fronts without redrawing them;
- keep every face-up/front card fully opaque;
- preserve explicit click-owned subclass selection and all existing Forge authority.

The approved lower-reflection cathedral/table artwork remains the active stage background.

## Protected boundaries

This work is presentation-only.

Do **not** change:

- canonical subclass catalogue/eligibility;
- subclass persistence/progression;
- Supabase schema/data/functions;
- world map/travel/routes/weather/camps/world clock;
- town/city-map behavior;
- tactical encounter authority;
- crafting/inventory/merchant/economy systems;
- existing subclass Tarot front artwork.

## Files intentionally in scope

Runtime:

- `components/ClassSubclassSection.js`
- `styles/character-forge-subclass-tarot-layout.css`

New presentation asset:

- `public/media/forge/subclass-carousel/subclass-card-base-contact-mask.svg`

Validation:

- `scripts/validate_class_subclass_browser.mjs`

Documentation:

- this handoff;
- the parent `Character_Forge_Subclass_Tarot_Reference_Rebuild_Checklist.md` only after the implementation checkpoint is validated.

## Phase 1 — orbit path alignment

- [x] Move the card-bottom anchor ellipse rearward/upward: vertical radius is now `10.2 + density*0.35`, center `56.8`, keeping the path inside the blue rune band rather than at the front lip.
- [x] Tune `verticalCenter` and `verticalRadius` as one pair; no separate front/rear path was introduced.
- [x] Preserve one continuous ellipse for all catalogue sizes.
- [x] Keep the same ring for arrow, keyboard, drag, flick, and click-to-hero motion.
- [x] Source/validator authority uses the same geometry for all catalogue sizes; browser acceptance for Wizard/four-option classes remains pending.

### Done when

The bottom center of every visible card appears to travel inside the table's blue rune band without jumping between paths.

## Phase 2 — upright posture

- [x] Remove the current ±10.5° whole-card roll completely.
- [x] Keep cards visually upright in screen space; whole-card `rotateZ`/orbit-roll was removed.
- [x] Retain moderate tangent yaw: `0.58 × ring angle`, capped at ±68°.
- [ ] Browser-review the reduced ±68° yaw; reduce further only if the live preview still compresses side cards too aggressively.
- [x] Keep hero yaw exactly 0°.

### Done when

Side cards read as upright cards turning around a circular table, not cards leaning sideways.

## Phase 3 — shared bottom contact mask

Create one reusable SVG contact/slot treatment because the lower card-frame/contact behavior is common across the Tarot deck.

The asset should be subtle and contain:

- a soft elliptical/table contact shadow;
- a narrow dark slot/occlusion band that hides only a few pixels of the card's bottom edge;
- restrained antique-gold edge detail;
- restrained cyan reflection/glow consistent with the table rune band;
- transparent surroundings.

Implementation:

- [x] Create `subclass-card-base-contact-mask.svg` as a transparent shared slot/contact treatment.
- [x] Add one `class-subclass-carousel-card__base-contact` layer per card.
- [x] Position the layer relative to the card bottom so it travels with the same orbit transform.
- [x] Keep `pointer-events: none`.
- [x] Keep it visually subordinate with a narrow dark slot, restrained gold edge, cyan reflection, and soft table shadow.
- [x] Use the same card-level contact layer for front-face art and rear card-back positions.
- [x] Keep the hero contact layer near-full opacity but restrained; no artwork mutation.

### Done when

The lower edge reads as planted/standing on the table without an obvious pasted-on effect or a visible hard fold line.

## Phase 4 — table contact shadow / depth

- [x] Replace the broad floating shadow with a tighter base-anchored contact shadow.
- [x] Keep the shadow at the card base/tabletop contact point.
- [x] Let the contact shadow scale with the card because it is card-relative rather than stage-relative.
- [x] Avoid smoke/haze.
- [x] Keep face-up/front cards at opacity 1.

## Phase 5 — physical depth progression

- [x] Preserve physical-width sizing rather than transform scale.
- [x] Preserve the existing non-linear physical-width depth falloff for multiple intermediate sizes.
- [ ] Ensure small/rear cards still remain large enough to communicate that they are cards.
- [x] Do not introduce a fixed visible-card cap or separate Wizard-only geometry.
- [x] Keep rear cards on the same continuous ring and use the shared Tarot back where appropriate.

## Phase 6 — interaction regression

- [ ] Left/Right button = exactly one card step.
- [ ] Keyboard Left/Right mirrors buttons.
- [ ] Escape closes modal.
- [ ] Drag rotates continuously.
- [ ] Flick snaps to one legal ring position.
- [ ] Click-vs-drag threshold still prevents accidental selection.
- [ ] Clicking a visible face-up card rotates that exact card to hero.
- [ ] Only explicit eligible card click calls `model.selectSubclass(option)`.
- [ ] Locked future-level cards can inspect without illegal persistence.
- [ ] Reopening centers the selected subclass.

## Phase 7 — validators

Update `validate_class_subclass_browser.mjs` to require:

- [x] shared base-contact asset exists;
- [x] base-contact layer exists in the component;
- [x] whole-card orbit roll has been removed;
- [x] one continuous ellipse remains authoritative;
- [x] front cards remain fully opaque;
- [x] physical depth sizing remains continuous/non-linear;
- [x] floating CSS blue ellipse does not return;
- [x] exactly one explicit `model.selectSubclass(option)` path remains;
- [x] cathedral/card-back asset size guards remain.

## Phase 8 — browser acceptance

Test deliberately:

### Wizard / dense catalogue

- [ ] bases remain inside blue rune band;
- [ ] near-front cards stay upright;
- [ ] several physical size steps are obvious;
- [ ] side cards turn through yaw without severe lean;
- [ ] base mask/contact treatment remains believable;
- [ ] rear card backs stay on the same path.

### Small catalogue

- [ ] four-option ring does not look empty or over-rotated;
- [ ] side cards remain face-up as expected;
- [ ] hero remains centered and planted.

### Motion

- [ ] slow drag around the ring;
- [ ] fast flick and snap;
- [ ] left/right arrows;
- [ ] click side card → hero;
- [ ] watch the lower contact point continuously during movement.

## Phase 9 — delivery

- [x] Run focused subclass validator — PASS at runtime head `4cff918cde08c20182bec10b7fa993424ff6e51c`.
- [x] Run triggered Class-browser CI — PASS at runtime head `4cff918cde08c20182bec10b7fa993424ff6e51c`.
- [x] Verify exact changed-file scope: component, selector CSS, focused validator, shared SVG asset, and this handoff only.
- [x] Verify exact-head Vercel Preview READY for runtime head `4cff918cde08c20182bec10b7fa993424ff6e51c`.
- [ ] Update parent rebuild checklist with accepted checkpoint.
- [ ] Keep PR #199 unmerged until Paul's explicit approval.

## Current implementation checkpoint

Runtime head: `4cff918cde08c20182bec10b7fa993424ff6e51c`

Validated:

- GitHub `Validate Class browser polish`: **PASS**;
- focused subclass selector validator: **PASS**;
- Vercel Preview: **READY**;
- PR #199: **open / mergeable / unmerged**.

Current remaining work is browser acceptance/tuning only: Wizard, a four-option class, slow drag, flick/snap, side-card click → hero, and visual confirmation that the contact mask/base path now stay centered in the blue rune band.

## Definition of done

The cards read as **upright Tarot cards standing on the blue rune band of the physical table**, with their bases continuously attached to that path while the carousel moves. Circular depth comes from yaw, perspective, z-order, and multiple physical card sizes—not severe sideways roll. The shared base-contact mask subtly sells the standing/slot illusion without modifying any Tarot card front.
