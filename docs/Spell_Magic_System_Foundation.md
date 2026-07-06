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

Supports players, NPCs, and monsters through `character_id`, with source labels for class, item, feat, monster, admin grant, scroll, potion, enchant, etc.

## Import script

Script:

```text
scripts/import_5etools_spells.mjs
```

Dry-run preview, limited to 10 PHB spells:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Downloads\5etools-src-2.32.0\data\spells" --source PHB --limit 10
```

Write a preview JSON for inspection:

```bat
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Downloads\5etools-src-2.32.0\data\spells" --source PHB --limit 10 --preview-json spell-preview.json
```

Actual Supabase apply requires a service key and should only be run after reviewing the preview:

```bat
set SUPABASE_URL=<your project url>
set SUPABASE_SERVICE_ROLE_KEY=<your service role key>
node scripts\import_5etools_spells.mjs "C:\Users\pcwil\Downloads\5etools-src-2.32.0\data\spells" --source PHB --apply
```

Dry-run is the default. `--apply` is required to write.

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

The CSS is not globally imported yet. Import `styles/spell-card.css` when the first spell page/panel is wired in.

## Next recommended steps

1. Apply the SQL migration to Supabase after review.
2. Run a dry-run preview for `PHB --limit 10`.
3. Review the normalized preview and spell-card layout against a few known spells.
4. Add an admin Spell Catalog page or tab with search/filter and the spell card preview.
5. Import only the approved source set.
6. Add character spellbook/prepared-spell assignment UI.
7. Later: connect `spell_effects` to enchantment, potion, scroll, monster action, and hazard systems.
