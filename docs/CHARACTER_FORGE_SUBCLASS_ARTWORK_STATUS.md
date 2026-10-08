# Character Forge Subclass Artwork Status

Status date: 2026-10-08

This is the current focused handoff for the Character Forge subclass Tarot deck and its selector presentation. Older rollout counts such as 33 remaining cards, 109 total concepts, 456x240 selector thumbnails, or the compact two-column selector are historical checkpoints and are not current completion authority.

## Current completion authority

- Runtime-visible subclass choices after the Grim Hollow Player's Guide expansion: **185**
- Runtime-visible choices with dedicated approved Tarot cards installed: **159**
- New Grim Hollow choices still awaiting dedicated Tarot cards: **26**
- Normalized installed artwork concepts enforced by the repository validator: **161**
- Current missing-card queue: **26**

The pre-expansion deck covered all 149 runtime-visible choices. Grim Hollow adds 36 new visible identities beyond the four Monster Hunter Guilds that were already present. The first approved expansion batch installs 10 of those 36, bringing dedicated runtime-visible coverage to 159 while leaving 26 cards to create. Historical compatibility/reprint identities and explicit aliases remain represented in the resolver/art ledger separately from the visible runtime count.

The historical Wizard compatibility identities **Abjuration, Divination, Evocation, and Illusion** are not missing current carousel choices and must not be re-added solely to make the visible count match the normalized ledger.

The canonical detailed completion checklist is:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`

## Grim Hollow expansion checkpoint — 10/36 new cards installed

Installed and mapped on the active Grim Hollow Player's Guide branch:

- Barbarian: Path of the Fractured, Path of the Primal Spirit, Path of the Wrathful Dead
- Bard: College of Adventurers, College of Fools, College of Requiems
- Cleric: Eldritch Domain, Inquisition Domain, Purification Domain
- Druid: Circle of Blood

Remaining: Circle of Entropy, Circle of Mutation, then the Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, and Wizard three-card batches listed in the canonical checklist.


## Current card standard

The active Tarot standard is:

- 7:12 aspect ratio
- 840x1440 WebP final export
- full-bleed illustration through title/emblem area
- no opaque footer/title band
- reusable antique-gold frame/title/emblem geometry
- restrained readability gradient
- cinematic fantasy realism
- deliberate species/gender/presentation/pose/environment diversity
- mandatory anatomy, hands, weapon, prop, companion, and species QA at full resolution

Detailed authority:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`

## Current resolver authority

Artwork resolution remains centralized through:

`ClassSubclassSection.js -> subclassArtworkFor(classKey, option) -> utils/classes/subclassArtwork.js`

`utils/classes/subclassArtwork.js` contains the approved class/family mappings and intentional aliases. Unknown/future subclass identities retain a safe fallback through `classMenuArtworkFor(...)`.

Artwork mapping is presentation-only. It does not create subclass eligibility, source authority, level gates, persistence, or progression rules.

## Current selector presentation

As of 2026-09-18 the old compact two-column selector has been replaced on PR #193 by the approved runic circular Tarot gallery.

The current selector:

- opens in a viewport portal/modal;
- places every option on one continuous circular orbit;
- keeps four cards prominent on the front arc at desktop scale;
- pushes the remaining cards behind the runic table as dimmer/smaller rear positions;
- advances exactly one card per Left/Right action;
- wraps by modulo arithmetic with no duplicated rail or scroll recentering;
- keeps card React keys stable so the same card visibly travels around the orbit;
- uses a gothic cathedral, runic table, and layered purple-smoke scene;
- includes a focused summary/details panel beneath the orbit;
- preserves existing selection/level-gate/persistence authority.

Current selector design authority:

`docs/CHARACTER_FORGE_CLASS_SUBCLASS_SELECTOR_ARTWORK.md`

## Current implementation checkpoint

Implementation head before this documentation refresh:

`49b6a0486878748f5d9c3147eb51fdbe16358451`

At that checkpoint:

- focused GitHub Class-browser workflow: **success**
- focused subclass-browser validator: **success**
- Vercel deployment `dpl_5kcUtbeqoWqsY7iBMaLeyb81buaX`: **READY**
- `/profile`: HTTP 200
- PR #193: open, mergeable, unmerged

The active branch is:

`agent/subclass-tarot-approved-batch-20260916`

Always re-fetch the exact remote head before additional writes or merge.

## Validation guard

`scripts/validate_class_subclass_browser.mjs` and `scripts/validate_class_browser_polish.mjs` protect the current presentation and authority split. Together they verify the runic-orbit structure, one-card modulo navigation, stable artwork resolver path, dedicated current deck coverage, safe future fallback, selection calls, and protected boundaries.

The normal Vercel build also remains authoritative for production compilation. The 2026-09-18 exact implementation preview compiled successfully under Next.js 16.1.6.

## Future artwork rule

If a future catalogue change introduces a new runtime-visible subclass:

1. Confirm the exact visible identity from current Forge runtime/catalogue behavior.
2. Treat it as incomplete until Paul approves its dedicated card.
3. Author/export to the 7:12 840x1440 WebP standard.
4. Install under `public/media/subclasses/<class-key>/`.
5. Wire the exact identity in `utils/classes/subclassArtwork.js`, unless Paul explicitly approves an alias.
6. Shrink the fallback count back to zero.
7. Run focused CI and an intentional browser preview.

Do not assume 149 is permanent if future source imports add or expose new playable subclass identities.

## Protected boundaries

Subclass artwork and the selector are presentation work. Do not use this work as authority to change:

- Supabase schema/data
- subclass gameplay rules or progression
- world-map behavior
- town/city-map behavior
- travel/routes/weather/camps/clock
- crafting/inventory/merchants/economy
- encounter/tactical authority
- unrelated Character Sheet runtime behavior
