# Character Forge Tarot Subclass Artwork Checklist

Status date: 2026-09-12

This is the authoritative production checklist for the **normalized rebuild** of the Character Forge subclass tarot deck.

The previous subclass artwork was intentionally deleted from the working branch on 2026-09-12. Progress therefore starts at **zero installed normalized tarot cards**.

Read first:

- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`

## Source of truth

The subclass queue below is derived from the current Supabase `class_catalog_preferred` joined to matching `class_feature_catalog` rows by preferred class source.

Rules:

- Supabase/class-guide data determines which subclass names exist.
- Artwork is presentation-only.
- Equivalent imported aliases may intentionally share one art concept only where grouped together below.
- Wizard names remain separate concepts in this checklist because the existing Wizard catalogue historically exposed one-to-one names.
- Do not add a subclass card merely because an older non-preferred source contains that subclass.
- Do not mark a card complete until it is approved, normalized to **7:12**, exported as **840 × 1440 WebP**, installed, wired, and validated.

Legend:

- ⬜ Not yet created/approved in the normalized deck
- 🟨 Art approved locally but not yet normalized/installed/wired
- ✅ Approved, normalized, installed, wired, and validated

## Progress

- **Target concepts:** 109
- **✅ Installed:** 0
- **🟨 Approved but not installed:** 0
- **⬜ Remaining:** 109

## Artificer — 6

- ⬜ Alchemist
- ⬜ Armorer
- ⬜ Artillerist
- ⬜ Battle Smith
- ⬜ Cartographer
- ⬜ Reanimator

## Barbarian — 4

- ⬜ Berserker
- ⬜ Wild Heart
- ⬜ World Tree
- ⬜ Zealot

## Bard — 6

- ⬜ Dance
- ⬜ Glamour
- ⬜ Lore
- ⬜ Moon
- ⬜ Spirits
- ⬜ Valor

## Cleric — 18 concepts

- ⬜ Ambition (PSA)
- ⬜ Arcana
- ⬜ Death
- ⬜ Forge
- ⬜ Grave
- ⬜ Knowledge / Knowledge (PSA) — shared concept
- ⬜ Life
- ⬜ Light
- ⬜ Nature
- ⬜ Order
- ⬜ Peace
- ⬜ Solidarity (PSA)
- ⬜ Strength (PSA)
- ⬜ Tempest
- ⬜ Trickery
- ⬜ Twilight
- ⬜ War
- ⬜ Zeal (PSA)

## Druid — 8

- ⬜ Dreams
- ⬜ Land
- ⬜ Moon
- ⬜ Sea
- ⬜ Shepherd
- ⬜ Spores
- ⬜ Stars
- ⬜ Wildfire

## Fighter — 5

- ⬜ Banneret
- ⬜ Battle Master
- ⬜ Champion
- ⬜ Eldritch Knight
- ⬜ Psi Warrior

## Monk — 4

- ⬜ Elements
- ⬜ Mercy
- ⬜ Open Hand
- ⬜ Shadow

## Monster Hunter — 4

- ⬜ Carver Guild
- ⬜ Devourer Guild
- ⬜ Occultist Guild
- ⬜ Trapper Guild

## Mystic

The current preferred-source join exposes no active Mystic subclass queue for this rebuild. Do not create Mystic tarot cards unless the preferred catalogue changes or Paul explicitly asks for a compatible-source set.

## Paladin — 5

- ⬜ Ancients
- ⬜ Devotion
- ⬜ Glory
- ⬜ Noble Genies
- ⬜ Vengeance

## Ranger — 6

- ⬜ Beast Master
- ⬜ Fey Wanderer
- ⬜ Gloom Stalker
- ⬜ Hollow Warden
- ⬜ Hunter
- ⬜ Winter Walker

## Rogue — 6

- ⬜ Arcane Trickster
- ⬜ Assassin
- ⬜ Phantom
- ⬜ Scion of the Three
- ⬜ Soulknife
- ⬜ Thief

## Sorcerer — 10 concepts

- ⬜ Aberrant / Aberrant Mind — shared concept
- ⬜ Clockwork / Clockwork Soul — shared concept
- ⬜ Divine Soul
- ⬜ Draconic
- ⬜ Lunar
- ⬜ Pyromancer (PSK)
- ⬜ Shadow
- ⬜ Spellfire
- ⬜ Storm
- ⬜ Wild / Wild Magic — shared concept

## Warlock — 9

- ⬜ Archfey
- ⬜ Celestial
- ⬜ Fathomless
- ⬜ Fiend
- ⬜ Genie
- ⬜ Great Old One
- ⬜ Hexblade
- ⬜ Undead
- ⬜ Undying

## Wizard — 18

- ⬜ Abjuration
- ⬜ Abjurer
- ⬜ Bladesinger
- ⬜ Bladesinging
- ⬜ Chronurgy
- ⬜ Conjuration
- ⬜ Divination
- ⬜ Diviner
- ⬜ Enchantment
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
- Mystic — no preferred-source subclass rows in the current rebuild join

## Recommended starting order

The new chat should work from the top of this checklist unless Paul chooses another class.

Recommended first small approval batch:

1. Artificer — Alchemist
2. Artificer — Armorer
3. Artificer — Artillerist
4. Artificer — Battle Smith

Keep the first batch small enough to verify the finalized **7:12 no-footer template** before scaling production.

## Completion rule

A checkbox becomes ✅ only after all of the following are true:

1. Individual card reviewed by Paul.
2. Passes anatomy/hand/prop QA.
3. Passes subclass-readability and variety tests.
4. Uses canonical 7:12 composition.
5. Uses continuous full-bleed art with **no footer**.
6. Uses the fixed frame/title/emblem geometry.
7. Exported at 840 × 1440 WebP.
8. Added under `public/media/subclasses/<class-key>/`.
9. Explicitly wired in `utils/classes/subclassArtwork.js`.
10. Checklist updated.
11. Relevant validation/CI passes.
12. Vercel preview checked.

## Protected boundaries

- No Supabase writes or migrations for artwork.
- No subclass rules or persistence changes.
- No world-map or town/city-map changes.
- No crafting, inventory, merchant, travel, encounter, tactical, or unrelated character-sheet runtime changes.
