# DNDNext Subclass Tarot Artwork — New Chat Handoff

Updated: 2026-09-14

Use this document as the subsystem handoff for continuing Character Forge subclass tarot artwork on PR #187.

## Active work surface

Repository: `bob8675309/DNDNEXT`

PR #187: `Redesign subclass selector as cinematic looping gallery`

Branch: `agent/subclass-carousel-selector-20260911`

Pre-documentation-update head: `b1807474149e26d741383ec2a633b8306560f307`.

Always re-fetch the branch and PR head before writing. Do not merge PR #187 without Paul's explicit approval.

The subclass selector is presentation-only. Existing class-guide/model logic remains the sole authority for subclass eligibility, level gates, selection, persistence, and progression. Artwork work must not create a second rules authority.

## The important correction: runtime visibility outranks the old 109-concept checklist

The repo previously declared the normalized preferred-source tarot deck complete at **109 / 109 concepts**. That statement is only a historical preferred-source checkpoint. It is not the correct production-completion definition for the carousel players actually see.

A runtime-visible audit shows **149 visible subclass choices**. Paul wants every visible choice to have dedicated artwork unless an intentional alias has been explicitly approved.

New completion target:

**149 visible subclass choices / 149 dedicated tarot cards.**

Do not call the deck complete while a visible choice silently resolves to the generic class artwork fallback.

## Why Wizard says 18 in the old ledger but 14 at runtime

The historical Wizard checklist contains 18 normalized concepts. The compatibility resolver suppresses four duplicate/reprint identities from the actual visible Wizard carousel in favor of the corresponding resolved choices:

- Abjuration
- Divination
- Evocation
- Illusion

Those four names still have normalized assets/mappings in the repository. They are intentionally not visible as separate runtime choices, so they are **not** four missing cards. Preserve this compatibility behavior unless Paul explicitly changes the catalogue/resolver policy.

The actual Wizard runtime list is 14 visible cards; the older ledger's 18 concepts remain useful historical/art provenance, not runtime cardinality.

## Current remaining production queue — 43 real fallbacks

The following visible choices currently fall back to class art and therefore still need dedicated normalized tarot artwork:

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

**Total real runtime fallbacks: 43.**

This list is the current artwork-production queue. Re-audit runtime-visible choices after each wiring batch rather than assuming the number remains unchanged forever.

## Canonical card standard

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md` remains authoritative for visual production.

Core requirements:

- true **7:12** tarot ratio;
- final export **840 x 1440 WebP**;
- high-resolution working master when possible;
- continuous full-bleed illustration through the title/emblem area;
- **no opaque footer or separate title band**;
- consistent antique-gold frame/title/emblem geometry;
- crisp cinematic fantasy realism with restrained glitter/motes/shine;
- deliberate species, gender, pose, camera, environment, and mood diversity;
- mandatory hands/anatomy/weapons/props/companions QA.

A card is not complete merely because a WebP exists. Paul must approve it, it must meet the standard, be installed, explicitly wired, and survive validation/runtime verification.

## Repository wiring contract

Final asset path:

`public/media/subclasses/<class-key>/<class-key>-<art-family>.webp`

Artwork resolver:

`utils/classes/subclassArtwork.js`

Carousel:

`components/ClassSubclassSection.js`

Presentation:

`styles/character-forge-subclass-tarot-layout.css`

Current validator:

`scripts/validate_class_subclass_browser.mjs`

The validator currently checks the historical 109 approved/mapped concepts and confirms fallback behavior exists. It does **not yet** enforce that all 149 runtime-visible choices have dedicated cards.

## Required validator follow-up

Before declaring final artwork completion, strengthen the validator so it derives/enumerates the real visible Forge subclass choices and verifies that each visible choice resolves to dedicated subclass artwork rather than generic class fallback.

The strengthened audit must preserve:

- explicit intentional aliases approved by Paul;
- the four suppressed Wizard duplicate/reprint identities listed above;
- canonical subclass selection/persistence authority in the existing model;
- fallback safety for genuinely unknown/future content, without allowing known visible production choices to hide behind fallback.

Do not change runtime subclass eligibility merely to make artwork counts line up.

## Production workflow

For each small batch:

1. Start from the 43-card runtime fallback list, then re-check the live resolver/runtime before generating.
2. Confirm the exact visible subclass name and class.
3. Pick a distinct species/gender/pose/environment with recent deck variety in mind.
4. Generate and normalize to the canonical 7:12 standard.
5. Perform anatomy/prop QA at full resolution.
6. Show Paul the individual card for approval.
7. After approval, export 840 x 1440 WebP.
8. Install under the canonical repo path.
9. Wire the exact visible identity in `subclassArtwork.js`; do not silently over-broaden aliases.
10. Update the runtime checklist.
11. Run focused validation.
12. Verify the intended Vercel preview when one is requested.

## Binary transfer workflow

Use the established binary route:

`approved local bytes -> normalized files -> manifest + SHA-256 -> ZIP -> Dropbox /DNDNext-Transfer/ -> guarded scratch/preview GitHub Actions branch -> checkout exact PR #187 head -> hard SHA guard -> verify payload/dimensions/checksums/paths -> commit -> push HEAD back to agent/subclass-carousel-selector-20260911 -> GitHub verification`

Do not restore the pre-normalization/reset-era tarot files from old commits unless Paul explicitly requests a specific old image as a reference.

## Vercel preview/storage note

PR #188 is a separate deployment-control patch intended to stop every intermediate `agent/*` commit from producing a full preview. Once PR #188 is merged to `main`, ordinary agent commits should be skipped and an intentional preview requested with `[deploy-preview]` in the commit message. Until then, verify actual project behavior rather than assuming the guard is active.

## Protected boundaries

Artwork work requires no Supabase mutation. Do not touch world-map behavior, town/city-map behavior, crafting, inventory, merchants, encounters, tactical rules, travel, economy, or unrelated Character Sheet systems while finishing the tarot deck.
