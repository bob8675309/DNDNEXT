# Character Forge Class Hero Artwork Status

Status date: 2026-09-10

This is the focused handoff/status note for Character Forge Class artwork presentation on PR #177 (`agent/realistic-dice-core`). Current source, exact-head CI, browser behavior, and Supabase remain authoritative over older screenshots or superseded notes.

## Current architecture

The Class guide keeps one centralized artwork authority:

`NpcForgeClassGuide.js -> classHeroArtworkFor(selectedClass.class_key) -> utils/classes/classArtwork.js`

Class-list/catalogue thumbnails remain separately resolved through:

`NpcForgeClassCatalog.js -> classMenuArtworkFor(classKey) -> utils/classes/classArtwork.js`

Purpose-built cinematic heroes are promoted through `PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK`. Dedicated Class-list thumbnails are promoted through `PUBLIC_CINEMATIC_CLASS_MENU_ARTWORK`. The two roles remain intentionally separate so a full-width cinematic is never destructively reused merely because it exists.

The Character Forge modal owns the cinematic painting. The Class body and nested guide stay transparent and do not repaint, blur, or independently crop a second copy. The final presentation layer is:

`styles/character-forge-class-final-corners.css`

Desktop cinematic heroes use one sharp `cover` background across the Forge, with a transparent dark left-side readability fade and class-specific focal positions where needed. Wizard retains its stronger near-black fade and remains the accepted reference composition.

## Approved public cinematic heroes

The centralized resolver now covers:

- No Adventuring Class / Civilian — `public/media/classes/cinematic-civilian.webp`
- Artificer — `public/media/classes/cinematic-artificer.webp`
- Barbarian — `public/media/classes/cinematic-barbarian.webp`
- Bard — `public/media/classes/cinematic-bard.webp`
- Cleric — `public/media/classes/cinematic-cleric.webp`
- Druid — `public/media/classes/cinematic-druid.webp`
- Fighter — `public/media/classes/cinematic-fighter.webp`
- Monk — `public/media/classes/cinematic-monk.webp`
- Paladin — `public/media/classes/cinematic-paladin.webp`
- Ranger — `public/media/classes/cinematic-ranger.webp`
- Rogue — `public/media/classes/cinematic-rogue.webp`
- Sorcerer — `public/media/classes/cinematic-sorcerer.webp`
- Warlock — `public/media/classes/cinematic-warlock.webp`
- Wizard — `public/media/classes/cinematic-wizard.webp`
- Mystic — `public/media/classes/cinematic-mystic.webp`
- Monster Hunter — `public/media/classes/cinematic-monster-hunter.webp`
- Expert Sidekick — shared `public/media/classes/cinematic-sidekick.webp`
- Warrior Sidekick — shared `public/media/classes/cinematic-sidekick.webp`
- Spellcaster Sidekick — shared `public/media/classes/cinematic-sidekick.webp`

The generic `sidekick` presentation key also resolves to the shared Sidekick cinematic as a compatibility fallback.

## 2026-09-10 Class-list thumbnail refresh

All visible Class-list entries now have purpose-built menu artwork under `public/media/classes/menu-*.webp`. These are 600x800 portrait assets, independently authored from the full-width cinematic compositions.

The public menu resolver now covers Civilian, Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk, Monster Hunter, Mystic, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard, plus the shared Sidekick family.

The shared Sidekick thumbnail is used for `sidekick`, `expert-sidekick`, `warrior-sidekick`, and `spellcaster-sidekick`, matching the existing shared Sidekick cinematic treatment without changing their separate Class rules or identities.

## 2026-09-10 Warlock, Sidekick, and Civilian corrections

### Warlock

The approved Warlock cinematic was recomposed so the character's head sits higher within the scene while remaining below the Forge/menu divider. The new binary keeps the same moonlit non-human occult direction without the prior face/divider collision.

### Sidekick

The existing Sidekick cinematic remains approved. Its desktop focal position is now:

`--npc-forge-class-art-position: 74% 28%`

This shifts the party composition lower in the visible Forge crop so the window/step rail does not cut across the upper subjects.

