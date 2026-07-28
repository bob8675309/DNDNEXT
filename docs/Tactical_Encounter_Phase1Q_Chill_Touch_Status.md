# Tactical Encounter Phase 1Q — Chill Touch

Status: **SERVER DEPLOYED / VALIDATED; COMBAT UI PENDING**

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

Pip Quillspark is the reviewed Wizard character for this adapter. His permanent canonical assignment is `03201317-0c4e-40bc-a7fd-f792a41260d6` with `source_type=class`, `source_label=Wizard`, `prepared=true`, and `casting_stat=int`.

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

`encounter_timed_effects.expiry_trigger` now supports three constrained values:

- `target_turn_start` — Phase 1O;
- `source_turn_start` — Phase 1P;
- `source_turn_end` — Phase 1Q.

Chill Touch applies `chill_touch_no_healing` with source-turn-end timing. Because the spell is cast during the source's current Action and lasts through the **end of the source's next turn**, the effect starts with two remaining source-turn-end trigger events: the current turn end decrements it from 2 to 1, and the following source turn end expires it.

Recasting Chill Touch from the same caster before expiration refreshes that duration. A simultaneous healing lock from a different caster fails closed to GM-assisted resolution rather than silently replacing the expiry owner.

## Healing authority

`public.encounter_apply_healing_internal_v1` remains the single internal healing authority. Phase 1Q extends it so an active `chill_touch_no_healing` effect returns zero applied healing and reports the prevention effect without mutating the target's HP or defeated state.

That defeated-state rule is important: a 0-HP defeated target affected by Chill Touch remains at 0 HP and remains defeated when healing is attempted. When no healing lock is active, the helper retains its prior healing/revival behavior.

## Deployment and validation

The full validator-backed Phase 1Q server branch completed successfully in Vercel at commit `b02dcc90ac4d9588cd964d15fa2c635c1b5b19aa` before the live migration was applied. This run included every prior tactical spell validator, the new Chill Touch server validator, and the Next build.

Production migration:

- `20260728193929 tactical_chill_touch`

Post-deploy rollback validation used Pip Quillspark and Raska Stonejaw and verified:

- Chill Touch resolved through deployed v9 as a 5-foot melee spell attack and dealt typed Necrotic damage;
- the observed critical hit doubled the level-2 cantrip from `1d10` to `2d10`;
- the cast spent exactly one Action;
- replaying the identical request returned the identical stored result without another damage/effect/Action application;
- one `chill_touch_no_healing` row was created with `source_turn_end` and two remaining source-turn-end triggers;
- a healing attempt at normal HP applied 0 healing and left HP unchanged;
- a healing attempt at 0 HP applied 0 healing, left HP at 0, and preserved `is_defeated=true`;
- ending Pip's current turn decremented the effect from 2 to 1 rather than expiring it;
- the effect remained active throughout Pip's next turn and continued to block healing;
- ending Pip's next turn removed the effect;
- immediately after expiry, the same healing helper applied 6 HP normally;
- rollback returned all tactical fixture tables, including `encounter_timed_effects`, to zero rows.

Privilege checks confirm v9 is executable by `authenticated` and `service_role`, not `anon`. The source-turn-end helper and internal healing helper remain unavailable to authenticated clients.

After rollback, the protected live state remained 5 characters, 20 locations, 4 world routes, and 9 route points. Pip's reviewed Chill Touch assignment is the only permanent gameplay addition, bringing intentional reviewed `character_spells` assignments to 10.

## Isolation

Phase 1Q is tactical-only. It does not reference or modify world routes, world travel, weather, camps, town maps, or world simulation.

## UI gate remaining

The combat UI still intentionally hides Chill Touch. The remaining Phase 1Q work is:

1. add Chill Touch to the reviewed combat whitelist and 5-foot Touch range preflight;
2. route only Chill Touch through v9 while preserving v1-v8 routing;
3. present d10 Necrotic scaling, melee spell-attack rules, and the no-healing rider through source-next-turn-end;
4. surface `healingPrevented` from Cure Wounds/other healing results so blocked healing is not described as successful recovery;
5. add a Chill Touch UI validator and make only the necessary older guards forward-compatible;
6. pass the full tactical validator suite and Next build on the exact UI head;
7. integrate linearly to `main` and production-verify before Phase 1R begins.

Phase 1P is the production baseline for this work: Ray of Frost is fully deployed on main at `b6bf8cb9c7c47334c60b2aa5f48874823928c7fc` with nine reviewed spell assignments and a clean 20/4/9 world baseline.
