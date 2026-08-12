# Forge Species Art, Portraits, and Expand/Collapse — Active Handoff

Status date: 2026-08-12
PR: #170 (`agent/character-forge-resilience-presentation`)
Merge status: OPEN / UNMERGED — merge only after explicit user approval
Database authority: migration 93 — `20260812042950 aven_subrace_catalog`
Validated code/art checkpoint: `086128e9617fedf8410943a4c230bc466f2f9d11` — 33/33 PR-triggered workflows green; Vercel successful

## Protected scope

This is Character Forge Species presentation/artwork work only. Do not touch world-map, town/city-map, route/travel/weather, tactical combat, crafting, inventory, merchants, or unrelated runtime systems for this work.

## User-approved Species browser behavior

1. Expandable parent Species show a small chevron/arrow at a glance.
2. Child lists independently expand/collapse.
3. Row click selects the Species; chevron click only toggles the list.
4. Selecting an expandable parent also opens its list.
5. Collapsing a list must not clear the selected lineage/subrace/source child.
6. The parent remains a valid selectable presentation before a child is chosen.
7. Every parent and visible child/sub-species has a concise description.
8. Selecting a child updates the right-side displayed identity, description, mechanics, and portrait as appropriate.
9. Every fixed-appearance parent/child should ultimately have its own dedicated Species portrait/reference artwork.

Final artwork should be newly created DNDNext art in the established realistic full-body Species-reference style. 5etools/source illustrations may guide anatomy, coloration, and distinguishing features, but should not be copied as final artwork.

## Persistence / rules boundary

Parent-persisted families continue to use existing source-choice authority:

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

Goliath Giant Ancestry and Tiefling Fiendish Legacy remain inline trait-level choices. Aasimar transformation remains runtime/per-use.

## Description policy

`utils/speciesLore.js` contains concise source-grounded descriptions for promoted child entries.

Use 5etools/source material to distinguish physical identity and mechanics, but omit campaign-/adventure-specific plot and faction language unless required to explain the Species itself.

`speciesCatalogSummary(...)` shortens catalogue display copy. Do not shorten canonical lore itself just to fit a card.

Existing regression contracts preserve:

- Fairy: `two to three feet tall` and `four gossamer wings`;
- Kithkin: stout legs, long arms, empathic web, and betrayal language.

## Artwork resolver policy

`speciesArtworkFor(...)` remains the stable canonical resolver used outside the Forge.

`speciesPortraitArtworkFor(...)` is the Forge presentation resolver.

Forge priority:

1. committed dedicated generated child file, if one really exists;
2. otherwise the explicit temporary family-image portrait treatment;
3. otherwise canonical Species art/fallback.

Do not call a CSS hue shift/crop or shared parent image final artwork. Temporary portrait treatments are placeholders only.

## Completed dedicated child artwork

### Genasi family — COMPLETE

- `public/media/species/air-genasi.webp`
- `public/media/species/earth-genasi.webp`
- `public/media/species/fire-genasi.webp`
- `public/media/species/water-genasi.webp`

All four Genasi lineages now have dedicated original Forge portrait assets while their canonical non-Forge aliases deliberately remain `genasi.webp`.

The three-file completion batch was committed in:

`086128e9617fedf8410943a4c230bc466f2f9d11` — `Complete dedicated Genasi Forge artwork`

Exact Git blob verification before branch attachment:

- Air: `49d9719a4087fddde9b9d565eaa8b21ed504d7a7`
- Earth: `5505920d2418943f27850e5bd610596076d04c8e`
- Water: `f12ccefdaa4ba8207bed6e8806a4c90ba9e97ef7`
- Fire (earlier recovered asset): `3269a1693ffee9ccd179f76dc0469f4f7ca6bab2`

The validator checks each Genasi file for existence, nontrivial size, RIFF/WEBP headers, Forge-only dedicated resolution, and unchanged canonical source artwork outside the Forge.

### Dragonborn completed

- `public/media/species/gold-dragonborn.webp`

Gold Dragonborn remains the first dedicated Dragonborn child. Canonical non-Forge resolution remains Metallic Dragonborn art.

## Fire Genasi upload incident — resolved

The first Fire Genasi upload was truncated by the GitHub connector and correctly rejected by the focused validator. The bad file was removed rather than weakening the validator.

The recovery established the binary workflow now used for the rest of the art queue:

