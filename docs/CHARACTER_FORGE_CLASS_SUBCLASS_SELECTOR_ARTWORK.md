# Character Forge Class Subclass Selector Artwork

Status date: 2026-09-07

This document records the browser-approved subclass-selector presentation layered onto the existing Class Overview on PR #177 (`agent/realistic-dice-core`). It is presentation-only. Canonical subclass availability, level gates, persistence, progression injection, and feature rules remain owned by `useNpcForgeClassGuideModel` / `NpcForgeClassChoiceContext` and Supabase-backed class catalogues.

## Approved selector layout

The approved target is the final compact two-column Wizard treatment reviewed on 2026-09-06:

- the selector sits directly above Class Progression;
- it uses exactly two columns on desktop and one column on narrow layouts;
- the normal desktop selector occupies about the yellow-box proportion from browser review: `width:min(35%,430px)`;
- at widths below 1100px it uses `width:min(42%,430px)` and below 900px it returns to full width;
- the expanded selector remains internally scrollable for larger catalogues with a `166px` desktop viewport;
- each visible choice button contains only the subclass artwork and subclass name; desktop cards are 52px tall with 76×40 artwork, so exactly six choices (2 columns × 3 rows) are visible before scrolling;
- source badges, inline descriptions, level badges, status/check circles, visible helper copy, and footer notes are intentionally omitted from the selector; eligibility guidance remains available to assistive technology;
- selected state is communicated by the existing border/background highlight rather than an extra visible status control;
- every canonical subclass remains present even when the reference mockup visually depicts fewer rows;
- selecting an eligible subclass still uses the existing Forge authority, updates progression, and collapses the selector;
- collapsed state retains the selected subclass artwork/name with compact Change/Clear controls;
- clicking a subclass still sends its details to the movable Feature card; hover/focus alone does not replace Feature-card content;
- search, source-filter toolbars, large inline detail cards, and the old multi-column pill wall are not part of the approved Overview layout.

The cinematic artwork remains independently positioned and must not resize or recrop when the selector expands or collapses.

## Artwork authority

Subclass artwork is not stored in Supabase. A schema inspection on 2026-09-06 confirmed the canonical `class_feature_catalog` contains subclass names, source, levels, descriptions, entries, and raw payloads but no image/artwork field. Artwork therefore remains presentation-side and must not become a second subclass rules authority.

`utils/classes/subclassArtwork.js` is the presentation resolver. It receives the selected Class key plus canonical subclass option and returns only an image path. If no dedicated subclass artwork is installed, it falls back to the existing Class menu artwork through `classMenuArtworkFor(...)`.

### Wizard first artwork set

Wizard now uses one distinct 240×112 presentation asset for every canonical subclass exposed by the current catalogue: Abjuration, Abjurer, Bladesinger, Bladesinging, Chronurgy, Conjuration, Divination, Diviner, Enchantment, Evocation, Evoker, Graviturgy, Illusion, Illusionist, Necromancy, Scribes, Transmutation, and War. Files follow `/media/subclasses/wizard/wizard-<normalized-subclass>.webp`.

These images remain presentation-only. Similar traditions may share visual motifs, but they must not resolve to the same file. The resolver maps each current canonical normalized subclass name to its own asset and falls back to Class menu artwork only for genuinely unmapped or missing future subclasses.

The WebPs were transferred through the standing DNDNext binary route: local approved assets → checksum ZIP → Dropbox `/DNDNext-Transfer` → guarded one-shot GitHub Actions materializer → scratch branch. The materializer verifies the ZIP checksum, the clean Wizard hero dimensions (1600×900), all 18 Wizard subclass dimensions (240×112), and binary uniqueness before committing. Do not regress to giant inline-base64 transfers.

## Progression density target

The approved progression table structure remains unchanged: Level, PB, Features, Cantrips, Known/Prepared, then individual 1st–9th spell-slot columns for spellcasting Classes. The current browser target remains roughly 20% shorter vertically than the preceding balance pass while preserving the complete table:

- table-card height cap is 435px and the desktop card itself is constrained to `width:min(74%,860px)` so it ends before the right-side character art;
- normal row minimum height is 34px;
- header minimum height is 28px;
- row text is `.57rem`;
- feature-pill padding is `.16rem .34rem`;
- desktop spell-table uses the available card width with no forced desktop minimum; its columns are rebalanced so Level, PB, Features, Cantrips, Known/Prepared, and 1st–9th remain aligned and the 9th-level column is visible without horizontal clipping at the approved desktop layout; narrow layouts retain the wider scrolling treatment;
- narrow layouts continue to scroll horizontally rather than dropping progression data.

Base Class features remain purple pills; selected-subclass features remain cyan pills.

## Cinematic Class art relationship

The selector and art are intentionally decoupled. The final desktop correction is owned by `styles/character-forge-class-fullbleed-final.css`, loaded after the earlier Class hero-framing stylesheet so it can safely override only the reviewed cinematic presentation.

For public cinematic Class heroes at desktop widths (`min-width: 901px`):

- the **Class guide workspace** (`.npc-forge-class-guide`) is the artwork containing block; the inner Overview article is no longer the artwork boundary;
- the Overview article becomes transparent/static for positioning purposes, so its padding, border, and margins cannot create top/right seams or crop the painting;
- the nested `.npc-forge-class-guide__hero-art` is positioned `absolute` with `inset: 0` against the Class guide, so the image fills the actual Class workspace from top to right to bottom regardless of selector/progression height;
- the cinematic image uses `width:100%`, `height:100%`, `object-fit:cover`, and `object-position:100% 0%`; it is not scaled by transform tricks;
- the replacement Wizard cinematic is a clean 1600×900 asset with its dark left-side composition built into the artwork itself, so only a restrained readability veil remains in CSS;
- Class copy, the view header, selector/progression layout, and footer remain normal foreground UI through explicit stacking order, while the artwork is pointer-inert behind them;
- expanding/collapsing subclass controls can change Class workspace height without moving the artwork into a different positioning context or recropping it against an inner card.

The final full-bleed rule is intentionally restricted to public cinematic Class artwork. Non-cinematic/core fallback paintings and layouts at 900px or narrower continue through the pre-existing Class framing rules rather than inheriting this desktop override.

## Validation requirements

Before this selector/artwork pass is accepted or extended:

1. every canonical `model.options` subclass must remain present;
2. eligibility and persistence must still call the existing model/context authority;
3. future-level subclasses may be inspected but must not persist early;
4. only the selected subclass contributes cyan progression features;
5. the Feature card remains click/selection-driven, not hover-driven;
6. the expanded selector remains a two-column internal scroll region at the approved compact desktop width;
7. each visible subclass choice contains only artwork and subclass name;
8. the selected collapsed row retains its artwork/name and Change control;
9. every currently canonical Wizard subclass resolves to a distinct artwork file; genuinely unmapped or missing future subclass images fall back to Class menu artwork rather than breaking the selector;
10. all nine spell-slot columns remain visible/scrollable;
11. expanding/collapsing the selector does not change the cinematic image's containing block or create top/right/bottom seams;
12. desktop public cinematic art fills the Class guide workspace while Class copy and controls remain stacked above it; non-cinematic and narrow-layout framing must remain unchanged;
13. `Validate Class browser polish`, subclass-selector validation, Source Magic Routing, and the normal Forge validation suite must pass;
14. Vercel exact-head build/runtime checks and `/profile` must pass;
15. no world-map, town/city-map, Supabase data/schema, crafting, inventory, travel, or unrelated runtime files may be changed.
