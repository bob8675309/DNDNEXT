# Character Forge Subclass Artwork Status

Status date: 2026-09-15

Status: **production uses the cinematic looping subclass carousel with standardized 7:12 Tarot cards. Artwork completion is measured against runtime-visible choices, not the historical 109-concept preferred-source checkpoint.**

## Production selector authority

Current production presentation is owned by:

- `components/ClassSubclassSection.js` — carousel/modal presentation;
- `utils/classes/subclassArtwork.js` — presentation-only artwork resolver;
- `styles/character-forge-subclass-tarot-layout.css` — Tarot layout/normalization;
- `scripts/validate_class_subclass_browser.mjs` — focused regression guard.

Canonical subclass identity, eligibility, level gates, persistence, and progression remain owned by the existing Class guide/model/context and Supabase-backed catalogues. Artwork must never become a second subclass rules authority.

The older compact two-column 76×40 selector is superseded production presentation. Its document remains historical design provenance in `CHARACTER_FORGE_CLASS_SUBCLASS_SELECTOR_ARTWORK.md`.

## Runtime-visible completion target

Historical normalized-art checkpoint:

- **109 approved/mapped concepts**.

Current production completion target:

- **149 runtime-visible subclass choices**;
- **149 dedicated Tarot cards**, except where Paul explicitly approves intentional shared art;
- **43 known visible choices currently resolving to generic/class fallback artwork**.

A generic class-art fallback is not a completed subclass card.

## Wizard compatibility correction

The historical Wizard artwork ledger contains 18 normalized identities. Runtime compatibility behavior suppresses four duplicate/reprint identities from the visible carousel in favor of corresponding resolved choices:

- Abjuration;
- Divination;
- Evocation;
- Illusion.

Their normalized assets/mappings remain valid repository provenance. They are not four additional missing cards. Current visible Wizard cardinality is therefore lower than the historical normalized concept count.

Do not change subclass visibility merely to make historical artwork counts align.

## Current real fallback queue — 43

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

Total current real runtime fallbacks: **43**.

Re-audit actual runtime-visible choices after every wiring batch. Do not simply decrement this list by assumption.

## Canonical Tarot standard

Detailed authority: `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.

Summary:

- aspect ratio: **7:12**;
- final repo export: **840×1440 WebP**;
- preferred working master: 1680×2880 or larger at the same ratio;
- full-bleed illustration across the entire card;
- **no opaque footer or separate title band**;
- restrained lower readability gradient only;
- consistent antique-gold frame/title/emblem geometry;
- crisp cinematic fantasy realism;
- deliberate species/gender/pose/environment variety;
- full-resolution anatomy, hands, weapons, props, companions, and species-detail QA.

A card counts as complete only after artwork approval, file installation, exact identity wiring (or explicitly approved intentional alias), focused validation, and runtime/preview verification when a Preview is requested.

## Repository path/wiring contract

Final asset path:

`public/media/subclasses/<class-key>/<class-key>-<art-family>.webp`

Resolver:

`utils/classes/subclassArtwork.js`

Carousel:

`components/ClassSubclassSection.js`

Tarot presentation:

`styles/character-forge-subclass-tarot-layout.css`

Do not silently broaden aliases to make an image appear for unrelated identities.

## Current validator gap

`scripts/validate_class_subclass_browser.mjs` currently proves the historical **109** normalized concept set and also proves a safe fallback exists for unmatched content.

That is useful but incomplete: a known visible production subclass can still silently use class fallback artwork without failing the historical count.

Before the deck is declared complete, strengthen validation to derive/enumerate the actual visible Forge subclass set and verify every known visible choice resolves to dedicated subclass artwork or an explicitly approved intentional alias.

The stronger validator must preserve:

- the four suppressed Wizard compatibility identities above;
- intentional aliases explicitly approved by Paul;
- safe fallback for truly unknown/future content;
- current Class guide/model eligibility/persistence authority.

Do not modify runtime eligibility or source data simply to make artwork validation pass.

## Production/branch history

- PR #177 originally carried a large part of the Class/subclass artwork infrastructure and is merged.
- PR #187 developed the later cinematic looping carousel/Tarot branch and remains open as a historical/working branch.
- PR #189 narrowly transplanted/restored the production carousel/Tarot behavior to current `main` without merging the broader #187 history.

Therefore, current `main` outranks PR #187. Future artwork work should branch from current `main` (or another explicitly chosen current branch) rather than assuming #187 is the integration base.

## Vercel note

The Vercel Preview guard from PR #188 is active. Ordinary `agent/*` artwork commits do not need a full Preview. Use `[deploy-preview]` only on the exact commit that needs visual/integration browser review.

## Protected boundaries

Subclass artwork is presentation-only. No Supabase mutation is required. Do not touch world-map/town-map behavior, travel, routes, crafting, inventory, merchants, economy, encounter/tactical authority, or unrelated Character Sheet runtime while completing this deck.
