# Forge Species Art, Portraits, and Expand/Collapse — Active Handoff

Status date: 2026-08-12
PR: #170 (`agent/character-forge-resilience-presentation`)
Merge status: OPEN / UNMERGED — merge only after explicit user approval
Database authority: migration 93 — `20260812042950 aven_subrace_catalog`
Validated code/art checkpoint: `249a1e1993d8c4b3c74f9d1bc6775e5fc8da294b` — 33/33 PR-triggered workflows green

## Protected scope

This is Character Forge Species presentation work only. Do not touch world-map, town/city-map, route/travel/weather, tactical combat, crafting, inventory, merchants, or unrelated runtime systems for this work.

## User-approved Species browser behavior

The user approved the family model, then requested the following presentation refinement:

1. expandable parent Species must show a small chevron/arrow at a glance;
2. the child list must independently expand/collapse;
3. row click selects the Species; chevron click only toggles the list;
4. selecting an expandable parent also opens its list;
5. collapsing a list must not clear the selected lineage/subrace/source child;
6. the parent remains a valid selectable presentation before a child is chosen;
7. every parent and visible child/sub-species should have its own concise description;
8. selecting a child should update the right-side displayed identity, description, mechanics, and portrait as appropriate;
9. every fixed-appearance parent/child should ultimately have its own dedicated Species portrait/reference artwork.

The final artwork should be newly created DNDNext art in the established realistic full-body Species-reference style. 5etools/source illustrations may be used as visual guidance for anatomy, coloration, and distinguishing features, but should not be copied as the final artwork.

## Persistence / rules boundary

Parent-persisted families continue to use the existing source-choice authority:

- Genasi — Air, Earth, Fire, Water;
- Dragonborn — ten XPHB ancestries plus explicit FTD Gem ancestries;
- Aven — Hawk-Headed / Ibis-Headed;
- Elf — Drow / High Elf / Wood Elf;
- Gnome — Forest / Rock;
- Shifter — Beasthide / Longtooth / Swiftstride / Wildhunt;
- Fairy/Faerie — Lorwyn / Shadowmoor;
- Kithkin — Lorwyn / Shadowmoor.

Do not add parallel subrace state, a new controller field, or a new save payload for these choices.

Setting/source variants nested under Human/Dwarf/Elf/Orc/Minotaur/Goblin remain real Species rows with their own ID, source, mechanics, source-choice groups, and persisted identity. They are nested visually only.

Goliath Giant Ancestry and Tiefling Fiendish Legacy remain inline trait-level choices. Aasimar's transformation choice remains runtime/per-use.

## Description policy

`utils/speciesLore.js` contains concise source-grounded descriptions for promoted child entries.

Use 5etools/source material to distinguish physical identity and mechanics, but omit campaign-/adventure-specific plot and faction language unless it is required to explain the Species itself.

`speciesCatalogSummary(...)` should shorten catalogue display copy. Do not shorten canonical lore itself just to fit a card.

Existing tests caught and restored two canonical player-facing phrases that the first cleanup accidentally shortened:

- Fairy must retain `two to three feet tall` and `four gossamer wings`;
- Kithkin must retain its distinctive stout legs, long arms, empathic web, and betrayal language.

Recovery commits for those corrections:

- `e661fbf6a6b09a75d44408b37723cddf6fe1cd96` — Fairy wording restored;
- `59d91292637dd5202a81443a892b2ddbf6188797` — Kithkin wording restored.

## Artwork resolver policy

`speciesArtworkFor(...)` remains the stable canonical resolver used outside the Forge.

`speciesPortraitArtworkFor(...)` is the Forge presentation resolver.

Forge priority:

1. committed dedicated generated child file, if one really exists;
2. otherwise the explicit temporary family-image portrait treatment;
3. otherwise canonical Species art/fallback.

Do not call a CSS hue shift/crop or a shared parent image "final artwork." Temporary portrait treatments are only placeholders while the dedicated generated-art queue is completed.

## Current generated-art status

### Successfully committed dedicated child artwork

- `public/media/species/gold-dragonborn.webp`

Gold Dragonborn is the first dedicated child file that successfully survived the GitHub binary upload and is wired through the Forge-specific dedicated-variant resolver.

### Fire Genasi binary-upload incident

An original full-body Fire Genasi illustration was generated and extracted locally, but the GitHub connector truncated the binary payload during upload. The focused validator correctly rejected the truncated file.

Do **not** treat Fire Genasi as completed artwork yet.

The corrupt/truncated `public/media/species/fire-genasi.webp` was removed from the branch in `249a1e1993d8c4b3c74f9d1bc6775e5fc8da294b`, and Fire Genasi now uses the explicit temporary Genasi-family portrait treatment until a reliable complete binary can be committed.

Do not weaken the file-size/art validator to accept a truncated image.

## Remaining dedicated-art queue

Genasi:
- Air
- Earth
- Fire
- Water

Dragonborn:
- Black
- Blue
- Green
- Red
- White
- Brass
- Bronze
- Copper
- Silver
- Amethyst Gem
- Crystal Gem
- Emerald Gem
- Sapphire Gem
- Topaz Gem

