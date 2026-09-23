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

- [ ] Move the card-bottom anchor ellipse slightly rearward/upward so the hero and side-card bases sit near the middle of the blue rune band rather than on the front edge.
- [ ] Tune `verticalCenter` and `verticalRadius` as one pair; do not independently fake front/rear paths.
- [ ] Preserve one continuous ellipse for all catalogue sizes.
- [ ] Keep the same ring for arrow, keyboard, drag, flick, and click-to-hero motion.
- [ ] Verify Wizard/high-count and a four-option class use the same geometry authority.

### Done when

The bottom center of every visible card appears to travel inside the table's blue rune band without jumping between paths.

## Phase 2 — upright posture

- [ ] Remove the current ±10.5° whole-card roll.
- [ ] Keep cards visually upright in screen space.
- [ ] Retain moderate tangent yaw so side cards still communicate circular travel.
- [ ] Reduce yaw if browser review shows excessive edge-on compression.
- [ ] Keep hero yaw exactly 0°.

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

- [ ] Create `subclass-card-base-contact-mask.svg`.
- [ ] Add one `class-subclass-carousel-card__base-contact` layer per card.
- [ ] Position the layer relative to the card bottom so it travels with the same orbit transform.
- [ ] Keep `pointer-events: none`.
- [ ] Keep it visually subordinate to the Tarot artwork.
- [ ] Ensure it works with both front-face art and shared rear card back.
- [ ] Keep the hero version crisp and restrained.

### Done when

The lower edge reads as planted/standing on the table without an obvious pasted-on effect or a visible hard fold line.

## Phase 4 — table contact shadow / depth

- [ ] Replace the current generic floating card shadow with a tighter contact shadow anchored at the card base.
- [ ] Keep the shadow on the tabletop, not halfway up the card.
- [ ] Let shadow width/depth follow physical card size naturally.
- [ ] Avoid smoke/haze.
- [ ] Keep face-up/front cards at opacity 1.

## Phase 5 — physical depth progression

- [ ] Preserve physical-width sizing rather than transform scale.
- [ ] Maintain several obvious intermediate card sizes around the ring.
- [ ] Ensure small/rear cards still remain large enough to communicate that they are cards.
- [ ] Do not introduce a fixed visible-card cap or separate Wizard-only geometry.
- [ ] Keep rear cards on the same continuous ring and use the shared Tarot back where appropriate.

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

- [ ] shared base-contact asset exists;
- [ ] base-contact layer exists in the component;
- [ ] whole-card orbit roll has been removed;
- [ ] one continuous ellipse remains authoritative;
- [ ] front cards remain fully opaque;
- [ ] physical depth sizing remains continuous/non-linear;
- [ ] floating CSS blue ellipse does not return;
- [ ] exactly one explicit `model.selectSubclass(option)` path remains;
- [ ] cathedral/card-back asset size guards remain.

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

- [ ] Run focused subclass validator.
- [ ] Run triggered Class-browser CI.
- [ ] Verify exact changed-file scope.
- [ ] Verify exact-head Vercel Preview READY.
- [ ] Update parent rebuild checklist with accepted checkpoint.
- [ ] Keep PR #199 unmerged until Paul's explicit approval.

## Definition of done

The cards read as **upright Tarot cards standing on the blue rune band of the physical table**, with their bases continuously attached to that path while the carousel moves. Circular depth comes from yaw, perspective, z-order, and multiple physical card sizes—not severe sideways roll. The shared base-contact mask subtly sells the standing/slot illusion without modifying any Tarot card front.
