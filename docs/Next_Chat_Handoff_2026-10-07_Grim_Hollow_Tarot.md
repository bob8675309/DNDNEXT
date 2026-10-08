# Next Chat Handoff — Grim Hollow Tarot Expansion

Status date: 2026-10-08

This is the focused handoff for continuing the Grim Hollow: Player's Guide Tarot-card rollout after consolidating the approved artwork and the completed PR #202 Forge polish onto current `main`.

## Current consolidation state

At the start of this consolidation, `main` was `5caf25069e91ac5b40b723c4d9826c1fb93cfbb8`.

PR #202 — **Polish Metamagic Adept, invocation details, and Forge spell browsing** — was reviewed against its final head `36ea5994ea256eaeac641ef1a32c8b523cb988a1`, with all 13 triggered workflows passing and Vercel Preview READY, then merged onto `main` as `15eaa8077c6beddcf4a8d6d42b7da980efc04d3d`.

This documentation/art consolidation commit advances `main` again. Always re-fetch the exact current head before further writes.

PR #203 — **Import Grim Hollow Player Guide spells, items, and subclasses** — remains open and unmerged. Its source-content work must be reconciled separately before any merge. The approved Tarot artwork no longer depends on PR #203.

## Source/content authority

The partnered Grim Hollow source remains pinned to:

- repository: `TheGiddyLimit/homebrew`
- commit: `ab4012f136dc1224c45d6c13c1d8f71b543c34bb`
- file: `collection/Ghostfire Gaming; Grim Hollow - Player's Guide - 2024.json`
- source id: `GrimHollowPG24`

5etools/partnered structured data is the rules-text/content source. Do not hand-maintain parallel descriptions when source-backed structured rules are available.

## Tarot production authority

The Grim Hollow Player's Guide set requires **36 new cards** because the four Monster Hunter Guilds already have approved dedicated Tarot cards.

Approved new Grim Hollow cards: **12 / 36**.

All twelve approved cards are now installed and mapped on current `main`:

- Barbarian — Path of the Fractured; Path of the Primal Spirit; Path of the Wrathful Dead.
- Bard — College of Adventurers; College of Fools; College of Requiems.
- Cleric — Eldritch Domain; Inquisition Domain; Purification Domain.
- Druid — Circle of Blood; Circle of Entropy; Circle of Mutation.

The focused subclass validator requires all twelve binaries and mappings. The source-backed Grim Hollow catalogue is still separate on PR #203, so these new identities remain staged presentation assets until the catalogue lands.

## Remaining creation queue — 24

Continue in three-card class batches:

1. Fighter — Bulwark Warrior; Living Crucible; Nightwatcher.
2. Monk — Warrior of Pride; Warrior of Regret; Warrior of the Leaden Crown.
3. Paladin — Oath of Pestilence; Oath of Slaughter; Oath of Zeal.
4. Ranger — Green Reaper; Primordial Archer; Vermin Lord.
5. Rogue — Highway Rider; Misfortune Bringer; Sanguine Thief.
6. Sorcerer — Apocalypse Sorcery; Haunted Sorcery; Wretched Bloodline Sorcery.
7. Warlock — The Coven; The First Vampire Patron; The Parasite Patron.
8. Wizard — Daemonologist; Plague Doctor; Sangromancer.

Next batch: **Fighter**.

## Art direction

Use `docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md` as the detailed contract and the older Battle Master / Soul Knife cards as visual-layout authority.

Each new card must:

- be photorealistic/cinematic rather than painterly;
- strongly represent the subclass fantasy and mechanics;
- use the established full antique-gold border/title/emblem treatment;
- preserve full-bleed artwork through the lower title area rather than introducing an opaque footer;
- vary species, gender/presentation, pose, camera direction, silhouette, environment, lighting, and action across the deck;
- receive full-resolution anatomy QA, especially legs, hands, joints, weapon grip, and body symmetry;
- export to **840 × 1440 WebP** at the canonical 7:12 presentation.

Production loop: read the actual source-backed subclass features -> generate one card -> Paul approves/revises -> lock it -> proceed through the three-card batch -> install only approved finals.

## Protected boundaries

Tarot work is presentation-only. Do not touch world-map behavior, town/city-map behavior, travel/routes/weather/camps/clock, crafting/economy, tactical authority, or unrelated Character runtime while continuing this card rollout.

World map remains explicitly protected unless Paul asks for world-map work.
