# Tactical Encounter Phase 1Q — Chill Touch

Status: **SERVER SOURCE READY / LIVE MIGRATION + UI PENDING**

Phase 1Q extends the tactical timed-effect engine with a third duration boundary: **source-turn-end**. The first reviewed adapter using it is the XPHB version of **Chill Touch**, and the shared rules slice is deliberately limited to one durable behavior: blocking Hit Point recovery while the effect is active.

## Reviewed XPHB spell

The live canonical catalog entry for Chill Touch is:

- source: XPHB;
- classes: Sorcerer, Warlock, Wizard;
- cantrip;
- Action;
- range: Touch;
- melee spell attack;
- base damage: 1d10 Necrotic;
- cantrip scaling: 2d10 / 3d10 / 4d10 at character levels 5 / 11 / 17;
- on a hit, the target cannot regain Hit Points until the end of the caster's next turn.

Pip Quillspark is the intended reviewed Wizard fixture/assignment target after live rollback validation succeeds.

## Server contract

New guarded cast RPC:

`public.encounter_cast_spell_v9(caster, assignment, target, slot_level, request_id)`

v9 delegates all Phase 1I-1P reviewed adapters to v8 and owns only `chill-touch|XPHB`.

The adapter requires the caster's exact XPHB class assignment, an active controlled turn, an available Action, canonical class spellcasting statistics, another visible undefeated creature within 5 feet, and line of sight. It remains fail-closed when active Conditions could alter the spell attack.

Attack resolution preserves the reviewed melee spell-attack contract:

- Dodge imposes Disadvantage;
- cover can increase target AC;
- Total Cover / blocked line of sight prevents the cast;
- natural 1 misses and natural 20 hits critically;
- critical hits double damage dice;
- Necrotic damage passes through the existing typed-damage affinity helper.

## Source-turn-end timed effects

`encounter_timed_effects.expiry_trigger` is extended to three constrained values:

- `target_turn_start` — Phase 1O;
- `source_turn_start` — Phase 1P;
- `source_turn_end` — Phase 1Q.

Chill Touch applies `chill_touch_no_healing` with source-turn-end timing. Because the spell is cast during the source's current Action and lasts through the **end of the source's next turn**, the effect starts with two remaining source-turn-end trigger events: the current turn end decrements it from 2 to 1, and the following source turn end expires it.

Recasting Chill Touch from the same caster before expiration refreshes that duration. A simultaneous healing lock from a different caster fails closed to GM-assisted resolution rather than silently replacing the expiry owner.

## Healing authority

`public.encounter_apply_healing_internal_v1` remains the single internal healing authority. Phase 1Q extends it so an active `chill_touch_no_healing` effect returns zero applied healing and reports the prevention effect without mutating the target's HP or defeated state.

That defeated-state rule is important: a 0-HP defeated target affected by Chill Touch must remain at 0 HP and remain defeated when healing is attempted. The helper must not clear `is_defeated` merely because a healing effect was invoked.

When no healing lock is active, the helper retains its prior behavior.

## Isolation

Phase 1Q is tactical-only. It does not reference or modify world routes, world travel, weather, camps, town maps, or world simulation.

## Validation plan

Before UI work:

1. the exact server head must pass the full tactical validator suite and Next build in Vercel;
2. only after that green gate, apply the additive migration;
3. rollback-test Chill Touch hit/miss, Necrotic damage, Action spend, duplicate-request idempotency, healing prevention, defeated-state preservation, first source-turn-end decrement, next source-turn-end expiry, and healing restoration after expiry;
4. verify v9 authenticated/service-role execution, no anon execution, and private internal helpers;
5. grant Pip Quillspark a reviewed canonical assignment only after rollback validation succeeds;
6. then wire and separately gate the combat UI.

Phase 1P is the production baseline for this work: Ray of Frost is fully deployed on main at `b6bf8cb9c7c47334c60b2aa5f48874823928c7fc` with nine reviewed spell assignments and a clean 20/4/9 world baseline.
