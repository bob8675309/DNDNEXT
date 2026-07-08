# Spell / Magic System Foundation

This is the first source-only foundation pass for spells and magic. It does not import any spell data by default and does not add any build-time mutation scripts.

## Source data

The 5etools spell source folder is expected locally at a path like:

```text
C:\Users\<you>\Downloads\5etools-src-2.32.0\data\spells
```

The importer reads `index.json`, then follows source files such as `spells-phb.json`, `spells-xge.json`, `spells-tce.json`, and `spells-xphb.json`.

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

Dry-run preview, limited to 10 PHB spells:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Downloads\5etools-src-2.32.0\data\spells" --source PHB --limit 10
```

Write one preview JSON for inspection/import:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Downloads\5etools-src-2.32.0\data\spells" --source PHB --limit 10 --preview-json spell-preview.json
```

Use `--offset` to create later slices:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Downloads\5etools-src-2.32.0\data\spells" --source PHB --offset 10 --limit 50 --preview-json spell-preview-phb-002.json
```

Generate reviewed-import batch files for a source. Each batch respects the 250-spell controlled-import cap:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Downloads\5etools-src-2.32.0\data\spells" --source PHB --out-dir spell-batches --chunk-size 250
```

Generated files are named like:

```text
spell-batches\spell-preview-phb-001.json
spell-batches\spell-preview-phb-002.json
```

Do not commit generated preview or batch JSON files.

## Normalizer

Utility:

```text
utils/spells/normalize5etoolsSpell.js
```

Responsibilities:

- Converts 5etools tag strings into readable text.
- Flattens entries and higher-level entries.
- Formats casting time, range, components, and duration.
- Maps school codes to full school names.
- Extracts classes/subclasses when present.
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

1. Generate and import approved source batches through `/admin/spells`.
2. Review parsing quality on a wider sample across PHB, XGE, TCE, and XPHB.
3. Add character spellbook/prepared-spell assignment UI.
4. Add monster/NPC spell assignment and spell-use display on profile panels.
5. Later: connect `spell_effects` to enchantment, potion, scroll, monster action, and hazard systems.
