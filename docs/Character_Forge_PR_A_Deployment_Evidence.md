# Character Forge PR A — Deployment Evidence

## Current acceptance state

PR #170 remains **open and unmerged**. Do not treat CI success alone as browser acceptance.

The current branch includes the source-backed Character Forge, player authority hardening, responsive presentation, choice-cadence cleanup, compact class-choice presentation, and the August 7 top-to-bottom audit corrections described below.

## August 7 top-to-bottom audit

The audit rechecked the live Supabase catalogue and authority functions against the Forge from Species through Review instead of relying on screenshots or source shape alone.

### Corrected during the audit

- **Weapon Mastery** remains runtime/rest configuration rather than permanent creation state.
- **Circle of the Land** terrain, **Primal Companion** form, **Fiendish Resilience**, **Dread Allegiance**, **Steps of the Fey**, and similar rest/per-use selections remain outside permanent creator state.
- **Armorer — Armor Model** is no longer serialized as a permanent creation choice because the source allows changing models after a Short or Long Rest.
- **Wizard — Spell Mastery** is no longer serialized as permanent creation state because a mastered spell can be replaced after a Long Rest.
- **Banneret — Knightly Envoy** keeps the permanent Well Spoken skill choice, but the Polyglot language is no longer locked at creation because it can be replaced after a Long Rest.
- **Pact of the Tome** remains a persistent invocation choice, but its Book of Shadows cantrips/rituals are no longer permanent child selections. They are chosen when the book is conjured after a Short or Long Rest.
- The live deferred nested-choice validator was updated by `player_forge_runtime_choice_cadence` so it no longer requires permanent Pact of the Tome child groups. Agonizing Blast, Eldritch Spear, Repelling Blast, and Lessons of the First Ones still require their persistent dependent selections.
- Legacy subclass Fighting Style choices now respect the options actually named by the source feature instead of automatically exposing the entire modern Fighting Style feat catalogue. This is important for compatibility subclasses such as College of Swords.
- Expertise progression now distinguishes the preferred 2024 base-class progression from legacy base-class progressions.
- The Abilities main workspace no longer duplicates the full **Species Bonus** controls. Those controls remain in the right contextual information panel.
- Regression validators were updated to protect the cadence cleanup instead of demanding the old, incorrect UI/state model.

### Verified as already correct

- The player Training pool intentionally shares the class skill allotment with trained crafting professions. `useNpcForgeDerivedModel` subtracts trained professions from the remaining class-skill count, and the controller validates that derived count.
- Class-step completion ignores Training-placement Expertise groups; Training validates them separately; final creation validates all persistent groups.
- Starting spell validation continues to use the canonical spell catalogue and class progression.
- No world-map, town/city-map, route, movement, weather, encounter, combat, or unrelated crafting runtime file was touched by this audit.

## Remaining acceptance blockers found by the audit

The following are now explicitly tracked as blockers rather than being silently treated as complete.

### 1. Species permanent-choice coverage is incomplete

The current Species choice engine is strong for Human Skillful/Versatile and Astral Fire-style cantrip choices, and correctly avoids Astral Trance-style rest-time state. It is not yet a general source-backed Species choice engine.

Live preferred Species data contains additional permanent selections that need structured capture, including examples such as:

- Dragonborn Draconic Ancestry
- Elf lineage and its spellcasting-ability choice
- Gnome lineage and its spellcasting-ability choice
- Tiefling Fiendish Legacy and its spellcasting-ability choice
- Goliath Giant Ancestry
- Shifter Shifting subtype
- Simic Hybrid Animal Enhancement, including the second level-5 selection
- Kobold Legacy and its conditional Craftiness/Draconic Sorcery child choices
- Reborn Strange Endurance resistance and skill
- Custom Lineage feat and Variable Trait
- direct species skill, tool, language, and fixed-innate-magic ability choices across several imported species

These must be modeled without turning runtime choices such as Astral Trance, Astral Knowledge, Eladrin seasonal trance state, breath-weapon shape/effect choices, or other per-use/rest selections into permanent character state.

