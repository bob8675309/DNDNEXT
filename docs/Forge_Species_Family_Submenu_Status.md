# Forge Species Family Submenus — Status

Status date: 2026-08-11
PR: #170 (`agent/character-forge-resilience-presentation`)
Validated code head: `4a7a18b7bb578e88d7a2c6405222061797cf8ac0`
Database authority: `20260811062025 genasi_subrace_catalog` (migration 91)
Database changes for this pass: none
Merge status: open/unmerged; merge only after explicit user approval

## Purpose

The Species browser review showed that not every source-owned Species choice belongs in the same UI pattern.

A choice that substantially changes the species presentation should behave like a Species-family/subspecies selection near the catalogue entry. A narrower trait choice should remain inside the selected Species feature panel.

This pass therefore introduces two distinct presentation classes without changing persistence or rules authority.

## Catalogue-level Species families

### Genasi

Selecting the MPMM `Genasi` parent in the left Species catalogue now reveals a compact `Elemental Lineage` submenu directly beneath that catalogue row.

The submenu uses the existing source-backed choices:

- Air Genasi;
- Earth Genasi;
- Fire Genasi;
- Water Genasi.

The submenu writes through the existing `NpcForgeSourceChoiceContext.setChoice` authority. It does not create a second lineage state and does not replace the persisted Genasi parent Species ID/name/source.

Changing the submenu selection updates the right-hand Species presentation through the established selected-variant projection. Movement and lineage-specific traits therefore follow the selected lineage; Water Genasi continues to show its swimming movement correctly. Species-granted magic remains owned by the Spells step.

### Dragonborn

Selecting the XPHB `Dragonborn` parent in the left Species catalogue now reveals a compact `Draconic Ancestry` submenu.

It retains the existing unified source-backed ancestry set:

- ten XPHB standard ancestries/colors;
- five explicitly labeled FTD Gem ancestries.

The dropdown includes the ancestry's damage affinity for quick comparison. Standard XPHB selections retain XPHB Dragonborn presentation. FTD Gem selections continue to project their Gem-family presentation so `Psionic Mind`, `Gem Flight`, and Gem-family resistance/breath rules can appear without leaving incompatible XPHB-only `Damage Resistance`, `Darkvision`, or `Draconic Flight` presentation behind.

This remains a presentation grouping. The persisted parent Species and existing source-choice key/save authority are unchanged.

## Inline Species trait choices

### Goliath

`Giant Ancestry` remains inside the Goliath Species feature panel. Its six source-owned supernatural boons are trait-level choices rather than a separate Species-family identity, so the existing inline selector is the correct presentation.

### Tiefling

`Fiendish Legacy` remains inside the Tiefling Species feature panel. Abyssal, Chthonic, and Infernal are retained as coherent trait packages with their resistance and level-granted spells; they are not promoted into the left catalogue family submenu.

## Implementation boundary

The code pass adds a catalogue-family helper and a compact submenu to the shared NPC/player Forge catalogue. The right information panel receives a presentation-filtered source-choice context so Genasi/Dragonborn family controls are not duplicated there, while the real source-choice state remains intact for completion validation and serialization.

The established `projectSelectedSpeciesVariant` bridge remains explicit in `NpcForgeContextPanel`. The catalogue-family helper augments that projected result; it does not replace the existing projection authority.

No changes were made to `chooseSpecies`, parent Species persistence, source-choice serialization, SQL/migrations, world-map behavior, town/city-map behavior, route/travel/weather, combat, crafting, inventory, or unrelated runtime systems.

## Validation

A focused validator, `scripts/validate_forge_species_catalog_families.mjs`, proves:

- Genasi and Dragonborn alone use the new catalogue family submenu in this pass;
- the submenu writes through existing `setChoice(group.id, field.id, ...)` state;
- Genasi keeps its parent identity while Water selection projects Water traits and does not leak Air traits;
- Dragonborn keeps all ten XPHB plus five FTD Gem ancestry options;
- standard XPHB ancestry retains XPHB mechanics;
- FTD Gem ancestry projects Gem-family mechanics without XPHB-only trait leakage;
- Goliath Giant Ancestry stays inline;
- Tiefling Fiendish Legacy stays inline;
- protected map/travel boundaries remain untouched.

For code head `4a7a18b7bb578e88d7a2c6405222061797cf8ac0`:

- 33/33 PR-triggered GitHub workflows completed successfully;
- `Validate Forge source presentation` passed the existing source-presentation contract, the new Species-family contract, and its production build gate;
- `Validate PR170 browser smoke corrections` passed its contract and production build;
- Vercel deployment completed successfully.

## Live database verification

No Supabase write was required.

Final read-only verification showed:

- latest migration: `20260811062025 genasi_subrace_catalog`;
- raw Species catalogue: 164 rows;
- preferred Species view: 100 rows;
- characters: 7;
- character_sheets: 7;
- character_spells: 30;
- character_progression: 7;
- inventory_items: 18;
- locations: 20;
- map_routes: 4;
- map_route_points: 9.

## Browser re-smoke

On a deployment containing `4a7a18b7...` or a code-identical descendant:

1. Select Genasi in the left Species catalogue and verify `Elemental Lineage` appears immediately beneath the selected row.
2. Switch Air/Earth/Fire/Water and verify the right-hand Species information changes immediately, including Water swimming movement.
3. Confirm the old large Genasi family selector is no longer duplicated in the right feature stack.
4. Select Dragonborn and verify `Draconic Ancestry` appears beneath the selected row with ten XPHB and five FTD Gem choices.
5. Switch between a standard ancestry and an FTD Gem ancestry and verify the right-hand mechanics follow the appropriate rule family.
6. Confirm the old large Dragonborn ancestry selector is no longer duplicated in the right feature stack.
7. Confirm Goliath Giant Ancestry remains inline in the Goliath feature panel.
8. Confirm Tiefling Fiendish Legacy remains inline in the Tiefling feature panel.

PR #170 remains open and must not be merged until the user explicitly approves the merge.
