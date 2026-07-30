# Tactical Encounter Phase 1U — Vicious Mockery

Status: **SERVER SOURCE READY / LIVE MIGRATION + UI PENDING**

Phase 1U extends the shared attack-roll authority with a reusable one-shot **next-attack Disadvantage** mechanic. The first reviewed adapter is the XPHB version of **Vicious Mockery**.

## Reviewed XPHB spell

The live canonical definition is:

- Bard cantrip;
- Action;
- 60-foot range;
- Wisdom saving throw;
- `1d6` Psychic damage on a failed save;
- cantrip scaling to `2d6 / 3d6 / 4d6` at character levels `5 / 11 / 17`;
- on a failed save, the target has Disadvantage on the next attack roll it makes before the end of its next turn;
- instantaneous and non-concentration.

The five persistent tactical fixtures currently contain no Bard. Phase 1U therefore does **not** add an artificial permanent character or an off-class permanent assignment merely to surface the spell. Live rollback validation will use transaction-only Bard test data; the adapter will become available automatically to future eligible Bard characters with reviewed class assignments.

## Shared next-attack modifier

`private.encounter_resolve_attack_roll_v1(attacker, target, base_disadvantage)` remains the single attack-roll authority for weapon attacks, Unarmed Strike, Opportunity Attacks, and reviewed spell attacks.

Phase 1U extends it with `vicious_mockery_next_attack_disadvantage`:

- Guiding Bolt Advantage remains target-scoped and is consumed from the attack target;
- Vicious Mockery Disadvantage is attacker-scoped and is consumed from the creature making the next attack;
- either one-shot effect is consumed by the next qualifying attack even if another source of Advantage/Disadvantage cancels its numerical effect;
- Guiding Bolt Advantage plus Vicious Mockery Disadvantage cancels to one normal d20 roll while both one-shot effects are consumed and audited;
- existing base Disadvantage such as Dodge continues to combine through the same resolver.

## Target-turn-end timed effects

`encounter_timed_effects.expiry_trigger` gains a fourth supported value: `target_turn_end`.

`private.encounter_apply_target_turn_end_effect_v1(...)` stores target-owned timed effects that expire at the end of that target's next turn. `public.encounter_end_turn_v1` becomes the authoritative expiry boundary and writes the existing `effect_expired` audit event when the unused effect ends.

Vicious Mockery uses one remaining target turn end. If the target attacks first, the shared attack resolver consumes the effect immediately. If it makes no attack, the effect expires at that target's next turn end.

## Server adapter

`public.encounter_cast_spell_v12(caster, assignment, target, slot_level, request_id)` delegates every other reviewed spell to v11 and owns only `vicious-mockery|XPHB`.

The adapter requires:

- reviewed XPHB cantrip definition;
- class-source assignment labeled Bard;
- canonical Bard spellcasting profile;
- Charisma casting ability;
- active turn, controller/service authority, available Action, undefeated caster/target, and existing tactical condition fail-closed guards;
- a different creature target within 60 feet;
- visible line of sight in the automated path.

The XPHB spell can target a creature the caster can **see or hear**. The tactical engine does not yet model hearing, deafness, or silence, so hearing-only targeting is intentionally GM-assisted rather than guessed. The automated adapter proves the visible-target subset and fails closed when LOS cannot establish that subset.

On a failed Wisdom save, v12 rolls shared typed Psychic damage through the existing damage authority and applies the one-shot attack Disadvantage effect. On a successful save, it deals 0 damage and applies no rider. Mind Sliver save-penalty consumption remains inherited through the shared internal saving-throw profile.

The command remains request-ID idempotent and consumes no spell slot.

## Validation plan

Before live migration:

1. pass the complete tactical validator suite and Next build on the exact Phase 1U server head;
2. verify the migration preserves all prior Guiding Bolt, legacy attack hardening, timed-effect, save-profile, and turn-end contracts;
3. apply the additive migration only after that gate is green;
4. rollback-test a transaction-only Bard caster and Vicious Mockery assignment against existing tactical fixtures;
5. force failed and successful Wisdom-save outcomes;
6. verify Psychic damage, cantrip scaling, Action spending, request idempotency, and no slot use;
7. verify Vicious Mockery Disadvantage on weapon, Unarmed, Opportunity, and reviewed spell attacks through the shared resolver;
8. verify Guiding Bolt Advantage + Vicious Mockery Disadvantage cancellation consumes both riders and uses one normal d20;
9. verify an unused rider expires exactly at the target's next turn end;
10. verify rollback returns all tactical fixture/effect rows to zero and leaves the protected world baseline unchanged;
11. then separately gate combat UI routing/result/log presentation through v12.

## Isolation

Phase 1U is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1U starts from production-green `main` commit `80ea7ba3f4d08695bf923672e5a4d69475b0de8e`: 5 characters, 13 reviewed spell assignments, exactly 1 Guiding Bolt assignment on Aurelia Dawnmere, zero tactical fixture/effect rows, and the protected world baseline of 20 locations / 4 routes / 9 route points.