1. optimize generated artwork to a compact WebP;
2. compute the local Git blob SHA;
3. upload the base64 binary to GitHub object storage;
4. require the returned Git blob SHA to match exactly;
5. only then attach the blob to the branch and add its key to dedicated artwork authority;
6. CI validates the file and resolver boundary.

## Remaining dedicated-art queue

### Dragonborn — next batch

Chromatic:
- Black
- Blue
- Green
- Red
- White

Metallic:
- Brass
- Bronze
- Copper
- Silver

Gem:
- Amethyst
- Crystal
- Emerald
- Sapphire
- Topaz

Gold is already complete.

### Aven
- Hawk-Headed
- Ibis-Headed

### Elf / Gnome
- Drow
- High Elf
- Wood Elf
- Forest Gnome
- Rock Gnome

### Shifter
- Beasthide
- Longtooth
- Swiftstride
- Wildhunt

### Lorwyn / Shadowmoor
- Lorwyn Fairy
- Shadowmoor Fairy
- Lorwyn Kithkin
- Shadowmoor Kithkin

### Setting/source aliases still needing dedicated art
- Dwarf (Kaladesh)
- Goblin (Dankwood)
- Orc (Ixalan)

Existing dedicated Human setting art, Elf Kaladesh/Zendikar art, and Amonkhet Minotaur art should be retained rather than regenerated without a reason.

## Expand/collapse implementation history

`622d8577a03b327aceb01851430db1fd75fd8a51` — introduced independent `expandedSpeciesRows`, visible parent chevrons, row-select/open behavior, chevron-only toggle behavior, parent/child portrait-summary rows, and selected-child right-panel metadata.

`f7ab80059ec9d7e85f989d11e0f40bc16398a6ff` — restored canonical artwork authority outside the Forge after the first presentation pass overloaded `speciesArtworkFor(...)`.

`249a1e1993d8c4b3c74f9d1bc6775e5fc8da294b` — conservative checkpoint that retained Gold Dragonborn and removed the first truncated Fire asset.

`7e69443a13058e2e9399a9c26922b2b82253f898` — promoted the recovered Fire Genasi asset.

`086128e9617fedf8410943a4c230bc466f2f9d11` — completed Air, Earth, and Water; the Genasi dedicated-art family is now complete.

## Validation authority

Focused workflow:

`.github/workflows/validate-forge-source-presentation.yml`

Required validators:

- `scripts/validate_forge_source_presentation.mjs`;
- `scripts/validate_forge_species_catalog_families.mjs`;
- `scripts/validate_forge_species_family_expansion.mjs`;
- `scripts/validate_forge_species_catalog_portraits.mjs`;
- production build gate.

For exact checkpoint `086128e9617fedf8410943a4c230bc466f2f9d11`:

- original structured source presentation passed;
- established Species catalogue family validator passed;
- expanded Species family validator passed;
- Species catalogue portrait/collapse validator passed;
- all four Genasi dedicated WebP integrity + Forge-only resolver assertions passed;
- focused production build passed;
- all 33 PR-triggered workflows completed successfully;
- Vercel deployment succeeded.

Do not weaken older validators to make a new implementation pass.

## Database boundary

No database migration or data write is required for this expand/collapse/description/artwork phase.

Supabase remains through migration 93:

`20260812042950 aven_subrace_catalog`

Re-verified after the completed Genasi artwork batch:

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

No database counts changed during the artwork work.

## Browser re-smoke checklist

After each green art batch, verify:

1. collapsed parent visibly has a chevron;
2. chevron expands/collapses without changing selection;
3. selecting a parent opens the list and shows parent-specific right-panel lore/art;
4. selecting a child changes child identity/lore/mechanics/portrait;
5. collapsing the list does not erase the selected child choice;
6. Air/Earth/Fire/Water Genasi and Gold Dragonborn use their real dedicated files in the Forge;
7. unfinished child art still renders safely through the explicit temporary treatment;
8. setting/source child uses its real Species row/rules rather than modern-parent rules;
9. Goliath/Tiefling remain inline.

## Next steps

1. Start the dedicated Dragonborn batch, using Gold as the established style anchor.
2. Prefer coherent family batches: Chromatic, Metallic, then Gem.
3. Use the verified optimized-WebP + exact Git-blob workflow for every asset.
4. Add a child key to dedicated artwork authority only when its real binary is committed.
5. Run focused workflow + full PR regression matrix after coherent batches.
6. Update this ledger and PR #170 body after green checkpoints.
7. Complete signed-in visual re-smoke.
8. Do not merge PR #170 until the user explicitly approves the merge.
