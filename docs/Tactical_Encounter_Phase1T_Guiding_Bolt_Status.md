# Tactical Encounter Phase 1T — Guiding Bolt

Status: **SERVER + COMBAT UI DEPLOYED / VALIDATED; LEGACY ATTACK RPC HARDENING LIVE / VALIDATED; PERMANENT ASSIGNMENT PENDING**

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

There are intentionally still **zero permanent Guiding Bolt assignments** until the validated hardening source is integrated to `main`.

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

The foundation rollback fixture used Raska Stonejaw attacking Pip Quillspark, with Aurelia Dawnmere as the synthetic Guiding Bolt source and a transaction-only equipped spear. It verified normal rolls, Advantage, Disadvantage, Advantage/Disadvantage cancellation, rider consumption, invalid-attack preservation, duplicate idempotency, Unarmed Strike consumption, Opportunity Attack consumption, and complete rollback.

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

Existing non-attack reviewed spells continue through the version chain. Existing spell-specific riders remain server-owned:

- Shocking Grasp suppresses Opportunity Attacks until target turn start;
- Ray of Frost reduces Speed by 10 feet until source turn start;
- Chill Touch prevents Hit Point recovery until source next turn end;
- Guiding Bolt grants the one-shot next-attack Advantage until source next turn end.

Guiding Bolt retains the tactical guards for class source, reviewed XPHB version, canonical Cleric profile, prepared/always-available state, one eligible slot pool, LOS/Total Cover, 120-foot range, close-quarters ranged spell attacks, active Conditions, Action spending, typed damage, critical dice, and request idempotency.

Production migration:

- `20260730023411 tactical_guiding_bolt`.

The v11 rollback fixture used a transaction-only Aurelia Guiding Bolt assignment and explicit fixture slot pools. It verified level-1 hit, miss, level-2 upcast, natural-20 critical, exact slot/Action spend, duplicate idempotency, Fire Bolt rider consumption, Dodge cancellation, unused-rider expiry, unprepared rejection, and complete rollback.

v11 is executable by `authenticated` and `service_role`, not `anon`.

## Combat UI deployment

Phase 1T adds Guiding Bolt to the existing tactical combat surface while preserving the established single-target version routes and Word of Radiance area routing.

Guiding Bolt alone routes directly through `encounter_cast_spell_v11`. The UI shows:

- 120-foot range;
- selected-slot `4d6 + 1d6 per slot above 1` Radiant damage;
- next-attack Advantage on hit;
- slot remainder;
- Guiding Bolt rider consumption on spell, weapon, and Unarmed attack feedback;
- Advantage/Disadvantage cancellation when applicable;
- combat-log detail for rider application and consumption.

Historical UI validators were made forward-compatible only by removing Guiding Bolt from obsolete future-spell forbidden lists. Their spell-specific rule and routing assertions remain intact.

Draft PR #93 used temporary PR-only workflow run `30512526110`. It passed dependency installation, the complete tactical spell validator suite, and `next build`. The workflow was removed before integration.

Clean UI head `04b81572b787af0e0b3fb330c6442c07f274afd0` was independently Vercel green. PR #93 was rebase-merged without force, producing app-bearing `main` commit `230bdfd2cb9c883bdac8262cbf12453b3f56a121`, which is production-green.

## Legacy attack-RPC hardening

Phase 1T preserves old authenticated client entry points instead of revoking the entire v1-v10 chain.

Production migration:

- `20260730040717 tactical_legacy_attack_spell_hardening`.

The compatibility contract is:

- v1 Fire Bolt -> v11; v1 Cure Wounds remains resolved by v1;
- v4 Poison Spray -> v11; other v4 calls fall through to v3;
- v7 Shocking Grasp -> v11; other v7 calls fall through to v6;
- v8 Ray of Frost -> v11; other v8 calls fall through to v7;
- v9 Chill Touch -> v11; other v9 calls fall through to v8.

This means old clients remain functional while every approved attack-roll spell reaches the shared v11 attack-roll authority path.

Draft PR #94 temporary workflow run `30512923829` passed dependency installation, the complete tactical spell validator suite, the new legacy-hardening validator, and `next build` before live migration.

Post-deploy transactional rollback validation called the actual legacy RPC versions using Pip Quillspark's permanent reviewed assignments and a synthetic Guiding Bolt timed effect on Raska Stonejaw. It verified:

- v1 Fire Bolt consumed the rider with Advantage through v11;
- duplicate v1 Fire Bolt request returned the same stored result without another log row;
- v4 Poison Spray consumed the rider through v11;
- v7 Shocking Grasp consumed the rider through v11;
- v8 Ray of Frost consumed the rider through v11;
- v9 Chill Touch consumed the rider through v11;
- v1 Cure Wounds still resolved `2d8` at slot level 1, spent one spell slot, spent one Action, and restored HP;
- rollback removed all encounter/map/participant/command/log/slot/effect fixture state.

v1, v4, v7, v8, and v9 remain executable by `authenticated` and `service_role`, not `anon`.

## Current protected baseline

After the live hardening migration and rollback validation:

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

1. integrate the validated legacy-hardening source to `main` without force;
2. production-verify that exact source commit;
3. add Aurelia Dawnmere's permanent reviewed Guiding Bolt assignment;
4. recheck the protected tactical/world baseline;
5. mark Phase 1T complete before beginning Phase 1U.

## Isolation

Phase 1T is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1S app-bearing production baseline: `1b52051a8d5a4bb672f77a1c48abd3a993a29961`. Phase 1T app-bearing combat-UI production baseline: `230bdfd2cb9c883bdac8262cbf12453b3f56a121`.
