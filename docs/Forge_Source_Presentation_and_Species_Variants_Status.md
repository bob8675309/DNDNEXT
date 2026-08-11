# Forge Source Presentation and Species Variants — Status

Status date: 2026-08-11
PR: #170 (`agent/character-forge-resilience-presentation`)
Database authority: migration 91 (`genasi_subrace_catalog`) deployed.
Browser status: implementation/build/database accepted; focused signed-in browser re-smoke still required.

## Why this pass exists

The latest Player Character Forge smoke showed a repeated presentation problem rather than isolated bad entries:

- imported Species rules with source tables/lists were being flattened into prose walls;
- Tiefling Fiendish Legacy mixed three legacy packages into one long paragraph plus a weak selector;
- Goliath Giant Ancestry had become identifiable but still repeated all six option rules as one dense block;
- Genasi had only a generic parent row even though its current source family has Air/Earth/Fire/Water variants;
- Dragonborn source families were exposed as separate top-level species rows rather than one ancestry-oriented creation flow;
- the same flattening risk exists in Background and Class source records.

The correction therefore targets source structure generically instead of adding screenshot-specific text patches.

## Source-structure audit

Read-only live catalogue inspection found substantial structured source content:

- Species catalogue: 160 rows before migration 91; 8 source payloads contain tables, 20 contain lists, and 17 contain version structures;
- Background catalogue: 161 rows; 88 source payloads contain tables and all 161 contain list structures somewhere in the payload;
- Class feature catalogue: 2,118 rows; 122 contain source tables, 91 contain source lists, and 187 contain nested named entry blocks.

This is why flattening everything to plain text is not a sustainable renderer.

## Shared structured source renderer

`components/SourceRuleContent.js` is the reusable source-rule renderer for information that is already structured in canonical source payloads.

Supported forms include:

- ordinary paragraphs;
- named rule sections;
- nested entries/insets;
- lists rendered as readable cards;
- tables with captions, column headers, rows, and footnotes.

`ClassFeatureText` accepts exact `entries` in addition to its legacy text fallback. The detailed Class guide preserves `class_feature_catalog.entries` and passes that structured data into the renderer instead of reconstructing tables/lists from flattened prose.

The compact sticky Class detail dock intentionally remains concise so a very large source table cannot make the dock itself taller than the usable scroll area.

## Background structure policy

Background feature presentation now preserves mechanical source structure while maintaining the existing player-facing exclusions.

Mechanical tables/lists that are part of a feature are presented as organized rule rows instead of collapsed text. Tables that are explicitly introduced as random/optional guidance — for example, `roll on this table`, `roll or choose`, or similar flavor generation — are not promoted into required Forge mechanics.

This preserves the earlier Astral Drifter policy: Longevity remains visible, Divine Contact's mechanical feat remains visible, but the optional deity-roll table is not dumped into the creation UI.

Suggested Characteristics remain excluded from the mechanical Forge presentation.

## Species persistent-choice presentation

For structured persistent Species choices, the explanatory feature text no longer repeats the entire table/list and then presents a second selector. The feature keeps its concise rule introduction, while the source-owned selector carries the individual options and their specific mechanics.

The current structured choice families include:

- Draconic Ancestry;
- Elven Lineage;
- Gnomish Lineage;
- Fiendish Legacy;
- Giant Ancestry;
- Shifting;
- Kobold Legacy;
- Animal Enhancement;
- Variable Trait.

This is presentation/routing work only. Runtime-only choices such as Astral Trance remain owned by their established runtime authority.

## Tiefling — Fiendish Legacy

XPHB Fiendish Legacy is presented as three coherent legacy packages rather than one flattened wall:

- Abyssal — Poison resistance; Poison Spray; Ray of Sickness; Hold Person;
- Chthonic — Necrotic resistance; Chill Touch; False Life; Ray of Enfeeblement;
- Infernal — Fire resistance; Fire Bolt; Hellish Rebuke; Darkness.

The selector retains the source table's row-specific mechanics so the player can compare the package before selecting it.

The separate flexible spellcasting ability question is still resolved by the established Forge rule: where the source permits Intelligence, Wisdom, or Charisma and there is no gameplay benefit to intentionally choosing a weaker one, the Forge uses the highest eligible final ability.

## Goliath — Giant Ancestry

Giant Ancestry now uses a structured selector whose options retain both the source name and the individual effect:

- Cloud's Jaunt (Cloud Giant);
- Fire's Burn (Fire Giant);
- Frost's Chill (Frost Giant);
- Hill's Tumble (Hill Giant);
- Stone's Endurance (Stone Giant);
- Storm's Thunder (Storm Giant).

The full six-option rules list is no longer duplicated into a long prose wall above the selector.

## Genasi — parent plus elemental lineage

### Source-pipeline gap

The existing 5etools character-option importer read `races.json.race[]` but did not read `races.json.subrace[]`. As a result, the live MPMM catalogue contained only generic `Genasi`; Air, Earth, Fire, and Water variant records were missing from Supabase.

The importer now resolves and composes `subrace[]` records with their parent species. Imported child rows retain:

- parent species/source;
- variant name;
- inherited parent traits;
- child-specific traits;
- speed/darkvision information;
- resistances;
- additional source spells;
- source-derived-subrace provenance.

