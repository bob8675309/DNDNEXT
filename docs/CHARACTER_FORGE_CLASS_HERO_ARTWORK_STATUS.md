# Character Forge Class Hero Artwork Status

Status date: 2026-09-09

This is the focused handoff/status note for Character Forge Class hero artwork presentation on PR #177 (`agent/realistic-dice-core`). Current source, CI, browser behavior, and Supabase remain authoritative over older screenshots or superseded notes.

## Current architecture

The Class guide keeps one centralized artwork authority:

`NpcForgeClassGuide.js -> classHeroArtworkFor(selectedClass.class_key) -> utils/classes/classArtwork.js`

Purpose-built cinematic heroes are promoted through `PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK`. Catalogue/menu art remains a separate concern through `classMenuArtworkFor`; cinematic backgrounds must not be destructively reused as menu thumbnails merely because they exist.

The Character Forge modal owns the cinematic painting. The Class body and nested guide stay transparent and do not repaint, blur, or independently crop a second copy. The final presentation layer is:

`styles/character-forge-class-final-corners.css`

Desktop cinematic heroes use one sharp `cover` background across the Forge, with a transparent dark left-side readability fade and class-specific focal positions where needed. Wizard retains its stronger near-black fade because its moonlit castle is brighter behind the copy.

## Approved public cinematic heroes

The following public heroes are now active through the centralized resolver:

- Artificer — `public/media/classes/cinematic-artificer.webp`
- Barbarian — `public/media/classes/cinematic-barbarian.webp`
- Bard — `public/media/classes/cinematic-bard.webp`
- Cleric — `public/media/classes/cinematic-cleric.webp`
- Druid — `public/media/classes/cinematic-druid.webp`
- Fighter — `public/media/classes/cinematic-fighter.webp`
- Monk — `public/media/classes/cinematic-monk.webp`
- Ranger — `public/media/classes/cinematic-ranger.webp`
- Rogue — `public/media/classes/cinematic-rogue.webp`
- Wizard — `public/media/classes/cinematic-wizard.webp`

The 2026-09-09 promoted batch was exported as WebP at 1600x900 and transferred through the established Dropbox/GitHub Actions binary bridge with checksum, MIME, dimension, exact-diff, and focused Class validation before publication.

### 2026-09-09 promoted diversity batch

The newest approved compositions deliberately avoid presenting every Class as the same human fantasy hero. The promoted set includes visibly different character concepts, including:

- a gnome Artificer in a clockwork/arcane forge;
- a Dragonborn Bard in a court/feast setting;
- a dwarven Cleric in a monumental cathedral;
- a Firbolg Druid in an ancient moonlit forest;
- a Tiefling Rogue above a gothic city;
- a distinct martial Monk composition;
- a storm-bound Barbarian composition;
- a completely reworked Fighter composition using sword and shield rather than repeating the Barbarian's stance/eyeline.

These are presentation choices only. They do not imply Species restrictions, Class defaults, or rules changes.

## Fighter final composition

The earlier Fighter asset placed the head too close to the horizontal Class divider. A temporary CSS-only `70% 42px` offset improved the old source but was not the desired final solution.

That workaround is now superseded by the newly approved Fighter painting. The new composition deliberately places more fortress/sky/background above the subject, uses a different pose and eyeline from Barbarian, and fixes the previous weapon/hand composition issue. Fighter now uses the normal cinematic focal contract:

`--npc-forge-class-art-position: 70% center`

Do not restore the obsolete `70% 42px` compensation unless the source artwork itself is reverted.

## Wizard accepted state

Wizard is the reference for bright cinematic scenes:

- one continuous 1600x900 image reaches the Forge border;
- the left side fades strongly toward near-black for title/body readability;
- the fade is transparent, not a separate black panel;
- no blur or `backdrop-filter` is used on the cinematic painting;
- the right-side Wizard remains bright and detailed;
- Wizard's 18 subclass selector images remain wide 456x240 assets filling the 76x40 selector viewport with `object-fit: cover`.

## Artwork composition standard going forward

For every additional Class hero:

1. Author for the wide Forge cinematic ratio, not a square catalogue portrait.
2. Reserve the left side for readable Class copy and controls; dark environmental detail is preferred over a blank opaque panel.
3. Keep the main subject on the right with enough background above the head that the Class divider cannot cross the face during ordinary desktop resizing.
4. Vary pose, eyeline, body type, Species, environment, lighting, and action across Classes. Avoid a row of heroes all staring toward the same distant point.
5. Check hands, weapons, instruments, spell effects, and held props for obvious generation defects before promotion.
6. Keep menu/catalogue art separate when a cinematic crop would read poorly at thumbnail size.
7. Promote a hero through `PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK`; do not bypass the resolver from page/component code.
8. Do not commit failed, UI-contaminated, placeholder, or unreviewed generations merely to complete a batch.

## Regression guard

`scripts/validate_class_hero_framing.mjs` is called by the existing Class browser validation workflow and now protects the current batch. It checks that:

- the final Class cinematic stylesheet remains loaded last among the Class framing layers;
- the modal owns the single public cinematic image;
- all promoted public cinematic paths exist and remain wired through the centralized resolver;
- the newly approved Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk, and Rogue paths remain present;
- Fighter uses the new composition's normal center focal treatment rather than the superseded pixel offset;
- Wizard keeps its stronger left readability fade;
- nested duplicate/blur layers remain suppressed;
- Wizard subclass artwork keeps its native wide selector treatment;
- protected map/town behavior is not referenced by the Class artwork patch.

## 2026-09-09 publication chain

Binary artwork materialization:

`eaf88bcf9670674a262b58b219e47c78655516ef` — `Install approved Class cinematic artwork batch`

Resolver promotion:

`f3447baafd673d9ef72a9a7cc4c1bb9d0dda9246` — `Promote approved Class cinematic hero batch`

Cinematic alignment/framing:

`b8d3405540ff8847f4c3b2d79589544762c6edcf` — `Align approved Class cinematic artwork batch`

Regression guard:

`8ebe3cfe905b2e6caff092cafcd5d9a24e8a6c47` — `Guard approved Class cinematic artwork batch`

## Protected boundaries

This work is presentation-only.

- No Class selection or persistence authority changed.
- No subclass/progression mechanics changed.
- No Supabase data write or migration is required.
- No world-map code was touched.
- No town/city-map behavior was touched.
- No crafting, travel, encounter, inventory, merchant, tactical, or character-sheet runtime behavior is part of this artwork batch.
- Existing Player Forge window portal/drag/resize behavior remains separate from this artwork work.
