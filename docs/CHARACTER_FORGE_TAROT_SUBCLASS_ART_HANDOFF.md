# DNDNext Subclass Tarot Artwork — Current Handoff

Updated: 2026-09-15

Use this document as the subsystem handoff for continuing Character Forge subclass Tarot artwork from current production `main`.

## Current production authority

Repository: `bob8675309/DNDNEXT`

Reconciled `main` checkpoint: `663281753fc1f789bc7caa3092f6e9980f4458af`.

Production carousel/Tarot behavior was restored through merged PR #189. PR #187 (`agent/subclass-carousel-selector-20260911`) remains open as historical/working context but is not the integration authority. Do not merge #187 wholesale without a fresh compare against current `main`.

The selector remains presentation-only. Existing Class guide/model/context logic owns subclass identity, eligibility, level gates, selection, persistence, progression, and feature rules.

## Runtime visibility outranks the old 109-concept checkpoint

The repository historically declared a normalized preferred-source Tarot set complete at **109 / 109 concepts**. That remains valid provenance but is not the correct production completion definition.

Runtime audit shows:

- **149 visible subclass choices**;
- target: **149 dedicated cards**, except explicitly approved intentional shared art;
- **43 visible choices currently use generic/class fallback artwork**.

Do not declare the deck complete while a known visible choice silently resolves to generic class art.

## Wizard compatibility note

The historical Wizard normalized set contains 18 identities. Runtime compatibility suppresses these four duplicate/reprint identities from the visible carousel:

- Abjuration
- Divination
- Evocation
- Illusion

Their assets/mappings remain in the repository. They are not missing runtime cards.

## Current 43-card production queue

### Barbarian — 7

- Ancestral Guardian
- Battlerager
- Beast
- Giant
- Storm Herald
- Totem Warrior
- Wild Magic

### Bard — 4

- Creation
- Eloquence
- Swords
- Whispers

### Fighter — 6

- Arcane Archer
- Cavalier
- Echo Knight
- Purple Dragon Knight (Banneret)
- Rune Knight
- Samurai

### Monk — 7

- Ascendant Dragon
- Astral Self
- Drunken Master
- Four Elements
- Kensei
- Long Death
- Sun Soul

### Mystic — 6

- Avatar
- Awakened
- Immortal
- Nomad
- Soul Knife
- Wu Jen

### Paladin — 5

- Conquest
- Crown
- Oathbreaker
- Redemption
- Watchers

### Ranger — 4

- Drakewarden
- Horizon Walker
- Monster Slayer
- Swarmkeeper

### Rogue — 4

- Inquisitive
- Mastermind
- Scout
- Swashbuckler

Total known real runtime fallbacks: **43**.

Re-audit current runtime/resolver after each wiring batch rather than decrementing this list blindly.

## Canonical card standard

Read `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md` before generating or approving art.

Core requirements:

- true **7:12** aspect ratio;
- final in-repo export **840×1440 WebP**;
- preferred working master 1680×2880 or larger at the same ratio;
- continuous full-bleed illustration across the entire card;
- **no opaque footer and no separate title band**;
- restrained transparent lower readability gradient only;
- consistent antique-gold frame/title/emblem geometry;
- crisp cinematic fantasy realism;
- deliberate species, gender/presentation, pose, camera, environment, and mood diversity;
- mandatory full-resolution anatomy/hands/weapons/props/companions/species QA.

A WebP existing in the repository does not by itself make a card complete.

## Completion rule

A visible subclass card counts as complete only when:

1. the exact visible runtime identity is confirmed;
2. Paul approves the artwork;
3. anatomy/prop/species QA passes;
4. the card conforms to the canonical 7:12 template;
5. final export is 840×1440 WebP;
6. it is installed under the canonical subclass path;
7. `utils/classes/subclassArtwork.js` explicitly maps the visible identity, or an intentional alias is explicitly approved/documented;
8. it no longer resolves to generic class fallback;
9. focused validation passes;
10. an intentional Vercel Preview is checked when browser review is needed.

## Repository wiring contract

Asset path:

`public/media/subclasses/<class-key>/<class-key>-<art-family>.webp`

Resolver:

`utils/classes/subclassArtwork.js`

Carousel:

`components/ClassSubclassSection.js`

Tarot presentation:

`styles/character-forge-subclass-tarot-layout.css`

Validator:

`scripts/validate_class_subclass_browser.mjs`

Do not silently broaden aliases merely to make a card appear.

## Validator follow-up required before final completion

The current validator still checks the historical 109 approved/mapped concepts and safe fallback behavior. It does not yet guarantee all 149 runtime-visible choices have dedicated art.

Strengthen the validator so it enumerates the actual visible Forge subclass set and fails when a known visible production choice resolves to generic/class artwork.

Preserve:

- explicit intentional aliases approved by Paul;
- the four suppressed Wizard compatibility identities;
- safe fallback for truly unknown/future content;
- existing Class model/context rules/persistence authority.

Do not alter subclass eligibility simply to make artwork counts pass.

## Artwork production workflow

For each small batch:

1. confirm the exact current `main`/art branch head;
2. re-check the visible subclass name/class and current resolver behavior;
3. select a distinct subject/composition with deck-wide variety in mind;
4. generate a high-resolution full-bleed illustration;
5. normalize/crop to 7:12;
6. apply the fixed reusable frame/title/emblem template;
7. perform full-resolution anatomy/prop QA;
8. show Paul the individual card for approval;
9. export 840×1440 WebP;
10. install under the canonical path;
11. wire the exact visible identity;
12. update the checklist/runtime audit;
13. run focused validation;
14. request an intentional Vercel Preview only when browser validation is actually needed.

## Binary transfer workflow

Use the established guarded binary route rather than giant inline-base64 commits:

`approved bytes -> normalized files -> manifest + SHA-256 -> archive -> transfer location -> guarded GitHub Actions materializer -> exact-head/checksum/dimension/path verification -> intended branch -> CI/Preview verification`

Do not restore pre-normalization Tarot assets from old commits unless Paul explicitly requests a specific historical image.

## Vercel Preview rule

PR #188 is merged and the guard is active. Ordinary `agent/*` commits skip full Preview builds. Include `[deploy-preview]` only on the exact commit requiring a full browser Preview.

## Protected boundaries

Tarot artwork work requires no Supabase mutation. Do not touch world-map or town/city-map behavior, routes/travel/weather/camps/clock, crafting, inventory, merchants, economy, encounters/tactical authority, or unrelated Character Sheet runtime while completing the deck.
