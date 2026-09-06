# Character Forge Species Artwork Rollout

Status date: 2026-09-05

This document is the handoff authority for the approved Character Forge Species cinematic-artwork rollout on PR #177 (`agent/realistic-dice-core`). It supplements the frozen post-PR #170 Species behavior ledger; it does not reopen the Species tab for a broad functional redesign.

## Current branch / PR boundary

- Working branch: `agent/realistic-dice-core`
- Pull request: #177 — **Add reusable realistic dice physics core**
- PR #177 remains intentionally unmerged until browser acceptance.
- `utils/speciesArtwork.js` remains the exact-name cinematic artwork authority.
- No Supabase migration or write is required for this artwork rollout.
- Do not touch world-map, town/city-map, travel, route, weather, combat, crafting, merchant, inventory, or other protected runtime systems as part of this work.

## Current accepted cinematic set

The current PR contains exact cinematic overrides for twenty Species names:

- Aarakocra
- Aasimar
- Aetherborn
- Autognome
- Bugbear
- Dragonborn — **base Dragonborn only**
- Dwarf
- Elf
- Firbolg
- Gnome
- Goblin
- Goliath
- Half-Orc
- Halfling
- Human
- Kenku
- Kobold
- Orc
- Tabaxi
- Tiefling

The large approved ten-portrait continuation installed on 2026-09-05 added/replaced Human, Gnome, Dwarf, base Dragonborn, Goliath, Elf, Half-Orc, Halfling, Autognome, and Aetherborn. Lizardfolk was browser-reviewed and explicitly accepted in its existing artwork, so it is intentionally **not** being replaced merely to make the filename cinematic.

## 2026-09-05 browser correction pass

Latest browser review identified three presentation issues:

1. **Bugbear** — the character needed to sit farther left in the source composition so the lore overlay does not hide as much of the figure.
2. **Kenku** — likewise needed a slightly more left-weighted composition.
3. **Orc** — the previous portrait read too dark; the replacement is brighter and more unmistakably full-orc, with stronger tusks, heavier brow, broader jaw, and a more imposing orc silhouette.

The correction exports are 720 × 960 WebP files and replace only:

- `public/media/species/cinematic-bugbear.webp`
- `public/media/species/cinematic-kenku.webp`
- `public/media/species/cinematic-orc.webp`

The old Bugbear-specific CSS focal override was removed so the approved artwork owns its composition rather than stacking an old crop correction on top of a new portrait.

## Image production standard

Approved Character Forge hero exports should normally be:

- 3:4 composition;
- 720 × 960 WebP for the current cinematic set unless a later, explicitly approved standard replaces it;
- high enough quality to remain sharp on the large desktop hero surface;
- realistic fantasy rather than sourcebook/purple-background presentation;
- composed with the subject clearly readable when the right-side lore/fact overlay is present;
- placed in a natural/species-appropriate environment when new art is generated;
- varied in pose and setting across the catalogue rather than repeating the same eyeline/body stance.

Do not regress approved hero artwork to tiny low-quality thumbnails merely to reduce repository size.

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

Only the **base `Dragonborn`** cinematic portrait is covered by this rollout.

Do not replace these merely because the parent was updated:

- Black, Blue, Green, Red, or White Dragonborn;
- Brass, Bronze, Copper, Gold, or Silver Dragonborn;
- Amethyst, Crystal, Emerald, Sapphire, or Topaz Gem Dragonborn;
- any other Dragonborn child/source presentation that already has dedicated artwork.

Several existing Dragonborn variant portraits are already strong and should be audited individually before replacement.

## Checkpoint validation requirements

After every artwork checkpoint:

1. Confirm every intended file is a valid WebP and matches the approved SHA-256.
2. Confirm required image dimensions before materialization.
3. Confirm the selected exact Species shows the intended image in Character Forge.
4. Confirm child/variant Species still resolve to their own dedicated artwork where applicable.
5. Check desktop headroom and horizontal focal framing; faces and important body features must not disappear behind the lore overlay at normal browser zoom.
6. Check responsive/mobile presentation and make sure hero art does not force horizontal overflow.
7. Run the relevant Forge Species validators and normal PR validation gates before calling the checkpoint accepted.
8. Keep PR #177 unmerged until the user has browser-reviewed the result.

## Proven binary transfer route — do not rediscover this again

The earlier inline base64 Git-blob approach is no longer the preferred handoff. On 2026-09-05 the approved Species artwork was successfully installed through the connected Dropbox + GitHub Actions bridge:

`approved local WebPs -> ZIP + SHA-256 manifest -> Dropbox /DNDNext-Transfer -> one-shot GitHub Actions scratch branch -> exact PR-head guard -> verify ZIP/files/MIME/dimensions -> exact diff guard -> bot commit -> push agent/realistic-dice-core -> GitHub/CI/Vercel verification`

Use `docs/ARTWORK_BINARY_TRANSFER_RUNBOOK.md` for the operational recipe and `docs/REPO_ACCESS_STANDING_RULE.md` for the persistent repository-access rule.

Do **not** regenerate approved images merely because a new chat took over, do **not** fall back to giant inline base64 payloads while the Dropbox bridge is available, and do **not** claim a binary rollout completed until the resulting PR commit and validations have been re-read from GitHub.
