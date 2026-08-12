# Forge Species Art, Portraits, and Expand/Collapse — Active Handoff

Status date: 2026-08-12
PR: #170 (`agent/character-forge-resilience-presentation`)
Merge status: OPEN / UNMERGED — merge only after explicit user approval
Database authority: migration 93 — `20260812042950 aven_subrace_catalog`
Protected scope: do not touch world-map, town/city-map, route/travel/weather, tactical combat, crafting, inventory, merchants, or unrelated runtime systems for this work.

## Why this document exists

This is the current handoff ledger for the Species-browser presentation pass that followed `Forge_Species_Family_Submenu_Status.md`.

The user approved the family model, then requested a presentation refinement:

1. expandable Species parents must show a small arrow/chevron at a glance;
2. the child list must be independently expandable/collapsible rather than being permanently tied to selection;
3. parent Species and every visible child/sub-species entry must have its own concise description;
4. selecting a child must update the right-side Species identity/presentation while preserving the established save/rules authority;
5. every fixed-appearance parent/child should ultimately have its own dedicated portrait/reference art;
6. new art should be original DNDNext artwork in the established realistic full-body Species-reference style, using 5etools/source imagery only as appearance guidance;
7. campaign-/adventure-specific lore should be omitted from catalogue descriptions unless it is required to explain the Species itself.

## Approved interaction model

### Parent rows

Expandable parent rows show a chevron even before they are selected.

- row click = select the parent Species;
- selecting an expandable parent also opens its child list;
- chevron click = expand/collapse only and does not change the selected Species;
- chevron keyboard activation supports Enter/Space;
- collapsing the list must not clear an already selected lineage/subrace/source variant.

The parent remains a valid selectable Species/presentation. A family is not forced to preselect a child merely because its list is expanded.

### Parent-persisted family children

Genasi, Dragonborn, Aven, Elf lineage, Gnome lineage, Shifter form, Fairy/Faerie lineage, and Kithkin lineage continue to reuse the existing source-choice authority documented in `Forge_Species_Family_Submenu_Status.md`.

No parallel subrace state, controller field, create payload, or save RPC is allowed.

### Real setting/source children

Human/Dwarf/Elf/Orc/Minotaur/Goblin setting variants remain real Species rows with their own catalogue ID, source, mechanics, source-choice groups, and persisted identity. They are only nested visually under the semantic parent.

## Description policy

`utils/speciesLore.js` now carries concise source-grounded catalogue descriptions for promoted child entries.

The source review uses 5etools/source data to distinguish physical identity and mechanics, while deliberately removing campaign-specific plot/faction language from the catalogue summary.

Examples already covered:

- Air/Earth/Fire/Water Genasi;
- all standard and Gem Dragonborn ancestry labels;
- Hawk-Headed / Ibis-Headed Aven;
- Drow / High Elf / Wood Elf;
- Forest / Rock Gnome;
- four Shifter forms;
- Lorwyn / Shadowmoor Fairy and Kithkin;
- grouped setting/source variants such as Innistrad Human, Kaladesh Dwarf, Ixalan Orc, and Dankwood Goblin.

Do not shorten established canonical player-facing lore phrases merely to make catalogue summaries compact. `speciesCatalogSummary(...)` should truncate the display copy instead.

Two regressions from the first presentation pass were caught by existing tests and restored:

- Fairy must retain the established wording that it is Small, typically `two to three feet tall`, with `four gossamer wings`;
- Kithkin must retain its established physical/empathic identity including stout legs, long arms, the empathic web, and the severity of betrayal within that culture.

## Artwork policy

### Final rule

Every fixed-appearance parent or child entry should ultimately have its own real image file in:

`public/media/species/<normalized-species-name>.webp`

Do not treat CSS hue shifts, crop changes, or shared-family aliases as final artwork for a child Species.

5etools/source illustrations may be used as visual guidance for anatomy, coloration, and distinguishing features, but final DNDNext artwork should be newly generated/original and match the existing realistic full-body Species catalogue framing.

### Transitional resolver

`speciesArtworkFor(...)` remains the stable canonical resolver for non-Forge consumers.

`speciesPortraitArtworkFor(...)` is the Forge presentation resolver.

The Forge resolver uses this priority:

1. a committed dedicated generated variant file, when present;
2. otherwise the temporary explicit family-image presentation treatment;
3. otherwise the canonical Species artwork/fallback.

This lets artwork roll out incrementally without changing unrelated consumers or claiming unfinished aliases are final.

### Current dedicated generated child assets

The first accepted generated-art batch contains:

