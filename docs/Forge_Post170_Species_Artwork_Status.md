# Forge Species Artwork — Post-PR #170 Active Status

Status date: 2026-08-13
Active branch: `agent/species-art-post170`
Active PR: #171 — OPEN / UNMERGED
Merge rule: **do not merge PR #171 without explicit user approval**
Database authority: migration 93 — `20260812042950 aven_subrace_catalog`
Previous validated code/art checkpoint: `f8f31534c157c9778f873e726551ac20cfdfd823`

## 2026-08-13 final portrait-quality continuation

The current local continuation, pending one coherent PR commit, replaces all 21 legacy Genasi, Dragonborn, and Aven child files with unique high-resolution 1536 × 2048 (3:4) artwork. The five Gem Dragonborn are no longer alternate treatments of one composition, Bronze Dragonborn is no longer duplicated, and the Aven pair now uses distinct full-body Hawk and Ibis compositions.

The large right-hand Forge Species hero now calls `speciesPortraitArtworkFor(...)`, matching the child rows in the left catalogue. Selected family metadata carries the dedicated child artwork name through the existing source-choice projection; no hook, state variable, prop, controller field, save payload, or database field was added.

Legacy CSS hue shifts and body-level crop/filter stand-ins were removed. `scripts/validate_forge_species_portrait_integrity.mjs` now enforces complete VP8 WebPs, exact dimensions, byte-level uniqueness across the 21 regenerated portraits, raw parenthetical Genasi/Aven alias routing, the large-hero resolver, removal of the recolor fallbacks, full Species importer descriptions, preview-only database behavior, and protected map/travel boundaries.

The character-option importer now retains the full flattened Species description instead of truncating it at 900 characters. A read-only dry run against all 166 live raw Species records produced 166 rows, zero blank descriptions, 102 descriptions over 900 characters, and a maximum length of 3,216 characters. Three exact-description pairs remain and are source-data reprints or intentional shared mechanics: Elf LFL/XPHB, Boggart LFL versus Goblin MPMM, and Harengon MPMM/WBtW. No Supabase write or migration was made.

## Why this ledger exists

PR #170 was accidentally merged through the GitHub connector while a branch-integration action was being searched for. GitHub confirms merge commit:

`599c4de7397ba6e4bbbb0a061d551d80c3570be7`

Do not describe PR #170 as open or unmerged. It is historical and merged.

No automatic revert was attempted because #170 contained a large body of previously validated work; blindly reverting that merge could destroy legitimate systems. The user instructed continuation, so all new Species artwork work now occurs on the fresh branch `agent/species-art-post170` and PR #171.

Never use `merge_pull_request` for branch integration. Never merge an active PR without explicit user approval.

## Direct repo-write authority

ChatGPT can write directly to GitHub and Supabase through the installed connectors.

Controlling procedure:

- `docs/CHATGPT_REPO_WRITE_PROCEDURE.md`

Preferred coherent GitHub write path:

`create_blob → create_tree → create_commit → race-check → update_ref(force=false) → compare → CI`

For binary artwork, use connector-confirmed Git blob SHAs. If raw binary transport is unreliable, use an isolated materialization branch, verify the reconstructed file inside GitHub Actions, read the resulting Git tree for the real blob SHA, and attach only that binary blob to the working branch. Never merge staging chunks or one-time materializer workflows into the real branch.

## Protected boundaries

Current work is Character Forge Species presentation/artwork only. Do not touch:

- world-map behavior;
- town/city-map behavior;
- `components/MapPageClient.js`;
- route/travel/weather;
- tactical combat;
- crafting;
- inventory;
- merchants;
- unrelated runtime systems.

## Species family / persistence boundary

Existing source-choice/persistence authority remains unchanged.

Parent-persisted/source-choice families include Genasi, Dragonborn, Aven, Elf, Gnome, Shifter, Fairy/Faerie, and Kithkin. Do not create parallel subrace state or new save payloads for these artwork changes.

Goliath Giant Ancestry and Tiefling Fiendish Legacy remain trait-level inline choices rather than catalogue sub-species.

## Artwork resolver authority

`speciesArtworkFor(...)` remains the canonical non-Forge resolver.

`speciesPortraitArtworkFor(...)` is the Forge portrait resolver.

A fixed-appearance child may use a dedicated Forge file only after the file really exists and validation proves it is a valid WebP. Outside the Forge, canonical family aliases remain stable.

## Completed dedicated families

### Genasi — COMPLETE

- `air-genasi.webp`
- `earth-genasi.webp`
- `fire-genasi.webp`
- `water-genasi.webp`

Canonical non-Forge resolution remains `genasi.webp`.

### Dragonborn — ALL 15 CHILD ANCESTRIES COMPLETE

Chromatic:

- `black-dragonborn.webp`
- `blue-dragonborn.webp`
- `green-dragonborn.webp`
- `red-dragonborn.webp`
- `white-dragonborn.webp`

Metallic:

