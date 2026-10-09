# DNDNext Subclass Tarot Artwork — Current Handoff

Updated: 2026-10-09

Status: **current maintenance handoff for the completed Grim Hollow Tarot expansion and future subclass-art maintenance.**

This file restores the durable artwork handoff path from PR #198 without carrying forward its stale September branch/selector state.

## Current completion state

Current `main` after the completed Grim Hollow Tarot rollout:

- runtime-visible subclass choices: **185**;
- dedicated approved Tarot coverage for current runtime choices: **185 / 185**;
- runtime-visible source/class fallbacks: **0**;
- approved Grim Hollow expansion cards installed on `main`: **36 / 36**;
- remaining Grim Hollow cards to create: **0**;
- focused validator-tracked approved asset families: **187**.

The four Monster Hunter Guilds were already represented in the existing deck and are not part of the 36-card new-art requirement.

Detailed ledgers:

- `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`
- `CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md`

## Canonical card standard

`CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md` is the detailed visual/QA authority.

Core requirements:

- 7:12 aspect ratio;
- 840 × 1440 WebP final export;
- continuous full-bleed illustration through the title/emblem area;
- no opaque footer/title band;
- consistent antique-gold frame/title/emblem geometry;
- restrained readability gradient;
- crisp cinematic fantasy realism;
- deliberate species/gender/presentation/pose/environment diversity;
- mandatory full-resolution anatomy, hands, weapon, prop, companion, and species QA.

## Current selector presentation

The active selector is the merged PR #199 presentation: a **floating Tarot carousel in a dark, smoky ruined gothic library**.

The retired physical runic-table/table-contact model must not be restored.

Presentation behavior:

- all canonical options stay on one continuous carousel;
- one exact front hero position;
- rear cards use the ornate Tarot back;
- card travel/drag/flick is presentation-only;
- explicit eligible selection remains the sole persistence path;
- Subclass Codex and Class Feature are independent floating windows;
- Codex navigation remains Overview / Progression / Spells;
- the Spells tab follows the Profile spellbook list + shared SpellCard presentation.

Selector geometry/stage work must preserve the approved Tarot deck. Do not regenerate approved cards merely to solve layout.

## Grim Hollow expansion state

The 36-card new-art requirement is complete and installed on `main`:

- Barbarian: Path of the Fractured; Path of the Primal Spirit; Path of the Wrathful Dead.
- Bard: College of Adventurers; College of Fools; College of Requiems.
- Cleric: Eldritch Domain; Inquisition Domain; Purification Domain.
- Druid: Circle of Blood; Circle of Entropy; Circle of Mutation.
- Fighter: Bulwark Warrior; Living Crucible; Nightwatcher.
- Monk: Warrior of Pride; Warrior of Regret; Warrior of the Leaden Crown.
- Paladin: Oath of Pestilence; Oath of Slaughter; Oath of Zeal.
- Ranger: Green Reaper; Primordial Archer; Vermin Lord.
- Rogue: Highway Rider; Misfortune Bringer; Sanguine Thief.
- Sorcerer: Apocalypse Sorcery; Haunted Sorcery; Wretched Bloodline Sorcery.
- Warlock: The Coven; The First Vampire Patron; The Parasite Patron.
- Wizard: Daemonologist; Plague Doctor; Sangromancer.

The source-backed Grim Hollow spells/items/subclasses import is also on `main`. All 36 new non-Monster-Hunter identities are runtime-visible and have dedicated approved Tarot cards. There is no remaining Grim Hollow artwork queue.

## Future artwork workflow

When a future catalogue change adds a runtime-visible subclass:

1. verify the exact visible identity against current Forge/catalogue behavior;
2. confirm it is genuinely new rather than a compatibility alias/reprint;
3. read the source-backed subclass mechanics before designing the card;
4. create artwork using the canonical card standard;
5. obtain explicit artwork approval;
6. export 840 × 1440 WebP;
7. install under `public/media/subclasses/<class-key>/`;
8. wire the exact identity in `utils/classes/subclassArtwork.js` unless an intentional alias is explicitly approved;
9. extend/run the focused subclass validator;
10. browser-review the card in the live selector when needed.

Unknown/future identities may retain safe class-art fallback temporarily, but fallback does not count as completed artwork.

## Binary transfer

For approved binary artwork, use the established guarded route documented in:

- `ARTWORK_BINARY_TRANSFER_RUNBOOK.md`
- `REPO_ACCESS_STANDING_RULE.md`

Do not return to giant inline base64 transfers while the established binary bridge or existing verified Git blobs are available.

## Protected boundaries

Subclass artwork/selector maintenance is presentation-only. It does not authorize changes to subclass eligibility/persistence/progression, Supabase schema/data, world-map or town/city-map behavior, travel/routes/weather/camps/world clock, crafting/inventory/merchant/economy mechanics, or tactical encounter authority.
