# Character Forge Species Artwork Rollout

Status reconciled: 2026-09-15

Status: **the PR #177 artwork/presentation line described by this document is merged. Current `main` and `utils/speciesArtwork.js` are production authority.**

This document records the durable Species cinematic-artwork rules and approved rollout decisions. It is not an instruction to resume the old `agent/realistic-dice-core` branch.

## Current branch / PR correction

Historical development branch: `agent/realistic-dice-core` / PR #177.

PR #177 merged on 2026-09-11. Do not treat it as open or as the current integration branch. Any new Species artwork should start from current `main` or another explicitly chosen current branch.

No Supabase migration/write is required for presentation-only Species artwork unless a separate data requirement is established.

## Artwork authority

`utils/speciesArtwork.js` remains the shared artwork resolver authority.

The cinematic resolver is intentionally exact-name/presentation aware. A base Species cinematic must not silently replace dedicated child/source-variant artwork.

Important distinction:

- Forge cinematic/portrait presentation may use a dedicated image for a nested lineage/ancestry presentation;
- canonical Species/source identity and rules remain owned by the existing catalogue/source-choice system.

Artwork must not create a second Species identity authority.

## Accepted cinematic direction

The approved Character Forge Species art direction remains:

- realistic/cinematic fantasy rather than old sourcebook/purple-background presentation;
- high-resolution portrait/cinematic exports suitable for the large right-side Forge surface;
- subject clearly readable with the lore/fact overlay present;
- natural/species-appropriate environments where useful;
- varied pose, camera, gender/presentation, environment, and silhouette across the catalogue;
- no destructive reuse of a base image when a child/source variant has dedicated art;
- do not replace an accepted image merely to make filenames or batches look uniform.

The September 2026 audit/cleanup did not authorize deleting current Species art. Approved art remains part of the production asset baseline.

## Approved exact cinematic set from the rollout

The #177-era rollout established exact cinematic overrides for entries including:

- Aarakocra
- Aasimar
- Aetherborn
- Autognome
- Bugbear
- base Dragonborn
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

Additional child/source artwork remains governed by the broader Species ledgers and current resolver source. Lizardfolk was explicitly browser-accepted in its existing presentation during the rollout and should not be replaced simply for naming consistency.

## Browser corrections retained

The rollout included source-composition corrections such as:

- Bugbear and Kenku subject placement adjusted for the right-side information overlay;
- Orc replaced with a brighter, more unmistakably full-orc composition;
- obsolete CSS focal compensation removed where approved source artwork now owns composition.

Do not reintroduce old crop/focal hacks without reproducing a current defect.

## Parent/child/source-variant rule

Species artwork routing must preserve the distinction between:

- base Species;
- parent-persisted lineage/ancestry presentations;
- independent source Species rows;
- setting/source variants;
- trait-level appearance/configuration choices.

Examples such as Dragonborn ancestries, Genasi lineages, Elf/Gnome children, Shifter forms, Aven types, Fairy/Kithkin variants, and setting/source children may have distinct Forge artwork while sharing or differing in persistence models. Inspect current source-choice authority before altering resolver behavior.

## Current Species baseline

The Species tab is mature and should remain frozen unless Paul requests new artwork/content or a concrete regression is reproduced.

Preserve:

- searchable parent/child reveal;
- canonical parent/child persistence behavior;
- large hero/portrait routing;
- semantic fact icons;
- Creature Type/Size/Vision/Languages fact handling;
- Common-language conventions;
- source-owned variable Size/Language/lineage choices;
- affinity-aware Dragonborn copy;
- structured Aasimar/Goliath/Eladrin/Hexblood/Simic presentation;
- guided Continue validation.

## Binary artwork workflow

For future binary art batches, use the established guarded asset route rather than giant inline-base64 repository writes. Validate exact base/head, archive/file checksums, dimensions, changed paths, and focused artwork regressions before advancing the intended branch.

## Relationship to subclass Tarot art

Species portraits/cinematics and subclass Tarot cards are separate asset systems. The broad Forge Species catalogue can inspire visible subjects for subclass card diversity, but using a Species as artwork casting does not change subclass rules or Species persistence.

Tarot card dimensions/format are controlled by `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`, not by this Species portrait standard.

## Protected boundaries

Species artwork work does not authorize changes to world-map or town/city-map behavior, routes/travel/weather/camps/clock, tactical combat, crafting, inventory, merchants, economy, or unrelated runtime systems.
