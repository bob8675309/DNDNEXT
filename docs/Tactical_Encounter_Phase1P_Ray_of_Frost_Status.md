# Tactical Encounter Phase 1P — Ray of Frost

Status: **SERVER DEPLOYED / VALIDATED; COMBAT UI PENDING**

Phase 1P extends the reviewed tactical spell engine with one reusable mechanic: source-turn-start timed effects that can modify movement Speed without coupling tactical combat to world or town movement.

## Reviewed XPHB spell

The live canonical catalog entry for **Ray of Frost** is used exactly:

- source: XPHB;
- classes: Artificer, Sorcerer, Wizard;
- cantrip;
- Action;
- range: 60 feet;
- ranged spell attack;
- base damage: 1d8 Cold;
- cantrip scaling: 2d8 / 3d8 / 4d8 at character levels 5 / 11 / 17;
- on a hit, the target's Speed is reduced by 10 feet until the start of the caster's next turn.

Pip Quillspark is the reviewed Wizard character for this adapter. His permanent canonical assignment is `3ed0ee78-547d-4ced-855b-c6d3db334fc2` with `source_type=class`, `source_label=Wizard`, `prepared=true`, and `casting_stat=int`.

## Server contract

New guarded cast RPC:

`public.encounter_cast_spell_v8(caster, assignment, target, slot_level, request_id)`

v8 delegates all Phase 1I-1O reviewed adapters to v7 and owns only `ray-of-frost|XPHB`.

The Ray of Frost adapter requires:

- exact XPHB class-spell assignment from the caster's real spellbook;
- cantrip semantics with no slot;
- active turn and controller authority;
- available Action;
- visible, undefeated creature target other than self;
- 60-foot range and line of sight;
- canonical class spell attack profile;
- fail-closed handling for close-quarters ranged spell attacks and active Conditions until those modifiers are modeled generically.

Attack behavior preserves the reviewed ranged spell-attack contract:

- Dodge imposes Disadvantage;
- Half and Three-Quarters Cover increase target AC;
- Total Cover / blocked line of sight prevents the cast;
- natural 1 misses and natural 20 hits critically;
- critical hits double damage dice;
- Cold damage passes through the existing typed-damage affinity helper.

## Source-turn-start timed effects

Phase 1O introduced `encounter_timed_effects` for Shocking Grasp's target-turn-start Opportunity Attack suppression. Phase 1P extends that same table rather than creating parallel state.

`expiry_trigger` is constrained to:

- `target_turn_start` — existing Phase 1O semantics;
- `source_turn_start` — new Phase 1P semantics.

Ray of Frost applies `ray_of_frost_speed_reduction` with metadata `speedPenaltyFt: 10` and `source_turn_start` expiry. The effect expires when the caster next becomes the active participant.

The movement authority derives effective tactical Speed as canonical Speed minus the active timed Speed penalty. `encounter_end_turn_v1` snapshots the next participant's effective Speed using the same helper so the combat UI and authoritative movement RPC stay consistent.

When a source-turn Speed effect expires, the turn-start trigger restores the affected participant's displayed `speed_ft` from canonical Speed minus any remaining timed penalty.

Multiple copies of the same Speed penalty are not summed. Overlapping Ray of Frost reductions from different casters fail closed to GM-assisted resolution rather than silently shortening, stacking, or choosing the wrong expiry source.

## Deployment and validation

Validator-backed server preview completed successfully at commit `db51b312fd3316e0f0b2ecd71814d76a1ab85d54` before the production migration was applied. The Vercel preview ran the existing tactical spell suite plus the new Ray of Frost server validator and then completed the Next build successfully.

Production migration:

- `20260728190908 tactical_ray_of_frost`

Post-deploy rollback validation used Pip Quillspark and Raska Stonejaw in a temporary encounter and verified:

- Ray of Frost hit through the deployed v8 resolver and applied typed Cold damage;
- a critical hit doubled the cantrip's damage dice correctly;
- Raska's effective Speed changed from 30 feet to 20 feet on the hit;
- duplicate replay of the same request returned the identical stored result without another damage/effect/Action application;
- Pip spent exactly one Action;
- the source-turn effect remained active when Raska's own turn began;
- a 25-foot movement path was rejected with `Movement exceeds remaining Speed`;
- a 20-foot path succeeded and consumed the full reduced allowance;
- when Pip's next turn began, the source-turn effect expired and Raska's Speed restored to 30 feet;
- the rollback left no encounter maps, encounters, participants, commands, combat-log rows, spell-slot rows, reaction windows, or timed effects behind.

Privilege checks confirm v8 is executable by `authenticated` and `service_role`, not `anon`. The source-turn effect and timed-Speed helpers are not executable by authenticated clients.

After rollback, the protected live baseline remained 5 characters, 20 locations, 4 world routes, and 9 route points. The only permanent gameplay addition is Pip's reviewed Ray of Frost assignment, bringing intentional `character_spells` assignments to 9.

## Isolation

Phase 1P is tactical-only. It does not reference or modify world routes, travel advancement, weather, camps, town maps, or world simulation.

## UI gate remaining

The combat UI still intentionally hides Ray of Frost until its UI branch is separately validated. The remaining Phase 1P work is:

1. add Ray of Frost to the combat-page reviewed whitelist and 60-foot range preflight;
2. route only Ray of Frost through v8 while keeping v1-v7 routing intact;
3. display ranged spell-attack rules, d8 cantrip scaling, Cold damage, and Speed −10 until source next turn start;
4. add Ray-specific combat-log rendering and forward-compatible prior-phase validators;
5. pass the full tactical validator suite and Next build on the exact UI head;
6. integrate linearly to `main` and verify the resulting production deployment before Phase 1Q begins.

Phase 1O production closeout remains green at main commit `afd9540653b39359db6c9939d94ded118a7d5db7`; Phase 1P starts from that validator-backed baseline.
