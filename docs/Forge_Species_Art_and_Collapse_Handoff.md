# Forge Species Art, Portraits, and Expand/Collapse — Active Handoff

Status date: 2026-08-12
PR: #170 (`agent/character-forge-resilience-presentation`)
Merge status: OPEN / UNMERGED — merge only after explicit user approval
Database authority: migration 93 — `20260812042950 aven_subrace_catalog`
Validated code/art checkpoint: `2e5031a71f05f8705b64dbbef30aa402dd42c58f` — 33/33 PR-triggered workflows green; Vercel successful

## Read this before writing

ChatGPT can write directly to this repository and to Supabase through the installed connectors. Do not tell the user a separate repo-connected environment is required unless an actual connector write fails.

Controlling write procedure:

- `docs/CHATGPT_REPO_WRITE_PROCEDURE.md`

Preferred coherent GitHub write path:

`create_blob → create_tree → create_commit → race-check → update_ref(force=false) → compare → CI`

For binary artwork, the connector-returned Git blob SHA is authoritative. Never substitute a guessed/local SHA for a GitHub-returned blob SHA.

## Protected scope

This is Character Forge Species presentation/artwork work only. Do not touch world-map, town/city-map, route/travel/weather, tactical combat, crafting, inventory, merchants, or unrelated runtime systems for this work.

## User-approved Species browser behavior

1. Expandable parent Species show a small chevron/arrow at a glance.
2. Child lists independently expand/collapse.
3. Row click selects the Species; chevron click only toggles the list.
4. Selecting an expandable parent also opens its list.
5. Collapsing a list does not clear the selected lineage/subrace/source child.
6. The parent remains a valid selectable presentation before a child is chosen.
7. Every parent and visible child/sub-species has a concise description.
8. Selecting a child updates the right-side displayed identity, description, mechanics, and portrait as appropriate.
9. Every fixed-appearance parent/child should ultimately have its own dedicated Species portrait/reference artwork.

Final artwork is newly created DNDNext art in the established realistic full-body Species-reference style. 5etools/source illustrations may guide anatomy, coloration, and distinguishing features, but are not copied as final artwork.

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

`utils/speciesLore.js` contains concise source-grounded descriptions for promoted child entries. Use source material to distinguish physical identity and mechanics, but omit campaign-/adventure-specific plot and faction language unless required to explain the Species itself.

`speciesCatalogSummary(...)` shortens catalogue display copy. Do not shorten canonical lore itself just to fit a card.

Existing regression contracts preserve Fairy (`two to three feet tall`, `four gossamer wings`) and Kithkin (stout legs, long arms, empathic web, betrayal language) wording.

## Artwork resolver policy

`speciesArtworkFor(...)` remains the stable canonical resolver outside the Forge.

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

All four have dedicated Forge assets while canonical non-Forge aliases deliberately remain `genasi.webp`.

Validated completion checkpoint:

`086128e9617fedf8410943a4c230bc466f2f9d11` — `Complete dedicated Genasi Forge artwork`

### Dragonborn — Chromatic COMPLETE

- `public/media/species/black-dragonborn.webp`
- `public/media/species/blue-dragonborn.webp`
- `public/media/species/green-dragonborn.webp`
- `public/media/species/red-dragonborn.webp`
- `public/media/species/white-dragonborn.webp`

Validated completion checkpoint:

`46306a44e698d907225d54d1e57d5df14656a9b5` — `Complete Chromatic Dragonborn Forge artwork`

Connector-returned Chromatic blob SHAs used by the committed tree:

- Black: `4411ec2f01f407d940d90d57d763df3dccb17f1a`
- Blue: `f26642356e71be8e40a938798160977273440cbc`
- Green: `6d60e0ec5e8db74c4402ab2ad3170e0ab521e0fd`
- Red: `8e171c5c87b28ed7a06bbb9bb696e3ea394c2712`
- White: `5cb50176c5da58cd2c06023ec60156036055eeb4`

Canonical non-Forge Black/Blue/Green/Red/White resolution remains `dragonborn-chromatic.webp`.

### Dragonborn — Metallic COMPLETE

Dedicated files:

- `public/media/species/brass-dragonborn.webp`
- `public/media/species/bronze-dragonborn.webp`
- `public/media/species/copper-dragonborn.webp`
- `public/media/species/gold-dragonborn.webp`
- `public/media/species/silver-dragonborn.webp`

Metallic rollout code/art commit:

`f706f773b807de77fd4239f5454c62efbe07d65b` — `Complete Metallic Dragonborn Forge artwork`

Validator-compatibility descendant and exact validated checkpoint:

`2e5031a71f05f8705b64dbbef30aa402dd42c58f` — `Preserve Chromatic validator after Metallic rollout`

Connector-returned Metallic blob SHAs used by the committed tree:

- Brass: `d3e822a26174b5bd919281a4d018b1ebd7cd1677`
- Bronze: `74926ded21cf8f57c799c37dc414fb288dedfbca`
- Copper: `c422af42d225b73398d79591589b6cb6c853f24c`
- Silver: `a69719f592ab0284b9ad24f680912b24c6bafdb8`

Gold was already dedicated before this batch.

Canonical non-Forge Brass/Bronze/Copper/Gold/Silver resolution remains `dragonborn-metallic.webp`.

## Binary-art safety workflow

The earlier Fire Genasi truncation incident established the mandatory process:

1. generate and crop/optimize a real Species portrait to WebP;
2. upload the base64 binary with `GitHub.create_blob`;
3. use the **connector-returned Git blob SHA** as tree authority;
4. never substitute a guessed/local SHA for a GitHub blob SHA;
5. attach real blobs and resolver changes in one coherent code/art commit;
6. CI verifies file presence, meaningful size, RIFF/WEBP headers, Forge-only dedicated routing, and canonical resolver stability.

During the Metallic pass the first CI run correctly failed because the older Chromatic validator still asserted that Brass was unfinished. That validator was not weakened: all Chromatic checks remain, while the stale Brass expectation was updated to require the new dedicated Brass file. The new Metallic validator owns the full Brass/Bronze/Copper/Silver contract.

## Remaining dedicated-art queue

### Dragonborn — NEXT: Gem

- Amethyst
- Crystal
- Emerald
- Sapphire
- Topaz

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

## Key implementation history

- `622d8577a03b327aceb01851430db1fd75fd8a51` — independent expansion state, visible chevrons, catalogue portraits/summaries.
- `f7ab80059ec9d7e85f989d11e0f40bc16398a6ff` — restored canonical artwork authority outside the Forge.
- `249a1e1993d8c4b3c74f9d1bc6775e5fc8da294b` — conservative binary-recovery checkpoint.
- `7e69443a13058e2e9399a9c26922b2b82253f898` — recovered Fire Genasi.
- `086128e9617fedf8410943a4c230bc466f2f9d11` — completed Genasi family.
- `46306a44e698d907225d54d1e57d5df14656a9b5` — completed Chromatic Dragonborn family.
- `ba6368087b170a298d1af16900fa7e0c852dd45c` — added permanent ChatGPT repo-write procedure.
- `f706f773b807de77fd4239f5454c62efbe07d65b` — completed Metallic Dragonborn files/routing/validator.
- `2e5031a71f05f8705b64dbbef30aa402dd42c58f` — reconciled older Chromatic compatibility contract; exact green checkpoint.

## Validation authority

Focused workflow:

`.github/workflows/validate-forge-source-presentation.yml`

Required validators now include:

- `scripts/validate_forge_source_presentation.mjs`;
- `scripts/validate_forge_species_catalog_families.mjs`;
- `scripts/validate_forge_species_family_expansion.mjs`;
- `scripts/validate_forge_species_catalog_portraits.mjs`;
- `scripts/validate_forge_chromatic_dragonborn_art.mjs`;
- `scripts/validate_forge_metallic_dragonborn_art.mjs`;
- production build gate.

For exact checkpoint `2e5031a71f05f8705b64dbbef30aa402dd42c58f`:

- structured source presentation passed;
- established Species family validator passed;
- expanded Species family validator passed;
- Species portrait/collapse validator passed;
- Chromatic Dragonborn dedicated-art validator passed;
- Metallic Dragonborn dedicated-art validator passed;
- focused production build passed;
- all **33/33 PR-triggered workflows** completed successfully;
- Vercel deployment succeeded.

The Metallic validator proves Brass/Bronze/Copper/Silver files are real WebPs, Forge routing uses each dedicated file, canonical routing remains the shared Metallic image outside the Forge, Gold remains dedicated, Gem children remain explicit temporary treatments, ancestry-specific lore preserves Fire/Lightning/Acid/Cold affinities, and protected map/travel boundaries are untouched.

Do not weaken older validators to make a new implementation pass.

## Database boundary

No database migration or data write is required for this artwork phase.

Supabase remains through migration 93:

`20260812042950 aven_subrace_catalog`

Re-verified after the Metallic Dragonborn checkpoint:

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
6. all Genasi and all Chromatic/Metallic Dragonborn use real dedicated Forge files;
7. unfinished Gem Dragonborn still render safely through explicit temporary treatment;
8. setting/source child uses its real Species row/rules rather than modern-parent rules;
9. Goliath/Tiefling remain inline.

## Next steps

1. Generate and commit Gem Dragonborn: Amethyst, Crystal, Emerald, Sapphire, Topaz.
2. Continue Aven, Elf/Gnome, Shifter, Lorwyn/Shadowmoor, then remaining setting/source aliases.
3. Use connector-returned GitHub blob SHAs for every binary attachment.
4. Run focused workflow + full PR regression matrix after coherent family batches.
5. Update this ledger and PR #170 body after green checkpoints.
6. Complete signed-in visual re-smoke.
7. Do not merge PR #170 until the user explicitly approves the merge.
