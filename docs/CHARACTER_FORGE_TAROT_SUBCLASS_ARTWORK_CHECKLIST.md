# Character Forge Tarot Subclass Artwork Checklist

Status date: 2026-09-16

This checklist tracks the production-visible Tarot deck, not the historical preferred-source concept count.

## Completion authority

Historical normalized checkpoint:

- **109 approved preferred-source concepts** were installed/mapped/validated before the current completion pass.
- The 109 milestone remains useful provenance.
- It is **not** the final production completion target.

Current production target after the 2026-09-16 approved artwork batch:

- runtime-visible choices: **149**;
- dedicated-card target: **149**;
- visible choices now covered by dedicated/approved Tarot art: **127**;
- known visible choices still resolving to generic/class fallback: **22**;
- normalized installed Tarot concepts after this batch: **130** because the historical ledger also retains the four suppressed Wizard compatibility identities.

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

## 2026-09-16 approved and installed batch — 21

The following cards were individually approved by Paul in the artwork review conversation and are the only newly promoted cards in this batch:

### Bard — 3

- [x] Creation
- [x] Eloquence
- [x] Whispers

### Fighter — 5

- [x] Arcane Archer
- [x] Cavalier
- [x] Echo Knight
- [x] Purple Dragon Knight (Banneret)
- [x] Rune Knight

### Monk — 2

- [x] Drunken Master
- [x] Kensei

### Paladin — 3

- [x] Conquest
- [x] Oathbreaker
- [x] Redemption

### Ranger — 4

- [x] Drakewarden
- [x] Horizon Walker
- [x] Monster Slayer
- [x] Swarmkeeper

### Rogue — 4

- [x] Inquisitive
- [x] Mastermind
- [x] Scout
- [x] Swashbuckler

**Approved this batch: 21.**

Do not regenerate or re-queue these unless Paul explicitly asks for a replacement. In particular, **Mastermind is already complete**.

## Current runtime fallback queue — 22

A checked item means the exact runtime-visible identity has an approved canonical 7:12 Tarot asset, explicit resolver wiring (or an explicitly approved intentional alias), and has passed focused validation.

### Barbarian — 7

- [ ] Ancestral Guardian
- [ ] Battlerager
- [ ] Beast
- [ ] Giant
- [ ] Storm Herald
- [ ] Totem Warrior
- [ ] Wild Magic

### Bard — 1

- [ ] Swords

### Fighter — 1

- [ ] Samurai

### Monk — 5

- [ ] Ascendant Dragon
- [ ] Astral Self
- [ ] Four Elements
- [ ] Long Death
- [ ] Sun Soul

### Mystic — 6

- [ ] Avatar
- [ ] Awakened
- [ ] Immortal
- [ ] Nomad
- [ ] Soul Knife
- [ ] Wu Jen

### Paladin — 2

- [ ] Crown
- [ ] Watchers

### Ranger — 0

- Complete for the current visible runtime catalogue.

### Rogue — 0

- Complete for the current visible runtime catalogue.

**Current remaining total: 22.**

The most recent generated drafts for **Swords**, **Crown**, and **Astral Self** are not checked here because they have not yet received explicit individual approval. Generation alone does not count as completion.

Re-audit the actual runtime-visible set after each approved installation batch before changing the total.

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

## Art standard summary

- 7:12 aspect ratio.
- 840×1440 WebP final export.
- Full-bleed illustration through title/emblem area.
- No opaque footer or separate title band.
- Fixed reusable antique-gold frame/title/emblem geometry.
- Restrained lower readability gradient.
- Crisp cinematic fantasy realism.
- Deliberate species/gender/presentation/pose/environment diversity.
- Prefer underused Forge species when the subclass fantasy supports them.
- Vary facing direction, camera angle, focal point, action, weather, environment, and color temperature across the remaining deck.
- Mandatory full-resolution anatomy/prop/species QA.

Detailed authority: `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

## Production/Preview rule

Work from current `main` or an explicitly current artwork branch. PR #187 is historical/working context, not production authority.

Ordinary `agent/*` commits skip full Vercel Preview builds. Use `[deploy-preview]` only on the exact commit requiring browser review.

## Protected boundaries

Subclass art is presentation-only. No Supabase write/migration is required. Do not touch world-map/town-map behavior, travel/routes/weather/camps/clock, crafting, inventory, merchants, economy, encounter/tactical authority, or unrelated character runtime while completing this queue.
