# Tactical Encounter Phase 1O — Shocking Grasp

Status: **SERVER DEPLOYED / POSTDEPLOY VALIDATED / COMBAT UI BUILD GATE PENDING**

Phase 1O introduces a reusable **target-turn-start timed tactical effect** and uses it for the reviewed XPHB version of **Shocking Grasp**. The automated slice remains narrow: one Action, Touch range, one creature, melee spell attack, Lightning damage, and suppression of Opportunity Attacks until the start of the target's next turn.

## Canonical spell contract

- id: `93553d6f-939f-4ee8-85e1-4368df17cb25`
- key: `shocking-grasp|XPHB`
- source: `XPHB`
- level: cantrip
- classes: Artificer, Sorcerer, Wizard
- casting time: 1 Action
- range: Touch
- attack: Melee Spell Attack
- base damage: `1d8` Lightning
- scaling: `2d8` / `3d8` / `4d8` at levels 5 / 11 / 17
- rider: on a hit, the target cannot make an Opportunity Attack until the start of the target's next turn.

## Timed tactical effect primitive

Shocking Grasp's rider is not stored in `encounter_conditions`. That table represents D&D Conditions, and older spell adapters intentionally fail closed when arbitrary Conditions could modify attacks or saves. Phase 1O keeps those semantics separate and adds:

- `public.encounter_timed_effects`
- `private.encounter_has_timed_effect_v1(participant, effect_key)`
- `private.encounter_apply_target_turn_start_effect_v1(target, source, effect_key, target_turn_starts, metadata)`
- `private.expire_encounter_timed_effects_on_turn_start_v1()`

The first supported timing primitive is a target-turn-start countdown. The expiry trigger runs when `encounters.active_participant_id` changes. An effect with one remaining target turn start expires immediately as that target becomes active; longer countdowns decrement at that point.

The table is server-authoritative. Authenticated clients can read permitted rows but cannot insert, update, or delete timed tactical effects directly.

## Opportunity Attack integration

Reusable effect key:

- `opportunity_attack_suppressed`

While active:

- `encounter_threat_reach_ft_internal_v1` returns 0 for the affected participant, so ordinary movement does not create an Opportunity Attack reaction window for that reactor;
- `encounter_opportunity_attack_internal_v1` rejects direct Opportunity Attack execution as defense in depth;
- `reaction_available` is not spent or disabled, preserving other future Reaction semantics.

When the target's next turn starts, the effect expires and normal threat reach / Opportunity Attack behavior resumes automatically.

## Resolver deployment

Repository migration:

- `sql/20260728_05_tactical_shocking_grasp.sql`

Production migration:

- `20260728171920 tactical_shocking_grasp`

Versioned RPC:

- `public.encounter_cast_spell_v7(caster, assignment, target, slot_level, request_id)`

Version boundary:

- Fire Bolt / Cure Wounds: v1
- Sacred Flame: v2
- Toll the Dead: v3
- Poison Spray: v4
- False Life: v5
- Inflict Wounds: v6
- Shocking Grasp: v7

v7 delegates all seven prior reviewed adapters to v6 and owns only `shocking-grasp|xphb`.

## Server guardrails

- exact XPHB whitelist;
- class-source assignment only;
- canonical cantrip definition;
- no spell slot accepted;
- another-creature target required;
- active-turn/controller authority;
- defeated caster or target rejected;
- Action required;
- incapacitated/paralyzed/stunned/unconscious caster rejected;
- canonical class spellcasting profile required;
- Touch range capped at 5 feet;
- blocked line of sight / Total Cover fails closed;
- melee spell attack uses canonical spell attack bonus or assignment override;
- Dodge imposes Disadvantage;
- cover AC remains server-authoritative;
- active Conditions on caster or target remain GM-assisted for spell-attack interactions;
- cantrip damage uses the current class-level scaling contract;
- Critical Hit doubles damage dice;
- Lightning damage resolves through the existing typed-damage helper;
- on a hit, one `opportunity_attack_suppressed` target-turn-start effect is applied/refreshed;
- on a miss, no timed effect is applied;
- one Action is spent; no spell slot is spent;
- request-ID idempotency and combat logging remain server-authoritative;
- anonymous execute remains revoked.

## Server build gate

Server commit:

- `ec934fe8229ee964bee9e7c8277a5c386070b2cd`

The branch was one commit ahead of the validator-backed Phase 1N `main` baseline and changed only the Phase 1O migration, server validator, status ledger, package script, and aggregate suite entry.

