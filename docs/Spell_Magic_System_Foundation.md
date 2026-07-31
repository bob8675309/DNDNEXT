# Spell / Magic System Foundation

Updated: 2026-07-30

This is the source-controlled foundation for spells and magic. It does not add build-time source mutation and does not write spell data to Supabase automatically.

## Source data

The 5etools spell source folder is expected locally at a path like:

```text
C:\Users\<you>\Dropbox\Public\Dndnext\5etools-src-2.32.0\data\spells
```

The importer reads:

```text
data\spells\index.json
data\spells\sources.json
data\spells\spells-*.json
data\class\class-*.json
```

`data\spells\sources.json` is the authoritative spell-to-class/subclass access lookup. The sibling `data\class\class-*.json` files provide spellcasting ability, caster progression, cantrip progression, spells-known/prepared metadata, spell-slot progression, and the character levels at which each spell level unlocks.

Use only data you are licensed/allowed to use for your campaign/site.

## Tables

Migration:

```text
sql/20260706_01_spell_catalog_foundation.sql
```

Creates:

```text
spells_catalog
spell_effects
character_spells
```

### `spells_catalog`

Master spell definitions. One row per spell/source version. It stores normalized card/search fields and preserves the original source entry in `raw_payload`.

Important fields:

```text
spell_key
name
source
level
school
classes
subclasses
ritual
concentration
casting_time
range_text
area_type / area_size / area_unit
components_v / components_s / components_m / material_text
duration_text
saving_throw_abilities
attack_type
damage_dice / damage_types / healing_dice
scaling_text
description
higher_level_text
tags
raw_payload
```

### `spell_effects`

Reusable normalized effects for automation and cross-system use.

This is where spells can later become enchant effects, potion effects, scroll effects, monster abilities, hazards, or item-granted spell powers.

### `character_spells`

Per-character spell access.

Supports players, NPCs, and monsters through `character_id`, with source labels for class, item, feat, monster grant, admin grant, scroll, potion, enchant, etc.

## Controlled import path

SQL function:

```text
public.import_spell_preview_batch(p_payload jsonb)
```

The function is admin-only, accepts the preview JSON shape produced by the local importer, upserts `spells_catalog`, replaces matching `spell_effects`, and caps one reviewed import at 250 spells / 750 effects.

Browser UI:

```text
/admin/spells
```

The Magic admin page loads existing spells, previews spell cards, and imports reviewed JSON batches through the RPC above.

## Preview and batch importer

Script:

```text
scripts/import_5etools_spells.mjs
```

This importer is deliberately preview/batch-file only. It does not write to Supabase and rejects `--apply`. All writes go through the admin Magic page controlled import.

The importer now merges class access from `sources.json` and parses class progression from the sibling `data\class` directory. Generated payloads include normalized spell rows/effects plus a `class_progressions` review section.

Dry-run preview, limited to 10 PHB spells:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Dropbox\Public\Dndnext\5etools-src-2.32.0\data\spells" --source PHB --limit 10
```

Write one preview JSON for inspection/import:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Dropbox\Public\Dndnext\5etools-src-2.32.0\data\spells" --source PHB --limit 10 --preview-json spell-preview.json
```

Use `--offset` to create later slices:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Dropbox\Public\Dndnext\5etools-src-2.32.0\data\spells" --source PHB --offset 10 --limit 50 --preview-json spell-preview-phb-002.json
```

Generate reviewed-import batch files for a source. Each batch respects the 250-spell controlled-import cap:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Dropbox\Public\Dndnext\5etools-src-2.32.0\data\spells" --source PHB --out-dir spell-batches --chunk-size 250
```

Generated files are named like:

```text
spell-batches\spell-preview-phb-001.json
spell-batches\spell-preview-phb-002.json
```

Rows missing class metadata should be selectively re-imported from newly generated, reviewed batches. Do not replace the populated catalog wholesale. The upsert updates `classes` and `subclasses`; it does not create duplicate spell/source rows.

Do not commit generated preview or batch JSON files.

## Normalizer and metadata parser

Utilities:

```text
utils/spells/normalize5etoolsSpell.js
scripts/lib/5etoolsSpellMetadata.mjs
utils/spells/classSpellbookRules.js
public/spells/class-progression.json
```

Responsibilities:

- Converts 5etools tag strings into readable text.
- Flattens entries and higher-level entries.
- Formats casting time, range, components, and duration.
- Maps school codes to full school names.
- Merges base and variant class access from `sources.json`.
- Extracts subclass access when present.
- Parses class casting ability, cantrip progression, spell-slot progression, spells-known/prepared metadata, and spell-level unlocks.
- Extracts obvious save, damage, healing, area, and tag fields.
- Preserves the raw source payload for future refinements.

## Spell card component

Component:

```text
components/SpellCard.js
styles/spell-card.css
```

The component is intentionally separate from item cards. It is visually compatible with item cards but uses spell-first fields:

```text
Level + School
Casting Time
Range
Components
Duration
Concentration / Ritual badges
Save / Attack
Damage / Area
Description
At Higher Levels
Classes / Source
```

## Profile-panel spellbook

Components:

```text
components/character/CharacterInteractionPanel.js
components/CharacterSpellbookPanel.js
```

The shared character profile panel now includes a `Spellbook` tab for player characters, NPCs, and merchants.

Player-facing behavior:

```text
View assigned/known spells
View prepared and always-available status
Open the full spell card inside the profile panel
See class, character level, casting ability, and highest unlocked spell level
```

Admin behavior in the same tab:

```text
Add spells from the character's class spell list
Filter the catalog by the character's class and character level
Mark assigned spells prepared
Remove an assignment
Grant from the full catalog only when the sheet has no recognized spellcasting class
```

The old standalone `/admin/spellbooks` page and Spellbooks navbar button were removed. Spell assignment belongs to the character being edited.

If the catalog rows do not yet contain class metadata, the panel shows a warning and disables class-filtered assignment rather than presenting an incorrect list. Existing assigned spells remain visible.

## Current admin Spell Catalog behavior

Route:

```text
/admin/spells
```

Current features:

```text
Search
Filter by level
Filter by school
Filter by source
Sort by level/name/school/source/damage/save/concentration
Compact spell card preview
Controlled reviewed-batch import
```

## Next recommended steps

Current live checkpoint: 936 spell rows, with 16 rows still missing class metadata. Seventeen reviewed character-spell assignments exist. Tactical casting has authoritative encounter-local spell-slot snapshots and reviewed adapters through Lightning Bolt; see the tactical phase ledgers for exact supported mechanics.

1. Repair only the remaining metadata gaps with reviewed batches.
2. Review parsing quality across PHB, XGE, TCE, and XPHB.
3. Add durable campaign rest/recovery reconciliation without weakening encounter-local slot authority.
4. Expand subclass-specific access and multiclass progression.
5. Connect normalized effects to enchantment, potion, scroll, monster-action, and hazard adapters through explicit reviewed contracts.
