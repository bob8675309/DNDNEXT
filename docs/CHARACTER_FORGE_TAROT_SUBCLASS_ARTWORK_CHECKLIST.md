# Character Forge Tarot Subclass Artwork Checklist

Status date: 2026-09-16

This checklist tracks the production-visible Tarot deck, not the historical preferred-source concept count.

## Completion authority

Historical normalized checkpoint:

- **109 approved preferred-source concepts** were installed/mapped/validated before the current completion pass.
- The 109 milestone remains useful provenance.
- It is **not** the final production completion target.

Current production target:

- runtime-visible choices: **149**;
- dedicated-card target: **149**;
- currently installed/validated visible choices on the artwork branch: **127**;
- runtime-visible choices still resolving to fallback on that branch: **22**;
- additionally approved artwork waiting to be normalized/installed/wired: **13**;
- generated/revised cards still awaiting explicit final approval: **9**.

If the 13 approved-pending cards are installed successfully, the visible fallback queue will drop from **22 to 9**.

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

## Installed and validated in the current artwork branch — 21

These cards were individually approved, normalized to the canonical 840x1440 WebP format, installed, wired in `utils/classes/subclassArtwork.js`, and passed the focused subclass validator.

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

**Installed/validated in this batch: 21.**

Do not regenerate or re-queue these unless Paul explicitly asks for a replacement. In particular, **Mastermind is already complete**.

## Explicitly approved, pending install/wiring — 13

These cards have received explicit approval in the current artwork review but are not yet counted as installed completion because they have not yet gone through final export/install/resolver/validation on the branch.

### Barbarian — 7

- [~] Ancestral Guardian
- [~] Battlerager
- [~] Beast
- [~] Giant
- [~] Storm Herald
- [~] Totem Warrior
- [~] Wild Magic

Notes:
- Giant was revised with a new weapon and approved in the locked batch.
- Totem Warrior was revised to remove the purple footer-emblem fill while preserving the approved composition, then the batch was locked.

### Bard — 1

- [~] Swords

### Fighter — 1

- [~] Samurai

### Monk — 2

- [~] Astral Self
- [~] Ascendant Dragon

### Paladin — 2

- [~] Crown
- [~] Watchers

Notes:
- Swords, Crown, and Astral Self were explicitly approved before the 19-card continuation.
- Giant and Watchers were explicitly approved after revision.
- The complete 10-card batch containing Ancestral Guardian, Battlerager, Beast, Giant, Storm Herald, Totem Warrior, Wild Magic, Samurai, Watchers, and Ascendant Dragon was then explicitly locked in before work moved to the final nine.

**Approved but pending install: 13.**

## Generated/revised, awaiting explicit final approval — 9

These have artwork drafts in the current conversation. They must **not** be marked complete until Paul explicitly approves the final version and they then pass export/install/wiring/validation.

### Monk — 3

- [ ] Four Elements
- [ ] Long Death
- [ ] Sun Soul

Current review state:
- Four Elements: generated; no final approval recorded yet.
- Long Death: revised to reduce the prominence of the hair; awaiting final approval.
- Sun Soul: generated; no final approval recorded yet.

### Mystic — 6

- [ ] Avatar
- [ ] Awakened
- [ ] Immortal
- [ ] Nomad
- [ ] Soul Knife
- [ ] Wu Jen

Current review state:
- Avatar: revised to appear more powerful; awaiting final approval.
- Awakened: generated; no final approval recorded yet.
- Immortal: generated; no final approval recorded yet.
- Nomad: revised for more coverage; awaiting final approval.
- Soul Knife: revised for a more natural left-hand position; awaiting final approval.
- Wu Jen: redrawn with a new species; awaiting final approval.

**Awaiting final approval: 9.**

## Current queue summary

### Runtime fallback right now on the artwork branch — 22

Because the 13 newly approved cards have not yet been installed/wired, the runtime branch still has the following fallback identities:

- Barbarian: Ancestral Guardian, Battlerager, Beast, Giant, Storm Herald, Totem Warrior, Wild Magic
- Bard: Swords
- Fighter: Samurai
- Monk: Ascendant Dragon, Astral Self, Four Elements, Long Death, Sun Soul
- Mystic: Avatar, Awakened, Immortal, Nomad, Soul Knife, Wu Jen
- Paladin: Crown, Watchers

### Artwork still needing approval after the approved-pending batch installs — 9

- Monk: Four Elements, Long Death, Sun Soul
- Mystic: Avatar, Awakened, Immortal, Nomad, Soul Knife, Wu Jen

Once those nine are individually approved, installed, wired, and validated, the visible 149-card production deck can reach full dedicated-card coverage.

## Card completion rule

For every visible subclass:

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
- Vary facing direction, camera angle, focal point, action, weather, environment, and color temperature across the remaining deck.
- Mandatory full-resolution anatomy/prop/species QA.

Detailed authority: `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

## Production/Preview rule

Work from current `main` or an explicitly current artwork branch. PR #187 is historical/working context, not production authority.

Ordinary `agent/*` commits skip full Vercel Preview builds. Use `[deploy-preview]` only on the exact commit requiring browser review.

## Protected boundaries

Subclass art is presentation-only. No Supabase write/migration is required. Do not touch world-map/town-map behavior, travel/routes/weather/camps/clock, crafting, inventory, merchants, economy, encounter/tactical authority, or unrelated character runtime while completing this queue.
