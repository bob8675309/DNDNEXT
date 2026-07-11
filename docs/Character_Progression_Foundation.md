# Character Progression and Creation

Updated: 2026-07-11

## Scope

This system provides account-linked player creation, class progression, spellbooks, feats, Epic Boons, XP, and transactional level-ups without changing world-map, town-map, crafting, merchant-stock, travel, or inventory-consumption behavior.

The shared profile tab order is:

`Profile | Class | Features & Boons | Sheet & Rolls | Inventory | Spellbook | Shop | Craft`

## Source policy

All imported source records remain stored. The application displays one preferred record when the same spell, class, feat, boon, background, species, or skill name appears in multiple sources.

Current source priority is:

1. `XPHB` — 2024 Player's Handbook
2. `EFA` — Eberron: Forge of the Artificer
3. `TCE` — Tasha's Cauldron of Everything
4. `PHB` — 2014 Player's Handbook
5. other campaign or supplemental sources

This means a 2024 spell replaces its 2014 presentation when both exist, but a spell found only in a supplemental source remains available. Source-specific rows are not deleted or silently merged.

The canonical views are:

- `spells_catalog_preferred`
- `class_catalog_preferred`
- `character_option_catalog_preferred`

The secure creation and level-up RPCs verify that submitted class and spell IDs are the preferred version before committing them.

## Player character creator

When a signed-in account has no linked player character, the global Profile panel opens `PlayerCharacterCreatorV2`.

The creator collects:

1. identity, appearance, and alignment
2. species and background with descriptions
3. preferred class and class-skill choices with descriptions
4. six ability rolls using 4d6 and dropping the lowest die from each roll
5. allocation of those six totals to Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma
6. background ability increases
7. the Human Versatile Origin feat when applicable
8. one campaign bonus feat at level 1
9. exact class-appropriate starting spells
10. final review and atomic account linking

### Ability generation

Each of the six score rolls records all four d6 results, identifies the dropped die, and totals the other three. Each total can be allocated to only one ability. Selecting a total already assigned to another ability swaps the two assignments rather than duplicating a roll.

Every ability includes an explanation of its common game uses. Final scores and modifiers update after background increases.

### Background increases

Imported backgrounds still display their source-recommended three abilities. This campaign permits the player to assign either `+2/+1` or three `+1` increases among any of the six abilities. This avoids presenting a recommendation as an unexplained hard restriction.

### Feats at level 1

A background's Origin feat is preserved. A Human also selects the extra Origin feat granted by Versatile. The campaign creator then grants one additional Game Master-approved bonus feat at level 1.

The reviewed character-option import supplies the full feat descriptions and prerequisites. A fallback list keeps the creator and admin grant panel usable before that import; imported preferred entries automatically replace the fallback display.

## Atomic player creation

`create_player_character_v1(payload, spell_choices)` validates and creates together:

- character row
- character sheet
- account ownership permission
- preferred class progression
- progression audit event
- starting spellbook
- player profile mirror

A failed validation leaves none of those records behind. An account that already has a linked player character cannot create a second one through this workflow.

Player characters remain hidden from map systems and receive no movement, route, shop, or crafting side effects from creation.

## Spell catalog

`spells_catalog` stores every source version under its source-specific spell key. `spells_catalog_preferred` displays one record per normalized spell name.

The all-source generator is:

```bat
node scripts\import_5etools_spells.mjs "C:\DnD\5etools-src-2.32.0\data\spells" --out-dir spell-batches-all --chunk-size 250
```

Omitting `--source` is intentional. It scans every spell source JSON file. The generated reviewed batches are imported in numeric order through `/admin/spells`.

Character creation and level-up spell selectors query the preferred view. They therefore expose supplemental-only spells while choosing XPHB whenever the same spell also has a 2014 PHB version.

## Character option catalog

`character_option_catalog` stores source-specific records for:

- feats
- Epic Boons
- backgrounds
- species
- skills

Generate reviewed all-source option batches with:

```bat
node scripts\import_5etools_character_options.mjs "C:\DnD\5etools-src-2.32.0\data" --out-dir character-option-batches --chunk-size 500
```

Import the generated files in numeric order through `/admin/character-options`.

The generator reads:

- `feats.json`
- `backgrounds.json`
- `races.json`
- `skills.json`

It never writes directly to Supabase. The admin page validates each reviewed JSON batch and calls `import_character_option_batch_v1`.

## Features & Boons profile tab

The shared profile includes `CharacterFeaturesPanel`.

Players can review:

- creation and level feats stored on their sheet
- Game Master-granted feats
- Game Master-granted Epic Boons
- source, description, prerequisites, and grant notes

Admins can search the preferred catalog, grant a feat or boon, record an optional reason, and remove a prior grant. The controlled RPCs are:

- `get_character_option_grants_v1(character_id)`
- `grant_character_option_v1(character_id, option_id, notes)`
- `remove_character_option_grant_v1(grant_id)`

Grant and removal operations update the durable grant table and the character-sheet/player mirror together. Direct authenticated writes to the grant table are not allowed.

## Canonical progression data

### `class_catalog`

One row per class and source. Source versions remain separate.

### `class_level_progression`

One row per class source and level 1–20, including XP threshold, proficiency bonus, spell progression, slots, features, and imported choice metadata.

### `character_progression`

The current class source, subclass, level, XP, pending-level state, and completed choices for one character.

### `character_level_events`

Append-only audit history for creation, XP changes, review sessions, and completed levels.

### `character_level_up_sessions`

A durable review snapshot. Only one open review may exist per character. An obsolete review is cancelled when XP falls below the threshold or the level changes.

## Level-up workflow

An authorized player or admin can:

1. add XP and a reason
2. open Review Level Up after reaching the next threshold
3. inspect new features and progression
4. choose fixed or rolled HP
5. choose a subclass when required
6. choose an Ability Score Improvement or supported general feat
7. choose exact newly gained preferred-source spells
8. apply the level transactionally or cancel without changes

A successful completion updates level, HP, maximum HP, Hit Dice, proficiency bonus, subclass, ability scores or feat, spellbook, sheet JSON, player mirror, choice history, review state, and audit event together.

## Safety boundary for class-specific choices

A level remains review-only when it contains a class-specific choice the engine cannot yet validate, including Weapon Mastery, Fighting Style, Expertise, Divine Order, Primal Order, Scholar, Primal Knowledge, Metamagic, Eldritch Invocations, Magical Secrets, Epic Boons, Blessed Strikes, or Elemental Fury.

The blocking feature names are shown. XP and the current level remain unchanged until that choice family receives a source-backed selector and validator.

## Current boundary

Active:

- preferred all-source class and spell selection
- descriptive account-linked creation
- 4d6-drop-lowest roll allocation
- flexible campaign background increases
- Human and campaign bonus feat selection
- starting spell validation
- XP and supported transactional level-ups
- admin feat and Epic Boon grants
- reviewed character-option batch generation/import

Remaining progression work:

- import the full all-source spell and character-option batches
- add source-backed selectors for blocked class-specific choices
- add automatic class-and-level-appropriate NPC spell loadouts