- `brass-dragonborn.webp`
- `bronze-dragonborn.webp`
- `copper-dragonborn.webp`
- `gold-dragonborn.webp`
- `silver-dragonborn.webp`

Gem:

- `amethyst-gem-dragonborn.webp`
- `crystal-gem-dragonborn.webp`
- `emerald-gem-dragonborn.webp`
- `sapphire-gem-dragonborn.webp`
- `topaz-gem-dragonborn.webp`

Canonical non-Forge resolution remains the appropriate shared Chromatic / Metallic / Gem family image.

PR #171 reconciles the Gem files that were already present on `main` after #170 with the dedicated Forge resolver and current validators.

### Aven — COMPLETE ON PR #171

- `public/media/species/hawk-headed-aven.webp`
- `public/media/species/ibis-headed-aven.webp`

GitHub-authoritative blob SHAs:

- Hawk-Headed Aven: `ad8a88b82099545e3983535c6c8abb1ba83e34b4`
- Ibis-Headed Aven: `bccfd0df8f63b772f57f85f0f1d800e4f9f3c323`

Verified source identity:

- Hawk-Headed: hawk/bird-of-prey head; shorter wings suited to quick controlled flight; Hawkeyed/Perception and long-range accuracy.
- Ibis-Headed: long ibis head/neck; broad angular wings suited to soaring; Kefnet's Blessing/Intelligence aptitude.

Canonical non-Forge Hawk/Ibis resolution remains `aven.webp`; only the Forge uses the dedicated files.

### Elf / Gnome — COMPLETE ON PR #171

- `public/media/species/drow.webp`
- `public/media/species/high-elf.webp`
- `public/media/species/wood-elf.webp`
- `public/media/species/forest-gnome.webp`
- `public/media/species/rock-gnome.webp`

All five are production WebP portraits at 1536 × 2048 (true 3:4). The dedicated validator checks real RIFF/WEBP/VP8 headers, exact dimensions, Forge routing, canonical non-Forge aliases, lineage-specific lore, completed Aven/Gem routing, and protected map/travel boundaries.

Canonical non-Forge Drow/High Elf/Wood Elf resolution remains `elf.webp`; canonical non-Forge Forest/Rock Gnome resolution remains `gnome.webp`. Only the Forge uses the dedicated lineage files.

### Shifter — COMPLETE ON PR #171

- `public/media/species/beasthide-shifter.webp`
- `public/media/species/longtooth-shifter.webp`
- `public/media/species/swiftstride-shifter.webp`
- `public/media/species/wildhunt-shifter.webp`

All four are production WebP portraits at 1536 × 2048 (true 3:4). The Shifter validator checks real RIFF/WEBP/VP8 headers, exact dimensions, dedicated Forge routing, stable canonical aliases, source-owned parent persistence, form-specific lore, prior completed artwork, and protected map/travel boundaries.

Canonical non-Forge Beasthide/Longtooth/Swiftstride/Wildhunt resolution remains `shifter.webp`; only the Forge uses the dedicated form files. Shifter remains one MPMM parent Species record and reuses the existing parent-persisted `shifting` choice.

### Fairy / Kithkin — COMPLETE ON PR #171

- `public/media/species/lorwyn-fairy.webp`
- `public/media/species/shadowmoor-fairy.webp`
- `public/media/species/lorwyn-kithkin.webp`
- `public/media/species/shadowmoor-kithkin.webp`

All four are production WebP portraits at 1536 × 2048 (true 3:4). The dedicated validator checks complete RIFF/WEBP/VP8 payloads, exact dimensions, dedicated Forge routing, stable canonical aliases, lineage-specific lore, the existing source-owned family bridge, Shadowmoor-only 120-foot Darkvision projection, prior completed artwork, and protected map/travel boundaries.

Canonical non-Forge Lorwyn/Shadowmoor Fairy resolution remains `fairy.webp`; canonical non-Forge Lorwyn/Shadowmoor Kithkin resolution remains `kithkin.webp`. Only the Forge uses the dedicated lineage files. Fairy and Kithkin remain single LFL parent Species records and reuse the existing `faerie-lineage` and `kithkin-lineage` source choices; no parallel persistence was added.

### Setting/source aliases — COMPLETE ON PR #171

- `public/media/species/dwarf-kaladesh.webp`
- `public/media/species/goblin-dankwood.webp`
- `public/media/species/orc-ixalan.webp`

All three are production WebP portraits at 1536 × 2048 (true 3:4). The focused setting-alias validator checks complete RIFF/WEBP/VP8 payloads, exact dimensions, dedicated Forge routing, source-setting lore, the existing catalogue-source grouping model, prior completed artwork, and protected map/travel boundaries.

Canonical non-Forge Dwarf (Kaladesh), Goblin (Dankwood), and Orc (Ixalan) resolution remains `dwarf.webp`, `goblin.webp`, and `orc.webp`, respectively. Only the Forge uses the dedicated setting files. The existing real source records remain nested through `catalogSourceVariants`; no parallel selection or persistence state was added.

