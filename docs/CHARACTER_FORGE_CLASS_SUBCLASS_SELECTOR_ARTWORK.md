# Character Forge Class Subclass Selector Artwork

Status date: 2026-09-07

This document records the browser-approved subclass-selector and Class hero presentation layered onto PR #177 (`agent/realistic-dice-core`). It is presentation-only. Canonical subclass availability, level gates, persistence, progression injection, and feature rules remain owned by `useNpcForgeClassGuideModel` / `NpcForgeClassChoiceContext` and the Supabase-backed class catalogues.

## Approved selector layout

The approved target remains the compact two-column treatment:

- the selector sits directly above Class Progression;
- it uses exactly two columns on desktop and one column on narrow layouts;
- the normal desktop selector uses `width:min(35%,430px)`;
- below 1100px it uses `width:min(42%,430px)` and below 900px returns to full width;
- the expanded selector remains internally scrollable with a `166px` desktop viewport;
- each visible choice button contains only subclass artwork and subclass name; desktop cards are 52px tall with 76×40 artwork, so six choices (2 columns × 3 rows) are visible before scrolling;
- source badges, inline descriptions, level badges, status/check circles, visible helper copy, and footer notes remain omitted from the selector; eligibility guidance stays available to assistive technology;
- every canonical subclass remains present;
- selecting an eligible subclass continues through the existing Forge model/context authority, updates progression, and collapses the selector;
- collapsed state retains selected subclass artwork/name with compact Change/Clear controls;
- clicking a subclass sends its details to the movable Feature card; hover/focus alone does not replace Feature-card content;
- search, source-filter toolbars, large inline detail cards, and the old multi-column pill wall are not part of the Overview layout.

## Artwork authority

Subclass artwork is not stored in Supabase. Supabase remains canonical for subclass names, sources, levels, descriptions, entries, eligibility, and rules. `utils/classes/subclassArtwork.js` is only a presentation resolver: it receives the Class key plus the canonical subclass option and returns an image path. Missing future artwork falls back through `classMenuArtworkFor(...)` without changing subclass identity or rules.

### Wizard artwork set

Wizard currently has 18 canonical subclasses in the catalogue: Abjuration, Abjurer, Bladesinger, Bladesinging, Chronurgy, Conjuration, Divination, Diviner, Enchantment, Evocation, Evoker, Graviturgy, Illusion, Illusionist, Necromancy, Scribes, Transmutation, and War.

Each one must resolve to its own 240×112 WebP at `/media/subclasses/wizard/wizard-<normalized-subclass>.webp`. Similar traditions may share visual motifs, but they must not resolve to the same binary or merely reuse one school image under another filename.

The 2026-09-07 artwork correction also establishes a binary-quality rule: selector artwork must be a clean borderless vignette. Do not bake Class UI borders, selector chrome, labels, screenshots, or other interface remnants into the WebP itself. Variant traditions may use distinct composition, grading, and restrained thematic sigils so they remain visually distinguishable at the 76×40 selector size.

## Progression density target

The progression table structure remains Level, PB, Features, Cantrips, Known/Prepared, then 1st–9th spell-slot columns for spellcasting Classes. Normal row density, feature-pill styling, and narrow-layout horizontal scrolling remain unchanged.

For Classes with a public cinematic hero, the progression card now reclaims the full available row below the hero. The old `width:min(74%,860px)` treatment existed only to avoid a full-height artwork layer and must not be reintroduced for cinematic Classes. Base Class features remain purple pills; selected-subclass features remain cyan pills.

## Cinematic Class art relationship

The 2026-09-07 browser correction replaces the former viewport-height/full-card background treatment.

- Public cinematic Class art belongs to the **hero header only**.
- On desktop the hero is a two-column composition: approximately 56% copy/facts and 44% artwork, with a 270px minimum hero height.
- The cinematic art occupies the right hero column and uses `object-fit:cover` with `object-position:100% 18%`.
- The readability fade is confined to the hero artwork edge; there is no full-card overlay behind the subclass selector or progression table.
- The Class Overview no longer uses negative margins or `width:calc(100% + 32px)` to turn the artwork into a workspace-wide layer.
- The old `height:clamp(780px,82vh,960px)` viewport-derived art height is forbidden.
- Selector and progression render in the normal document flow beneath the hero, so opening/collapsing the selector cannot resize, move, or recrop the hero art.
- Cinematic progression cards use the full available row below the hero.
- Legacy square paintings retain their safe non-destructive framing until a dedicated cinematic asset is approved.
- Generated Artificer/Barbarian behavior remains protected.

The Wizard hero binary itself must also be clean source art. A UI screenshot or crop containing ghosted fact cards, labels, borders, or other interface elements must never be promoted as `cinematic-wizard.webp`.

## Validation requirements

Before this selector/artwork pass is accepted or extended:

1. every canonical `model.options` subclass must remain present;
2. eligibility and persistence must still call the existing model/context authority;
3. future-level subclasses may be inspected but must not persist early;
4. only the selected subclass contributes cyan progression features;
5. the Feature card remains click/selection-driven, not hover-driven;
6. the expanded selector remains a two-column internal scroll region at the approved compact desktop width;
7. each visible subclass choice contains only artwork and subclass name;
8. the selected collapsed row retains artwork/name and Change/Clear controls;
9. every currently canonical Wizard subclass resolves to a distinct artwork binary, and those images contain no baked selector/UI chrome;
10. all nine spell-slot columns remain visible/scrollable;
11. cinematic artwork remains confined to the hero header and never becomes a viewport-height/full-card background;
12. cinematic Classes reclaim full progression width beneath the hero;
13. `Validate Class browser polish`, Class hero framing, subclass-selector validation, Source Magic Routing, and the normal Forge validation suite must pass;
14. Vercel exact-head build/runtime checks and `/profile` must pass;
15. no world-map, town/city-map, Supabase data/schema, crafting, inventory, travel, or unrelated runtime files may be changed.
