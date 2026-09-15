# Character Forge Class Subclass Selector Artwork — Historical Compact Selector

Status reconciled: 2026-09-15

Classification: **historical/superseded presentation reference**.

This document originally described the browser-approved compact two-column subclass selector developed during PR #177. That implementation history remains useful for understanding Class progression/artwork decisions, but it is **not the current production subclass-selector presentation**.

Production now uses the cinematic looping carousel with standardized 7:12 Tarot cards restored to `main` through PR #189. Current selector/artwork authority is documented in:

- `CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

## What remains authoritative from the old design

The following architectural boundaries survived the visual replacement and remain important:

- subclass availability, level gates, persistence, progression injection, and feature rules belong to the existing Class guide/model/context and Supabase-backed catalogues;
- artwork is presentation-only and remains resolved through `utils/classes/subclassArtwork.js`;
- only the selected subclass contributes selected-subclass progression features;
- future-level subclasses may be shown for planning but must not persist early;
- Class artwork and subclass artwork are separate presentation concerns;
- missing/unknown future artwork must fail safely rather than breaking Class selection;
- Class/subclass work does not authorize world-map, town-map, crafting, inventory, travel, merchant, encounter, or unrelated runtime changes.

## Historical compact-selector contract

The superseded selector used a narrow two-column desktop region above Class Progression, internally scrolled larger catalogues, displayed small rectangular subclass artwork/name rows, and collapsed to a selected-subclass row after choice. The design intentionally omitted bulky inline detail cards and relied on the movable Feature card for deeper information.

Those measurements — including the old 76×40 thumbnails, compact 52px rows, two-column 2×3 viewport, and 240×112 Wizard artwork — are **historical only**. Do not use them as current Tarot/card dimensions.

## Historical Wizard artwork note

The compact-selector period produced 18 distinct normalized Wizard presentation identities:

- Abjuration
- Abjurer
- Bladesinger
- Bladesinging
- Chronurgy
- Conjuration
- Divination
- Diviner
- Enchantment
- Evocation
- Evoker
- Graviturgy
- Illusion
- Illusionist
- Necromancy
- Scribes
- Transmutation
- War

Current runtime compatibility behavior suppresses Abjuration, Divination, Evocation, and Illusion as duplicate/reprint identities from the visible carousel. Their historical assets/mappings remain provenance; they are not current missing-card requirements.

## Current production replacement

Current production presentation is:

`ClassSubclassSection.js -> cinematic looping carousel -> subclassArtworkFor(...) -> normalized Tarot asset -> character-forge-subclass-tarot-layout.css`

The production card standard is 7:12, 840×1440 WebP, full bleed, no opaque footer/title band.

Current completion authority is runtime-visible: 149 visible choices / 149 dedicated cards, with 43 known visible choices still using generic/class fallback art as of the 2026-09-15 audit.

## Progression and Class artwork relationship

The compact-selector era also established durable Class presentation decisions that still matter independently of the selector replacement:

- Class progression retains its source-backed level/PB/features/spell-column structure;
- Class cinematic hero artwork is presentation-only and must not become class/subclass rules authority;
- selected-subclass progression injection remains owned by the Class model/context, not by the artwork component;
- feature inspection remains separate from persistence.

For current Class hero art, use `CHARACTER_FORGE_CLASS_HERO_ARTWORK_STATUS.md` and current source.

## Why this file remains

This file is retained so future developers can understand why old screenshots, commits, and validator history mention a compact rectangular selector and 240×112 subclass art. It must not be used to regress production back to that layout.

If current source and this historical document disagree, current source plus the Tarot handoff/status documents win.
