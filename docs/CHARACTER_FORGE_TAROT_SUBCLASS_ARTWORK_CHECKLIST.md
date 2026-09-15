# Character Forge Tarot Subclass Artwork Checklist

Status date: 2026-09-15

This checklist tracks the production-visible Tarot deck, not the historical preferred-source concept count.

## Completion authority

Historical normalized checkpoint:

- **109 approved preferred-source concepts** were installed/mapped/validated.
- The 109 milestone remains useful provenance.
- It is **not** the final production completion target.

Current production target:

- runtime-visible choices: **149**;
- dedicated-card target: **149**;
- known visible choices still resolving to generic/class fallback: **43**.

Intentional art sharing is allowed only when Paul explicitly approves it. A generic class-art fallback never counts as a completed subclass card.

Read first:

- `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`;
- `CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`;
- `CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md`;
- `DNDNext_Current_Handoff_Prompt.md`.

## Wizard compatibility note

The historical Wizard normalized ledger contains 18 identities. Runtime compatibility suppresses four duplicate/reprint identities from the visible carousel:

- Abjuration
- Divination
- Evocation
- Illusion

Their normalized assets/mappings remain repository history. Do not add them to the missing-card queue solely because historical Wizard cardinality is higher than visible runtime cardinality.

## Current runtime fallback queue — 43

A checked item means the exact runtime-visible identity has an approved canonical 7:12 Tarot asset, explicit resolver wiring (or an explicitly approved intentional alias), and has passed focused validation.

### Barbarian — 7

- [ ] Ancestral Guardian
- [ ] Battlerager
- [ ] Beast
- [ ] Giant
- [ ] Storm Herald
- [ ] Totem Warrior
- [ ] Wild Magic

### Bard — 4

- [ ] Creation
- [ ] Eloquence
- [ ] Swords
- [ ] Whispers

### Fighter — 6

- [ ] Arcane Archer
- [ ] Cavalier
- [ ] Echo Knight
- [ ] Purple Dragon Knight (Banneret)
- [ ] Rune Knight
- [ ] Samurai

### Monk — 7

- [ ] Ascendant Dragon
- [ ] Astral Self
- [ ] Drunken Master
- [ ] Four Elements
- [ ] Kensei
- [ ] Long Death
- [ ] Sun Soul

### Mystic — 6

- [ ] Avatar
- [ ] Awakened
- [ ] Immortal
- [ ] Nomad
- [ ] Soul Knife
- [ ] Wu Jen

### Paladin — 5

- [ ] Conquest
- [ ] Crown
- [ ] Oathbreaker
- [ ] Redemption
- [ ] Watchers

### Ranger — 4

- [ ] Drakewarden
- [ ] Horizon Walker
- [ ] Monster Slayer
- [ ] Swarmkeeper

### Rogue — 4

- [ ] Inquisitive
- [ ] Mastermind
- [ ] Scout
- [ ] Swashbuckler

Current total: **43**.

Re-audit the actual runtime-visible set after each batch before changing the total.

## Card completion rule

For every visible subclass:

1. Confirm the exact visible identity against current Forge runtime/catalogue behavior.
2. Paul reviews and approves the individual artwork.
3. Anatomy, hands, weapons, props, companions, and species details pass QA.
4. The card follows the canonical 7:12 full-bleed template.
5. Final export is 840×1440 WebP.
6. Install under `public/media/subclasses/<class-key>/`.
7. Wire the exact visible identity in `utils/classes/subclassArtwork.js`, unless an intentional alias was explicitly approved.
8. Confirm the choice no longer silently falls back to generic class art.
9. Run focused validation.
10. Check an intentional Vercel Preview when browser validation is needed.

## Validator gap before final 149/149 completion

`scripts/validate_class_subclass_browser.mjs` currently asserts the historical 109 approved concept set and fallback safety. Before final deck completion, it must enumerate actual visible runtime choices and fail any known visible generic/class fallback while preserving:

- approved intentional aliases;
- the four suppressed Wizard compatibility identities;
- safe fallback for truly unknown/future content;
- existing Class model/context rules and persistence.

The validator must not change subclass eligibility to make artwork counts align.

## Art standard summary

- 7:12 aspect ratio.
- 840×1440 WebP final export.
- Full-bleed illustration through title/emblem area.
- No opaque footer or separate title band.
- Fixed reusable antique-gold frame/title/emblem geometry.
- Restrained lower readability gradient.
- Crisp cinematic fantasy realism.
- Deliberate species/gender/presentation/pose/environment diversity.
- Mandatory full-resolution anatomy/prop/species QA.

Detailed authority: `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

## Production/Preview rule

Work from current `main` or an explicitly current artwork branch. PR #187 is historical/working context, not production authority.

Ordinary `agent/*` commits skip full Vercel Preview builds. Use `[deploy-preview]` only on the exact commit requiring browser review.

## Protected boundaries

Subclass art is presentation-only. No Supabase write/migration is required. Do not touch world-map/town-map behavior, travel/routes/weather/camps/clock, crafting, inventory, merchants, economy, encounter/tactical authority, or unrelated character runtime while completing this queue.
