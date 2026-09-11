# Character Forge Tarot Subclass Artwork Checklist

Status date: 2026-09-11

This is the working art-production checklist for the new portrait tarot-card subclass gallery. It exists specifically to prevent accidental remakes and to keep the visual remaster aligned with the preferred Supabase Class catalogue.

## Authority and style contract

- Supabase `class_catalog_preferred` + matching `class_feature_catalog` rows are the source of truth for which subclasses are currently exposed.
- Selection, level eligibility, persistence, and progression remain in the existing Class guide model. Artwork remains presentation-only.
- Tarot card art target: **5:7 portrait**, exported as **840x1176 WebP** for the Forge gallery.
- Keep the ornate gold frame and black title band.
- Gold inside the illustration should be controlled; the frame already carries the strongest gold treatment.
- Vary Species, gender presentation, age, pose, camera angle, gaze direction, action, and focal point.
- Sexy is acceptable, but keep it tasteful: avoid excessive exposed skin and exaggerated anatomy.
- Prefer strong environmental storytelling and immediate subclass identity.
- Do **not** remake any entry marked ✅ unless Paul explicitly asks for a revision.

Legend:

- ✅ **Tarot remaster installed on the current gallery branch**
- 🟨 **Concept approved, but still needs a clean standalone tarot card rerender/export**
- ⬜ **Legacy/wide artwork exists or safe fallback exists; tarot remaster still needed**

## Current publication checkpoint

The 2026-09-11 reviewed payload installed **37 portrait tarot assets** on `agent/subclass-carousel-selector-20260911` and wired all newly completed preferred subclass names through `utils/classes/subclassArtwork.js`.

Dropbox transfer backup:

`/DNDNext-Transfer/dndnext-tarot-remaster-20260911.zip`

Archive SHA-256:

`d1051042b90680a3bd1abb9e9cfc41ad56466b0cfd094c211f1ee0d3426207f1`

Current count after this checkpoint:

- **37** installed tarot cards
- **6** Cleric cards with approved varied-composition direction that still need standalone rerenders
- **66** other preferred art concepts still using legacy/wide/fallback presentation
- **72 total distinct tarot cards still to finish**

## Artificer

- ✅ Alchemist
- ✅ Armorer
- ✅ Artillerist
- ✅ Battle Smith
- ⬜ Cartographer
- ⬜ Reanimator

## Barbarian

- ⬜ Berserker
- ✅ Wild Heart
- ✅ World Tree
- ⬜ Zealot

## Bard

- ✅ Dance
- ⬜ Glamour
- ⬜ Lore
- ✅ Moon
- ✅ Spirits
- ⬜ Valor

## Cleric

`Knowledge (PSA)` intentionally shares the Knowledge artwork concept.

- ✅ Ambition / Ambition (PSA)
- ✅ Arcana
- ✅ Death
- ✅ Forge
- ✅ Grave
- ⬜ Knowledge / Knowledge (PSA)
- ⬜ Life
- ⬜ Light
- ✅ Nature
- 🟨 Order — corrected varied-pose direction approved in the six-card Cleric composition; standalone card still needed
- 🟨 Peace — corrected varied-pose direction approved; standalone card still needed
- 🟨 Solidarity / Solidarity (PSA) — corrected varied-pose direction approved; standalone card still needed
- 🟨 Strength / Strength (PSA) — corrected varied-pose direction approved; standalone card still needed
- ⬜ Tempest
- ⬜ Trickery
- 🟨 Twilight — corrected varied-pose direction approved; standalone card still needed
- ⬜ War
- 🟨 Zeal / Zeal (PSA) — corrected varied-pose direction approved; standalone card still needed

## Druid

- ✅ Dreams
- ⬜ Land
- ⬜ Moon
- ✅ Sea
- ⬜ Shepherd
- ⬜ Spores
- ⬜ Stars
- ⬜ Wildfire

## Fighter

- ⬜ Banneret
- ⬜ Battle Master
- ⬜ Champion
- ✅ Eldritch Knight
- ✅ Psi Warrior

## Monk

- ⬜ Elements
- ✅ Mercy
- ⬜ Open Hand
- ⬜ Shadow

## Monster Hunter

- ⬜ Carver
- ⬜ Devourer
- ⬜ Occultist
- ⬜ Trapper

## Mystic

The current preferred Mystic source exposes no subclass catalogue rows. Do not create more Mystic tarot cards until the catalogue changes or Paul explicitly asks for compatible-source art.

## Paladin

- ⬜ Ancients
- ⬜ Devotion
- ⬜ Glory
- ⬜ Noble Genies
- ✅ Vengeance

## Ranger

- ⬜ Beast Master
- ⬜ Fey Wanderer
- ⬜ Gloom Stalker
- ✅ Hollow Warden
- ⬜ Hunter
- ✅ Winter Walker

## Rogue

- ⬜ Arcane Trickster
- ⬜ Assassin
- ⬜ Phantom
- ✅ Scion of the Three
- ⬜ Soulknife
- ⬜ Thief

## Sorcerer

The paired names below intentionally share one artwork concept where the preferred catalogue exposes equivalent naming variants.

- ⬜ Aberrant / Aberrant Mind
- ⬜ Clockwork / Clockwork Soul
- ⬜ Divine Soul
- ⬜ Draconic
- ✅ Lunar
- ✅ Pyromancer / Pyromancer (PSK)
- ⬜ Shadow
- ✅ Spellfire
- ✅ Storm
- ⬜ Wild / Wild Magic

## Warlock

- ⬜ Archfey
- ⬜ Celestial
- ✅ Fathomless
- ⬜ Fiend
- ✅ Genie
- ⬜ Great Old One
- ⬜ Hexblade
- ⬜ Undead
- ✅ Undying

## Wizard

Wizard currently has one-to-one file coverage guarded by `validate_class_subclass_browser.mjs`, so similarly named catalogue rows remain separate checklist entries until that contract is deliberately changed.

- ⬜ Abjuration
- ✅ Abjurer
- ✅ Bladesinger
- ⬜ Bladesinging
- ✅ Chronurgy
- ✅ Conjuration
- ⬜ Divination
- ✅ Diviner
- ✅ Enchantment
- ⬜ Evocation
- ⬜ Evoker
- ⬜ Graviturgy
- ⬜ Illusion
- ⬜ Illusionist
- ⬜ Necromancy
- ⬜ Scribes
- ⬜ Transmutation
- ⬜ War

## Classes without an active subclass art queue

- No Adventuring Class — no subclass family
- Expert Sidekick — no subclass catalogue authority
- Warrior Sidekick — no subclass catalogue authority
- Spellcaster Sidekick — no subclass catalogue authority

## Next production batch

To avoid remaking completed work, continue with entries still marked 🟨 or ⬜. Recommended next six:

1. Cleric — Order standalone rerender
2. Cleric — Peace standalone rerender
3. Cleric — Solidarity standalone rerender
4. Cleric — Strength standalone rerender
5. Cleric — Twilight standalone rerender
6. Cleric — Zeal standalone rerender

After those six are exported individually, continue with **Artificer Cartographer + Reanimator**, then the remaining preferred legacy families in checklist order.

## Protected boundaries

- No Supabase writes or migrations for artwork.
- No Class/subclass rules or persistence changes.
- No world-map or town/city-map changes.
- No crafting, inventory, merchant, travel, encounter, tactical, or character-sheet runtime changes.
