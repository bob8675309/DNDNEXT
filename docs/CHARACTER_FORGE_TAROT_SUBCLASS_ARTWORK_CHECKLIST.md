# Character Forge Tarot Subclass Artwork Checklist

Status date: 2026-09-14

This checklist now distinguishes the historical preferred-source rebuild checkpoint from the actual runtime-visible production target.

## Completion authority

Historical checkpoint:

- **109 preferred-source normalized concepts** were installed, wired, and validated during the normalized rebuild.
- That 109-concept milestone remains valid as provenance/history.
- It is **not** the final deck-completion number because the Forge carousel exposes additional compatible subclass choices at runtime.

Current production target:

- **Runtime-visible choices:** 149
- **Dedicated-card target:** 149
- **Known visible choices still using generic class/fallback artwork:** 43

Intentional art sharing is permitted only where Paul explicitly approves two visible names sharing the same card. Do not silently count a class-art fallback as a completed subclass card.

Read first:

- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`
- `docs/DNDNext_Current_Handoff_Prompt.md`

## Wizard compatibility note

The older preferred-source checklist contains 18 Wizard concepts, but the runtime resolver exposes 14 visible Wizard choices. Four normalized names are compatibility/reprint identities that are currently suppressed from the visible carousel in favor of their corresponding resolved choices:

- Abjuration
- Divination
- Evocation
- Illusion

Their normalized assets/mappings remain in the repository. Do not put those four names into the 43-card fallback queue merely because the historical Wizard count is larger than the runtime count.

## Runtime fallback production queue — 43

A checkbox below means the visible runtime choice has received a dedicated approved 7:12 tarot asset and explicit runtime wiring. Re-audit the resolver/runtime after each batch before marking completion.

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

Total remaining runtime fallbacks at this audit: **43**.

## Card completion rule

A runtime-visible choice counts as complete only after all applicable steps are true:

1. The exact visible subclass identity is confirmed against current Forge runtime/catalogue behavior.
2. Paul reviews and approves the individual artwork.
3. Anatomy, hands, weapons, props, companions, and species details pass QA.
4. The card uses canonical 7:12 composition and continuous full-bleed art with no opaque footer.
5. Final export is 840 x 1440 WebP.
6. The file is installed under `public/media/subclasses/<class-key>/`.
7. `utils/classes/subclassArtwork.js` explicitly resolves that visible identity to approved subclass art, or an intentional alias is documented and approved.
8. The card does not silently fall back to generic class artwork.
9. Focused validation passes.
10. Runtime/preview behavior is checked when an intentional preview is requested.

## Validator gap that must be closed before final completion

`scripts/validate_class_subclass_browser.mjs` currently asserts the historical set of 109 installed approved concepts and also asserts that unmatched content has a safe fallback. That remains useful, but it can allow a known visible Forge choice to fall back silently.

Before the deck is declared fully complete, validation should enumerate the **actual visible runtime choices** and fail if any known visible production choice uses generic class artwork, while preserving:

- approved intentional aliases;
- the four suppressed Wizard duplicate/reprint identities;
- safe fallback for truly unknown/future content;
- existing class-guide/model authority for subclass behavior.

The validator change is a runtime-safety follow-up; do not change subclass eligibility/persistence to make the artwork audit pass.

## Art standard summary

- 7:12 aspect ratio.
- 840 x 1440 WebP final export.
- Full-bleed artwork through title/emblem area.
- No opaque footer/title band.
- Fixed gold frame/title/emblem geometry.
- Crisp cinematic fantasy realism; restrained glitter, random motes, and excessive shine.
- Deliberate species/gender/pose/environment variety.
- Mandatory full-resolution anatomy/prop QA.

The detailed visual contract remains `docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

## Protected boundaries

Subclass artwork is presentation-only. No Supabase writes/migrations are required. Do not touch world-map/town-map behavior, crafting, inventory, merchants, travel, encounter/tactical authority, economy, or unrelated character runtime while completing this queue.
