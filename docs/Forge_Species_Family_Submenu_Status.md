# Forge Species Family Submenus — Status

Status date: 2026-08-11/12
PR: #170 (`agent/character-forge-resilience-presentation`)
Validated code head: `d2b64bd1128a0457393283a463fddd71cc7c9094`
Database authority: `20260812042950 aven_subrace_catalog` (migration 93)
Merge status: open/unmerged; merge only after explicit user approval

## Purpose

The Species browser review established that the Forge needs to distinguish three different concepts:

1. a persistent lineage/subrace/family choice that substantially changes one Species presentation;
2. a full alternate Species row from another setting/source that should be visually grouped under a familiar parent without losing its own rules identity;
3. a narrower trait-level choice that belongs inside the Species feature panel.

The current implementation supports all three without creating a parallel Forge state system.

## Parent-persisted family choices

These choices are shown as indented child rows under the selected parent Species and write through existing source-choice authority.

### Genasi — MPMM

`Genasi` exposes `Elemental Lineage` with Air, Earth, Fire, and Water. The Genasi parent Species remains the persisted identity while the selected lineage projects its own movement and traits into the right information panel. Water retains swimming movement. Species-granted magic remains owned by the Spells step.

Migration 92, `20260812033649 genasi_source_detail_restore`, restored source details that had been over-condensed in the original import, including material-component exceptions, alternate spell-slot casting, complete spell cadence, and source spellcasting-ability information.

### Dragonborn — XPHB + explicit FTD Gem options

`Dragonborn` exposes `Draconic Ancestry` with ten standard XPHB ancestries plus five explicitly labeled FTD Gem ancestries.

Standard ancestries retain the ordinary XPHB Dragonborn rules projection. FTD Gem selections project the FTD Gem family rules, including `Psionic Mind`, `Gem Flight`, and the Gem resistance/breath package, without leaking incompatible XPHB-only presentation. Canonical source-choice labels remain unchanged even when richer catalogue-facing child names are shown.

### Aven — PSA

`Aven` exposes `Aven Subrace` with:

- Hawk-Headed;
- Ibis-Headed.

The live catalogue originally contained only the PSA Aven parent. Migration 93, `20260812042950 aven_subrace_catalog`, restored the two reviewed source-derived subrace rows so the Forge can group them under Aven without hardcoding their mechanics in React.

The two child source rows are internal family records; the Forge presents one Aven parent and persists the parent plus the existing source-choice selection.

## Existing trait choices promoted to the catalogue family UI

These families reuse source choices that already existed in the Species mechanics model. The catalogue UI relocates the relevant choice without changing its serialization key.

### Elf — XPHB

`Elven Lineage` now appears beneath Elf with Drow, High Elf, and Wood Elf. The existing `lineage` field remains authoritative. The separate Elf spellcasting-ability choice remains present in the right-side source-choice panel rather than being accidentally hidden with the promoted lineage field.

Drow projects its 120-foot Darkvision. Wood Elf projects its 35-foot Speed. The selected lineage retains its level 1, 3, and 5 source benefits.

### Gnome — XPHB

`Gnomish Lineage` now appears beneath Gnome with Forest Gnome and Rock Gnome. It reuses the existing `lineage` source field; no second Gnome lineage state was introduced.

### Shifter — MPMM

`Shifting Form` now appears beneath Shifter with Beasthide, Longtooth, Swiftstride, and Wildhunt. It reuses the existing `shifting` field.

### Fairy / Faerie — LFL

`Faerie Lineage` now presents Lorwyn and Shadowmoor as family choices. The source parser did not previously create a dedicated lineage field for this source structure, so the existing standalone Species-variant source-choice bridge is used. Shadowmoor projects the source-specific 120-foot Darkvision; the neutral parent does not preselect that benefit.

### Kithkin — LFL

`Kithkin Lineage` likewise presents Lorwyn and Shadowmoor through one standalone source-choice family. Shadowmoor projects 120-foot Darkvision; the neutral parent does not silently inherit it before a lineage is selected.

## Setting/source variants folded under a parent

Setting variants are deliberately handled differently from the families above. They remain real catalogue Species rows with their own database ID, source, mechanics, source-choice groups, and save identity. The Forge only nests them visually beneath the semantic parent.

This prevents a setting variant from inheriting the modern parent's required choices or rules by accident.

Current visual groupings:

- Human (XPHB parent)
  - Human (Innistrad) — PSI
  - Human (Ixalan) — PSX
  - Human (Kaladesh) — PSK
  - Human (Zendikar) — PSZ
- Dwarf (XPHB parent)
  - Dwarf (Kaladesh) — PSK
- Elf (XPHB parent)
  - Elf (Kaladesh) — PSK
  - Elf (Zendikar) — PSZ
- Orc (XPHB parent)
  - Orc (Ixalan) — PSX
- Minotaur (MPMM parent)
  - Minotaur (Amonkhet) — PSA
- Goblin (MPMM parent)
  - Goblin (Dankwood) — AWM

Selecting one of these nested setting rows calls the established Species selector with that real child row. The child therefore keeps its own source authority instead of being projected as if it were a 2024 parent choice.

Search aliases allow a nested setting/source child to still lead the player to its parent catalogue group.

## Species intentionally kept independent

