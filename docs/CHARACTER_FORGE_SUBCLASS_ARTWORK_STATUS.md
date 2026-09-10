# Character Forge Subclass Artwork Status

Status date: 2026-09-10

This is the focused handoff for the Character Forge subclass selector artwork rollout on PR #177 (`agent/realistic-dice-core`). Current source, exact-head CI, browser behavior, and the preferred Supabase Class catalogue remain authoritative over older screenshots or notes.

## Artwork authority

Subclass selector artwork remains centralized through:

`ClassSubclassSection.js -> subclassArtworkFor(classKey, option) -> utils/classes/subclassArtwork.js`

The selector continues to use the existing 76x40 viewport. Purpose-built selector assets are authored at 456x240 (1.9:1) and displayed with `object-fit: cover`. Missing/unpromoted subclasses still fall back safely through `classMenuArtworkFor`; this rollout does not alter subclass selection, persistence, progression, or Supabase authority.

## Existing complete family

Wizard remains the established reference family with 18 distinct selector assets under:

`public/media/subclasses/wizard/`

Wizard artwork was not changed in these batches.

## 2026-09-09 first rollout batch

Thirty approved 456x240 WebP assets were installed for six selector concepts each across Fighter, Paladin, Ranger, Sorcerer, and Warlock. Naming aliases for reprints remain centralized in `utils/classes/subclassArtwork.js`.

## 2026-09-10 continuation batch

Fifty-two additional reviewed selector assets plus the approved Warlock cinematic hero replacement were installed through the Dropbox -> guarded GitHub Actions binary bridge. The materializer verified archive SHA-256, per-file SHA-256, exact target head, exact changed-file scope including untracked binaries, WebP dimensions, and the focused Class regressions before publication.

### Artificer

- Alchemist
- Armorer
- Artillerist
- Battle Smith
- Cartographer
- Reanimator

### Barbarian

- Ancestral Guardian
- Berserker
- Giant
- Totem Warrior
- Wild Magic
- Zealot

### Bard

- Creation
- Glamour
- Lore
- Swords
- Valor
- Whispers

### Cleric

- Knowledge
- Life
- Light
- Tempest
- Trickery
- War

`Knowledge (PSA)` intentionally aliases the approved Knowledge artwork.

### Druid

- Land
- Moon
- Shepherd
- Spores
- Stars
- Wildfire

### Monk

- Astral Self
- Drunken Master
- Elements
- Kensei
- Open Hand
- Shadow

`Four Elements` intentionally aliases the `Elements` artwork where the legacy name is player-facing.

### Monster Hunter

- Carver
- Devourer
- Occultist
- Trapper

The preferred Grim Hollow catalogue exposes these as `Carver Guild`, `Devourer Guild`, `Occultist Guild`, and `Trapper Guild`. The resolver now aliases those exact preferred names to the four existing reviewed artworks rather than falling back to generic Class art.

### Mystic

- Avatar
- Awakened
- Immortal
- Nomad
- Soul Knife
- Wu Jen

The current preferred Mystic source does not expose subclass catalogue rows, so these assets remain available for compatible source/catalogue variants without changing Supabase authority.

### Rogue

- Arcane Trickster
- Assassin
- Phantom
- Soulknife
- Swashbuckler
- Thief

## Current preferred-source audit

A 2026-09-10 audit joined `class_catalog_preferred` to `class_feature_catalog` using each preferred Class source. After accounting for existing artwork and deliberate aliases, **33 currently preferred/visible subclass concepts still need dedicated reviewed selector artwork**.

### Next 10-art batch

- Barbarian — Wild Heart
- Barbarian — World Tree
- Bard — Dance
- Bard — Moon
- Bard — Spirits
- Druid — Dreams
- Druid — Sea
- Fighter — Eldritch Knight
- Fighter — Psi Warrior
- Monk — Mercy

### Following 11-art batch

- Paladin — Vengeance
- Ranger — Hollow Warden
- Ranger — Winter Walker
- Rogue — Scion of the Three
- Sorcerer — Lunar
- Sorcerer — Pyromancer (PSK)
- Sorcerer — Spellfire
- Sorcerer — Storm
- Warlock — Fathomless
- Warlock — Genie
- Warlock — Undying

### Remaining Cleric 12-art batch

- Ambition (PSA)
- Arcana
- Death
- Forge
- Grave
- Nature
- Order
- Peace
- Solidarity (PSA)
- Strength (PSA)
- Twilight
- Zeal (PSA)

Artificer and Wizard are complete for their current preferred catalogue. Expert Sidekick, Warrior Sidekick, and Spellcaster Sidekick have no subclass catalogue authority in Supabase. No Adventuring Class likewise has no subclass family.

## Regression guard

`scripts/validate_class_subclass_browser.mjs` protects the promoted selector families. It verifies that:

- every promoted selector file exists and is non-empty;
- the centralized resolver contains each approved class/family mapping and naming alias;
- Wizard's existing one-to-one selector artwork remains intact;
- missing future subclasses retain the safe Class-menu fallback;
- the selector remains presentation-only and does not acquire Supabase authority;
- protected world-map, town/city-map, crafting, encounter, or other gameplay boundaries are not crossed.

## 2026-09-10 publication chain

Binary materialization:

`fcb2015e287a00d5d83b479c859cad39a67aed38` — `Install approved subclass artwork continuation batch`

Resolver promotion:

`07fd74c749a9e01b7a9377f94fcceec834b1b1be` — `Wire approved subclass artwork continuation batch`

Regression guard:

`9a7c0d8a35e1d72fb7853447e72016f518552ab3` — `Guard approved subclass artwork continuation batch`

Preferred-catalogue alias correction:

`ef56ee149924615888f524c296c12b7839791406` — `Align subclass artwork aliases with preferred catalog`

Dropbox transfer archive:

`/DNDNext-Transfer/dndnext-subclass-art-batch-20260910.zip`

Archive SHA-256:

`e04ea88dc11e49ced6bcfbd417abc80d9204a00a95c07069c24ad18cfbb33677`

## Protected boundaries

- No Supabase writes or migrations.
- No Class/subclass rules or persistence changes.
- No world-map code.
- No town/city-map code.
- No crafting, travel, merchant, inventory, encounter, tactical, or character-sheet runtime changes.