- `public/media/species/fire-genasi.webp` — original full-body Fire Genasi art extracted from a generated Forge composition;
- `public/media/species/gold-dragonborn.webp` — original full-body Gold Dragonborn art extracted from a generated Forge composition.

These files are not recolors of the existing parent images.

### Remaining generated-art queue

The following child/variant entries still need dedicated original art before this artwork pass is complete:

Genasi:
- Air Genasi
- Earth Genasi
- Water Genasi

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
- Hawk-Headed Aven
- Ibis-Headed Aven

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

Setting/source aliases still awaiting dedicated art:
- Dwarf (Kaladesh)
- Goblin (Dankwood)
- Orc (Ixalan)

Existing dedicated Human setting art, Elf Kaladesh/Zendikar art, and Amonkhet Minotaur art should be retained rather than regenerated without a reason.

## Current code history / exact recovery points

The first expand/collapse + portrait-summary implementation was pushed as:

`622d8577a03b327aceb01851430db1fd75fd8a51` — `Polish expandable Species catalogue portraits`

That implementation correctly introduced independent chevron state and child descriptions, but its first portrait resolver overloaded the canonical artwork function. Existing tests caught this because Water Genasi was expected to remain canonical `/media/species/genasi.webp` outside the Forge.

Compatibility repair:

`f7ab80059ec9d7e85f989d11e0f40bc16398a6ff`

This restored the stable canonical artwork resolver and separated the Forge portrait presentation path.

The same first presentation pass had shortened two established lore overrides. Existing regression tests caught them:

`e661fbf6a6b09a75d44408b37723cddf6fe1cd96` — restored canonical Fairy wording.

`59d91292637dd5202a81443a892b2ddbf6188797` — restored canonical Kithkin wording.

When resuming after a chat handoff, inspect the current PR head rather than assuming `59d912...` is still the branch head. It is the last code checkpoint before the first dedicated generated child-art commit was assembled.

## Validation authority

The focused workflow is:

`.github/workflows/validate-forge-source-presentation.yml`

It includes:

- `scripts/validate_forge_source_presentation.mjs`;
- `scripts/validate_forge_species_catalog_families.mjs`;
- `scripts/validate_forge_species_family_expansion.mjs`;
- `scripts/validate_forge_species_catalog_portraits.mjs`;
- production build gate.

The portrait/collapse validator must prove:

- chevron state is independent from selected state;
- selecting a parent can open its list without making expansion the selection authority;
- parent and child rows expose concise unique descriptions;
- canonical artwork aliases remain stable outside the Forge;
- dedicated generated child image files win in the Forge when present;
- unfinished child entries remain explicit temporary portrait treatments rather than silently pretending to have final art;
- generated asset files exist and are non-placeholder binaries;
- protected map/travel boundaries are untouched.

Do not weaken an older validator to make a new implementation pass. Preserve the established behavior unless the user explicitly changes that behavior.

## Database boundary

No database migration or data write is required for the expand/collapse/description/artwork phase.

Supabase remains through migration 93:

`20260812042950 aven_subrace_catalog`

Last verified counts before this presentation/artwork-only phase:

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

Do not create a migration merely to store Forge presentation art or expand/collapse state.

## Browser re-smoke after each green artwork batch

For at least one family in each batch verify:

1. collapsed parent visibly shows a chevron;
2. chevron expands without changing the Species selection;
3. parent click selects the parent and opens the list;
4. parent right-side description/art remains parent-specific before a child is chosen;
5. child click changes the right-side displayed child identity, lore, facts/traits, and portrait as appropriate;
6. collapsing the child list does not erase the selected child/source choice;
7. dedicated child art uses its real file and is not receiving the old CSS hue/crop treatment;
8. an unfinished child still renders safely with its explicit temporary family-art treatment;
9. setting/source child selects its real Species row/rules rather than inheriting the modern parent rules;
10. Goliath Giant Ancestry and Tiefling Fiendish Legacy remain inline.

## Next steps

1. Finish the dedicated generated artwork queue in coherent family batches.
2. For every committed image, add the key to the dedicated-variant artwork authority and extend the portrait validator.
3. Remove temporary CSS portrait treatments as each corresponding family reaches complete dedicated-art coverage.
4. Keep source descriptions grounded and non-campaign-specific; do not replace mechanics with flavor summaries.
5. Run the focused source-presentation workflow and the full PR regression matrix after coherent code/art batches.
6. Update this ledger and the PR #170 body after the final artwork batch is green.
7. Complete signed-in visual re-smoke.
8. Do not merge PR #170 until the user explicitly approves the merge.
