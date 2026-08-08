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
- `character_spells` — spell assignments with source identity plus preparation and limited-use resource state
- `character_option_grants` / `character_option_grant_instances` — feat/boon grants and per-instance choices
- `class_feature_option_catalog` — canonical optional class-feature identities
- `character_class_option_grant_instances` — normalized per-instance class options such as Invocations and Battle Master maneuvers
- `character_sheets.sheet` — player-facing projection plus validated source-choice summaries

Authoritative protected sheet fields must be changed through guarded creation/progression/resource RPCs, not direct authenticated JSON mutation.

## Level-up transaction flow

Current UI completion target: `public.complete_character_level_up_v5(character_id, selections)`.

High-level order:

1. open/review level-up metadata;
2. validate HP method, subclass/advancement/spell requirements, and source-owned choice groups;
3. apply v5-specific normalized replacements/acquisitions that must precede the base transition;
4. delegate the ordinary level transition through the reviewed v4/v3 foundation;
5. apply final-spellbook-dependent persistent choices that must occur **after** the base transition, currently Wizard Signature Spells at level 20;
6. rebuild dependent projections where needed;
7. record normalized deltas in progression history, completed session state, and level event;
8. commit everything or roll the transaction back.

Direct authenticated v3/v4 completion is revoked. Legacy v1/v2 completion functions still have authenticated execute grants and remain a cleanup item; the current level-up component completes through v5 and contains compatibility fallbacks only for environments where a newer RPC is unavailable.

## Connected progression families

### Base progression

- one-level-at-a-time XP advancement
- fixed or rolled HP gain
- proficiency/slot progression
- subclass entry
- ordinary class spell acquisition
- General feat / Epic Boon advancement
- source-aware spell access, including reviewed expanded access

### Persistent class/subclass choices

Connected families currently include:

- persistent simple class choices handled by the shared class-choice resolvers
- Bard Magical Secrets spell-list expansion
- Lore Magical Discoveries
- Draconic Elemental Affinity
- Champion Additional Fighting Style
- Sorcerer Metamagic
- Warlock Mystic Arcanum
- Warlock Eldritch Invocations
- Battle Master maneuvers
- XPHB Wizard Savant spellbook additions in earned progression and higher-level Forge creation
- XPHB Wizard Signature Spells in earned progression and level-20 Forge creation

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

Migrations 38-39 normalize the 20 XPHB Battle Master maneuver identities directly from imported `Maneuver Options`.

Cumulative maneuver counts:

| Fighter level | Maneuvers |
| ---: | ---: |
| 3 | 3 |
| 7 | 5 |
| 10 | 7 |
| 15 | 9 |

The level-7/10/15 increases require two new maneuvers and permit one optional replacement. Replacement updates the normalized option occupying that slot but preserves the slot's original acquisition level.

Higher-level Forge creation serializes the cumulative Battle Master choices and the deferred Forge authority materializes them into normalized maneuver instances. Earned progression uses the same instance family.

## Wizard spellbook authority

There is no separate public spellbook table. `character_spells` assignments are the practical spellbook/known/prepared authority, with source identity and preparation/resource state stored independently.

Ordinary Wizard Forge validation deliberately requires an exact number of base `source_type='class'` spell rows. Feature-granted spellbook additions therefore must not be inserted as ordinary base-Wizard rows.

`private.wizard_spellbook_has_spell_v1(...)` defines normalized Wizard spellbook membership for progression features as:

- ordinary level-1+ Wizard `source_type='class'` assignments; or
- `source_type='class-feature'` assignments explicitly marked `raw_payload.wizardSpellbook=true`.

Cantrips are not Wizard spellbook entries.

### Savant — migrations 40-41

Migrations 40-41 provide XPHB Savant authority for:

- Abjurer → Abjuration Savant
- Diviner → Divination Savant
- Evoker → Evocation Savant
- Illusionist → Illusion Savant

Savant assignments use:

- `source_type='class-feature'`
- source key tied to the historical acquisition group
- `known=true`
- `prepared=false`
- `always_available=false`
- `raw_payload.wizardSpellbook=true`

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

A deferred uniqueness trigger treats ordinary level-1+ Wizard class rows and Savant `wizardSpellbook` rows as one spellbook membership set. A spell therefore cannot be acquired twice as spellbook membership through ordinary Wizard progression and Savant.

Higher-level Forge uses separate Savant groups for levels 3/5/7/9/11/13/15/17. The normal Wizard Spells step excludes already-selected Savant spell IDs so the player cannot accidentally spend one of the ordinary Wizard spellbook picks on the same spell.

### Signature Spells — migration 42

Migration 42, `wizard_signature_spells_authority`, connects XPHB Wizard Signature Spells across earned Wizard 19→20 progression and direct level-20 Player Forge creation.

The persistent rule is exactly two **level-3 Wizard spells already in the final normalized spellbook**. Because that eligibility depends on spellbook membership, the Forge group uses `placement='spells'` rather than the Class step.

The client derives eligible Signature choices from:

- level-3 ordinary Wizard spellbook selections already present or being selected in the current Forge/level-up flow; and
- level-3 Savant choices in the same shared class-choice state.

The server independently validates each submitted spell with `wizard_spellbook_has_spell_v1`. For earned 19→20 progression, v5 applies Signature Spells **after** the v4 base transition so a level-3 Wizard spell learned as one of the normal two level-20 spellbook additions can immediately qualify.

Signature Spells does not create a new `character_spells` membership row and does not overwrite the original spellbook source identity. Instead it overlays the existing authoritative row:

- preserves original `source_type` / `source_key`;
- `prepared=true`;
- `always_available=true`;
- `uses_max=1`;
- `uses_remaining=1`;
- `recharge='short_rest'`;
- `raw_payload.signatureSpell=true` plus feature/resource provenance.

The existing `complete_character_rest_v1` resource authority restores a `short_rest` spell-use resource on either a Short Rest or Long Rest. The ordinary character-sheet limited-use spell tracker can therefore consume/restore the Signature free use without inventing a second spell assignment. Automatic battle-board use of the free cast is outside this Forge/progression migration and is not claimed here.

For higher-level Forge, migration 42 replaces the Savant-only deferred insert trigger with a Wizard finalizer that runs:

1. higher-level Savant chronology materialization;
2. Signature Spells materialization against the resulting final spellbook.

That ordering intentionally allows a Savant-granted level-3 spell to become a Signature Spell. The shared client choice engine sets `allowRepeatAcrossGroups=true` only for this different-feature reuse; it does not relax duplicate spellbook membership.

### Migration 42 production evidence

Runtime source head `9740d66a45b215805a6c988c25874a01d1e35e55` passed all five PR GitHub Actions workflows. The NPC Forge workflow completed the repository's exact `npm run build:vercel` production build successfully. Hosted Vercel itself hit the account build-rate limit, so that hosted deployment is not claimed green.

Migration 42 compiled and registered in production as `wizard_signature_spells_authority` (`20260808213723`). Rollback-only proofs covered:

- successful overlay of two existing level-3 spellbook rows while preserving row count and source provenance;
- Short Rest restoring both spent free uses;
- atomic rejection of duplicate choices, a level-2 spell, and a level-3 Wizard spell absent from the spellbook;
- direct level-20 Abjurer Forge chronology with nine Savant rows at `3/3/5/7/9/11/13/15/17`, then Savant-granted Counterspell plus ordinary Bestow Curse as Signature Spells without adding membership rows;
- authenticated Wizard 19→20 completion through v5 where Animate Dead and Bestow Curse were learned in that same level transition and then became Signature Spells;
- Signature deltas in the completed session, level event, and `character_progression.level_choices`;
- final zero-residue integrity: 7 characters, 7 sheets, 30 spell assignments, 7 progression rows, zero open reviews, zero synthetic Signature rows, and unchanged world baseline 20/4/9.

### Spell Mastery

Spell Mastery is intentionally **not** treated as a permanent level-up choice because its selected spells can be changed after a Long Rest. It belongs in guarded runtime Long-Rest configuration. That is the remaining Wizard-specific progression/runtime slice after Savant and Signature Spells.

## Forge cadence model

Persistent Forge groups use explicit semantics instead of structural `options`/`count` heuristics.

- persistent creation/level-up choices → authoritative source-choice state
- proficiency-dependent choices such as Expertise → Training placement
- permanent spellbook-dependent choices such as Signature Spells → Spells placement
- Long-Rest / Short-Rest choices → runtime configuration
- per-use choices → action/runtime UI
- informational features → display only

Examples intentionally excluded from one-time creation lock-in include Weapon Mastery and Spell Mastery.

## Validation and rollback policy

Every new progression family should have all of the following before it is considered deployed:

1. source-grounded option/cadence rules;
2. dedicated static regression assertions;
3. inclusion in the progression GitHub Actions workflow;
4. exact source/build validation appropriate to the environment;
5. live migration compile success when DDL changes;
6. rollback-only production fixtures for success and fail-closed cases;
7. production residue/integrity sweep;
8. documentation reconciliation.

The progression workflow now watches migrations through migration 42 and runs focused contracts for Invocation replacement, reversible Origin-feat effects, Battle Master maneuvers, Wizard Savant earned/Forge chronology, and Wizard Signature Spells in addition to the earlier foundation checks.

## Remaining progression / Forge blockers

- guarded runtime Long-Rest configuration for Wizard Spell Mastery and other rest-reconfigurable families
- source-backed starting equipment packages and higher-level starting wealth/equipment
- character-scoped starting currency
- remaining guarded multi-source starting-magic frontend integration
- Artificer wildcard Magic Item Plan concrete-item instances
- final persistent subclass/cumulative choice audit and conditional-choice polish
- reconcile/revoke obsolete authenticated level-up completion RPC generations when confirmed unused
- authenticated browser acceptance

## Protected boundaries

Do not mix this work with world-map or town/city-map behavior. The progression/Forge migrations and components remain isolated from world routes, travel/weather simulation, encounter/combat runtime, and unrelated crafting systems unless the user explicitly requests those systems.
