# Forge Species Artwork — Post-PR #170 Active Status

Status date: 2026-08-12
Active branch: `agent/species-art-post170`
Active PR: #171 — OPEN / UNMERGED
Merge rule: **do not merge PR #171 without explicit user approval**
Database authority: migration 93 — `20260812042950 aven_subrace_catalog`
Exact validated code/art checkpoint: `dd335d69af7bebdfc2b4590c34f15e621d93adc5`

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

## Exact PR #171 code/art checkpoint

`dd335d69af7bebdfc2b4590c34f15e621d93adc5` — `Align Gem artwork validators with source wording`

Net code/art scope relative to merged `main` is nine files:

- `.github/workflows/validate-forge-source-presentation.yml`
- `public/media/species/hawk-headed-aven.webp`
- `public/media/species/ibis-headed-aven.webp`
- `scripts/validate_forge_aven_art.mjs`
- `scripts/validate_forge_chromatic_dragonborn_art.mjs`
- `scripts/validate_forge_gem_dragonborn_art.mjs`
- `scripts/validate_forge_metallic_dragonborn_art.mjs`
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
- production build.

For exact code/art head `dd335d69...`:

- focused push workflow: SUCCESS;
- PR `Validate Forge source presentation`: SUCCESS;
- PR `Validate NPC Forge foundation`: SUCCESS;
- production builds: SUCCESS;
- Vercel deployment: SUCCESS.

Because PR #171 has a tightly scoped nine-file diff, GitHub path filters correctly triggered two relevant PR workflows rather than the 33-workflow matrix associated with the old long-lived #170 diff.

The first focused run on `3ef24c85...` correctly failed on a validator phrase mismatch: source lore says `force-linked gem ancestry`, while the assertion required `force-linked ancestry`. The implementation was not changed to satisfy the test. The validators were corrected to require the actual source wording while still enforcing each Gem ancestry's correct damage affinity.

## Live database boundary

No SQL write or migration was made for the Aven/Gem artwork reconciliation.

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

## Remaining dedicated-art queue

Next coherent batch:

### Elf / Gnome

- Drow
- High Elf
- Wood Elf
- Forest Gnome
- Rock Gnome

Then:

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

### Remaining setting/source aliases

- Dwarf (Kaladesh)
- Goblin (Dankwood)
- Orc (Ixalan)

Retain existing dedicated Human setting art, Elf Kaladesh/Zendikar art, and Amonkhet Minotaur art unless there is a specific reason to replace them.

## Next action

Continue with the Elf/Gnome batch on PR #171, using the same dedicated-file / canonical-alias boundary and validator-first process. Do not merge PR #171 until the user explicitly approves it.
