# Character Forge Subclass Tarot Flexible Ring Status

Updated: 2026-09-21

## Current active work

The subclass Tarot selector remains active and **unmerged** on:

- PR #194 — `Refine subclass Tarot carousel interaction and clarity`;
- branch: `agent/subclass-carousel-drag-crisp-20260918`;
- exact reviewed head: `f21a81435946b1ae8ec6112e5376062cfc2b62f4`;
- exact-head Vercel preview: `dndnext-86xs3s1d4-pauls-projects-2016aa54.vercel.app`;
- preview state at handoff: **READY**.

The runtime baseline that PR #194 must integrate against includes merged PR #195 at:

- `320671a22b83432177dcc67e9efd035f3c3ccc5d`.

Documentation-only merges may place current `main` ahead of that SHA. Always re-fetch PR #194, current `main`, mergeability, and the exact preview before writing or merging.

## Visual authority

Paul's supplied cathedral/runic-table screenshot is the current visual target.

Older prose that specifies a fixed 3-card, 5-card, 7-card, or 9-card carousel is historical experimentation and must **not** override the current architecture.

Keep the approved Tarot card artwork. The surrounding cathedral/table/stage artwork may be changed if that produces a better implementation of the target.

## Locked flexible-ring architecture

The current controlling rule is:

> **One physical table ring. N subclasses = N equally spaced cards. One exact front hero position. All other presentation derives from where each card currently sits on the ring.**

There is no fixed visible-card cap.

For a catalogue with `N` subclasses:

- angular spacing = `360° / N`;
- every subclass remains on the same carousel ring;
- every subclass is rendered around that ring;
- rear cards become smaller/dimmer and show the ornate card back;
- only the exact front-center card receives hero treatment.

### Examples

Monster Hunter has four current subclass Tarot options. At rest the natural ring is:

- hero/front: 0°;
- one side: 90°;
- opposite/rear: 180°;
- other side: 270°.

Wizard's larger catalogue uses the same ring with much smaller angular spacing; it does **not** switch to a different carousel system.

## Adaptive geometry

The ring expands mildly as catalogue density increases rather than hiding cards.

Current source model:

- horizontal radius starts near 31% and eases to about 37.5%;
- vertical radius starts near 22% and eases to about 24.5%;
- vertical center remains about 52.5%;
- card bottom-center is the physical table-contact anchor.

This preserves one rotational ring while giving dense catalogues more perimeter.

## Adaptive card sizing

Tarot source art remains declared at native `840 × 1440`.

Current maximum desktop physical widths ease down with catalogue size:

- 1–4 subclasses: ~300px;
- 5–6: ~292px;
- 7–8: ~282px;
- 9–10: ~270px;
- 11–12: ~258px;
- 13+: ~248px.

The exact hero gets only a restrained ~5.5% physical-width increase.

Do not return to heavy transform upscaling as a sharpness workaround.

## Front/rear behavior

Front/back presentation is angle-based, not slot-count-based.

Current branch behavior:

- cards within the front angle window show their Tarot face;
- cards around the rear show the live ornate card back;
- scale and opacity are continuous functions of ring depth;
- rear cards remain visible enough to communicate circular motion;
- yaw follows the table curve continuously;
- positive Z translation is removed from the orbit to reduce raster softness.

Only the exact front card is the hero. All other cards remain at their natural position on the ring.

## Interaction

Existing interaction authority is preserved:

- drag/flick rotates the ring;
- Left/Right advances the carousel;
- clicking a face-up card rotates that exact card to the hero position;
- an explicit click owns the dossier/inspection target;
- eligible explicit clicks use the existing subclass persistence authority;
- rear card backs are non-interactive;
- carousel movement alone must never persist a subclass.

The dossier should not silently follow whichever card merely happens to be centered by browsing motion.

## Current source

Primary files:

- `components/ClassSubclassSection.js`;
- `styles/character-forge-subclass-tarot-layout.css`;
- `scripts/validate_class_subclass_browser.mjs`.

The CSS was consolidated so late experimental override blocks do not continue fighting one another.

## Acceptance work still open

Before PR #194 is merged, browser-review at least:

1. a small catalogue, especially Monster Hunter's 4-card case;
2. Wizard's large catalogue;
3. drag/flick transitions through front → side → rear → front;
4. hero-only emphasis;
5. table-foot anchoring;
6. front/rear card-face transition;
7. Tarot sharpness at normal browser zoom;
8. dossier ownership after click versus simple carousel rotation.

If the stage still cannot visually match the target using the existing cathedral/table assets, create or replace those **stage assets only**. Preserve the Tarot deck.

## Boundaries

This is Character Forge presentation work.

Do not touch:

- world-map behavior;
- town/city-map behavior;
- tactical movement/combat authority;
- crafting/inventory/merchant mechanics;
- Supabase persistence schema merely to implement carousel presentation.

No Supabase migration is required for the flexible ring.
