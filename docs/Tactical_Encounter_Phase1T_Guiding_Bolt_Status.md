# Tactical Encounter Phase 1T — Guiding Bolt

Status: **SERVER DEPLOYED / VALIDATED; COMBAT UI + LEGACY HARDENING PENDING**

Phase 1T adds the XPHB **Guiding Bolt** and establishes a reusable one-shot attack-roll modifier authority path.

## Reviewed XPHB spell

The live canonical definition is:

- Cleric level 1;
- Action;
- 120-foot ranged spell attack;
- 4d6 Radiant damage on a hit;
- +1d6 damage for each spell slot level above 1;
- on a hit, the next attack roll made against the target before the end of the caster's next turn has Advantage;
- 1-round duration;
- no concentration.

There are intentionally still **zero permanent Guiding Bolt assignments** while UI routing and legacy-RPC hardening are pending.

## Shared attack-roll foundation

`private.encounter_resolve_attack_roll_v1(attacker, target, base_disadvantage)` is the attack-roll authority primitive.

It consumes `guiding_bolt_next_attack_advantage` on the next qualifying attack roll against the target, transactionally logs that consumption, and resolves:

- Advantage only: roll two d20 and use the higher;
- Disadvantage only: roll two d20 and use the lower;
- both Advantage and Disadvantage: cancel to one normal d20 roll while still consuming the one-shot Guiding Bolt effect;
- neither: one normal d20 roll.

The foundation explicitly rewires equipped weapon attacks, Unarmed Strike, and Opportunity Attack through the shared resolver.

Production migration:

- `20260730022432 tactical_attack_roll_modifiers`.

The foundation rollback fixture used Raska Stonejaw attacking Pip Quillspark, with Aurelia Dawnmere as the synthetic Guiding Bolt source and a transaction-only equipped spear. It verified:

- no rider + no Dodge: one normal d20, no effect consumption;
- duplicate weapon request: identical stored result, no extra effect-consumption log;
- rider + no Dodge: Advantage, two d20, higher roll selected, rider deleted and audited exactly once;
- rider + Dodge: Advantage and Disadvantage cancel to one d20 while the rider is still consumed;
- Dodge only: Disadvantage, two d20, lower roll selected;
- invalid out-of-reach weapon attack rejects before the resolver and preserves rider, Action, and request ledger;
- Unarmed Strike consumes the same rider with Advantage;
- Opportunity Attack consumes the same rider with Advantage and spends Reaction;
- rollback removed the encounter map, encounter, participants, test inventory item, commands, logs, timed effects, and all other fixture rows.

The resolver is executable by `service_role` only, not `authenticated` or `anon`.

## Canonical spell-attack resolver

`public.encounter_cast_spell_v11(caster, assignment, target, slot_level, request_id)` is the canonical current resolver for reviewed attack-roll spells:

- Fire Bolt;
- Poison Spray;
- Shocking Grasp;
- Ray of Frost;
- Chill Touch;
- Guiding Bolt.

All six use the same attack-roll resolver, so the next-attack Advantage rider is consumed consistently by spell attacks as well as weapon, Unarmed, and Opportunity Attacks.

Existing non-attack reviewed spells continue through v10. Existing spell-specific riders remain server-owned:

- Shocking Grasp suppresses Opportunity Attacks until target turn start;
- Ray of Frost reduces Speed by 10 feet until source turn start;
- Chill Touch prevents Hit Point recovery until source next turn end;
- Guiding Bolt grants the one-shot next-attack Advantage until source next turn end.

Guiding Bolt retains the tactical guards for class source, reviewed XPHB version, canonical Cleric profile, prepared/always-available state, one eligible slot pool, LOS/Total Cover, 120-foot range, close-quarters ranged spell attacks, active Conditions, Action spending, typed damage, critical dice, and request idempotency.

Production migration:

- `20260730023411 tactical_guiding_bolt`.

The v11 rollback fixture used a transaction-only Aurelia Guiding Bolt assignment and explicit fixture slot pools. Deterministic PostgreSQL RNG seeds verified:

- level-1 normal hit: `4d6` Radiant, one slot spent, one Action spent, source-turn-end rider created;
- duplicate request: identical result, no extra slot, Action, or log spend;
- Pip's existing reviewed Fire Bolt routed through v11 and consumed the Guiding Bolt rider with Advantage;
- deterministic miss: slot and Action spent, no rider created;
- level-2 natural-20 critical: base `5d6` upcast doubled to `10d6`;
- level-2 noncritical hit: `5d6` and rider creation;
- v11 Fire Bolt against a Dodging target: Guiding Bolt Advantage canceled Dodge Disadvantage to one d20 while consuming the rider;
- unused rider decremented at the cast turn end and expired at the end of Aurelia's next turn with an `effect_expired` audit row;
- unprepared Guiding Bolt rejected before Action or slot spend;
- rollback removed the temporary assignment, slots, encounter fixtures, commands, logs, and timed effects.

v11 is executable by `authenticated` and `service_role`, not `anon`.

## Source validation gate

Draft PR #92 used a temporary PR-only GitHub Actions workflow because Vercel returned a failure state without diagnostic text. After restoring two Phase 1S provenance lines required by existing validators, run `30508258993` passed:

- dependency installation;
- the complete tactical spell validator suite, including the new attack-roll and Guiding Bolt validators;
- `next build`.

The temporary workflow is diagnostic only and is removed before server-source integration.

## Current protected baseline

After both live migrations and rollback validation:

- 5 characters;
- 12 reviewed spell assignments;
- 0 Guiding Bolt assignments;
- 0 encounter maps;
- 0 encounters;
- 0 encounter participants;
- 0 command requests;
- 0 combat-log fixture rows;
- 0 encounter spell slots;
- 0 reaction windows;
- 0 timed effects;
- 0 encounter Conditions;
- 20 locations;
- 4 world routes;
- 9 world route points.

## Remaining Phase 1T sequence

1. integrate the validated server/source slice to `main` without force;
2. route all reviewed single-target spell attacks in combat UI through v11 while keeping Word of Radiance on `encounter_cast_area_spell_v1`;
3. production-verify the UI;
4. revoke authenticated client execution on legacy v1-v10 while retaining internal delegation through v11;
5. add Aurelia Dawnmere's permanent reviewed Guiding Bolt assignment only after hardening;
6. recheck the protected tactical/world baseline before Phase 1U.

## Isolation

Phase 1T is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1S app-bearing production baseline: `1b52051a8d5a4bb672f77a1c48abd3a993a29961`. The later Phase 1S completion-ledger commit is documentation-only and does not change runtime application code.
