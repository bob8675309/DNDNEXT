# Character Forge Subclass Artwork Status

Status date: 2026-09-09

This is the focused handoff for the Character Forge subclass selector artwork rollout on PR #177 (`agent/realistic-dice-core`). Current source, exact-head CI, and browser behavior remain authoritative.

## Artwork authority

Subclass selector artwork remains centralized through:

`ClassSubclassSection.js -> subclassArtworkFor(classKey, option) -> utils/classes/subclassArtwork.js`

The selector continues to use the existing 76x40 viewport. Purpose-built selector assets are authored at 456x240 (1.9:1) and displayed with `object-fit: cover`. Missing/unpromoted subclasses still fall back safely through `classMenuArtworkFor`; this rollout does not alter subclass selection, persistence, progression, or Supabase authority.

## Existing complete family

Wizard remains the established reference family with 18 distinct selector assets under:

`public/media/subclasses/wizard/`

Wizard artwork was not changed in this batch.

## 2026-09-09 approved first rollout batch

Thirty approved 456x240 WebP assets were installed through the Dropbox -> guarded GitHub Actions binary bridge with ZIP SHA-256, per-file SHA-256, MIME, dimension, exact-head, exact-file-scope, and focused Class validation before publication.

### Fighter

- Arcane Archer
- Banneret
- Battle Master
- Cavalier
- Champion
- Echo Knight

`Purple Dragon Knight (Banneret)` intentionally aliases the Banneret artwork until its own art is authored.

### Paladin

- Ancients
- Conquest
- Crown
- Devotion
- Glory
- Noble Genies

### Ranger

- Beast Master
- Drakewarden
- Fey Wanderer
- Gloom Stalker
- Horizon Walker
- Hunter

### Sorcerer

- Aberrant / Aberrant Mind
- Clockwork / Clockwork Soul
- Divine Soul
- Draconic
- Shadow
- Wild / Wild Magic

The paired 2014/2024 naming variants above intentionally share the same visual concept rather than duplicating identical art under two filenames.

### Warlock

- Archfey
- Celestial
- Fiend
- Great Old One
- Hexblade
- Undead

## Current hero-art note

The approved Ranger and Warlock cinematic hero replacements were already installed immediately before this subclass batch. Ranger keeps the same attractive Elf/ruined-valley criteria with substantially more headroom above the subject so the Class menu/divider cannot cut through her head. Warlock now uses a visually distinct non-human moonlit occult composition so it no longer reads as a near-duplicate of Sorcerer.

## Regression guard

`scripts/validate_class_subclass_browser.mjs` now protects the first rollout batch. It verifies that:

- the dedicated files exist for all 30 promoted selector assets;
- the centralized resolver contains the approved class/family mappings and naming aliases;
- Wizard's existing one-to-one selector artwork remains intact;
- missing future subclasses retain the safe class-menu fallback;
- the selector remains presentation-only and does not acquire Supabase authority;
- protected world-map, town/city-map, crafting, encounter, or other gameplay boundaries are not crossed.

## Remaining work

This is intentionally a partial rollout, not a claim that every non-Wizard subclass is finished. Unpromoted subclasses continue to display the Class menu fallback until their reviewed artwork batch is created and installed. Continue the rollout in bounded reviewed batches rather than silently reusing unrelated subclass art.

## Publication chain

Binary materialization:

`0c08b5770371d5381a20351b32d45dd186d201df` — `Install approved subclass artwork batch`

Resolver promotion:

`816e986fc7df378bc7d559070589998710ec123d` — `Wire approved subclass artwork batch`

Regression guard:

`3575a0331b06fa7868d21608c7981d856fb0a084` — `Guard approved subclass artwork batch`

## Protected boundaries

- No Supabase writes or migrations.
- No Class/subclass rules or persistence changes.
- No world-map code.
- No town/city-map code.
- No crafting, travel, merchant, inventory, encounter, tactical, or character-sheet runtime changes.