### 2. Species size selection is not yet fully wired to source constraints

Imported Species metadata already supplies each species' legal size set, and `speciesCharacterSizeOptions()` now normalizes the source size codes as groundwork. The Species selector and Species-step validation still need to consume that source set, auto-lock a single legal size, and require one of the allowed values when the source permits multiple sizes.

### 3. Background tool and language choices are under-modeled

The Background engine already captures fixed skills, source-backed skill choice groups, and background feat selection. It does not yet serialize every source-defined tool/language selection as a required structured choice.

The live preferred Background catalogue contains nine backgrounds with explicit tool-choice structures and at least one explicit language-choice structure in the canonical metadata, with additional imported backgrounds expressing comparable choices in source text. Examples include gaming-set, artisan-tool, musical-instrument, and language selections. A free text Languages field is not a substitute for source-constrained Background choice authority.

### 4. Feats that contain their own permanent choices are currently treated as leaf selections

The Forge can grant a feat from Human Versatile, a Background, or a class feature, but selecting the feat name does not yet open and serialize all required child choices.

This affects important level-1 examples in the live catalogue:

- **Magic Initiate** — spell list, two cantrips, one level-1 spell from the same list, and Intelligence/Wisdom/Charisma spellcasting ability
- **Crafter** — three different Artisan's Tools
- **Musician** — three Musical Instruments
- **Skilled** — any combination of three skills or tools
- Fighting Style feats such as **Blessed Warrior** and **Druidic Warrior** — two class-list cantrips

The correct fix is a reusable nested feat-choice model with server validation, not one-off UI fields on Human, Background, or Class.

### 5. Artificer wildcard Magic Item Plans need a deeper nested-selection model

The presentation problem from the earlier screenshots is fixed: the giant Replicate Magic Item table is no longer dumped into the choice UI and future-level plan rows are filtered.

However, EFA also contains wildcard plan rows such as a qualifying common/uncommon/rare item category whose footnote allows that plan to be learned multiple times by selecting a different concrete item each time. Treating the wildcard row itself as a complete plan does not fully model that source rule. This needs a nested concrete-item selection and matching authority validation before Replicate Magic Item can be considered exhaustive.

### 6. Review placement should follow choice ownership

The serialized class-feature choice summary already records `placement`. The Review screen currently lists all class-feature choices under Class Progression, including Training-owned Expertise. Review should display `placement: class` choices under Class Progression and `placement: training` choices under Training & Professions.

## Database authority

Production migrations currently include the existing Character Forge authority stack plus:

- `player_forge_runtime_choice_cadence`

The live `private.validate_player_forge_nested_choice_payload_v1()` function now requires persistent children for:

- Agonizing Blast
- Eldritch Spear
- Repelling Blast
- Lessons of the First Ones

It deliberately does **not** require Pact of the Tome cantrip/ritual children because those are reselected when the Book of Shadows is conjured after a rest.

The audit also ran Supabase security and performance advisors after the function migration. Existing project-wide advisory items remain, including older RLS/performance and index findings outside the Character Forge patch boundary. No map/combat/crafting advisory was changed as part of this Forge audit.

## Validation status

The last code head before the documentation-only blocker update passed:

- Validate NPC Forge foundation
- Validate character portrait authority
- Validate Character Forge nested choices
- exact Vercel production build

Automated checks are regression guards, not substitutes for the remaining Species, Background, nested-feat, and Artificer semantic work above.

## Protected boundaries

- no world-map files or behavior changed
- no town/city-map files or behavior changed
- no route, movement, weather, encounter, combat, or unrelated crafting runtime behavior changed
- `components/MapPageClient.js` remains untouched

## Browser acceptance gate

Do not merge PR #170 and do not ask for final authenticated browser acceptance until the remaining source-choice blockers above are resolved. Once they are addressed, browser review should confirm Species, Background, nested feat choices, Training placement, class presentation, draft persistence, starting spells, Review output, and final character sheet persistence.
