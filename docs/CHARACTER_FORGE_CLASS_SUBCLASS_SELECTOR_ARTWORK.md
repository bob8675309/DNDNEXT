# Character Forge Class Subclass Selector Artwork

Status date: 2026-09-18

This document records the current approved Character Forge subclass-selector presentation on PR #193 (`agent/subclass-tarot-approved-batch-20260916`). It replaces the older compact two-column selector description. The change is presentation-only: canonical subclass availability, level gates, persistence, progression injection, and feature rules remain owned by the existing Forge class guide/context and Supabase-backed catalogues.

## Current approved selector

The accepted visual target is the runic circular Tarot gallery reviewed on 2026-09-18.

- Opening the subclass picker uses a viewport-owned modal/portal rather than expanding an inline grid.
- The scene is a gothic arcane selection hall with a glowing runic table and layered purple smoke.
- All canonical `model.options` remain in the selector. The UI does not trim the rules catalogue to only the cards currently in front.
- Four cards are the prominent front arc at desktop scale. Remaining cards continue around the same circular orbit as smaller, dimmer rear cards.
- Cards keep stable React keys and stable orbital positions. Left/right movement advances the carousel by exactly one option and wraps with modulo arithmetic.
- The loop is continuous; there is no duplicated scrolling rail, rubber-band recentering, `scrollLeft` correction, or snap-back segment.
- The focused card is the second prominent front position, matching the approved reference composition rather than forcing the focus to the exact geometric center.
- The selected/focused state is conveyed primarily by the existing Tarot artwork plus a restrained gold/purple glow. The card art itself is not covered by a large text footer.
- The lower details panel shows the focused subclass name, class label, a concise source-backed subclass description, availability guidance when level-gated, and a **View Details** action.
- Clicking an eligible card still selects through the existing model authority and closes the modal. A future-level card may be inspected but cannot persist early.
- Keyboard Left/Right arrows mirror the one-card navigation; Escape closes the modal.
- The selected collapsed card remains in the Class Overview and can be reopened through Change Subclass or double-click.
- The modal prevents body scrolling while open and restores the previous body overflow state when closed.

## Presentation assets

The runic scene assets live under:

`public/media/forge/subclass-carousel/`

Current files:

- `subclass-selector-cathedral-bg.png`
- `subclass-selector-runic-table.png`
- `subclass-selector-smoke-back.png`
- `subclass-selector-smoke-front.png`

All four were transferred through the standing guarded binary workflow, checksum-validated, confirmed as 1672x941 PNGs, and installed on the PR #193 artwork branch. The table and smoke overlays retain alpha.

The subclass Tarot cards remain under `public/media/subclasses/<class-key>/` and are resolved through `utils/classes/subclassArtwork.js`.

## Artwork authority

Subclass artwork remains presentation-side only:

`ClassSubclassSection.js -> subclassArtworkFor(classKey, option) -> utils/classes/subclassArtwork.js`

Current production-visible coverage is 149/149 dedicated cards. The repository artwork ledger contains 152 normalized installed concepts because historical compatibility identities and explicitly approved aliases are retained. The four historical Wizard identities Abjuration, Divination, Evocation, and Illusion are suppressed by runtime compatibility and are not missing visible cards.

Unknown/future subclass identities still retain the class-menu artwork fallback so new catalogue content fails safely rather than rendering a broken image.

## Runtime / behavior authority preserved

The runic selector must not become a second rules engine.

Selection still flows through the existing model calls:

- `model.setPreviewKey(option.key)`
- `model.selectSubclass(option)`
- `optionEntryLevel(option) > currentLevel` prevents early persistence
- `onInspectSubclass` remains the detail-inspection handoff

No Supabase write, migration, subclass eligibility rewrite, progression rewrite, or new persistence state was introduced by this presentation pass.

## Current implementation files

Primary implementation:

- `components/ClassSubclassSection.js`
- `styles/character-forge-subclass-tarot-layout.css`

Focused guards:

- `scripts/validate_class_browser_polish.mjs`
- `scripts/validate_class_subclass_browser.mjs`

Runic scene assets:

- `public/media/forge/subclass-carousel/*`

## Validation checkpoint

Implementation checkpoint:

`49b6a0486878748f5d9c3147eb51fdbe16358451` — `Harden runic carousel preview effects [deploy-preview]`

At that checkpoint:

- `Validate Class browser polish` completed successfully, including the focused subclass-browser validation;
- Vercel Preview `dpl_5kcUtbeqoWqsY7iBMaLeyb81buaX` reached **READY**;
- preview host: `dndnext-jy8z0xq7u-pauls-projects-2016aa54.vercel.app`;
- `/profile` returned HTTP 200;
- Next.js 16.1.6 production build compiled successfully;
- no world-map, town/city-map, crafting, inventory, travel, merchant, economy, encounter/tactical, or Supabase runtime files were part of the runic-carousel implementation delta.

## Acceptance / regression requirements

Before merging or extending this selector:

1. Re-fetch the current PR #193 head; do not trust a recorded SHA if the branch moved.
2. Every canonical visible subclass option must still be reachable in the continuous orbit.
3. Arrow/keyboard navigation must advance exactly one option and wrap without rubber-band recentering.
4. Front/rear depth must remain one circular presentation, not two unrelated lists.
5. Eligibility and persistence must continue through the existing Forge authority.
6. Future-level subclasses must remain non-persistable.
7. The details panel must remain based on actual subclass feature content; do not invent rules text.
8. The 149 current runtime-visible identities must keep dedicated Tarot coverage.
9. Unknown/future identities must retain the safe class-art fallback.
10. Exact-head focused CI and an intentional Vercel Preview should be green before merge.
11. Do not touch world-map or town/city-map behavior while maintaining this selector.
