# Character Forge Subclass Artwork Status

Status date: 2026-09-14

This is the focused handoff for the Character Forge subclass selector artwork rollout originally developed on PR #177 (`agent/realistic-dice-core`), now merged into `main` at `02854698298f357d2dfde21dd292ba7caf73e1c1`. Current source, exact-head CI/browser behavior where noted below, and the preferred Supabase Class/Species catalogues remain authoritative over older screenshots or notes.

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

## Subclass-art casting pool — use the full Forge Species catalogue

The remaining subclass artwork should no longer default mainly to Humans, Elves, Dwarves, Tieflings, and the other most familiar core Species. The Character Forge now provides a much larger pool of valid character identities that can be used as the visible subject of subclass selector art.

Live Supabase currently contains **102 preferred Species catalogue rows**. The Forge's current family-expansion/presentation layer intentionally collapses source rows and promotes source-backed lineage/ancestry choices, producing **83 top-level Species entries plus 43 named nested lineage, ancestry, subrace, subtype, or setting/source presentations**. For subclass-art casting purposes, that gives **126 named Forge Species presentations** before counting narrower trait-level appearance choices.

Art-direction rules for the remaining subclass batches:

- Treat the full pool below as available casting material. Do not repeatedly fall back to Human or the same small set of PHB-style Species when another Forge Species fits the subclass fantasy.
- Prefer broad visual diversity across the unfinished subclass set. Avoid repeating the exact same Species/presentation in the remaining 33 cards unless the subclass concept strongly benefits from it.
- A nested Forge presentation such as Air Genasi, Drow, Beasthide Shifter, Shadowmoor Fairy, or Amethyst Gem Dragonborn can be cast as its own visual identity even though Forge persistence may be owned by a parent Species.
- Setting/source children remain real source-backed Species rows where the Forge models them that way. Their artwork use does not merge their rules into the parent.
- Independently published Species such as Astral Elf, Sea Elf, Eladrin, Shadar-Kai, Duergar, and Deep Gnome remain independent top-level choices and should be treated as distinct casting options.
- `Elf (Zendikar)` still exists in the underlying preferred data but is intentionally hidden/excluded from the Forge and is **not** part of the casting pool below.
- The old FTD `Dragonborn (Chromatic)`, `Dragonborn (Metallic)`, and `Dragonborn (Gem)` umbrella rows are not separate Forge casting entries. Use the specific 15 Dragonborn ancestry presentations below instead.
- Goliath Giant Ancestry, Tiefling Fiendish Legacy, and Aasimar transformations are trait-level/configuration choices rather than additional Species and are not included in the 126 count. They may still inform the appearance of a Goliath, Tiefling, or Aasimar subject where useful.
- Species choice is an art-direction decision only. It must not create or alter subclass rules, Class eligibility, persistence, source authority, or gameplay state.

### Full current Forge Species casting pool

- **Aarakocra**
- **Aasimar**
- **Aetherborn**
- **Astral Elf**
- **Autognome**
- **Aven**
  - Hawk-Headed Aven
  - Ibis-Headed Aven
- **Boggart**
- **Bugbear**
- **Bullywug**
- **Centaur**
- **Changeling**
- **Custom Lineage**
- **Deep Gnome**
- **Dhampir**
- **Dragonborn**
  - Black Dragonborn
  - Blue Dragonborn
  - Brass Dragonborn
  - Bronze Dragonborn
  - Copper Dragonborn
  - Gold Dragonborn
  - Green Dragonborn
  - Red Dragonborn
  - Silver Dragonborn
  - White Dragonborn
  - Amethyst Gem Dragonborn
  - Crystal Gem Dragonborn
  - Emerald Gem Dragonborn
  - Sapphire Gem Dragonborn
  - Topaz Gem Dragonborn
- **Duergar**
- **Dwarf**
  - Dwarf (Kaladesh)
- **Eladrin**
- **Elf**
  - Drow
  - High Elf
  - Wood Elf
  - Elf (Kaladesh)
- **Fairy**
  - Lorwyn Fairy
  - Shadowmoor Fairy
- **Firbolg**
- **Flamekin**
- **Genasi**
  - Air Genasi
  - Earth Genasi
  - Fire Genasi
  - Water Genasi
- **Giff**
- **Githyanki**
- **Githzerai**
- **Gnoll**
- **Gnome**
  - Forest Gnome
  - Rock Gnome
- **Goblin**
  - Goblin (Dankwood)
- **Goliath**
- **Grimlock**
- **Grung**
- **Hadozee**
- **Half-Elf**
- **Half-Orc**
- **Halfling**
- **Harengon**
- **Hexblood**
- **Hobgoblin**
- **Human**
  - Human (Innistrad)
  - Human (Ixalan)
  - Human (Kaladesh)
  - Human (Zendikar)
- **Kalashtar**
- **Kender**
- **Kenku**
- **Khenra**
- **Khoravar**
- **Kithkin**
  - Lorwyn Kithkin
  - Shadowmoor Kithkin
- **Kobold**
- **Kor**
- **Kuo-Toa**
- **Leonin**
- **Lizardfolk**
- **Locathah**
- **Lorwyn Changeling**
- **Loxodon**
- **Lupin**
- **Merfolk**
- **Minotaur**
  - Minotaur (Amonkhet)
- **Naga**
- **Orc**
  - Orc (Ixalan)
- **Owlin**
- **Plasmoid**
- **Reborn**
- **Rimekin**
- **Satyr**
- **Sea Elf**
- **Shadar-Kai**
- **Shifter**
  - Beasthide Shifter
  - Longtooth Shifter
  - Swiftstride Shifter
  - Wildhunt Shifter
- **Simic Hybrid**
- **Siren**
- **Skeleton**
- **Tabaxi**
- **Thri-kreen**
- **Tiefling**
- **Tortle**
- **Triton**
- **Troglodyte**
- **Vampire**
- **Vedalken**
- **Verdan**
- **Warforged**
- **Yuan-Ti**
- **Yuan-ti Pureblood**
- **Zombie**

For visual-variety planning, especially strong underused candidates include Aetherborn, Aven, Boggart, Bullywug, Flamekin, Giff, Githzerai, Gnoll, Grimlock, Grung, Hadozee, Kender, Khenra, Khoravar, Kithkin, Kor, Kuo-Toa, Locathah, Lorwyn Changeling, Lupin, Naga, Plasmoid, Rimekin, Siren, Thri-kreen, Troglodyte, Verdan, Yuan-Ti, plus the Genasi, Dragonborn, Shifter, Fairy, Kithkin, and Aven child presentations. These are suggestions for variety, not mandatory pairings; subclass fantasy and composition still decide the final subject.

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

## 2026-09-14 species-pool handoff refresh

The species-casting expansion above is documentation/art-direction only. It was derived from the live preferred Supabase Species catalogue plus the Forge family/presentation code on `main`. No binary artwork, resolver mapping, Class/subclass behavior, Supabase data, or runtime system was changed in this refresh.

## Protected boundaries

- No Supabase writes or migrations.
- No Class/subclass rules or persistence changes.
- No world-map code.
- No town/city-map code.
- No crafting, travel, merchant, inventory, encounter, tactical, or character-sheet runtime changes.
