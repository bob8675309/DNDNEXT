# Next Chat Handoff — Grim Hollow Tarot Expansion

Status date: 2026-10-07

This is the focused handoff for continuing the Grim Hollow: Player's Guide Tarot-card rollout after the current chat reached its practical length limit.

## Re-fetch before writing

At handoff time:

- `main` artwork install checkpoint: `a4e8ae692c4de2c0fa9ae54b0a161a07937de6d2` (three Grim Hollow Druid WebPs only).
- PR #203: **Import Grim Hollow Player Guide spells, items, and subclasses**.
- PR #203 last observed head before this handoff: `c9a675bbb2a04a25ee9aa0be4975d46d0b9c5ef1`.
- PR #203 remains open and must not be merged without Paul's explicit approval.

Always re-fetch current `main`, PR #203, and any active artwork branch before another write. Do not rely on these SHAs if they have moved.

## Source/content authority

The partnered Grim Hollow source is pinned to:

- repository: `TheGiddyLimit/homebrew`
- commit: `ab4012f136dc1224c45d6c13c1d8f71b543c34bb`
- file: `collection/Ghostfire Gaming; Grim Hollow - Player's Guide - 2024.json`
- source id: `GrimHollowPG24`

5etools/partnered structured data is the rules-text/content source. Do not hand-maintain parallel descriptions when source-backed structured rules are available.

## Tarot production authority

The new Grim Hollow Player's Guide set requires **36 new cards** because the four Monster Hunter Guilds already have approved dedicated Tarot cards.

Approved new Grim Hollow cards: **12/36**.

Approved cards:

- Barbarian: Path of the Fractured; Path of the Primal Spirit; Path of the Wrathful Dead.
- Bard: College of Adventurers; College of Fools; College of Requiems.
- Cleric: Eldritch Domain; Inquisition Domain; Purification Domain.
- Druid: Circle of Blood; Circle of Entropy; Circle of Mutation.

The Druid trio is the first Grim Hollow class batch installed directly on current `main`:

- `public/media/subclasses/druid/druid-circle-of-blood.webp`
- `public/media/subclasses/druid/druid-circle-of-entropy.webp`
- `public/media/subclasses/druid/druid-circle-of-mutation.webp`

The earlier approved Barbarian/Bard/Cleric cards were installed on PR #203 during the prior pass. Reconcile PR #203 against current main before any eventual merge; do not assume branch parity.

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

## Art direction Paul approved

Use the older Battle Master / Soul Knife Tarot cards as layout authority.

Each new card should:

- be photorealistic/cinematic rather than painterly;
- strongly represent the subclass fantasy and mechanics;
- remain attractive and visually striking;
- use the full antique-gold border through the bottom edge;
- use the established title + emblem treatment rather than a redesigned frame;
- vary species, gender/presentation, pose, camera direction, silhouette, environment, lighting, and action across the deck;
- avoid repeatedly posing characters looking off into the same distance;
- receive full-resolution anatomy QA, especially legs, hands, joints, weapon grip, and body symmetry;
- export to **840x1440 WebP** at the canonical 7:12 presentation.

Production loop: read the actual Grim Hollow subclass features first -> generate one card -> Paul approves/revises -> lock it -> proceed through the three-card batch -> install only approved finals.

## Current Druid approvals

- Circle of Blood: approved corrected version with complete leg/body alignment.
- Circle of Entropy: approved ruined-civilization entropy composition.
- Circle of Mutation: approved dragonborn mutation/swamp composition.

Do not regenerate these unless Paul explicitly requests a replacement.

## Protected boundaries

Tarot work is presentation-only. Do not touch world-map behavior, town/city-map behavior, travel/routes/weather/camps/clock, crafting/economy, tactical authority, or unrelated Character runtime while continuing this card rollout.

World map remains explicitly protected unless Paul asks for world-map work.
