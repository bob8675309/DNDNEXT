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

The following public heroes are active through the centralized resolver:

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

## 2026-09-09 diversity direction

Paul explicitly approved continuing the Class cinematic set while avoiding additional human heroes because the Class browser already contained enough human representation. The active cinematic roster therefore deliberately varies visible Species, silhouette, pose, environment, and eyeline.

Recent approved compositions include:

- a gnome Artificer in a clockwork/arcane forge;
- a storm-bound Barbarian composition;
- a Dragonborn Bard in a court/feast setting;
- a dwarven Cleric in a monumental cathedral;
- a Firbolg Druid in an ancient moonlit forest;
- a completely reworked Fighter using sword and shield with a different stance and eyeline from Barbarian;
- a distinct martial Monk composition;
- a celestial/non-human Paladin in a sunlit holy citadel;
- an Elf Ranger overlooking a ruined mountain valley;
- a Tiefling Rogue above a gothic city;
- a celestial Sorcerer channeling innate magic over a floating citadel;
- a Drow Warlock beneath an eldritch eclipse;
- a psionic Mystic in an astral/floating-city environment;
- a dwarven Monster Hunter surveying a moonlit monster-haunted valley;
- a mixed-Species Sidekick party composition used by Expert, Warrior, and Spellcaster Sidekick.

These are presentation choices only. They do not imply Species restrictions, Class defaults, or rules changes.

## Fighter accepted state

The original Fighter art repeatedly placed the face too close to the Class divider and visually duplicated Barbarian's pose/eyeline. A temporary CSS `70% 42px` offset was used only while the source art was being replaced.

The approved Fighter painting now builds the spacing into the artwork itself, uses a clearly different pose and direction of gaze, and fixes the earlier weapon/hand issue. Fighter therefore uses the normal cinematic focal contract:

`--npc-forge-class-art-position: 70% center`

Do not restore the obsolete pixel-offset workaround unless the source artwork itself is reverted.

## Wizard accepted state

Wizard remains the reference for bright cinematic scenes:

- one continuous 1600x900 image reaches the Forge border;
- the left side fades strongly toward near-black for title/body readability;
- the fade is transparent, not a separate black panel;
- no blur or `backdrop-filter` is used on the cinematic painting;
- the right-side Wizard remains bright and detailed;
- Wizard's 18 subclass selector images remain wide 456x240 assets filling the 76x40 selector viewport with `object-fit: cover`.

## Ranger replacement

The earlier Ranger cinematic was rejected after an obvious generated anatomy error was found in the Tabaxi hand/paw. A second feline revision was also intentionally superseded when Paul requested a different Species and a more attractive presentation.

The approved Ranger is now the Elf composition in `cinematic-ranger.webp`. It keeps the left reading zone dark, places the subject on the right, preserves clean bow/hand anatomy, and uses the standard `72% center` cinematic focal treatment.

## Paladin and Monster Hunter replacements

The initial Dragonborn Paladin and Orc-like Monster Hunter concepts were not the final approved choices. They were replaced before promotion:

- Paladin now uses the approved celestial/non-human holy-warrior composition.
- Monster Hunter now uses the approved dwarven hunter composition.

Only the final reviewed artwork should be treated as authoritative.

## Sidekick treatment

Supabase currently exposes `expert-sidekick`, `warrior-sidekick`, and `spellcaster-sidekick` as distinct preferred Class keys. All three intentionally share the approved party cinematic because the artwork depicts a mixed adventuring support group rather than pretending each Sidekick track is a full standalone heroic archetype.

The Class rules, progression, identity, and selection remain separate in Supabase; only the presentation background is shared.

## Artwork composition standard going forward

For every additional Class hero or replacement:

1. Author for the wide Forge cinematic ratio, not a square catalogue portrait.
2. Reserve the left side for readable Class copy and controls; dark environmental detail is preferred over a blank opaque panel.
3. Keep the main subject on the right with enough background above the head that the Class divider cannot cross the face during ordinary desktop resizing.
4. Vary pose, eyeline, body type, Species, environment, lighting, and action across Classes. Avoid a row of heroes all staring toward the same distant point.
5. Avoid defaulting to humans while the current roster remains human-heavy; use appropriate playable fantasy Species where the composition benefits from it.
6. Check hands, paws, weapons, bows, instruments, spell effects, and held props for obvious generation defects before promotion.
7. Keep menu/catalogue art separate when a cinematic crop would read poorly at thumbnail size.
8. Promote a hero through `PUBLIC_CINEMATIC_CLASS_HERO_ARTWORK`; do not bypass the resolver from page/component code.
9. Do not commit failed, UI-contaminated, placeholder, or unreviewed generations merely to complete a batch.

## Regression guard

`scripts/validate_class_hero_framing.mjs` is called by the existing Class browser validation workflow and protects the active cinematic roster. It checks that:

- the final Class cinematic stylesheet remains loaded last among the Class framing layers;
- the modal owns the single public cinematic image;
- all promoted public cinematic paths exist and remain wired through the centralized resolver;
- Paladin, Ranger, Sorcerer, Warlock, Mystic, Monster Hunter, and the Sidekick family keep their approved cinematic routes;
- Fighter keeps the final normal center focal treatment;
- Ranger and the other new right-side compositions keep explicit resize-safe positions;
- Wizard keeps its stronger left readability fade;
- nested duplicate/blur layers remain suppressed;
- Wizard subclass artwork keeps its native wide selector treatment;
- protected map/town behavior is not referenced by the Class artwork patch.

## 2026-09-09 remaining-Class publication chain

The approved binary transfer bundle was checksum-verified and dimension-verified at 1600x900. The first bounded transfer exposed an important guard detail: `git diff --name-only` does not report newly created untracked binary files. Ranger was a tracked replacement and therefore appeared in that diff, while Paladin, Sorcerer, Warlock, Mystic, Monster Hunter, and Sidekick were new files and remained untracked. The corrected materializer switched its scope check to `git status --porcelain --untracked-files=all`, then committed exactly those six missing assets. The focused Class regression suite passed before that corrected asset commit was pushed.

Ranger binary replacement:

`68fc7fa4b2fdabaa7c1da10db7b50506b6b02aee` — `Install approved Elf Ranger cinematic artwork`

Resolver promotion:

`0ccac2453759a6e9e682b4bd4b7986dbb72c4c04` — `Promote remaining approved Class cinematic heroes`

Cinematic alignment/framing:

`2fd0c0090538c256e7546813b34425c8d7aae981` — `Align remaining approved Class cinematic heroes`

Regression guard:

`7d038ddae3f45bd39b568b50d4bc109c5aaaf739` — `Guard remaining approved Class cinematic heroes`

Remaining six binary assets:

`68813a1c0cb898035df472b7f24a6edcdba1b549` — `Install remaining approved Class cinematic assets`

## Protected boundaries

This work is presentation-only.

- No Class selection or persistence authority changed.
- No subclass/progression mechanics changed.
- No Supabase data write or migration is required.
- No world-map code was touched.
- No town/city-map behavior was touched.
- No crafting, travel, encounter, inventory, merchant, tactical, or character-sheet runtime behavior is part of this artwork batch.
- Existing Player Forge window portal/drag/resize behavior remains separate from this artwork work.
