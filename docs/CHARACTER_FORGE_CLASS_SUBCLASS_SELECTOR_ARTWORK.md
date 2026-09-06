# Character Forge Class Subclass Selector Artwork

Status date: 2026-09-06

This document records the browser-approved subclass-selector presentation layered onto the existing Class Overview on PR #177 (`agent/realistic-dice-core`). It is presentation-only. Canonical subclass availability, level gates, persistence, progression injection, and feature rules remain owned by `useNpcForgeClassGuideModel` / `NpcForgeClassChoiceContext` and Supabase-backed class catalogues.

## Approved selector layout

The approved target is the two-column Wizard mockup reviewed on 2026-09-06, with enough density to stay compact without reducing the selector to miniature strips:

- the selector sits directly above Class Progression;
- it uses exactly two columns on desktop and one column on narrow layouts;
- the normal desktop selector occupies only the left/middle portion of Class Overview (`width:min(66%,760px)`) so the cinematic Class subject remains visible on the right;
- the expanded selector shows roughly four readable rows at once and becomes internally scrollable for larger catalogues;
- current desktop scroll cap is `min(28vh, 205px)`;
- each row is approximately 48px tall and contains an 82×40 landscape thumbnail, subclass name, one-line summary, source badge, and compact selected/level state;
- every canonical subclass remains available even when the reference mockup visually depicts fewer rows;
- selecting an eligible subclass still uses the existing Forge authority, updates progression, and collapses the selector;
- collapsed state keeps only the selected subclass artwork/summary plus compact Change/Clear controls at the same restrained left-side width;
- clicking a subclass row sends its details to the movable Feature card; hover/focus alone does not replace Feature-card content;
- search, source-filter toolbars, large inline detail cards, and the old multi-column pill wall are not part of the approved Overview layout.

At widths below 900px the selector returns to full width. The cinematic artwork remains independently positioned and must not resize or recrop when the selector expands or collapses.

## Artwork authority

Subclass artwork is not stored in Supabase. A schema inspection on 2026-09-06 confirmed the canonical `class_feature_catalog` contains subclass names, source, levels, descriptions, entries, and raw payloads but no image/artwork field. Artwork therefore remains presentation-side and must not become a second subclass rules authority.

`utils/classes/subclassArtwork.js` is the presentation resolver. It receives the selected Class key plus canonical subclass option and returns only an image path. If no dedicated subclass artwork is installed, it falls back to the existing Class menu artwork through `classMenuArtworkFor(...)`.

### Wizard first artwork set

The first approved thumbnail set was derived from the exact Wizard mockup accepted by browser review and installed as eight 240×112 WebPs:

- `/media/subclasses/wizard/wizard-abjuration.webp`
- `/media/subclasses/wizard/wizard-conjuration.webp`
- `/media/subclasses/wizard/wizard-divination.webp`
- `/media/subclasses/wizard/wizard-enchantment.webp`
- `/media/subclasses/wizard/wizard-evocation.webp`
- `/media/subclasses/wizard/wizard-illusion.webp`
- `/media/subclasses/wizard/wizard-necromancy.webp`
- `/media/subclasses/wizard/wizard-transmutation.webp`

Closely related Wizard traditions may share the nearest approved visual family until dedicated artwork is explicitly reviewed. Examples: Evoker uses Evocation, Abjurer uses Abjuration, Illusionist uses Illusion, Diviner/Chronurgy/Scribes use Divination, Bladesinger/Bladesinging use the Abjuration-family thumbnail, War uses the Evocation-family thumbnail, and Graviturgy uses the Transmutation-family thumbnail. This mapping is visual only and does not merge, rename, or alter subclass rules/content.

The WebPs were transferred through the standing DNDNext binary route: local approved assets → checksum ZIP → Dropbox `/DNDNext-Transfer` → guarded one-shot GitHub Actions materializer → scratch branch. Do not regress to giant inline-base64 transfers.

## Progression density target

The approved progression table structure remains unchanged: Level, PB, Features, Cantrips, Known/Prepared, then individual 1st–9th spell-slot columns for spellcasting Classes. The current balance target is compact but readable:

- table padding remains 6px;
- normal row minimum height is 42px;
- header minimum height is 34px;
- row text is restored slightly from the over-compressed pass while keeping the feature-pill spacing tight;
- feature-pill padding is `.2rem .42rem`;
- spell-table minimum width remains 1060px while preserving all columns;
- narrow layouts continue to scroll horizontally rather than dropping progression data.

Base Class features remain purple pills; selected-subclass features remain cyan pills.

## Cinematic Class art relationship

The selector and art are intentionally decoupled:

- public cinematic art remains fixed to the top-right and content-height independent;
- expanding/collapsing the subclass selector must not move, resize, or recrop it;
- the stable art layer is currently `height: clamp(780px, 82vh, 960px)` with `object-position: 100% 0%`;
- the right-side art blend is lighter than the previous pass so more of the approved image remains visible;
- the Class title and introductory copy receive slightly stronger hierarchy while staying within the existing Class Overview structure.

## Validation requirements

Before this selector/artwork pass is accepted or extended:

1. every canonical `model.options` subclass must remain present;
2. eligibility and persistence must still call the existing model/context authority;
3. future-level subclasses may be inspected but must not persist early;
4. only the selected subclass contributes cyan progression features;
5. the Feature card remains click/selection-driven, not hover-driven;
6. the expanded selector remains a readable two-column internal scroll region rather than a full-width miniature list;
7. the selected collapsed row retains its thumbnail and Change control;
8. missing subclass images fall back to Class menu artwork rather than breaking the selector;
9. all nine spell-slot columns remain visible/scrollable;
10. expanding/collapsing the selector does not alter cinematic art framing;
11. `Validate Class browser polish`, subclass-selector validation, Source Magic Routing, and the normal Forge validation suite must pass;
12. Vercel exact-head build/runtime checks and `/profile` must pass;
13. no world-map, town/city-map, Supabase data/schema, crafting, inventory, travel, or unrelated runtime files may be changed.
