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

## 2026-09-23 browser-review correction — previous mask interpretation rejected

The browser video at runtime head `4cff918cde08c20182bec10b7fa993424ff6e51c` proved that the previous implementation did **not** satisfy the visual target even though CI passed.

What was wrong:

- the previous `subclass-card-base-contact-mask.svg` was only a shadow/slot underneath a rigid card;
- the card itself never folded at the bottom;
- the last geometry pass flattened the orbit to a shallow ellipse, so card hinges no longer followed the actual front/back ellipse of the blue rune band;
- ±68° whole-card yaw remained too aggressive for the near-front cards.

Correct interpretation:

1. The **hinge line**, not the card's absolute bottom, is the orbit anchor.
2. The main ~92–93% of the Tarot card remains upright.
3. The bottom ~7–8% of the **same Tarot image** is rendered as a second clipped strip.
4. Only that strip folds around the horizontal hinge using `rotateX(...)`, visually lying onto the tabletop.
5. The upright copy is clipped above the hinge so the footer is not duplicated.
6. The hinge travels on one fixed ellipse measured from the approved blue rune ring artwork (approximately 39.1% horizontal radius, 16.1% vertical radius, center Y approximately 55.8%).
7. Whole-card yaw is restrained; the fold, physical size, fixed rune ellipse, and z-order carry most of the depth illusion.
8. A small contact shadow may remain under the folded strip, but it is supporting detail—not the fold itself.

This correction supersedes the previous interpretation of Phase 1–4 below.

## Phase 1 — orbit path alignment

- [ ] Replace the rejected shallow ellipse with the fixed ellipse measured from the approved blue rune band; anchor the **fold hinge** to that path.
- [ ] Lock the table path to approximately `horizontalRadius 39.1`, `verticalRadius 16.1`, `verticalCenter 55.8`; do not vary table geometry by catalogue density.
- [x] Preserve one continuous ellipse for all catalogue sizes.
- [x] Keep the same ring for arrow, keyboard, drag, flick, and click-to-hero motion.
- [ ] Verify Wizard/high-count and a four-option class use the exact same fixed table ellipse.

### Done when

The bottom center of every visible card appears to travel inside the table's blue rune band without jumping between paths.

## Phase 2 — upright posture

- [x] Remove the current ±10.5° whole-card roll completely.
- [x] Keep cards visually upright in screen space; whole-card `rotateZ`/orbit-roll was removed.
- [ ] Reduce whole-card yaw substantially; near-front cards should turn gently around the ring rather than becoming steeply edge-on.
- [ ] Browser-review a target around `0.34 × ring angle`, capped near ±48°.
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

- [ ] Replace the rejected shadow-only contact treatment with a real hinged footer fold built from the same Tarot art.
- [ ] Add a dedicated `class-subclass-carousel-card__base-fold` layer per card.
- [ ] Make the fold hinge (about 92.5% down the card) the orbit anchor; the fold extends from that hinge onto the tabletop.
- [x] Keep `pointer-events: none`.
- [ ] Clip the upright card above the hinge and render the bottom ~7.5% of the same image in the fold layer; no duplicated vertical footer.
- [ ] Front fold uses the current Tarot front's bottom slice; rear fold uses the shared Tarot back bottom slice.
- [ ] Keep the hero fold crisp/full-opacity; do not mutate source artwork.

### Done when

The lower edge reads as planted/standing on the table without an obvious pasted-on effect or a visible hard fold line.

## Phase 4 — table contact shadow / depth

- [ ] Keep only a small supporting tabletop shadow underneath the actual folded footer.
- [ ] Shadow/contact effect must sit at the hinge/fold footprint, not substitute for the fold.
- [ ] Let the small contact shadow scale with the card/fold.
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

- [ ] validator requires the hinged base-fold implementation (the old shadow-only asset is no longer sufficient);
- [ ] validator requires the base-fold layer and same-art footer slice;
- [x] whole-card orbit roll remains removed;
- [ ] validator locks the fixed rune-band ellipse measured from the approved table art;
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

Browser review rejected the shadow-only contact implementation. The corrected hinged-footer runtime patch has now landed; acceptance is again browser-driven, with the hinge position/fold angle/yaw intentionally left tunable.

## 2026-09-23 corrected hinged-footer implementation checkpoint

Runtime implementation: `e85d41808fce97ac2fc788c39fffc28c63efa327`  
Cleanup removing the rejected shadow-only SVG: `40384505175cb4814fdc763def9933c4d555ffeb`

Implemented:

- fixed table path: `horizontalRadius 39.1`, `verticalRadius 16.1`, `verticalCenter 55.8`;
- table geometry no longer changes with catalogue density;
- whole-card roll remains removed;
- whole-card yaw reduced to `0.34 × ring angle`, capped at ±48°;
- orbit anchor moved from the absolute card bottom to the footer hinge at 92.5% card height;
- upright card surface is clipped above the lower 7.5%;
- the lower 7.5% of the **same current Tarot front** is rendered again as a separate fold strip;
- rear cards use the same treatment with the shared Tarot-back footer slice;
- only the footer strip uses `rotateX(70deg)`, creating the tabletop fold while the card body stays upright;
- contact shadow is now small/supporting and sits under the hinge/fold footprint;
- rejected `subclass-card-base-contact-mask.svg` was removed from the branch.

Validation:

- focused subclass selector validator: **PASS**;
- full triggered `Validate Class browser polish`: **PASS**;
- PR #199 remains open / mergeable / unmerged.

Still pending:

- browser review of the actual fold illusion;
- final rune-band ellipse tuning if the hinge does not visually sit in the band center;
- Wizard and four-option visual acceptance;
- drag/flick/contact continuity acceptance.

## Definition of done

The cards read as **upright Tarot cards standing on the blue rune band of the physical table**, with their bases continuously attached to that path while the carousel moves. Circular depth comes from yaw, perspective, z-order, and multiple physical card sizes—not severe sideways roll. The shared base-contact mask subtly sells the standing/slot illusion without modifying any Tarot card front.
