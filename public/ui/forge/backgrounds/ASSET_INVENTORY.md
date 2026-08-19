# Character Forge Background Art Inventory

This folder is the canonical reusable art kit for the Character Forge **Background** tab. Keep this inventory current before generating additional artwork so we do not duplicate assets.

## Shared hero banners — complete

All banners are 768×256 WebP and are composed for dark text-safe overlays with important visual detail weighted to the right.

- [x] `banners/bg-banner-martial.webp` — guards, soldiers, city watch, marines, mercenaries, martial service
- [x] `banners/bg-banner-arcane.webp` — sages, students, Rune Carver, High Sorcery, scholarly/planar magic
- [x] `banners/bg-banner-travel.webp` — guides, sailors, outlanders, hermits, travelers, wilderness origins
- [x] `banners/bg-banner-intrigue.webp` — charlatans, criminals, gamblers, agents, investigators, urban/social origins
- [x] `banners/bg-banner-craft.webp` — artisans, clan crafters, guilds, merchants, shipwrights
- [x] `banners/bg-banner-faith.webp` — acolytes, priests, temple/religious origins
- [x] `banners/bg-banner-giant.webp` — Giant Foundling and giant/mythic origins
- [x] `banners/bg-banner-haunted.webp` — Haunted One, Ruined, Ravenloft/vampiric and other dark origins

## Shared family crests — complete

- [x] `crests/bg-crest-martial.webp`
- [x] `crests/bg-crest-arcane.webp`
- [x] `crests/bg-crest-travel.webp`
- [x] `crests/bg-crest-intrigue.webp`
- [x] `crests/bg-crest-craft.webp`
- [x] `crests/bg-crest-faith.webp`
- [x] `crests/bg-crest-giant.webp`
- [x] `crests/bg-crest-haunted.webp`
- [x] `crests/bg-crest-noble-court.webp`

## Shared section art — complete

- [x] `icons/bg-icon-skills.webp`
- [x] `icons/bg-icon-tools.webp`
- [x] `icons/bg-icon-languages.webp`
- [x] `icons/bg-icon-origin-feat.webp`
- [x] `icons/bg-icon-background-feature.webp`
- [x] `icons/bg-icon-before-adventuring.webp`
- [x] `icons/bg-icon-special-choice.webp`
- [x] `icons/bg-icon-lore-info.webp`

## Integration status

- [x] Selected Background hero uses the correct shared family banner and crest.
- [x] Before Adventuring reuses the family banner under a darker narrative treatment instead of duplicating raster strips.
- [x] Skills, Tools, Languages, Origin Feat, and lore/help areas use the shared section art.
- [x] Left Background catalogue rows use the same family crests, a restrained family-banner texture, compact right-aligned source pills, and reduced padding.
- [x] Family assignment was audited against all 75 live preferred Background names. Ravenloft/vampiric backgrounds use Haunted; merchants/crafters use Craft; social/intrigue backgrounds use Intrigue; scholarly/magical backgrounds use Arcane; martial, travel, faith, giant, and noble/court families remain distinct.

## Deliberately not generated

Separate raster art for every Before Adventuring strip and footer/help strip is intentionally omitted. Reusing the family banner plus shared section icon avoids duplicate artwork and keeps the tab visually coherent.

## Future unique art

Only add background-specific art when browser review shows a shared family is not distinctive enough. Do **not** create one-off art for all 75 Backgrounds by default. The approved strategy is shared families first, unique art only for important/special exceptions.

## Current visual checkpoint

The shared-art system, selected-background hero, and catalogue family treatment are ready for browser review. If that review is accepted, no additional generic Background artwork is required before the tab can be merged; future art should be exception-driven rather than generated speculatively.