Aven:
- Hawk-Headed
- Ibis-Headed

Elf/Gnome:
- Drow
- High Elf
- Wood Elf
- Forest Gnome
- Rock Gnome

Shifter:
- Beasthide
- Longtooth
- Swiftstride
- Wildhunt

Lorwyn/Shadowmoor:
- Lorwyn Fairy
- Shadowmoor Fairy
- Lorwyn Kithkin
- Shadowmoor Kithkin

Setting/source aliases still needing dedicated art:
- Dwarf (Kaladesh)
- Goblin (Dankwood)
- Orc (Ixalan)

Existing dedicated Human setting art, Elf Kaladesh/Zendikar art, and Amonkhet Minotaur art should be retained rather than regenerated without a reason.

## Expand/collapse implementation history

First implementation:

`622d8577a03b327aceb01851430db1fd75fd8a51` — `Polish expandable Species catalogue portraits`

It introduced:

- independent `expandedSpeciesRows` state;
- parent chevrons visible independently of selection;
- row click selects and opens;
- chevron click toggles without selecting;
- parent/child thumbnail + concise description rows;
- selected-child presentation metadata for the right panel.

That first pass incorrectly overloaded the canonical artwork resolver. Existing tests caught Water Genasi changing away from canonical `/media/species/genasi.webp` outside the Forge.

Compatibility repair:

`f7ab80059ec9d7e85f989d11e0f40bc16398a6ff`

This restored canonical artwork authority and separated the Forge portrait path.

The first dedicated-art tree started at:

`a6fe9843ee4f5b5bb085ef6d4ff1d088d5032c59`

The first binary repair attempt was:

`f25fb004c7df6ccc011fd0018ac6a04f328628f2`

The corrected validated checkpoint is:

`249a1e1993d8c4b3c74f9d1bc6775e5fc8da294b` — `Keep unfinished Species art explicit`

That checkpoint keeps Gold Dragonborn as the only newly dedicated child file, removes the truncated Fire Genasi file, and leaves unfinished child art explicitly on the temporary family-art treatment.

## Validation authority

Focused workflow:

`.github/workflows/validate-forge-source-presentation.yml`

Required validators:

- `scripts/validate_forge_source_presentation.mjs`;
- `scripts/validate_forge_species_catalog_families.mjs`;
- `scripts/validate_forge_species_family_expansion.mjs`;
- `scripts/validate_forge_species_catalog_portraits.mjs`;
- production build gate.

For exact checkpoint `249a1e1993d8c4b3c74f9d1bc6775e5fc8da294b`:

- original structured source presentation passed;
- established Species catalogue family validator passed;
- expanded Species family validator passed;
- Species catalogue portrait/collapse validator passed;
- focused production build passed;
- all 33 PR-triggered workflows completed successfully, including NPC Forge, nested choices, source magic, progression, equipment, portrait, runtime-choice, Artificer, and Primal Companion gates.

The portrait/collapse validator proves:

- expansion state is independent from selected state;
- parent selection can open a list without making expansion the choice authority;
- parent/child entries have meaningful concise descriptions;
- canonical artwork aliases remain stable outside the Forge;
- a dedicated generated child file wins in the Forge only when the file truly exists;
- unfinished variants remain explicit temporary portrait treatments;
- committed generated image files are real/non-placeholder binaries;
- protected map/travel boundaries are untouched.

Do not weaken older validators to make a new implementation pass.

## Database boundary

No database migration or data write is required for this expand/collapse/description/artwork phase.

Supabase remains through migration 93:

`20260812042950 aven_subrace_catalog`

Re-verified after the validated Species presentation checkpoint:

- raw Species: 166
- preferred Species: 102
- characters: 7
- character_sheets: 7
- character_spells: 30
- character_progression: 7
- inventory_items: 18
- locations: 20
- map_routes: 4
- map_route_points: 9

No database counts changed during the chevron/description/artwork work.

## Browser re-smoke checklist

After a green code/art batch, verify:

1. collapsed parent visibly has a chevron;
2. chevron expands/collapses without changing selection;
3. selecting a parent opens the list and shows parent-specific right-panel lore/art;
4. selecting a child changes child identity/lore/mechanics/portrait;
5. collapsing the list does not erase the selected child choice;
6. committed dedicated child art uses its real file and no temporary CSS treatment;
7. unfinished child art still renders safely through the explicit temporary treatment;
8. setting/source child uses its real Species row/rules rather than modern-parent rules;
9. Goliath/Tiefling remain inline.

## Next steps

1. Finish the dedicated generated artwork queue in coherent family batches.
2. Use a reliable binary upload path; verify Git blob/file integrity before calling a child art-complete.
3. For each real committed file, add only that key to the dedicated-variant artwork authority and extend the validator.
4. Remove temporary CSS treatments only when the corresponding dedicated family art is complete.
5. Run focused workflow + full PR regression matrix after coherent batches.
6. Update this ledger and PR #170 body after green checkpoints.
7. Complete signed-in visual re-smoke.
8. Do not merge PR #170 until the user explicitly approves the merge.
