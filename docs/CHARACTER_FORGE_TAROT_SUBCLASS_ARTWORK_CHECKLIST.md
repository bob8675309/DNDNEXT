# Character Forge Tarot Subclass Artwork Checklist

Status date: 2026-09-17

This checklist tracks the production-visible Tarot deck, not the historical preferred-source concept count.

## Completion authority

Historical normalized checkpoint:

- **109 approved preferred-source concepts** were the earlier normalized milestone.
- That number remains provenance only and is not the production completion target.

Current completed artwork-branch state:

- runtime-visible choices: **149**;
- dedicated-card target: **149**;
- runtime-visible choices with approved dedicated Tarot coverage: **149**;
- known current runtime-visible choices resolving to generic/class fallback: **0**;
- normalized installed Tarot concepts in the repository ledger: **152**, because the historical normalized set also retains the four suppressed Wizard compatibility identities and approved source aliases remain explicit.

**Current remaining Tarot card queue: 0.**

Intentional art sharing remains allowed only when Paul explicitly approves it. Generic class-art fallback does not count as a completed subclass card.

Read first for future maintenance:

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

Their normalized assets/mappings remain repository history. They are not missing production cards and must not be re-added to the visible missing-card queue solely because the historical Wizard cardinality is higher than the runtime-visible Wizard set.

## 2026-09-16 installed/validated artwork batch — 21

- Bard: Creation, Eloquence, Whispers
- Fighter: Arcane Archer, Cavalier, Echo Knight, Purple Dragon Knight (Banneret), Rune Knight
- Monk: Drunken Master, Kensei
- Paladin: Conquest, Oathbreaker, Redemption
- Ranger: Drakewarden, Horizon Walker, Monster Slayer, Swarmkeeper
- Rogue: Inquisitive, Mastermind, Scout, Swashbuckler

Mastermind is complete and must not be re-queued unless Paul explicitly requests a replacement.

## 2026-09-17 final completion batch — 22

All of the following received explicit individual/batch approval from Paul, were normalized to canonical 7:12 **840x1440 WebP**, installed under canonical subclass paths, wired to their exact runtime-visible identities, and are covered by the focused subclass validator.

### Barbarian — 7

- [x] Ancestral Guardian
- [x] Battlerager
- [x] Beast
- [x] Giant
- [x] Storm Herald
- [x] Totem Warrior
- [x] Wild Magic

Final-review notes:

- Giant uses the approved revised weapon artwork.
- Totem Warrior uses the approved final composition with the purple footer-emblem fill removed.

### Bard — 1

- [x] Swords

### Fighter — 1

- [x] Samurai

### Monk — 5

- [x] Ascendant Dragon
- [x] Astral Self
- [x] Four Elements
- [x] Long Death
- [x] Sun Soul

### Mystic — 6

- [x] Avatar
- [x] Awakened
- [x] Immortal
- [x] Nomad
- [x] Soul Knife
- [x] Wu Jen

Final-review notes:

- Avatar uses the stronger revised presentation.
- Nomad uses the revised, more-covered costume composition.
- Long Death uses the revision with less-prominent hair.
- Soul Knife uses Paul's explicitly selected final image from the last review.
- Wu Jen uses Paul's explicitly selected final image from the last review.

### Paladin — 2

- [x] Crown
- [x] Watchers

Watchers uses the approved final revised species/composition.

**Final completion batch: 22.**

## Runtime fallback queue — 0

The current 149 runtime-visible subclass choices all have approved dedicated Tarot coverage. The resolver retains a class-art fallback only as a safety net for genuinely unknown or future catalogue content.

Re-audit the actual runtime-visible set whenever subclass catalogue/compatibility behavior changes. Do not assume 149 is permanent if new playable subclass identities are later imported.

## Card completion rule

For any future visible subclass:

1. Confirm the exact visible identity against current Forge runtime/catalogue behavior.
2. Paul reviews and approves the individual artwork.
3. Anatomy, hands, weapons, props, companions, and species details pass QA.
4. The card follows the canonical 7:12 full-bleed template.
5. Final export is 840x1440 WebP.
6. Install under `public/media/subclasses/<class-key>/`.
7. Wire the exact visible identity in `utils/classes/subclassArtwork.js`, unless an intentional alias was explicitly approved.
8. Confirm the choice no longer silently falls back to generic class art.
9. Run focused validation.
10. Check an intentional Vercel Preview when browser validation is needed.

## Art standard summary

- 7:12 aspect ratio.
- 840x1440 WebP final export.
- Full-bleed illustration through title/emblem area.
- No opaque footer or separate title band.
- Fixed reusable antique-gold frame/title/emblem geometry.
- Restrained lower readability gradient.
- Crisp cinematic fantasy realism.
- Deliberate species/gender/presentation/pose/environment diversity.
- Prefer underused Forge species when the subclass fantasy supports them.
- Vary facing direction, camera angle, focal point, action, weather, environment, and color temperature across the deck.
- Mandatory full-resolution anatomy/prop/species QA.

Detailed authority: `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

## Production/Preview rule

Work from current `main` or an explicitly current artwork branch. PR #187 is historical/working context, not production authority.

Ordinary `agent/*` commits skip full Vercel Preview builds. Use `[deploy-preview]` only on the exact commit requiring browser review.

## Protected boundaries

Subclass art is presentation-only. No Supabase write/migration is required. Do not touch world-map/town-map behavior, travel/routes/weather/camps/clock, crafting, inventory, merchants, economy, encounter/tactical authority, or unrelated character runtime while maintaining this deck.
