# Tactical Encounter Phase 1P — Ray of Frost

Status: **SERVER SOURCE READY / LIVE MIGRATION + UI PENDING**

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

Pip Quillspark is the intended reviewed Wizard fixture/assignment target after live rollback validation succeeds.

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

The movement authority now derives effective tactical Speed as canonical Speed minus the active timed Speed penalty. `encounter_end_turn_v1` also snapshots the next participant's effective Speed using the same helper so the UI and movement RPC remain consistent.

When a source-turn Speed effect expires, the expiry trigger restores the affected participant's displayed `speed_ft` from canonical Speed minus any remaining timed penalty.

Multiple copies of the same Speed penalty are not summed. Overlapping Ray of Frost reductions from different casters fail closed to GM-assisted resolution rather than silently shortening, stacking, or choosing the wrong expiry source.

## Isolation

Phase 1P is tactical-only. It does not reference or modify world routes, travel advancement, weather, camps, town maps, or world simulation.

## Validation plan

Before UI work:

1. Vercel must accept and compile the exact server commit with the full tactical validator suite.
2. Apply the additive migration only after that build is green.
3. Run rollback fixtures proving hit/miss, damage, Action use, idempotency, Speed −10, movement enforcement, target-turn persistence, source-turn-start expiry/restoration, and no fixture residue.
4. Verify v8 authenticated/service-role access and no anon access; internal timed-effect helpers remain private.
5. Only then grant Pip Quillspark the reviewed canonical assignment and wire the combat UI.

Phase 1O production closeout remains green at main commit `afd9540653b39359db6c9939d94ded118a7d5db7`; Phase 1P starts from that validator-backed baseline.
