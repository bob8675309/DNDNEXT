# Character Forge Tarot Subclass Artwork Checklist

Status date: 2026-10-08

This checklist tracks the production-visible Tarot deck, not the historical preferred-source concept count.

## Completion authority

Historical normalized checkpoint:

- **109 approved preferred-source concepts** were the earlier normalized milestone.
- That number remains provenance only and is not the production completion target.

Current artwork state after the Grim Hollow Player's Guide expansion:

- runtime-visible subclass choices: **185**;
- dedicated-card target: **185**;
- runtime-visible choices with approved dedicated Tarot coverage installed: **159**;
- current Grim Hollow choices still awaiting dedicated Tarot cards: **26**;
- normalized installed Tarot concepts enforced by the repository validator: **161**.

The prior deck covered all 149 pre-expansion runtime-visible choices. The Grim Hollow import adds 36 new visible identities beyond the four Monster Hunter Guilds that were already represented. Ten of those 36 now have approved dedicated cards installed, leaving **26** to create.

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

## 2026-10-08 Grim Hollow expansion batch — 10 installed

These cards received Paul's explicit approval in the current Grim Hollow rollout, were normalized to the canonical 7:12 **840x1440 WebP** format, installed under the canonical subclass paths, and wired to their exact runtime-visible identities.

### Barbarian — 3

- [x] Path of the Fractured
- [x] Path of the Primal Spirit
- [x] Path of the Wrathful Dead

### Bard — 3

- [x] College of Adventurers
- [x] College of Fools
- [x] College of Requiems

### Cleric — 3

- [x] Eldritch Domain
- [x] Inquisition Domain
- [x] Purification Domain

### Druid — 1

- [x] Circle of Blood

Approval notes:

- The Grim Hollow extension keeps the older approved Tarot border/title/emblem language used by cards such as Battle Master and Soul Knife.
- The artwork target is photoreal/cinematic rather than painterly.
- Species, pose, camera direction, and silhouette are intentionally varied across the set.
- Revised anatomy was explicitly required where earlier drafts had missing limbs or unnatural torso/leg alignment.
- Circle of Blood uses the corrected two-leg composition approved by Paul.

## Current missing-card queue — 26

### Druid — 2
- [ ] Circle of Entropy
- [ ] Circle of Mutation

### Fighter — 3
- [ ] Bulwark Warrior
- [ ] Living Crucible
- [ ] Nightwatcher

### Monk — 3
- [ ] Warrior of Pride
- [ ] Warrior of Regret
- [ ] Warrior of the Leaden Crown

### Paladin — 3
- [ ] Oath of Pestilence
- [ ] Oath of Slaughter
- [ ] Oath of Zeal

### Ranger — 3
- [ ] Green Reaper
- [ ] Primordial Archer
- [ ] Vermin Lord

### Rogue — 3
- [ ] Highway Rider
- [ ] Misfortune Bringer
- [ ] Sanguine Thief

### Sorcerer — 3
- [ ] Apocalypse Sorcery
- [ ] Haunted Sorcery
- [ ] Wretched Bloodline Sorcery

### Warlock — 3
- [ ] The Coven
- [ ] The First Vampire Patron
- [ ] The Parasite Patron

### Wizard — 3
- [ ] Daemonologist
- [ ] Plague Doctor
- [ ] Sangromancer

The four Monster Hunter Guilds from Grim Hollow—Carver, Devourer, Occultist, and Trapper—already had approved dedicated Tarot coverage before this expansion and are not part of the 26-card queue.

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
