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

## 2026-09-24 browser-review correction — hinged footer rejected

The latest browser video proved the hinged-footer interpretation is also wrong. It creates a visible trapezoid/flap under the Tarot card, especially at hero, while the reference image shows a rigid upright card whose base simply appears seated into the table/rune path.

This supersedes the 2026-09-23 hinged-footer section.

Correct target:

1. The **actual bottom-center of the full rigid Tarot card** is the orbit anchor.
2. The card artwork is not clipped, duplicated, or folded.
3. There is **no `rotateX` footer strip**.
4. The full card remains upright; whole-card roll stays removed.
5. Whole-card yaw is gentle and only communicates that the card is turning around the ring.
6. One fixed ellipse measured from the approved blue rune band remains the path authority.
7. A shallow **foreground table-seat mask** overlaps only the lowest few pixels of the card. Its job is occlusion/contact: it makes the base look inserted into or immediately behind the glowing rune band.
8. The seat mask is not a pedestal, fold, or shadow pretending to be geometry. It is a thin local table-contact/occlusion lip.
9. A small shadow can remain behind the base, but the front occlusion layer is what sells the card as standing on the table.
10. Front-facing Tarot cards remain fully opaque.

Implementation target for the next runtime patch:

- remove all `base-fold` markup/styles;
- restore `translate(-50%, -100%)` and `transform-origin: 50% 100%`;
- keep the fixed rune ellipse (`39.1 / 16.1 / 55.8`) initially; browser-tune only if the real card bottoms do not land in the band center;
- reduce yaw toward approximately `0.24 × ring angle`, capped near ±34°;
- add one reusable `subclass-card-table-seat-mask.svg` rendered **in front of** the bottom edge of each card;
- keep the existing non-linear physical-size depth falloff.

## 2026-09-24 browser-review correction — table owns the occlusion

The latest browser video at runtime head `82687fba7ffc130dddb1994fa0fd9c40adc50697` shows that the per-card `table-seat` effect is still wrong. It moves with each Tarot card and therefore reads as a glowing underline/pedestal attached to the card rather than part of the physical table.

This supersedes the shadow-only, hinged-footer, and per-card-seat interpretations.

Correct implementation target:

1. The Tarot card remains one intact rigid rectangle.
2. The card's actual bottom-center is the orbit anchor.
3. The card has no attached seat, fold, pedestal, or foreground mask.
4. One fixed ellipse is shared by every card and every interaction mode.
5. The path should run through the **middle of the approved blue rune band**, not along its outer/front lip.
6. The table itself owns the contact illusion:
   - render the approved cathedral/table image normally behind the cards;
   - render the **same exact table image a second time in front of the cards**;
   - mask that foreground copy so only a narrow front-half section of the blue rune annulus is visible.
7. Because the foreground layer is pixel-identical to the background, the rune artwork/glow/perspective cannot float or drift independently.
8. The foreground rune strip overlaps only the lowest few pixels of cards crossing the front half of the table, creating real scene occlusion.
9. Rear-half cards remain in front of the rear rune arc because only the front half of the annulus is foreground.
10. Whole-card roll remains zero. Yaw stays restrained and may be browser-tuned separately from table contact.
11. Front-facing cards remain fully opaque.
12. No Tarot artwork redraw, clipping, duplication, or fold is allowed.

Implementation recommendation:

- remove `class-subclass-carousel-card__table-seat` from every card;
- delete `subclass-card-table-seat-mask.svg`;
- keep the approved cathedral/table image as both background and foreground source;
- add a stage-level foreground element/pseudo-element using the same background-position/size as the scene;
- mask that foreground copy with a new **mask-only** SVG describing the front half of the blue rune ellipse;
- shift the card-bottom ellipse slightly rearward from the current outer-lip position so its front point lies near the middle of the blue rune band;
- keep non-linear physical card sizing and the current click/drag/selection authority unchanged.

## Phase 1 — orbit path alignment

- [ ] Anchor the **actual card bottom-center** to the fixed ellipse through the middle of the approved blue rune band.
- [ ] Keep `horizontalRadius 39.1` and `verticalCenter 55.8`, but shift the front/back depth inward from the current outer-lip path; browser target begins around `verticalRadius 13.8`.
- [x] Preserve one continuous ellipse for all catalogue sizes.
- [x] Keep the same ring for arrow, keyboard, drag, flick, and click-to-hero motion.
- [ ] Verify Wizard/high-count and a four-option class use the exact same fixed table ellipse.

### Done when

The bottom center of every visible card appears to travel inside the table's blue rune band without jumping between paths.

## Phase 2 — upright posture

- [x] Remove the current ±10.5° whole-card roll completely.
- [x] Keep cards visually upright in screen space; whole-card `rotateZ`/orbit-roll was removed.
- [ ] Reduce whole-card yaw further so near-front cards stay nearly upright while still turning around the ring.
- [ ] Browser-review a target around `0.24 × ring angle`, capped near ±34°.
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

- [ ] Remove the rejected per-card seat entirely. The **table**, not the card, owns foreground occlusion.
- [ ] Add one stage-level `class-subclass-carousel-modal__rune-foreground` layer (or equivalent pseudo-element), never one layer per card.
- [x] The actual card bottom remains the orbit anchor.
- [x] Keep `pointer-events: none`.
- [x] Keep the entire Tarot card intact and uncut.
- [ ] Use the exact approved table image as the foreground source, masked to the front-half rune annulus only.
- [ ] Hero artwork remains intact/full-opacity; only the actual table foreground may occlude its lowest few pixels.

### Done when

The lower edge reads as planted/standing on the table without an obvious pasted-on effect or a visible hard fold line.

## Phase 4 — table contact shadow / depth

- [ ] Keep only a small supporting tabletop shadow behind the card base.
- [ ] The stage-level foreground rune strip must pass in front of the lowest card edge; no card-attached foreground effect may remain.
- [ ] Keep only a restrained card-relative shadow behind the base; the rune foreground remains fixed to the table.
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

- [ ] validator requires a stage-level rune foreground and rejects all per-card seat/fold/contact layers;
- [ ] validator requires intact full-card art plus the table-owned foreground rune mask;
- [x] whole-card orbit roll remains removed;
- [ ] validator locks the fixed rune-band ellipse and ensures catalogue density cannot change table geometry;
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
- [ ] table-owned rune occlusion remains believable and does not move independently with cards;
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

Browser review rejected the shadow-only contact implementation. The per-card seat implementation was also rejected by browser review. The next patch must remove every card-attached contact treatment and use a table-owned foreground copy of the real rune band.

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
