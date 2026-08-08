# Character Progression and Creation

Updated: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Scope

This document describes the current server-authoritative character creation, earned progression, source-owned spell assignment, and runtime-cadence boundaries used by PR #170. It intentionally excludes world-map, town/city-map, route/travel/weather, tactical combat, merchant/crafting, and unrelated inventory behavior.

## Governing rule: creation/progression parity

For **persistent** character decisions, directly creating a character at level N and earning level N through XP should converge on equivalent authoritative state.

That rule does not make every source-text choice permanent. Long-Rest, Short-Rest, per-use, and informational decisions stay runtime-configurable.

## Core data authority

Primary normalized sources include:

- `character_progression` — class/subclass level, XP, pending state, level-choice history;
- `character_level_up_sessions` — reviewed open/completed level-up transaction state;
- `character_level_events` — progression audit trail;
- `character_spells` — spell source identity, known/prepared/availability, and limited-use resources;
- `character_option_grants` / `character_option_grant_instances` — feat/boon grants and per-instance choices;
- `class_feature_option_catalog` — canonical optional class-feature identities;
- `character_class_option_grant_instances` — normalized class options such as Invocations and Battle Master maneuvers;
- runtime feature tables introduced by the cadence work — current rest-configurable state without rewriting permanent acquisition history;
- `character_sheets.sheet` — validated player-facing projection and source-choice summaries.

Protected authority fields must change through guarded creation/progression/runtime RPCs rather than arbitrary authenticated JSON mutation.

## Level-up authority

The active Level Up UI completes through `public.complete_character_level_up_v5`.

High-level transaction order:

1. open/review the next one-level transition;
2. validate HP, subclass, advancement, spell, and persistent source-choice requirements;
3. apply source-owned normalized changes that must precede the base transition;
4. perform the reviewed v4/v3 class-level transition;
5. apply final-state-dependent persistent choices such as Wizard Signature Spells;
6. synchronize projections;
7. write progression/session/event history;
8. commit all or roll back all.

Direct authenticated v3/v4 completion is revoked. Legacy v1/v2 completion functions still retain authenticated execute and remain a cleanup item after confirmed nonuse.

## Connected persistent progression families

Current connected families include:

- General feat / Epic Boon advancement;
- persistent simple class choices;
- Bard Magical Secrets;
- Lore Magical Discoveries;
- Draconic Elemental Affinity;
- Champion Additional Fighting Style;
- Sorcerer Metamagic acquisition/replacement;
- Warlock Mystic Arcanum acquisition/replacement;
- Magic Initiate per-instance spell replacement;
- Eldritch Invocation acquisition/replacement, prerequisites, repeatability, dependent choices, and Lessons of the First Ones;
- Battle Master maneuver acquisition/replacement;
- Wizard Savant spellbook additions;
- Wizard Signature Spells.

## Eldritch Invocation / Origin feat authority

Invocations use normalized `character_class_option_grant_instances`. Current state is validated for source legality, Warlock level, prerequisites, repeatability, child-choice dependencies, and repeated-child distinctness.

Replacement checks the **current/new Warlock level**, preserves original acquisition chronology, and records later replacement level. The final sheet projection is rebuilt from normalized instances.

`Lessons of the First Ones` owns a normalized Origin-feat instance. Reversal preserves pre-existing/other-source benefits and fails closed if removal would invalidate Expertise.

## Battle Master authority

Migrations 38-39 normalize all 20 XPHB Battle Master maneuvers.

Cumulative counts are 3 / 5 / 7 / 9 at Fighter 3 / 7 / 10 / 15. Later gains require two new maneuvers and allow one optional replacement while preserving the original slot acquisition level.

Higher-level Forge and earned progression use the same normalized option-instance family.

## Wizard spellbook authority

There is no separate public Wizard spellbook table. Normalized Wizard spellbook membership is represented by `character_spells`.

`private.wizard_spellbook_has_spell_v1(...)` recognizes:

- ordinary level-1+ Wizard `source_type='class'` rows; and
- source-owned `class-feature` rows explicitly marked `wizardSpellbook=true`, currently Savant.

Cantrips are not Wizard spellbook entries.

### Savant — migrations 40-41

Abjurer, Diviner, Evoker, and Illusionist Savant additions are live across earned progression and direct higher-level Forge.

Savant rows are class-feature provenance, known but not automatically prepared/always available, and do not inflate the exact base-Wizard class spell count.

Historical acquisition chronology is 3/3/5/7/9/11/13/15/17. Cross-provenance duplicate spellbook membership is rejected.

### Signature Spells — migrations 42-43

Signature Spells is a persistent Wizard-20 selection of exactly two level-3 spells already in the **final** normalized spellbook.

Earned Wizard 19→20 applies normal level-20 spellbook acquisition first, then Signature validation. Direct higher-level Forge materializes Savant history first, then Signature.

Signature overlays the existing assignment, preserves source provenance, marks the spell prepared/always available, and adds one `short_rest` free level-3 cast. Migration 43 provides explicit resource labels/protection.

### Spell Mastery — migration 44

Spell Mastery is runtime Long-Rest configuration, not a persistent level-18 Forge choice.

An XPHB Wizard 18+ configures one level-1 and one level-2 Action spell from the actual spellbook. The mastered spells are always prepared and at-will at their lowest level without a finite-use counter.

