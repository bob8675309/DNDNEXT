# Character Progression and Creation

Updated: 2026-08-08

## Scope

This document describes the current server-authoritative character creation and earned-progression foundation used by PR #170. It covers XP/level reviews, persistent source-owned choices, spell assignments, feats/boons, and higher-level creation parity. It intentionally excludes world-map, town-map, travel/weather, encounter/combat, merchant/crafting, and unrelated inventory-consumption behavior.

## Governing rule: creation/progression parity

For persistent character decisions, directly creating a character at level N and earning level N through XP should converge on equivalent authoritative state. Higher-level creation must therefore account for persistent choices that would have been made while advancing through earlier levels.

This rule does **not** mean every class-feature choice belongs in creation/progression state. Long-Rest, Short-Rest, per-use, and informational decisions stay runtime-configurable rather than becoming permanent locks.

## Core data authority

Primary normalized sources include:

- `character_progression` — class/subclass level, XP, pending level state, level-choice history
- `character_level_up_sessions` — open/completed transactional review state
- `character_level_events` — progression audit trail
- `character_spells` — spell assignments with source identity and preparation/resource state
- `character_option_grants` / `character_option_grant_instances` — feat/boon grants and per-instance choices
- `class_feature_option_catalog` — canonical optional class-feature identities
- `character_class_option_grant_instances` — normalized per-instance class options such as Invocations and Battle Master maneuvers
- `character_sheets.sheet` — player-facing projection plus validated source-choice summaries

Authoritative protected sheet fields must be changed through guarded creation/progression RPCs, not direct authenticated JSON mutation.

## Level-up transaction flow

Current UI completion target: `public.complete_character_level_up_v5(character_id, selections)`.

High-level order:

1. open/review level-up metadata;
2. validate HP method, subclass/advancement/spell requirements, and source-owned choice groups;
3. apply v5-specific normalized replacements/acquisitions that must precede the base transition;
4. delegate the ordinary level transition through the reviewed v4/v3 foundation;
5. rebuild dependent projections where needed;
6. record normalized deltas in progression history, completed session state, and level event;
7. commit everything or roll the transaction back.

Direct authenticated v3/v4 completion is revoked. Legacy v1/v2 completion functions still have authenticated execute grants and remain a cleanup item; the current level-up component completes through v5 and only contains compatibility fallbacks to v4/v3 if the newer RPC is unavailable.

## Connected progression families

### Base progression

- one-level-at-a-time XP advancement
- fixed or rolled HP gain
- proficiency/slot progression
- subclass entry
- ordinary class spell acquisition
- General feat / Epic Boon advancement
- source-aware spell access

### Persistent class/subclass choices

Connected families currently include:

- simple persistent class choices already modeled by shared class-choice resolvers
- Bard Magical Secrets spell-list expansion
- Lore Magical Discoveries
- Draconic Elemental Affinity
- Champion Additional Fighting Style
- Sorcerer Metamagic
- Warlock Mystic Arcanum
- Warlock Eldritch Invocations
- Battle Master maneuvers
- XPHB Wizard Savant spellbook additions in earned progression and higher-level Forge creation

### Safe replacements

Connected optional replacement families include:

- Metamagic
- Mystic Arcanum
- Lore Magical Discoveries
- Magic Initiate spells, per feat instance
- Eldritch Invocations
- Battle Master maneuvers when the source feature grants later maneuver learning

## Eldritch Invocation authority

Invocations use normalized `character_class_option_grant_instances` rows. The current set is validated for source legality, Warlock level, prerequisites, repeatability, dependent child choices, and repeated-child distinctness.

Replacement rules:

- the current replacement option is checked at the **new/current Warlock level**;
- original slot acquisition chronology is retained;
- `lastReplacementLevel` records later retraining;
- an Invocation required by another current Invocation is not replaceable;
- same-level final-state prerequisite resolution is supported;
- the final `sheet.eldritchInvocations` projection is rebuilt after required new-slot acquisition completes.

`Lessons of the First Ones` grants a normalized Origin-feat instance. Its owned effects are reversible without removing benefits that existed before the feat or remain claimed by another source. Expertise-dependent proficiency removal fails closed.

## Battle Master maneuver authority

Migrations 38-39 normalize the 20 XPHB Battle Master maneuver identities directly from the imported `Maneuver Options` source feature.

Cumulative maneuver counts:

| Fighter level | Maneuvers |
| ---: | ---: |
| 3 | 3 |
| 7 | 5 |
| 10 | 7 |
| 15 | 9 |

The level-7/10/15 increases require two new maneuvers and permit one optional replacement. Replacement updates the normalized option occupying that slot but preserves the slot's original acquisition level.

Higher-level Forge creation serializes the cumulative Battle Master choices and the deferred Forge trigger materializes them into normalized maneuver instances. Earned progression uses the same instance family.

## Wizard spellbook authority

There is no separate public spellbook table. `character_spells` assignments are the practical spellbook/known/prepared authority, with `prepared` independent from membership.

