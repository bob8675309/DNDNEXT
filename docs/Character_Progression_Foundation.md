# Character Progression Foundation

Updated: 2026-07-10

## Scope

This foundation adds source-specific class and level progression without changing world-map, town-map, crafting, merchant-stock, or inventory behavior.

The shared character profile now uses this tab order when capabilities are available:

`Profile | Class | Sheet & Rolls | Inventory | Spellbook | Shop | Craft`

The Class tab is implemented by `components/CharacterClassPanel.js` and is hosted by the same `CharacterInteractionPanel` shell used by NPC, merchant, town, and player-facing profile routes.

## Canonical ruleset policy

2024/XPHB is the canonical player-facing ruleset.

- When both PHB and XPHB records exist, the Class picker exposes XPHB.
- A legacy class remains available only when no 2024 equivalent exists, such as a supplemental class that has not received an XPHB record.
- Existing legacy progression is displayed honestly and can be migrated by an admin through the Class tab.
- Character-sheet synchronization defaults missing `rulesetSource` values to `XPHB`.
- Legacy data remains stored for compatibility and source comparison; it is not the normal creation or leveling path.

## Canonical data model

### `class_catalog`

One row per class and source. `Wizard|PHB` and `Wizard|XPHB` are separate records so 2014 and 2024 progression are never silently merged.

Important fields include:

- `class_key`, `class_name`, `source`, `ruleset`, `edition`
- hit die, primary abilities, saving throws
- spellcasting ability and caster progression
- cantrip, spells-known/prepared, slot, unlock, and class-feature metadata

### `class_level_progression`

One row per class source and level 1-20. It stores:

- proficiency bonus
- cumulative XP threshold
- cantrips and spells-known/prepared counts when supplied by source data
- spell or pact slots
- features and required choices

### `character_progression`

The canonical current state for one character:

- class source and subclass
- current level and XP
- pending-level-up flag
- completed level choices

### `character_level_events`

Append-only audit history for character creation, XP changes, review sessions, and completed level-up transactions.

### `character_level_up_sessions`

A durable review record for a character that reached the next XP threshold.

It stores:

- from/to level
- metadata-readiness state
- required choices and submitted selections
- a snapshot of next-level proficiency, spell progression, and class features
- open/cancelled/completed status

Only one open review may exist per character. Reducing XP below the threshold or changing the current level cancels an obsolete open review automatically.

## Controlled RPCs

- `get_character_progression_v1(character_id)` returns the profile-ready progression model.
- `set_character_progression_v1(...)` initializes or corrects progression and is admin-gated.
- `can_manage_character_progression_v1(character_id)` reports whether the signed-in user may change this character's progression.
- `add_character_xp_v1(...)` allows admins or the linked character editor to change XP. Non-admin users cannot remove XP.
- `get_character_level_up_review_v1(character_id)` loads the current open review.
- `begin_character_level_up_v1(character_id)` creates or refreshes a durable review after the XP threshold is reached.
- `complete_character_level_up_v1(character_id, selections)` validates and commits a supported 2024 level in one transaction.
- `cancel_character_level_up_v1(character_id)` cancels the review without changing XP or level.
- `get_my_player_character_v1()` returns the signed-in account's canonical linked player character.
- `create_player_character_v1(payload, spell_choices)` creates and links one level-one 2024 player character atomically.
- `import_class_progression_batch_v1(payload)` imports reviewed source metadata and is admin-gated.
- `xp_threshold_for_level_v1(level)` provides the canonical cumulative XP table.

The underlying progression, event, and review tables are not directly exposed to anonymous or authenticated clients. Writes go through the RPC authorization checks.

## Player character creation

When a signed-in account has no linked character, the global Profile panel opens `PlayerCharacterCreator` instead of a dead-end message.

The creator collects:

1. identity and appearance
2. 2024 species and background
3. 2024 class and class skills
4. base ability scores and background increases
5. legal XPHB starting cantrips and level-one spells
6. a final review before submission

The database validates the class, level, spell source, class spell-list access, exact starting spell counts, and prepared-spell count. It then creates the character, sheet, ownership permission, canonical progression, audit event, and spellbook together. A failure leaves none of those records behind.

The account is limited to one editable character tagged `player-character`. Player characters remain hidden from map systems and are not given movement, route, shop, or crafting side effects by this workflow.

## Class-tab XP and level-up workflow

A user with edit permission for the linked character can:

1. Enter a positive whole-number XP award and an optional reason.
2. See the XP progress bar update immediately.
3. Open **Review Level Up** after reaching the next threshold.
4. Inspect the next proficiency bonus, spell progression, class features, and required choices.
5. Choose fixed or rolled HP.
6. Choose a subclass when the next level requires one.
7. Choose an Ability Score Improvement or supported 2024 general feat.
8. Select the exact number of newly gained XPHB class spells when progression grants them.
9. Apply the level transactionally, or cancel the review without changing anything.

A successful completion updates the canonical level, XP state, HP/max HP, Hit Dice, proficiency bonus, subclass, abilities or feat, character spellbook, sheet JSON, player mirror, level-choice history, review session, and audit event in one database transaction.

Admins may also remove XP and correct class, source, level, subclass, or total XP.

## Safety boundary for class-specific choices

The completion engine does not silently skip a choice it cannot validate. A level remains review-only when its imported features include an unresolved class-specific decision such as Weapon Mastery, Fighting Style, Expertise, Divine Order, Primal Order, Scholar, Primal Knowledge, Metamagic, Eldritch Invocations, Magical Secrets, Epic Boons, Blessed Strikes, or Elemental Fury.

Those levels display the blocking feature names. The character keeps its XP and current level until that choice family receives a proper source-backed selector and validator.

## Character-sheet compatibility

`sync_character_progression_from_sheet_v1` watches `character_sheets.sheet` after insert/update. A sheet with `classKey` and `level` receives a canonical progression row automatically. New canonical character-creator sheets default to `XPHB`/2024 unless they explicitly supply another `rulesetSource`.

The atomic player creator marks its sheet with `creator = player_character_creator_v1`; the compatibility trigger skips that one insert because the creator writes the canonical progression itself in the same transaction.

`set_character_progression_v1` also writes the selected class, source, ruleset, level, proficiency bonus, and Hit Dice back into the sheet JSON. This keeps the existing sheet and Spellbook filters compatible during the transition.

## Reviewed metadata import

`scripts/import_5etools_spells.mjs` packages `class_progressions` beside spells and effects. The Admin Magic page imports that metadata through `import_class_progression_batch_v1` before importing the spell rows.

The metadata reader captures:

- all classes, including non-spellcasters
- distinct PHB/XPHB/source records
- hit die and saving throws
- casting ability and caster progression
- cantrip, prepared/known-spell, and slot progressions
- class feature references grouped by level
- improved pact-slot counts and slot levels

The parser now also derives 2024 `Prepared Spells` or `Spells Known` table columns when those values are not exposed as a direct JSON progression array. Regenerate and re-import the XPHB reviewed batches after this parser change so non-Wizard spellcasters receive exact level-up spell budgets.

For the canonical workflow, generate and import an XPHB-reviewed batch. PHB batches may remain for reference, but do not drive normal player creation or leveling.

## Current boundary

Player creation, starting spell selection, XP tracking, durable reviews, and transactionally supported level-ups are active.

The remaining progression work is to add source-backed selectors and validation for the blocked class-specific choice families listed above, then add automatic class-and-level-appropriate NPC spell loadouts. No level is auto-applied when an unresolved choice remains.
