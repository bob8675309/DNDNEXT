# Forge Gem Dragonborn Artwork Status

Status: COMPLETE and validated

This file is the focused handoff ledger for the Gem Dragonborn dedicated-art pass. It supplements `Forge_Species_Art_and_Collapse_Handoff.md`.

## Validation checkpoint

The exact tested runtime/source/art checkpoint is the **last non-documentation commit immediately before the documentation commit `Document binary repo write fallback`** on `agent/character-forge-resilience-presentation`.

That code/art checkpoint completed:

- **33/33 PR-triggered GitHub workflows successfully**;
- the focused Forge source-presentation workflow successfully;
- the production-build gate successfully;
- Vercel deployment successfully.

The documentation commits that follow are documentation-only descendants and do not supersede that tested runtime/art tree.

PR #170 was explicitly rechecked after the validation pass and remains **OPEN and UNMERGED**.

## Gem Dragonborn family — COMPLETE

All five FTD Gem Dragonborn children now have dedicated Forge artwork:

- `public/media/species/amethyst-gem-dragonborn.webp`
- `public/media/species/crystal-gem-dragonborn.webp`
- `public/media/species/emerald-gem-dragonborn.webp`
- `public/media/species/sapphire-gem-dragonborn.webp`
- `public/media/species/topaz-gem-dragonborn.webp`

The materializer commit that first added exactly those five binaries is:

`6560331be56bfc9eef211163824b603a3085962f` — `Materialize Gem Dragonborn Forge artwork`

That commit changed exactly the five Gem WebP paths above and nothing else.

## Visual/source identities

The existing Species lore/source authority remains unchanged and distinguishes the five Gem ancestries as:

- Amethyst — Force-linked ancestry, violet crystalline presentation;
- Crystal — Radiant-linked ancestry, pale/translucent crystalline presentation;
- Emerald — Psychic-linked ancestry, green crystalline presentation;
- Sapphire — Thunder-linked ancestry, deep-blue crystalline presentation;
- Topaz — Necrotic-linked ancestry, amber/topaz crystalline presentation.

The art pass did not rewrite 5etools/FTD mechanics or Species choice persistence.

## Deterministic art provenance

Raw binary Git blob transfer became unreliable during this batch while normal GitHub text writes remained available. Rather than weaken validation or stop repo work, the final assets were materialized through:

- `scripts/materialize_gem_dragonborn_art.py`
- `.github/workflows/materialize-gem-dragonborn-art.yml`

The deterministic generator uses already-committed DNDNext Dragonborn source/reference artwork, gives each Gem ancestry a different source pose, adds ancestry-specific crystalline facets/effects, writes dedicated WebPs, and refuses to complete if a generated file is too small or lacks `RIFF` / `WEBP` headers.

The permanent operational fallback is documented in:

- `docs/CHATGPT_REPO_WRITE_PROCEDURE_BINARY_FALLBACK.md`

## Artwork authority

`speciesArtworkFor(...)` remains the stable canonical non-Forge resolver.

All five Gem names still resolve canonically to:

`/media/species/dragonborn-gem.webp`

`speciesPortraitArtworkFor(...)` is the Forge presentation authority and now resolves each Gem child to its own dedicated file.

Completed Dragonborn families are now:

- Chromatic — Black, Blue, Green, Red, White;
- Metallic — Brass, Bronze, Copper, Gold, Silver;
- Gem — Amethyst, Crystal, Emerald, Sapphire, Topaz.

## Validation authority

Current focused validation includes:

- `scripts/validate_forge_source_presentation.mjs`
- `scripts/validate_forge_species_catalog_families.mjs`
- `scripts/validate_forge_species_family_expansion.mjs`
- `scripts/validate_forge_species_catalog_portraits_v2.mjs`
- `scripts/validate_forge_chromatic_dragonborn_art.mjs`
- `scripts/validate_forge_metallic_dragonborn_art.mjs`
- `scripts/validate_forge_gem_dragonborn_art.mjs`
- production build gate

The v2 catalogue portrait validator preserves the existing chevron/collapse/lore/canonical-art assertions and updates the completed Gem family from temporary presentation to real dedicated-art coverage. The historical v1 portrait validator remains in the repository for prior context but is no longer the active focused-workflow portrait contract.

The Chromatic and Metallic validators retain their original family assertions and now explicitly require completed Gem artwork to remain dedicated rather than using the former temporary Gem fallback.

## Live database boundary

No SQL write or migration was required for Gem artwork.

Post-pass production counts remain unchanged:

- raw Species catalogue: **166**;
- preferred Species view: **102**;
- characters: **7**;
- character_sheets: **7**;
- character_spells: **30**;
- character_progression: **7**;
- inventory_items: **18**;
- locations: **20**;
- map_routes: **4**;
- map_route_points: **9**.

Live database authority remains migration 93:

`20260812042950 aven_subrace_catalog`

## Safety incident / merge rule

While looking for a temporary-branch integration action, the assistant accidentally selected the PR-merge action twice. The PR was immediately rechecked/reasserted and remained open/unmerged. No further merge actions are to be used for branch preparation in this workflow.

Use file/tree/ref operations only. PR #170 must not be merged until the user explicitly approves it.

## Protected boundaries

This pass did not intentionally modify:

- `components/MapPageClient.js`;
- world-map behavior;
- town/city-map behavior;
- route/travel/weather execution;
- tactical combat execution;
- unrelated crafting or inventory execution;
- merchants;
- unrelated runtime systems.

## Next dedicated-art queue

With all Dragonborn child artwork complete, continue in this order unless the user redirects:

1. Aven — Hawk-Headed, Ibis-Headed;
2. Elf/Gnome — Drow, High Elf, Wood Elf, Forest Gnome, Rock Gnome;
3. Shifter — Beasthide, Longtooth, Swiftstride, Wildhunt;
4. Lorwyn/Shadowmoor — both Fairy and both Kithkin variants;
5. setting/source aliases still on shared art — Dwarf (Kaladesh), Goblin (Dankwood), Orc (Ixalan).
