# Character Forge Species Artwork Rollout

Status date: 2026-09-02

This document is the handoff authority for the approved Character Forge Species cinematic-artwork rollout that continues from PR #177 (`agent/realistic-dice-core`). It supplements the frozen post-PR #170 Species behavior ledger; it does not reopen the Species tab for a broad functional redesign.

## Current branch / PR boundary

- Working branch: `agent/realistic-dice-core`
- Pull request: #177 — **Add reusable realistic dice physics core**
- Safe pre-rollout head at this handoff: `592a70340e72f064bfa80ef6fef9f1c73b354d0d`
- PR #177 remains intentionally unmerged until browser acceptance.
- No Supabase migration or write is required for this artwork rollout.
- Do not touch world-map, town/city-map, travel, route, weather, combat, crafting, merchant, inventory, or other protected runtime systems as part of this work.

## Approved artwork rollout

The following nineteen base Species images were visually reviewed and approved for installation. Install them in controlled checkpoints so regressions remain easy to isolate.

### Checkpoint 1 — first installation set

1. Human
2. Aarakocra
3. Elf
4. Half-Orc
5. Halfling

Target files:

- `public/media/species/cinematic-human.webp`
- `public/media/species/cinematic-aarakocra.webp`
- `public/media/species/cinematic-elf.webp`
- `public/media/species/cinematic-half-orc.webp`
- `public/media/species/cinematic-halfling.webp`

The Aarakocra, Elf, Half-Orc, and Halfling cinematic paths already exist on the branch and should be replaced by the newly approved high-detail exports. Human is a new cinematic override.

### Checkpoint 2

1. Dwarf
2. Gnome
3. Dragonborn — **base Dragonborn only**
4. Tiefling
5. Goliath

### Checkpoint 3

1. Aasimar
2. Firbolg
3. Goblin
4. Orc

### Checkpoint 4

1. Bugbear
2. Kenku
3. Kobold
4. Lizardfolk
5. Tabaxi

## Image production standard

The approved production exports for the first checkpoint were prepared as:

- 720 × 960 pixels;
- WebP;
- approximately quality 80;
- enough retained detail to avoid the visibly soft/over-compressed Aarakocra result from the earlier cinematic export.

Do not regress these to tiny low-quality thumbnails merely to reduce repository size. The hero image is a large presentation surface and needs enough source detail to survive desktop scaling.

## Artwork authority and exact-name rule

`utils/speciesArtwork.js` remains the shared resolver authority.

The cinematic map is intentionally an **exact normalized Species-name override**. A cinematic base Species image must not silently cascade into dedicated children or source variants that already have their own art.

Examples:

- changing `elf` must not replace `drow`, `high-elf`, or `wood-elf`;
- changing `gnome` must not replace `forest-gnome` or `rock-gnome`;
- changing base `dragonborn` must not replace chromatic, metallic, or gem Dragonborn children;
- setting/source variants should continue using their dedicated files when such files exist.

This boundary is especially important because the non-Forge resolver intentionally retains family aliases. The cinematic hero resolver is the narrow presentation override and must stay narrow.

## Dragonborn boundary

Only the **base `Dragonborn`** portrait is approved for replacement in Checkpoint 2.

Do not replace the following as part of that checkpoint:

- Black, Blue, Green, Red, or White Dragonborn;
- Brass, Bronze, Copper, Gold, or Silver Dragonborn;
- Amethyst, Crystal, Emerald, Sapphire, or Topaz Gem Dragonborn;
- any other Dragonborn child/source presentation that already has dedicated artwork.

Those images will be audited individually later. Several existing Dragonborn variant portraits are already strong and should not be overwritten by a parent-art rollout.

## Checkpoint validation requirements

After each checkpoint:

1. Confirm every intended cinematic file is a valid WebP and resolves without fallback to `adventurer.webp`.
2. Confirm the selected base Species shows the new cinematic image in Character Forge.
3. Confirm child/variant Species still resolve to their own dedicated artwork where applicable.
4. Check desktop headroom/focal framing; faces and important head features must not be clipped at normal browser zoom.
5. Check responsive/mobile presentation and make sure hero art does not force horizontal overflow.
6. Run the relevant Forge Species validators and the normal Next.js production build before calling the checkpoint accepted.
7. Keep PR #177 unmerged until the user has browser-reviewed the result.

## Handoff state

At the end of the 2026-09-02 conversation, the first five approved 720×960 WebP exports were prepared for Human, Aarakocra, Elf, Half-Orc, and Halfling and copied into the persistent ChatGPT Library at:

`/DNDNext/Species Artwork Rollout/Checkpoint 1/`

The five persistent filenames are:

- `cinematic-human.webp`
- `cinematic-aarakocra.webp`
- `cinematic-elf.webp`
- `cinematic-half-orc.webp`
- `cinematic-halfling.webp`

The GitHub connector available in this conversation can create binary Git blobs only from an inline base64 string; it does not expose a byte-preserving local-file upload parameter. An attempted inline transfer did not reproduce the source blob checksum, so that unverified blob was deliberately left unreachable and **no corrupted image was attached to the branch**. The next chat must retrieve the five exact Library files and finish/verify the binary GitHub transfer before claiming Checkpoint 1 installed.

Once Checkpoint 1 is green, continue Checkpoints 2–4 in order. Do not regenerate already approved images merely because a new chat took over; preserve the approved art direction and only revisit an image when browser review identifies a concrete problem.
