# Tactical Encounter Phase 1O — Shocking Grasp

Status: **SERVER SOURCE PREPARED / VALIDATOR-BACKED BUILD GATE PENDING**

Phase 1O introduces a reusable **target-turn-start timed tactical effect** and uses it for the reviewed XPHB version of **Shocking Grasp**. The slice is deliberately narrow: one Action, Touch range, one creature, melee spell attack, Lightning damage, and suppression of Opportunity Attacks until the start of the target's next turn.

## Canonical spell contract

The live XPHB catalog was rechecked before implementation.

- id: `93553d6f-939f-4ee8-85e1-4368df17cb25`
- key: `shocking-grasp|XPHB`
- source: `XPHB`
- level: cantrip
- classes: Artificer, Sorcerer, Wizard
- casting time: 1 Action
- range: Touch
- attack: Melee Spell Attack
- base damage: `1d8` Lightning
- cantrip scaling: `2d8` / `3d8` / `4d8` at levels 5 / 11 / 17
- rider: on a hit, the target cannot make an Opportunity Attack until the start of the target's next turn.

## Why this uses a timed effect instead of encounter_conditions

`encounter_conditions` represents D&D Conditions and the older spell adapters intentionally fail closed when arbitrary active Conditions could modify attacks or saves. Shocking Grasp's Opportunity Attack rider is not a D&D Condition. Storing it there would make unrelated spell automation fail closed for the wrong reason.

Phase 1O therefore keeps Conditions separate and adds:

- `public.encounter_timed_effects`
- `private.encounter_has_timed_effect_v1(participant, effect_key)`
- `private.encounter_apply_target_turn_start_effect_v1(target, source, effect_key, target_turn_starts, metadata)`
- `private.expire_encounter_timed_effects_on_turn_start_v1()`

The first supported timing primitive is explicit: a target-turn-start countdown. The expiry trigger runs whenever the encounter's active participant changes and removes an effect immediately when its target's countdown reaches the next turn start. The table is server-authoritative; authenticated clients may read permitted rows but cannot insert, update, or delete them directly.

## Opportunity Attack integration

The reusable effect key for this phase is:

- `opportunity_attack_suppressed`

While that effect is active:

- `encounter_threat_reach_ft_internal_v1` returns 0 for the affected participant, so normal movement does not create an Opportunity Attack window for that reactor;
- `encounter_opportunity_attack_internal_v1` also rejects a direct Opportunity Attack attempt as defense in depth;
- the participant's general Reaction resource is not spent or disabled, so the engine does not incorrectly conflate “cannot make Opportunity Attacks” with “cannot take any Reaction.”

At the start of the affected participant's next turn, the timed effect expires automatically and normal threat reach / Opportunity Attack behavior is restored.

## Resolver design

Repository migration:

- `sql/20260728_05_tactical_shocking_grasp.sql`

New versioned RPC:

- `public.encounter_cast_spell_v7(caster, assignment, target, slot_level, request_id)`

Version boundary:

- Fire Bolt / Cure Wounds: v1
- Sacred Flame: v2
- Toll the Dead: v3
- Poison Spray: v4
- False Life: v5
- Inflict Wounds: v6
- Shocking Grasp: v7

v7 delegates all seven prior reviewed adapters directly to v6 and owns only `shocking-grasp|xphb`.

Shocking Grasp guardrails:

- exact XPHB whitelist;
- class-source assignment only;
- canonical cantrip definition;
- no spell slot accepted;
- another creature target required;
- active-turn/controller authorization;
- defeated caster or target rejected;
- Action required;
- incapacitated/paralyzed/stunned/unconscious still block the Cast action;
- canonical class spellcasting profile required;
- Touch range limited to 5 feet;
- blocked line of sight / Total Cover fails closed;
- melee spell attack uses canonical spell attack bonus or assignment override;
- Dodge imposes Disadvantage on the attack;
- cover AC remains server-authoritative;
- active Conditions on caster or target remain GM-assisted for spell-attack interactions;
- cantrip damage scales with the same current class-level contract as the previously reviewed attack cantrips;
- Critical Hit doubles damage dice;
- on a hit, Lightning damage resolves through the typed damage helper and the Opportunity Attack suppression timed effect is applied;
- on a miss, no timed effect is applied;
- one Action is spent for the cast, with no spell slot;
- request-ID idempotency and combat logging remain server-authoritative;
- anonymous execute remains revoked.

## Test character

Phase 1O uses **Pip Quillspark**, the persistent level-2 XPHB Wizard. The postdeploy rollback fixture will temporarily assign canonical Shocking Grasp with a deterministic test-only attack override, stage Pip adjacent to Raska Stonejaw, and verify the full rider lifecycle:

1. Shocking Grasp hits and deals legal `1d8` Lightning damage at Pip's level;
2. `opportunity_attack_suppressed` is created for Raska without spending Raska's Reaction;
3. while the effect is active, Raska has zero tactical threat reach and cannot execute an Opportunity Attack;
4. Pip can leave Raska's reach without an Opportunity Attack window being created;
5. the effect expires when Raska's next turn starts;
6. after that expiry, normal threat reach and Opportunity Attack window creation are restored;
7. duplicate cast request IDs do not spend a second Action or re-resolve damage;
8. all temporary encounter/effect/assignment state rolls back.

A permanent reviewed assignment is granted only after that deployed rollback fixture passes.

## Baseline before Phase 1O

- characters: 5
- character spell assignments: 7
- encounter maps: 0
- encounters: 0
- encounter participants: 0
- encounter command requests: 0
- encounter combat log: 0
- encounter spell slots: 0
- locations: 20
- world routes: 4
- world route points: 9

World and town systems are outside this phase and must remain unchanged.

## Deferred

Still GM-assisted/manual:

- source-turn-start and source-turn-end effect timers;
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

Next gate: run the complete tactical spell validator suite plus the new Phase 1O server validator in Vercel. Only a green server commit may be applied to production; UI exposure remains a separate follow-on gate.