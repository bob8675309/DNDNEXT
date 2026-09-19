# Character Forge Subclass Artwork Status

Status date: 2026-09-18

This is the current focused handoff for the completed Character Forge subclass Tarot deck and its selector presentation.

## Completion authority

- Runtime-visible subclass choices: **149**
- Runtime-visible choices with dedicated approved Tarot cards: **149**
- Runtime-visible generic/class fallback cards: **0**
- Normalized installed artwork concepts in the repository ledger: **152**
- Current missing-card queue: **0**

The deck was merged to `main` in PR #193 at merge commit:

`1e5c0795010a4714250d309ecefc68ee67977e2d`

The difference between 149 visible choices and 152 normalized installed concepts remains intentional. Historical compatibility/reprint identities and explicit aliases remain represented while runtime compatibility suppresses duplicate/reprint identities such as historical Wizard Abjuration, Divination, Evocation, and Illusion.

Canonical completion checklist:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`

## Active selector refinement

PR #194 (`agent/subclass-carousel-drag-crisp-20260918`) is the current unmerged presentation refinement.

It does **not** add or replace Tarot cards. It improves how the completed deck is displayed and manipulated:

- continuous fractional orbital positioning;
- pointer grab/drag/flick with snap;
- one-card arrow/keyboard navigation preserved;
- browsing motion separated from actual subclass persistence;
- eligible subclasses selected only by explicit card click;
- click suppression after a drag gesture;
- slightly wider/zoomed-out table framing;
- more rear-card/table visibility;
- sharper front-card presentation by removing image-level filter compositing and isolating depth treatment in a dedicated card surface.

Current implementation checkpoint before the final documentation/preview commit:

`5c4e3d3af1b3afe6d065de2fbb9b451fdd152c2d`

Focused Class browser CI is green on that exact code head.

## Current card standard

The Tarot card standard is unchanged:

- 7:12 aspect ratio;
- 840x1440 WebP final export;
- full-bleed illustration;
- no opaque footer/title band;
- reusable antique-gold frame/title/emblem geometry;
- cinematic fantasy realism;
- full-resolution anatomy/prop/species QA.

Detailed authority:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`

## Resolver authority

Artwork resolution remains centralized through:

`ClassSubclassSection.js -> subclassArtworkFor(classKey, option) -> utils/classes/subclassArtwork.js`

PR #194 does not change the 149/149 mappings. Unknown/future subclass identities retain safe fallback through `classMenuArtworkFor(...)`.

## Selection authority

The selector remains presentation-only.

- `model.selectSubclass(option)` remains the actual persistence authority.
- The new drag orbit never calls it.
- Front/browsed position is informational only.
- Explicit eligible card click performs selection.
- Level gates remain unchanged.
- No Supabase write/migration is required.

## Protected boundaries

Do not use subclass artwork/selector work as authority to change:

- Supabase schema/data;
- subclass gameplay rules/progression;
- world-map behavior;
- town/city-map behavior;
- travel/routes/weather/camps/clock;
- crafting/inventory/merchants/economy;
- encounter/tactical authority;
- unrelated Character Sheet runtime behavior.
