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

Append-only audit history for progression initialization, XP changes, and level-up review transactions.

### `character_level_up_sessions`

A durable, non-destructive review record for a character that reached the next XP threshold.

It stores:

- from/to level
- metadata-readiness state
- required choices and current selections
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
- `cancel_character_level_up_v1(character_id)` cancels the review without changing XP or level.
- `import_class_progression_batch_v1(payload)` imports reviewed source metadata and is admin-gated.
- `xp_threshold_for_level_v1(level)` provides the canonical cumulative XP table.

The underlying progression, event, and review tables are not directly exposed to anonymous or authenticated clients. Writes go through the RPC authorization checks.

## Class-tab workflow

A user with edit permission for the linked character can:

1. Enter a positive whole-number XP award and an optional reason.
2. See the XP progress bar update immediately.
3. Open **Review Level Up** after reaching the next threshold.
4. Inspect the next proficiency bonus, spell progression, class features, and required choices.
5. Cancel the review without changing XP or level.

Admins may also remove XP and correct class, source, level, subclass, or total XP.

Review is intentionally non-destructive. **Apply Level** remains disabled until the 2024 choice engine can validate HP, subclass, feat/ASI, spell, expertise, mastery, and class-specific decisions in one transaction.

## Character-sheet compatibility

`sync_character_progression_from_sheet_v1` watches `character_sheets.sheet` after insert/update. A sheet with `classKey` and `level` receives a canonical progression row automatically. New canonical character-creator sheets default to `XPHB`/2024 unless they explicitly supply another `rulesetSource`.

`set_character_progression_v1` also writes the selected class, source, ruleset, level, proficiency bonus, and hit dice back into the sheet JSON. This keeps the existing sheet and Spellbook filters compatible during the transition.

## Reviewed metadata import

`scripts/import_5etools_spells.mjs` packages `class_progressions` beside spells and effects. The Admin Magic page imports that metadata through `import_class_progression_batch_v1` before importing the spell rows.

The metadata reader captures:

- all classes, including non-spellcasters
- distinct PHB/XPHB/source records
- hit die and saving throws
- casting ability and caster progression
- cantrip, known/prepared, and slot progressions
- class feature references grouped by level
- improved pact-slot counts and slot levels

For the canonical workflow, generate and import an XPHB-reviewed batch. PHB batches may remain for reference, but do not drive normal player creation or leveling.

## Current boundary

The current slice tracks XP and creates a durable level-up review, but it does not advance the level automatically. Reaching the XP threshold sets `pending_level_up`; review remains locked from completion until all required 2024 choices can be validated and applied transactionally.

Player character creation, automatic NPC spell loadouts, and full feature-choice resolution remain the next phases built on this foundation.
