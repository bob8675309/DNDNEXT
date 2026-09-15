# Character Forge Class Hero Artwork Status

Status reconciled: 2026-09-15

Classification: **reference / merged rollout history**.

The Class hero/menu artwork work documented here was developed during PR #177 (`agent/realistic-dice-core`). PR #177 is now merged; current `main`, `utils/classes/classArtwork.js`, current browser behavior, and live catalogue/source data outrank any historical branch/SHA wording below.

## Current architecture

The Class guide keeps one centralized artwork authority:

`NpcForgeClassGuide.js -> classHeroArtworkFor(selectedClass.class_key) -> utils/classes/classArtwork.js`

Class-list/catalogue thumbnails remain separately resolved through:

`NpcForgeClassCatalog.js -> classMenuArtworkFor(classKey) -> utils/classes/classArtwork.js`

Purpose-built cinematic heroes are promoted through `PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK`. Dedicated Class-list thumbnails are promoted through `PUBLIC_CINEMATIC_CLASS_MENU_ARTWORK`. The two roles remain intentionally separate so a full-width cinematic is never destructively reused merely because it exists.

The Character Forge modal owns the cinematic painting. The Class body and nested guide stay transparent and do not repaint, blur, or independently crop a second copy. Current source controls the final CSS layering/focal-position details.

## Approved cinematic families from the rollout

The centralized resolver covers the production Class families including Civilian/No Adventuring Class, Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard, Mystic, Monster Hunter, and the Sidekick family. Expert/Warrior/Spellcaster Sidekick may intentionally share the Sidekick cinematic/menu treatment without merging their Class rules or identities.

## Class-list thumbnails

Visible Class-list entries use purpose-built portrait/menu artwork rather than destructively reusing full-width cinematics. Keep the menu and hero roles separate.

## Special presentation notes

- Wizard remains the reference composition and should not be changed without an explicit request.
- Sidekick presentation may share artwork across Sidekick classes while retaining separate Class identities/rules.
- Civilian/No Adventuring Class is a synthetic presentation entry; UUID-only catalogue/progression queries must remain guarded against synthetic non-UUID IDs.
- Source artwork should own composition where possible instead of accumulating CSS crop hacks.

## Relationship to subclass artwork

Class hero/menu artwork is separate from subclass Tarot artwork.

Current subclass production presentation is the cinematic looping Tarot carousel restored through PR #189. Read:

- `CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

Do not reuse a Class hero/menu image as a “completed” subclass Tarot card merely because fallback rendering can display it.

## Validation expectations

When changing Class artwork:

- preserve centralized resolver ownership;
- preserve menu-vs-hero role separation;
- preserve Class/subclass rules/persistence authority outside artwork helpers;
- validate synthetic/non-UUID Class handling where relevant;
- verify desktop/narrow responsive framing;
- run current Class/Forge validators;
- request an intentional `[deploy-preview]` commit only when browser review is needed.

## Protected boundaries

Class artwork changes do not authorize Supabase mutation, world-map/town-map changes, travel/routes/weather/camps/clock changes, crafting, inventory, merchants, economy, encounter/tactical changes, or unrelated Character Sheet runtime work.