Name similarity alone is not sufficient reason to collapse a Species. Distinct rows such as Sea Elf, Astral Elf, Eladrin, Shadar-kai, Duergar, Deep Gnome, and similar independently published Species remain top-level entries unless their source data explicitly models them as a parent variant.

## Inline Species trait choices

### Goliath

`Giant Ancestry` remains inside the Goliath Species feature panel. Its six supernatural boons are trait-level choices within one Goliath rules identity.

### Tiefling

`Fiendish Legacy` remains inside the Tiefling Species feature panel. Abyssal, Chthonic, and Infernal remain coherent trait packages with their resistance and level-granted spells.

### Other non-family choices

Aasimar transformation choices are per-use rather than persistent subtype identity. Custom Lineage, Simic Hybrid adaptations, and similar configurable traits remain inline or in their existing lifecycle-specific authority rather than becoming catalogue children.

## Implementation authority

The family expansion is centralized in `utils/speciesCatalogExpansion.js` and the existing `utils/speciesCatalogFamilyMenu.js` presentation bridge.

Key invariants:

- `NpcForgeSourceChoiceContext` remains the source of truth for parent-persisted family selections;
- existing Elf/Gnome/Shifter field IDs remain unchanged;
- Fairy/Kithkin use the existing standalone Species-variant source-choice bridge;
- setting children remain real Species rows and use the existing `onSelect` / `chooseSpecies` path;
- the right information panel filters only the family field promoted into the left catalogue, preserving sibling source choices;
- `projectSelectedSpeciesVariant` remains part of the established selected-variant projection path;
- no new controller state, save payload, creation RPC, progression authority, or runtime-choice authority was introduced.

No changes were made to world-map behavior, town/city-map behavior, route/travel/weather, tactical combat, crafting, inventory, merchants, or unrelated runtime systems.

## Validation

The focused source-presentation workflow now runs three semantic validators separately before its production build:

- `scripts/validate_forge_source_presentation.mjs`;
- `scripts/validate_forge_species_catalog_families.mjs`;
- `scripts/validate_forge_species_family_expansion.mjs`.

The expanded-family validator proves, among other invariants:

- Elf reuses the existing `lineage` field while retaining its sibling spellcasting-ability choice;
- Gnome reuses its existing lineage field;
- Shifter reuses its existing `shifting` field;
- Fairy and Kithkin create exactly one standalone family source group and do not preselect Shadowmoor Darkvision;
- Aven collapses its two restored source rows under one parent family;
- setting children remain independent real Species rows with their original sources;
- Sea Elf and Astral Elf remain independent;
- Genasi/Dragonborn behavior remains compatible with the previously accepted contract;
- protected map/travel boundaries remain untouched.

For exact code head `d2b64bd1128a0457393283a463fddd71cc7c9094`:

- **33/33 PR-triggered GitHub workflows completed successfully**;
- `Validate Forge source presentation` passed all three semantic validators and its production build gate;
- `Validate PR170 browser smoke corrections` passed its contract and production build;
- NPC Forge, nested choices, source magic, starting equipment/magic, progression, runtime choices, portrait, currency, Artificer, and related regression gates all passed.

## Live database verification

Production is registered through:

- migration 91 — `20260811062025 genasi_subrace_catalog`;
- migration 92 — `20260812033649 genasi_source_detail_restore`;
- migration 93 — `20260812042950 aven_subrace_catalog`.

Migration 93 was transaction-tested with an explicit rollback before deployment. After deployment, both Aven rows were verified with `restored-after-5etools-review` source-audit metadata.

Current production counts:

- raw Species catalogue: 166 rows;
- preferred Species view: 102 rows;
- characters: 7;
- character_sheets: 7;
- character_spells: 30;
- character_progression: 7;
- inventory_items: 18;
- locations: 20;
- map_routes: 4;
- map_route_points: 9.

The only count changes in this pass are the two intended Aven Species rows. Campaign/runtime/map counts are unchanged.

## Focused browser re-smoke

On a deployment containing `d2b64bd...` or a code-identical descendant:

1. Recheck Genasi and Dragonborn parent/child behavior.
2. Select Aven and switch Hawk-Headed / Ibis-Headed; confirm source-specific traits change on the right while Aven remains the parent family.
3. Select Elf and switch Drow / High Elf / Wood Elf; verify Drow Darkvision, Wood Elf Speed, tiered lineage benefits, and the separate spellcasting-ability choice.
4. Select Gnome and switch Forest / Rock.
5. Select Shifter and verify all four forms.
6. Select Fairy and Kithkin; switch Lorwyn / Shadowmoor and confirm Shadowmoor Darkvision only appears after that selection.
7. Open Human and verify its four setting variants appear as nested source rows. Select each representative child and verify its own source/rules drive the panel.
8. Repeat the source-row check for Dwarf (Kaladesh), Elf (Kaladesh/Zendikar), Orc (Ixalan), Minotaur (Amonkhet), and Goblin (Dankwood).
9. Confirm Sea Elf, Astral Elf, Eladrin, Shadar-kai, Duergar, and Deep Gnome remain independent catalogue Species.
10. Confirm Goliath Giant Ancestry and Tiefling Fiendish Legacy remain inline.

PR #170 remains open and must not be merged until the user explicitly approves the merge.
