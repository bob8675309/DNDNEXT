# Subclass Tarot Artwork

The subclass Tarot deck was normalized from 2026-09-12 onward and is now complete for the current runtime-visible catalogue: 149/149 visible choices have dedicated approved cards.

Do not restore old assets from history unless Paul explicitly requests a specific reference image. Re-audit runtime-visible coverage whenever the subclass catalogue changes.

Before adding new artwork, read:

- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`

Canonical final export:

- 7:12 aspect ratio
- 840 × 1440 WebP
- full-bleed art to the bottom
- no footer panel

Asset path pattern:

`public/media/subclasses/<class-key>/<class-key>-<art-family>.webp`

Only approved cards should be added and wired in `utils/classes/subclassArtwork.js`.
