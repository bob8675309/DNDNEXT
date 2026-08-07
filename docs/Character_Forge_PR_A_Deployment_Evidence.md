# Character Forge PR A Deployment Evidence

Status date: 2026-08-07

This document records the current implementation and acceptance evidence for PR #170, **Refine Character Forge resilience, presentation, spells, and player authority**. Read it with `Unified_Character_Forge_Status.md`.

## Implemented boundary

PR #170 consolidates player creation into the shared Forge and adds draft resilience, responsive layouts, raster-only portraits, class/subclass guidance, ability generation, Training choices, starting spells, Review dossier presentation, profile scrolling, and player feat/spell authority.

The class-readability pass:

- preserves imported paragraph breaks and source headings;
- removes redundant `1st-level ... feature` boilerplate already represented by the level header;
- removes isolated internal ability-code artifacts such as `int`;
- deduplicates repeated adjacent text blocks;
- presents long item/plan lists as multi-column lists;
- folds exceptionally long lists behind an explicit **View N listed options** control while retaining every listed rule entry;
- applies the same structured rendering to the detailed guide and left feature-description dock;
- removes the Primary Abilities tile from the Forge class hero.

The creation-choice semantic pass adds a stricter distinction between a feature that contains options and a choice that belongs in character creation:

- source `options` nodes no longer become Forge choices merely because they contain a `count` field;
- permanent acquisition choices remain in the Class step;
- Expertise and Wizard Scholar are persistent acquisition choices but are routed to **Training**, after skill proficiency is established;
- Weapon Mastery is no longer locked at character creation because the source feature allows weapon choices to be changed after a Long Rest;
- Circle of the Land terrain, Primal Companion form, Dread Allegiance, Fiendish Resilience, and comparable rest-reconfigurable selections are treated as runtime/rest choices rather than permanent creator state;
- Steps of the Fey and Tinker's Magic style per-use selections remain feature instructions rather than creation fields;
- Spellcasting is informational and remains reference text; ordinary class spell selection remains owned by the Spells step;
- small single-option groups use compact selectors with an expandable selected-option detail instead of a grid of large cards;
- large or nested choice families such as Invocations, Maneuvers, Metamagic, Magic Item Plans, and spell-backed choices retain searchable expandable catalogues.

The rule model now carries both **cadence** (`creation`, `long-rest`, `short-rest`, `per-use`, `informational`) and **placement** (`class`, `training`) so UI location is not confused with persistence semantics.

## Database evidence

Production migrations for controlled tags, subclass choice, starting-spell validation, player feat/spell authority, source-choice validation, and nested-choice validation are active. The most recent authority migration was rollback-tested before production application. An authenticated-player mutation test against an owned character was blocked as intended, and authoritative row counts remained unchanged.

The cadence/placement pass requires no new database migration. Existing deferred nested-choice validation still validates every serialized persistent class-feature group; removing runtime-only groups is legal because the server validates submitted persistent groups rather than requiring those runtime features to exist as creation choices.

## Validation requirements

The exact final PR head must pass:

- `Validate NPC Forge foundation`;
- `Validate character portrait authority`;
- `Validate Character Forge nested choices`;
- Character Forge resilience and player-authority validators;
- source/model/security regression suites;
- exact `npm run build:vercel`;
- Next.js production compilation and static generation;
- Vercel preview deployment.

The nested-choice regression contract now specifically requires:

- an explicit choice-cadence classifier;
- no unconditional `options + count = creation choice` rule;
- no creation groups for Weapon Mastery, Circle of the Land terrain, Primal Companion form, or Dread Allegiance;
- Training placement for Expertise;
- compact controls for small single-choice groups;
- continued server validation for serialized persistent groups and nested dependencies.

## Protected boundaries

No world-map, town/city-map, route, movement, weather, combat, encounter, or unrelated crafting runtime files belong to this pass.

## Remaining acceptance gate

Do not merge until authenticated browser testing confirms:

- Artificer Spellcasting and Tinker's Magic read as information/instructions rather than false creation choices;
- Weapon Mastery, Circle of the Land terrain, Primal Companion form, Dread Allegiance, Fiendish Resilience, and similar rest choices are absent from permanent Class creation choices;
- Expertise appears on Training and only offers skills in which the character is already proficient;
- Astral Fire remains a persistent Species choice while Astral Trance remains a rest-time feature rather than locked creator state;
- small permanent groups use compact selectors and selected-option details cleanly;
- large permanent catalogues remain searchable and preserve all mechanics;
- no mechanics or option entries are missing from source-backed guide text;
- hover/focus/click still updates the left feature card;
- the class hero contains Hit Die, level, saving throws, and spellcasting but no Primary Abilities tile;
- existing Forge persistence, subclass selection, spell selection, player authority, profile scrolling, and NPC creation remain intact.
