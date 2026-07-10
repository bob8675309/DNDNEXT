# Character Progression Foundation

Updated: 2026-07-10

## Scope

This foundation adds source-specific class and level progression without changing world-map, town-map, crafting, merchant-stock, or inventory behavior.

The shared character profile now uses this tab order when capabilities are available:

`Profile | Class | Sheet & Rolls | Inventory | Spellbook | Shop | Craft`

The Class tab is implemented by `components/CharacterClassPanel.js` and is hosted by the same `CharacterInteractionPanel` shell used by NPC, merchant, town, and player-facing profile routes.

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

Append-only audit history for progression initialization, XP changes, and later level-up transactions.

## Controlled RPCs

- `get_character_progression_v1(character_id)` returns the profile-ready progression model.
- `set_character_progression_v1(...)` initializes or corrects progression and is admin-gated.
- `add_character_xp_v1(...)` allows admins or the linked character editor to change XP. Non-admin users cannot remove XP.
- `import_class_progression_batch_v1(payload)` imports reviewed source metadata and is admin-gated.
- `xp_threshold_for_level_v1(level)` provides the canonical cumulative XP table.

The underlying progression/event tables are not directly exposed to anonymous or authenticated clients. Writes go through the RPC authorization checks.

## Character-sheet compatibility

`sync_character_progression_from_sheet_v1` watches `character_sheets.sheet` after insert/update. A sheet with `classKey` and `level` receives a canonical progression row automatically. New canonical character-creator sheets default to `XPHB`/2024 unless they explicitly supply another `rulesetSource`.

`set_character_progression_v1` also writes the selected class, source, ruleset, level, proficiency bonus, and hit dice back into the sheet JSON. This keeps the existing sheet and Spellbook filters compatible during the transition.

## Reviewed metadata import

`scripts/import_5etools_spells.mjs` packages `class_progressions` beside spells and effects. The Admin Magic page imports that metadata through `import_class_progression_batch_v1` before importing the spell rows.

The metadata reader now captures:

- all classes, including non-spellcasters
- distinct PHB/XPHB/source records
- hit die and saving throws
- casting ability and caster progression
- cantrip, known/prepared, and slot progressions
- class feature references grouped by level
- improved pact-slot counts and slot levels

## Current boundary

Phase 1 intentionally does not complete a level-up automatically. Reaching the XP threshold sets `pending_level_up`. A later transactional level-up wizard will review and collect HP, subclass, feat/ASI, spell, expertise, and class-specific choices before advancing the level.

Player character creation, automatic NPC spell loadouts, and full feature-choice resolution are the next phases built on this foundation.