The Vercel build ran the complete prior tactical spell validator suite plus the new Shocking Grasp server validator before Next compilation and completed successfully:

- `https://vercel.com/pauls-projects-2016aa54/dndnext/244JVjXKA1oqBkaAe4e6hFNNtW3s`

## Postdeploy rollback validation

The deployed v7 resolver was exercised transactionally with persistent **Pip Quillspark** (level-2 XPHB Wizard) and **Raska Stonejaw**. The fixture used a temporary canonical Shocking Grasp assignment with a test-only attack bonus override to guarantee an ordinary hit while keeping all resolution server-authoritative.

Verified:

- Shocking Grasp hit and dealt legal `1d8` Lightning damage at Pip's level;
- one `opportunity_attack_suppressed` timed effect was created on Raska;
- Raska's general Reaction remained available;
- Raska's threat reach became 0 while suppression was active;
- replaying the same cast request returned the stored result, applied no second damage, and did not duplicate the timed effect;
- direct Opportunity Attack execution by Raska was rejected while suppressed and did not spend the Reaction;
- Pip moved out of Raska's normal reach while suppression was active and no reaction window was created;
- ending Pip's turn made Raska active and expired the timed effect exactly at Raska's turn start;
- Raska's threat reach immediately restored to at least 5 feet;
- Raska's Reaction remained available;
- exactly one `effect_expired` combat-log row was written;
- after Raska moved adjacent and the turn cycled back to Pip, Pip leaving reach created a valid pending Opportunity Attack window for Raska;
- duplicate cast replay left exactly one stored spell-cast command and one Shocking Grasp combat-log row;
- all temporary encounter, participant, reaction-window, timed-effect, command, log, and temporary assignment state rolled back.

Execution privileges were rechecked:

- v7 authenticated: `true`
- v7 anon: `false`
- v7 service role: `true`
- timed-effects authenticated SELECT: `true`
- timed-effects authenticated INSERT: `false`
- target-turn-start apply helper authenticated execute: `false`.

## Persistent reviewed assignment

After rollback validation passed, canonical Shocking Grasp was granted to **Pip Quillspark**:

- assignment id: `8a3943a7-dd65-4163-9414-7132bcfad712`
- spell id: `93553d6f-939f-4ee8-85e1-4368df17cb25`
- source type: `class`
- source label: `Wizard`
- prepared: `true`
- always available: `false`
- casting stat: `int`
- notes: `Phase 1O reviewed tactical adapter`.

This raises the intentional reviewed character-spell assignment count to 8.

## Current live baseline after server validation

- characters: 5
- character spell assignments: 8
- encounter maps: 0
- encounters: 0
- encounter participants: 0
- encounter command requests: 0
- encounter combat log: 0
- encounter spell slots: 0
- encounter reaction windows: 0
- encounter timed effects: 0
- locations: 20
- world routes: 4
- world route points: 9

World and town systems were not modified.

## Combat UI gate

The follow-on combat UI source adds only the reviewed Shocking Grasp presentation:

- eight-spell approved set;
- 5-foot Touch preflight;
- current-level `d8` damage preview;
- v7 routing only for Shocking Grasp while v1-v6 remain intact;
- hit/miss messaging including Opportunity Attack suppression duration;
- rules text explicitly separating OA suppression from the target's general Reaction;
- combat-log attack metadata and suppression marker;
- Phase 1O labeling;
- dedicated UI validator;
- older Poison Spray, False Life, and Inflict Wounds UI validators made forward-compatible without weakening their spell-specific route or rule checks.

This UI source must receive a real validator-backed green Vercel build before any merge to `main`.

## Deferred

Still GM-assisted/manual:

- source-turn-start and source-turn-end timed effects;
- target-turn-end non-Condition riders beyond existing Condition duration support;
- persistent save/attack modifiers;
- next-roll consumable modifiers;
- full Poisoned-condition attack/check semantics;
- healing-prevention riders;
- speed-reduction riders;
- concentration;
- AoE, lines, cones, emanations, and persistent areas;
- forced movement and teleportation;
- reaction spells;
- summons;
- Bonus Action spellcasting and broader spell-per-turn semantics;
- item/feat/background spell-resource semantics;
- multiclass or multiple spell-slot-pool selection.

Next gate: build the complete Phase 1O combat UI commit through the aggregate tactical validator suite and Next production compile. Only a green UI head may be merged linearly to `main`, followed by production verification.