## Exact PR #171 code/art checkpoint

`f8f31534c157c9778f873e726551ac20cfdfd823` — `Add high-resolution setting variant artwork`

Net code/art scope relative to merged `main` is twenty-nine files; the complete PR has thirty-three changed files after the four documentation files are included:

- `.github/workflows/validate-forge-source-presentation.yml`
- `public/media/species/hawk-headed-aven.webp`
- `public/media/species/ibis-headed-aven.webp`
- `public/media/species/drow.webp`
- `public/media/species/high-elf.webp`
- `public/media/species/wood-elf.webp`
- `public/media/species/forest-gnome.webp`
- `public/media/species/rock-gnome.webp`
- `public/media/species/beasthide-shifter.webp`
- `public/media/species/longtooth-shifter.webp`
- `public/media/species/swiftstride-shifter.webp`
- `public/media/species/wildhunt-shifter.webp`
- `public/media/species/lorwyn-fairy.webp`
- `public/media/species/shadowmoor-fairy.webp`
- `public/media/species/lorwyn-kithkin.webp`
- `public/media/species/shadowmoor-kithkin.webp`
- `public/media/species/dwarf-kaladesh.webp`
- `public/media/species/goblin-dankwood.webp`
- `public/media/species/orc-ixalan.webp`
- `scripts/validate_forge_aven_art.mjs`
- `scripts/validate_forge_elf_gnome_art.mjs`
- `scripts/validate_forge_chromatic_dragonborn_art.mjs`
- `scripts/validate_forge_gem_dragonborn_art.mjs`
- `scripts/validate_forge_metallic_dragonborn_art.mjs`
- `scripts/validate_forge_shifter_art.mjs`
- `scripts/validate_forge_fairy_kithkin_art.mjs`
- `scripts/validate_forge_setting_alias_art.mjs`
- `scripts/validate_forge_species_catalog_portraits_v2.mjs`
- `utils/speciesArtwork.js`

No controller, persistence, database, map, combat, crafting, inventory, or merchant file is in the code/art diff.

## Validation authority

Focused workflow:

`.github/workflows/validate-forge-source-presentation.yml`

Current required checks include:

- structured Forge source presentation;
- established Species family contract;
- expanded Species family contract;
- Species portrait/collapse v2 contract;
- Chromatic Dragonborn artwork;
- Metallic Dragonborn artwork;
- Gem Dragonborn artwork;
- Aven artwork;
- Elf/Gnome artwork, including exact 1536 × 2048 dimensions;
- Shifter artwork, including exact 1536 × 2048 dimensions and the parent-persisted `shifting` boundary;
- Fairy/Kithkin artwork, including complete WebP payloads, exact 1536 × 2048 dimensions, source-owned lineage choices, and Shadowmoor-only Darkvision;
- setting/source-alias artwork, including complete WebP payloads, exact 1536 × 2048 dimensions, stable canonical parent aliases, and unchanged catalogue-source grouping;
- production build.

For exact code/art head `f8f31534...`:

- focused push workflow: SUCCESS;
- PR `Validate Forge source presentation`: SUCCESS;
- PR `Validate NPC Forge foundation`: SUCCESS;
- PR `Validate Species rest proficiency runtime`: SUCCESS;
- production builds: SUCCESS;
- Vercel deployment: SUCCESS.

At `f8f31534...`, all three triggered GitHub workflow runs passed, the production build succeeded, and Vercel deployment succeeded. GitHub compare confirms the setting-variant continuation commit changes exactly seven files and no component, controller, persistence, database, map, combat, crafting, inventory, or merchant file.

A legacy one-shot town-crafter patch workflow still appears as a failing push run because its workflow-level trigger configuration is malformed; the same unrelated failure predates this Fairy/Kithkin commit. Its workflow and town-crafter targets are outside this diff. The required PR checks, focused push workflow, production builds, and Vercel deployment all passed.

The first focused run on `3ef24c85...` correctly failed on a validator phrase mismatch: source lore says `force-linked gem ancestry`, while the assertion required `force-linked ancestry`. The implementation was not changed to satisfy the test. The validators were corrected to require the actual source wording while still enforcing each Gem ancestry's correct damage affinity.

## Live database boundary

No SQL write or migration was made for the Aven/Gem/Elf/Gnome/Shifter/Fairy/Kithkin/setting-variant artwork reconciliation.

Latest verified production counts remain:

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

## Planned post-#170 dedicated-art queue — COMPLETE

- Dwarf (Kaladesh)
- Goblin (Dankwood)
- Orc (Ixalan)

Retain existing dedicated Human setting art, Elf Kaladesh/Zendikar art, and Amonkhet Minotaur art unless there is a specific reason to replace them.

## Next action

Review the completed PR #171 artwork pass and perform any desired in-Forge visual QA. Keep PR #171 open and unmerged until the user explicitly approves the merge.
