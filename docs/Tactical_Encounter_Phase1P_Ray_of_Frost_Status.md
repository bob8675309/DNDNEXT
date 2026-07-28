# Tactical Encounter Phase 1P — Ray of Frost

Status: **SERVER + COMBAT UI DEPLOYED / VALIDATED**

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

Guarded cast RPC:

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

`expiry_trigger` supports:

- `target_turn_start` — Phase 1O semantics;
- `source_turn_start` — Phase 1P semantics.

Ray of Frost applies `ray_of_frost_speed_reduction` with metadata `speedPenaltyFt: 10` and `source_turn_start` expiry. The effect expires when the caster next becomes the active participant.

The movement authority derives effective tactical Speed as canonical Speed minus the active timed Speed penalty. `encounter_end_turn_v1` snapshots the next participant's effective Speed using the same helper so the combat UI and authoritative movement RPC stay consistent.

When a source-turn Speed effect expires, the turn-start trigger restores the affected participant's displayed `speed_ft` from canonical Speed minus any remaining timed penalty.

Multiple copies of the same Speed penalty are not summed. Overlapping Ray of Frost reductions from different casters fail closed to GM-assisted resolution rather than silently shortening, stacking, or choosing the wrong expiry source.

## Server deployment and rollback validation

Validator-backed server preview completed successfully at commit `db51b312fd3316e0f0b2ecd71814d76a1ab85d54` before the production migration was applied.

Production migration:

- `20260728190908 tactical_ray_of_frost`

Post-deploy rollback validation with Pip Quillspark and Raska Stonejaw verified:

- typed Cold damage through v8;
- critical doubling of cantrip damage dice;
- Speed 30 → 20 on a hit;
- duplicate replay idempotency;
- exactly one Action spent;
- persistence through the target's own turn start;
- rejection of a 25-foot movement path while reduced to 20 feet;
- acceptance of an exact 20-foot path;
- source-next-turn-start expiry and Speed restoration to 30 feet;
- zero surviving tactical fixture rows after rollback.

Privilege checks confirm v8 is executable by `authenticated` and `service_role`, not `anon`, while internal timed-effect helpers remain private.

The server-only source ancestry was rebased linearly through PR #84 and production-verified on main at `dd7fbe35b39044a8d85dd5e76efe3f4800ae9ea1` before the UI was exposed.

## Combat UI deployment

The separately gated UI adds Ray of Frost as the ninth reviewed tactical adapter and preserves v1-v7 routing for all prior spells.

The combat surface now shows:

- 60-foot client range preflight;
- canonical spell-attack bonus versus AC;
- d8 cantrip scaling;
- Cold damage;
- Dodge disadvantage and cover-AC rules;
- close-quarters fail-closed guidance;
- current target Speed and the 10-foot on-hit reduction;
- result text with before/after Speed;
- combat-log text showing the source-turn-start expiry boundary.

A dedicated `validate_tactical_ray_of_frost_ui.mjs` validator was added, and older Poison Spray, False Life, and Shocking Grasp UI guards were made narrowly forward-compatible without removing their spell-specific assertions.

The exact UI branch head `ae9efd750408d6dd550d2b28d7a64f9c2e00b4c8` passed all 17 tactical spell validators plus the Next build in Vercel. PR #85 then rebased that ancestry linearly to `main` at `b6bf8cb9c7c47334c60b2aa5f48874823928c7fc`, and the resulting production deployment completed successfully.

Post-production state remained clean: 5 characters, 9 intentional reviewed spell assignments, no encounter maps/sessions/participants/commands/logs/slot rows/reaction windows/timed effects, and the protected world baseline remained 20 locations / 4 routes / 9 route points.

## Isolation

Phase 1P is tactical-only. It does not reference or modify world routes, travel advancement, weather, camps, town maps, or world simulation.

Phase 1P is complete. Phase 1Q may build from production main `b6bf8cb9c7c47334c60b2aa5f48874823928c7fc`.