A later same-level replacement requires a newer Long Rest and can change only one mastered spell. The old assignment's prior prepared/availability state is restored.

## Weapon Mastery runtime authority

### Class-granted Weapon Mastery — migration 45

Class-granted XPHB Weapon Mastery is rest-configurable runtime state. Capacity is derived from canonical class/level progression and weapon eligibility from XPHB mundane item metadata.

New capacity can be filled immediately. Replacing an existing active mastery requires a newer Long Rest. No-op preserves the opportunity; more than one replacement or a second replacement on the same rest fails closed.

### Weapon Master feat — migration 46

Each permanent XPHB Weapon Master feat instance owns an independent runtime current weapon. The permanent feat grant and its original nested acquisition choices remain immutable history.

The derived `sheet.weaponMasteries` projection is the union of class-granted runtime selections plus active Weapon Master feat-instance selections.

## Player creation / starting magic authority

### Frontend endpoint

The shared Player Forge now creates player characters through:

`public.create_player_character_v3(p_payload, p_spell_choices, p_magic_selections)`

It no longer stops at v2.

The Forge serializes exact Spell-step authority in `sheet.startingMagicSelections`.

### v3 source families — migration 47

v3 owns only Spell-step starting magic:

- native class list → `source_type='class'`, `accessType='class-list'`;
- Background-expanded class access → `source_type='class'`, `accessType='background-expanded'`;
- Eldritch Knight / Arcane Trickster → `source_type='subclass'`, `accessType='subclass'` or `fixed`.

Species, feat, and unrelated class-feature spell grants remain separate source-owned systems.

### v2 compatibility inside v3

v3 delegates common creation mechanics to v2. The browser supplies v2-compatible choices only for ordinary native class-list spells.

Background-expanded selections still consume ordinary class spell-count slots, so v3 temporarily adds a same-level native class proxy for v2's historical count validation. It then deletes **only** v2-created temporary/base spell rows and inserts the exact v3 assignments.

Subclass-source spells never masquerade as Fighter/Rogue class-list spells in v2.

### Background-expanded validation

A Background-expanded spell must be explicitly listed in `sheet.backgroundExpandedSpells`. It may legitimately be absent from the native class list.

Production rollback proof used Entangle on a level-1 Wizard; Entangle's preferred row is Druid/Ranger, proving true expanded access.

### Eldritch Knight / Arcane Trickster validation

Fighter/Rogue base classes remain noncasters. The deferred starting-spell validator specializes only for canonical XPHB Eldritch Knight / Arcane Trickster state.

At level 3:

- Eldritch Knight → 2 Wizard cantrips + 3 prepared level-1 Wizard spells;
- Arcane Trickster → fixed Mage Hand exactly once + 2 additional Wizard cantrips + 3 prepared level-1 Wizard spells.

Subclass spellcasting uses Intelligence and the validator models cumulative cantrip/spell/max-level progression through level 20.

### Exactness and ACL — migrations 47-48

Every v3 Spell-step row is marked `startingMagic=true` with exact source/access metadata and creation level. Existing exactness authority compares submitted `startingMagicSelections` to materialized rows.

Migration 48 removes the stale explicit anonymous execute grant inherited by v3. `create_player_character_v1/v2/v3` now expose owner/postgres plus `authenticated` and `service_role`, with no `anon` execute.

See `Player_Forge_Starting_Magic_v3_Status.md` for detailed CI and rollback evidence.

## Forge cadence model

Current semantics:

- persistent creation/level-up choice → normalized acquisition/progression authority;
- proficiency-dependent choice → Training;
- permanent spellbook-dependent choice → Spells placement;
- Long-/Short-Rest choice → runtime configuration;
- per-use choice → runtime/action UI;
- informational feature → display only.

Do not reintroduce Spell Mastery or Weapon Mastery as permanent Forge locks.

## Validation policy

A source-authority slice is not considered complete until it has, as applicable:

1. source-grounded rules;
2. static regression assertions;
3. exact CI/build gate;
4. migration compilation against live schema before deployment;
5. live migration success;
6. rollback-only success and fail-closed fixtures;
7. zero-residue integrity sweep;
8. documentation reconciliation.

Migrations 47-48 satisfied that sequence, including real authenticated public-v3 rollback creation for native Wizard, Background-expanded Wizard, Eldritch Knight, Arcane Trickster, and invalid submissions.

## Current protected production checkpoint

After migrations 47-48 and rollback fixtures:

- 7 characters;
- 7 sheets;
- 30 character-spell rows;
- 7 progression rows;
- 0 open level-up sessions;
- 0 synthetic v3 characters;
- world baseline 20 locations / 4 routes / 9 route points.

## Remaining PR #170 work

- remaining runtime cadence families such as Astral Trance, Circle-of-the-Land choices, Primal Companion, Dread Allegiance, Fiendish Resilience, and per-use Steps of the Fey;
- source-backed starting equipment and higher-level starting wealth/equipment;
- character-scoped starting currency;
- Artificer wildcard Magic Item Plan concrete-item instances;
- remaining persistent/conditional source-choice audit and UI polish;
- obsolete authenticated level-up RPC cleanup;
- authenticated browser acceptance before merge.

## Protected boundaries

Do not mix this work with world-map or town/city-map behavior. Forge/progression migrations remain isolated from world routes, travel/weather simulation, tactical combat, and unrelated crafting systems unless the user explicitly requests those systems.