Future reviewed source imports therefore reproduce the same model instead of relying on a one-time database patch.

### Migration 91

`sql/20260811_91_genasi_subrace_catalog.sql` additively backfills the four currently missing MPMM rows:

- `species:genasi-air|MPMM`;
- `species:genasi-earth|MPMM`;
- `species:genasi-fire|MPMM`;
- `species:genasi-water|MPMM`.

Rollback QA inserted all four rows inside a transaction and then rolled back; post-rollback residue was zero.

Migration 91 was then deployed as:

- `20260811062025 genasi_subrace_catalog`.

Post-deploy verification confirmed all four rows with their parent/variant identity, movement/resistance data, and source spell metadata.

Production integrity after deployment:

- characters: 7;
- character_sheets: 7;
- character_spells: 30;
- character_progression: 7;
- inventory_items: 18;
- locations: 20;
- map_routes: 4;
- map_route_points: 9;
- Species catalogue: 160 -> 164, exactly the four intended Genasi catalogue rows.

No character, inventory, map, route, encounter, or campaign-state rows were changed by migration 91.

### Player-facing model

When the MPMM Genasi parent and all four child records are available, the Forge exposes one player-facing `Genasi` entry with an `Elemental Lineage` choice:

- Air Genasi;
- Earth Genasi;
- Fire Genasi;
- Water Genasi.

The selected lineage publishes its child-specific rule summary and facts into the Species choice card. Water Genasi movement is explicitly formatted as walking movement plus swimming equal to walking speed rather than coercing the movement object into a numeric value.

Species magic remains owned by the Spells step / existing source-magic authority rather than creating a second spell resolver inside Species.

## Dragonborn — one ancestry-oriented parent flow

The Forge groups the current player-facing Dragonborn family around the XPHB Dragonborn parent.

Standard XPHB ancestries are represented by the ten Draconic Ancestry rows:

- Black — Acid;
- Blue — Lightning;
- Brass — Fire;
- Bronze — Lightning;
- Copper — Acid;
- Gold — Fire;
- Green — Poison;
- Red — Fire;
- Silver — Cold;
- White — Cold.

The five FTD Gem ancestries are added to that creation selector with explicit Gem/source labeling:

- Amethyst — Force;
- Crystal — Radiant;
- Emerald — Psychic;
- Sapphire — Thunder;
- Topaz — Necrotic.

The Gem choices retain their FTD rule-family marker and Gem-specific trait summaries instead of silently treating them as XPHB color rows.

The FTD Chromatic/Gem/Metallic top-level rows are hidden only when the family can be represented under the unified parent. This is a presentation grouping, not permission to blend incompatible source mechanics.

## Validation

A dedicated workflow, `Validate Forge source presentation`, checks:

- Genasi parent + four lineage grouping;
- Water Genasi movement formatting;
- Dragonborn ten XPHB + five explicitly FTD Gem ancestry options;
- Fiendish Legacy three-row package preservation;
- Goliath six-option selector with individual descriptions and no duplicated prose wall;
- Background mechanical tables preserved;
- optional/random Background tables omitted;
- Class source `entries` retained through the detailed guide;
- importer `subrace[]` support;
- migration 91 idempotent markers;
- protected world-map/travel boundaries.

At the pre-documentation code head `dec7a45241bbe471978d0c0607a175b91327844c`:

- 33/33 PR-triggered GitHub workflows completed successfully;
- `Validate Forge source presentation` passed its focused checks and production build;
- `Validate PR170 browser smoke corrections` passed its updated structured-selector contract and production build;
- NPC Forge, nested choices, source magic, Artificer plans, progression, runtime, equipment, portrait, and currency workflows were green.

Vercel's status at this checkpoint is `failure` only because the account hit the Vercel build-rate limit; GitHub's production build gates for the same exact code head succeeded. Do not describe that Vercel marker as an application compilation failure.

Documentation commits move the exact head beyond that checkpoint and must be re-gated before any merge.

## Focused browser re-smoke

The next signed-in Species pass should verify:

1. Tiefling Fiendish Legacy is a coherent three-package selector with each package's resistance/spells grouped together.
2. Goliath Giant Ancestry uses compact option cards/selector detail and no longer repeats all six mechanics as a wall of text.
3. Genasi appears as one parent entry and exposes Air/Earth/Fire/Water Elemental Lineage options; changing the option updates the shown lineage detail immediately.
4. Water Genasi displays its swimming movement correctly.
5. Dragonborn appears as one parent creation entry with the ten standard XPHB ancestries and five clearly labeled FTD Gem choices; selecting a Gem option surfaces its distinct Gem traits rather than generic Dragonborn-only text.
6. Existing species skill/spell routing remains intact: skill choices resolve in Training and species magic resolves in Spells.
7. Continue checking the remaining Species catalogue for malformed source structures; the shared renderer/selector should now catch the same table/list patterns generically.

When the user reaches Background and Class tomorrow, specifically verify source tables/lists are organized rather than flattened and report any source node type the shared renderer still does not handle cleanly.

## Protected boundaries

This pass does not modify or authorize changes to `components/MapPageClient.js`, world-map behavior, town/city-map behavior, route/travel/weather simulation, tactical combat execution, or unrelated crafting/inventory execution.