Sidekick presentation also omits the redundant Saving Throws and Primary Ability hero fact boxes. Hit Die remains visible, leaving more of the artwork unobstructed.

### No Adventuring Class / Civilian

Civilian now has a dedicated full-width cinematic and a dedicated Class-list thumbnail. Its cinematic uses the normal `72% center` focal treatment.

The synthetic Civilian entry can use an id such as `static-class-civilian`, which is not a Postgres UUID. `NpcForgeClassGuideModel.js` now guards the UUID-only `class_level_progression.class_id` query and skips that query for synthetic non-UUID entries. This removes the prior `invalid input syntax for type uuid: "static-class-civilian"` runtime warning without changing Supabase data or Class authority.

Like Sidekick, Civilian omits the redundant Saving Throws and Primary Ability hero fact boxes so the special non-adventuring presentation has more usable artwork space.

## Accepted composition notes

- Wizard remains accepted and should not be changed unless explicitly requested.
- Fighter uses the normal `70% center` focal treatment; do not restore the obsolete temporary pixel offset.
- Ranger uses the approved Elf cinematic with source-level headroom rather than a CSS compensation hack.
- Paladin uses the approved celestial/non-human holy-warrior composition.
- Monster Hunter uses the approved dwarven hunter composition.
- Warlock uses the latest recomposed moonlit occult image described above.

## Artwork composition standard going forward

For every additional Class hero or replacement:

1. Author for the wide Forge cinematic ratio, not a square catalogue portrait.
2. Reserve the left side for readable Class copy and controls; dark environmental detail is preferred over a blank opaque panel.
3. Keep the main subject on the right with enough background above the head that the Class divider cannot cross the face during ordinary desktop resizing.
4. Vary pose, eyeline, body type, Species, environment, lighting, and action across Classes.
5. Avoid defaulting to humans while the roster remains human-heavy; use appropriate playable fantasy Species where the composition benefits from it.
6. Check hands, paws, weapons, bows, instruments, spell effects, and held props for obvious generation defects before promotion.
7. Keep menu/catalogue artwork separate when a cinematic crop would read poorly at thumbnail size.
8. Promote art through the centralized resolvers rather than bypassing them from page/component code.
9. Do not commit failed, UI-contaminated, placeholder, or unreviewed generations merely to complete a batch.

## Regression guard

`scripts/validate_class_hero_framing.mjs` protects the active cinematic presentation. It checks that:

- the final Class cinematic stylesheet remains loaded last among the Class framing layers;
- the modal owns the single public cinematic image;
- promoted public cinematic paths exist and remain wired through the centralized resolver;
- Civilian and the Sidekick family retain their explicit special-case cinematic routes;
- Sidekick retains its lower `74% 28%` focal treatment;
- Wizard retains its stronger left readability fade;
- nested duplicate/blur layers remain suppressed;
- protected map/town behavior is not referenced by the Class artwork patch.

## 2026-09-10 publication chain

Latest reviewed binary installation:

`0f1f5238fc9dacf274db08e590b81967a5f91caf` — `Install approved Class menu and civilian artwork`

Public menu/cinematic resolver promotion:

`75bd678b785bcda56a70ce1c0cd9ebf8e9720c1b` — `Wire approved Class menu and civilian artwork`

Preferred subclass alias alignment:

`ef56ee149924615888f524c296c12b7839791406` — `Align subclass artwork aliases with preferred catalog`

Special Class presentation polish:

`34b9475b867f34357d7c8f02d27385d306ee0be7` — `Polish special Class cinematic presentation`

Binary transfer archive:

`/DNDNext-Transfer/dndnext-class-menu-civilian-warlock-20260910.zip`

Archive SHA-256:

`fa07bd055fed6b9263920f44a8271e50d01262dbc1b3567dae0c8c84cec0ee06`

## Protected boundaries

- No Supabase writes or migrations.
- No Class/subclass persistence authority changes.
- No world-map code.
- No town/city-map code.
- No crafting, travel, encounter, inventory, merchant, tactical, or character-sheet runtime behavior.
- Existing Player Forge portal/drag/resize behavior remains separate from this artwork work.