Ordinary Wizard Forge validation deliberately requires an exact number of base `source_type='class'` spell rows. Feature-granted spellbook additions therefore must not be inserted as ordinary base-Wizard rows.

### Savant

Migrations 40-41 provide XPHB Savant authority for:

- Abjurer → Abjuration Savant
- Diviner → Divination Savant
- Evoker → Evocation Savant
- Illusionist → Illusion Savant

Savant assignments use:

- `source_type='class-feature'`
- source key tied to the Savant acquisition group
- `known=true`
- `prepared=false`
- `always_available=false`
- `raw_payload.wizardSpellbook=true`

Wizard Spellcasting defines the spellbook as level 1+ spells; cantrips remain separate. Savant therefore never grants a level-0 spellbook entry.

Persistent acquisition chronology is replayed at the levels where a new Wizard spell-slot level first becomes available:

| Wizard level | New Savant choices | Maximum spell level |
| ---: | ---: | ---: |
| 3 | 2 | 2 |
| 5 | 1 | 3 |
| 7 | 1 | 4 |
| 9 | 1 | 5 |
| 11 | 1 | 6 |
| 13 | 1 | 7 |
| 15 | 1 | 8 |
| 17 | 1 | 9 |

Each spell must be a Wizard spell from the subclass's Savant school and must have been legal at that historical acquisition point.

A deferred uniqueness trigger treats ordinary level-1+ Wizard `class` rows and `class-feature` rows marked `wizardSpellbook=true` as one spellbook membership set. A spell therefore cannot be selected once through normal Wizard progression and again through Savant.

Higher-level Forge uses separate Savant groups for levels 3/5/7/9/11/13/15/17 rather than one cumulative current-level bucket. A deferred progression trigger materializes those validated groups after the creation transaction rebuilds starting spell assignments. The normal Wizard Spells step excludes already-selected Savant spell IDs so the player cannot accidentally spend one of the ordinary Wizard spellbook picks on the same spell.

Production evidence after migration 41:

- level-3 review: count 2, minimum spell level 1, maximum 2, zero cantrips;
- simulated Abjurer level-5 review: exactly one school-correct option at level 1-3;
- valid level-3 materialization: two unprepared class-feature rows and unchanged ordinary Wizard class-spell count;
- wrong-school submission: atomic rejection;
- duplicate ordinary-Wizard + Savant provenance: deferred rejection;
- higher-level Forge level-5 replay: acquisition levels 3/3/5 with no level-0 rows;
- rollback residue sweep: original test Wizard level/subclass/creator restored and zero Forge-Savant rows remain.

### Spell Mastery

Spell Mastery is intentionally **not** treated as a permanent level-up choice because its selected spells can be changed after a Long Rest. It belongs in runtime Long-Rest configuration.

### Signature Spells

Signature Spells is a persistent Wizard-20 selection but is not yet connected. Its options must be restricted to level-3 spells already present in that Wizard's normalized spellbook. The two free-cast resources and Short/Long Rest recharge are runtime resource state separate from spellbook membership.

## Forge cadence model

Persistent Forge groups use explicit semantics instead of structural `options`/`count` heuristics.

- persistent creation/level-up choices → authoritative source-choice state
- proficiency-dependent choices such as Expertise → Training placement
- Long-Rest / Short-Rest choices → runtime configuration
- per-use choices → action/runtime UI
- informational features → display only

Examples intentionally excluded from one-time creation lock-in include Weapon Mastery and Spell Mastery.

## Validation and rollback policy

Every new progression family should have all of the following before it is considered deployed:

1. source-grounded option/cadence rules;
2. dedicated static regression assertions;
3. inclusion in the progression GitHub Actions workflow;
4. exact-head CI + Vercel success;
5. live migration compile success;
6. rollback-only production fixtures for success and fail-closed cases;
7. production residue/integrity sweep;
8. documentation reconciliation.

The progression workflow now watches migrations through migration 41 and runs focused contracts for Invocation replacement, reversible Origin-feat effects, Battle Master maneuvers, Wizard Savant earned progression, and higher-level Forge Savant chronology in addition to the earlier foundation checks.

The syntax-corrected migration-41 source head `057b22ece3aeb084bbbd02dde9779378d1e4e7e6` passed all five PR workflows and Vercel before production DDL was retried successfully.

## Remaining progression / Forge blockers

- Wizard Signature Spells and its rest-recharging free-cast resources
- runtime Long-Rest configuration for Spell Mastery and other rest-reconfigurable families
- source-backed starting equipment packages and higher-level starting wealth/equipment
- character-scoped starting currency
- remaining guarded multi-source starting-magic frontend integration
- Artificer wildcard Magic Item Plan concrete-item instances
- final persistent subclass/cumulative choice audit
- reconcile/revoke obsolete authenticated level-up completion RPC generations when confirmed unused
- authenticated browser acceptance

## Protected boundaries

Do not mix this work with world-map or town/city-map behavior. The progression/Forge migrations and components must remain isolated from world routes, travel/weather simulation, encounter/combat runtime, and unrelated crafting systems unless the user explicitly requests those systems.
