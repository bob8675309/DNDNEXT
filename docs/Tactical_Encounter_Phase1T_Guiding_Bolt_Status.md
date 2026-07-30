# Tactical Encounter Phase 1T — Guiding Bolt

Status: **SERVER SOURCE IN PROGRESS / LIVE MIGRATION + UI PENDING**

Phase 1T adds the XPHB **Guiding Bolt** and, more importantly, establishes a reusable one-shot attack-roll modifier authority path.

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

## Shared attack-roll foundation

`private.encounter_resolve_attack_roll_v1(attacker, target, base_disadvantage)` is the new attack-roll authority primitive.

It consumes `guiding_bolt_next_attack_advantage` on the next qualifying attack roll against the target, transactionally logs that consumption, and resolves:

- Advantage only: roll two d20 and use the higher;
- Disadvantage only: roll two d20 and use the lower;
- both Advantage and Disadvantage: cancel to one normal d20 roll while still consuming the one-shot Guiding Bolt effect;
- neither: one normal d20 roll.

The foundation explicitly rewires equipped weapon attacks, Unarmed Strike, and Opportunity Attack through the shared resolver. This is behavior-neutral until a Guiding Bolt effect exists.

## Canonical spell-attack resolver

`public.encounter_cast_spell_v11(caster, assignment, target, slot_level, request_id)` becomes the canonical current resolver for reviewed attack-roll spells:

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

Guiding Bolt retains the existing tactical guards for class source, reviewed XPHB version, canonical Cleric profile, prepared/always-available state, one eligible slot pool, LOS/Total Cover, 120-foot range, close-quarters ranged spell attacks, active Conditions, Action spending, typed damage, critical dice, and request idempotency.

## Deployment sequencing

There are currently zero live Guiding Bolt assignments. Phase 1T intentionally keeps that true while server and UI are staged.

Safe sequence:

1. validate the shared attack-roll foundation and v11 source;
2. apply the foundation migration;
3. rollback-test weapon, Unarmed, and Opportunity Attack behavior with and without a synthetic Guiding Bolt effect, including Advantage/Disadvantage cancellation;
4. apply the v11 Guiding Bolt migration;
5. rollback-test Guiding Bolt hit/miss, slots/upcast/critical/rider/idempotency and consumption by every automated attack-roll category;
6. deploy combat UI routing through v11;
7. only after the UI is production-green, harden legacy v1-v10 client execution so old client RPCs cannot bypass the shared attack-roll authority path;
8. add Aurelia Dawnmere's reviewed Guiding Bolt assignment after hardening;
9. recheck tactical zero-fixture state and protected world baseline.

## Isolation

Phase 1T is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1S app-bearing production baseline: `1b52051a8d5a4bb672f77a1c48abd3a993a29961`. The later Phase 1S completion-ledger commit is documentation-only and does not change runtime application code.
