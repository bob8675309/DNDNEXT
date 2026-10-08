# Character Forge Subclass Artwork Status

Status date: 2026-10-08

This is the current focused status for the Character Forge subclass Tarot deck and selector presentation. Live source and the focused validator outrank older branch-era counts or selector descriptions.

## Current completion authority

The Grim Hollow Player's Guide source-content import is now part of the production catalogue:

- runtime-visible subclass choices: **185**;
- runtime-visible choices with dedicated approved Tarot cards: **170 / 185**;
- runtime-visible choices still using source/class fallback artwork: **15**.

The Grim Hollow: Player's Guide expansion adds 36 new visible subclass identities beyond the four Monster Hunter Guilds that already had dedicated cards. Paul has approved **21 / 36** of those new cards, and **all 21 approved cards are installed and mapped on `main`**:

- Barbarian — Path of the Fractured; Path of the Primal Spirit; Path of the Wrathful Dead.
- Bard — College of Adventurers; College of Fools; College of Requiems.
- Cleric — Eldritch Domain; Inquisition Domain; Purification Domain.
- Druid — Circle of Blood; Circle of Entropy; Circle of Mutation.
- Fighter — Bulwark Warrior; Living Crucible; Nightwatcher.
- Monk — Warrior of Pride; Warrior of Regret; Warrior of the Leaden Crown.
- Paladin — Oath of Pestilence; Oath of Slaughter; Oath of Zeal.

The focused validator tracks **172 approved asset families** in the repository, including these 21 Grim Hollow cards. The remaining 15 Grim Hollow identities use the trusted partnered source-art fallback (or class fallback when no trusted source image is available) until their dedicated Tarot cards are approved.

**Remaining Grim Hollow cards to create: 15.** The next batch is Ranger: Green Reaper, Primordial Archer, Vermin Lord.

## Canonical card standard

Detailed authority:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`

Core rules:

- canonical 7:12 aspect ratio;
- final export **840 × 1440 WebP**;
- full-bleed illustration through the title/emblem area;
- no opaque footer/title band;
- consistent antique-gold frame/title/emblem geometry;
- restrained readability gradient;
- cinematic fantasy realism;
- deliberate species/gender/presentation/pose/environment diversity;
- mandatory full-resolution anatomy, hands, weapon, prop, companion, and species QA.

## Resolver authority

Artwork resolution remains centralized through:

`ClassSubclassSection.js -> subclassArtworkFor(classKey, option) -> utils/classes/subclassArtwork.js`

The resolver owns presentation only. It does not create subclass eligibility, source authority, level gates, persistence, or progression rules. Unknown/future identities retain the class-art fallback until a dedicated card is approved.

## Current selector presentation

PR #199 merged the accepted selector presentation on 2026-10-02. The active selector is a **floating Tarot carousel in a dark, smoky ruined gothic library**, not the retired physical runic-table/table-contact model.

Current presentation rules:

- all canonical options remain on one continuous carousel;
- one exact front hero position;
- rear cards use the ornate back;
- explicit eligible selection remains the only persistence path;
- carousel motion alone never persists a subclass;
- the Subclass Codex and Class Feature panel are independent and may remain open simultaneously;
- Codex navigation is Overview / Progression / Spells;
- Spells uses the Profile-style list + shared SpellCard detail pattern;
- reduced-motion behavior remains supported.

The selector and Tarot artwork are presentation systems layered over the existing class-guide/source authority.

## Validation guard

`scripts/validate_class_subclass_browser.mjs` and `scripts/validate_class_browser_polish.mjs` protect the current selector, artwork resolver, approved asset presence, single persistence path, Codex/Feature split, and protected boundaries.

The approved Grim Hollow cards are validated against the live source-backed Grim Hollow catalogue on `main`.

## Future artwork rule

For every newly runtime-visible subclass:

1. confirm the exact visible identity from current source/catalogue behavior;
2. verify it is not merely a compatibility alias/reprint;
3. create and explicitly approve a dedicated card;
4. export it to 840 × 1440 WebP;
5. install it under `public/media/subclasses/<class-key>/`;
6. wire the exact identity in `utils/classes/subclassArtwork.js`;
7. extend the focused asset/mapping validator;
8. verify the runtime fallback count returns to zero after the source content lands.

## Protected boundaries

Subclass artwork and selector maintenance are presentation-only. They do not authorize changes to Supabase schema/data, subclass gameplay rules, world-map or town/city-map behavior, travel/routes/weather/camps/clock, crafting/inventory/merchant/economy systems, tactical encounter authority, or unrelated Character Sheet runtime behavior.
