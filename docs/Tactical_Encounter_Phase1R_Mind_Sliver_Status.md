# Tactical Encounter Phase 1R — Mind Sliver

Status: **SERVER SOURCE READY / LIVE MIGRATION + UI PENDING**

Phase 1R adds a reusable one-shot saving-throw modifier to the tactical engine. The first reviewed adapter is the XPHB version of **Mind Sliver**.

## Reviewed XPHB spell

The live canonical definition is:

- classes: Sorcerer, Warlock, Wizard;
- cantrip;
- Action;
- range: 60 feet;
- Intelligence saving throw;
- 1d6 Psychic damage on a failed save;
- cantrip scaling to 2d6 / 3d6 / 4d6 at character levels 5 / 11 / 17;
- on a failed save, the target subtracts 1d4 from the next saving throw it makes before the end of the caster's next turn.

Pip Quillspark is the intended reviewed Wizard fixture and permanent assignment target after rollback validation succeeds.

## Shared save modifier

All current automated saving throws converge on `public.encounter_saving_throw_profile_internal_v1(participant, ability)`: Sacred Flame, Toll the Dead, Inflict Wounds, and the manual save resolver. The function is internal-only; authenticated and anonymous clients cannot execute it directly.

Phase 1R makes that profile the one-shot consumption boundary. If `mind_sliver_save_penalty` is active on the participant, the profile:

- rolls 1d4;
- subtracts that value from the normal save bonus;
- deletes the timed effect immediately so it can affect exactly one real saving throw;
- returns both `baseSaveBonus` and the rolled `savePenalty` with the final `saveBonus`;
- records an `effect_consumed` combat-log event.

Because the profile is called inside the same database transaction as each saving throw, a later exception rolls the consumption back with the rest of the failed command.

## Duration

Mind Sliver reuses Phase 1Q's **source-turn-end** timing. On a failed Intelligence save it applies `mind_sliver_save_penalty` with two source-turn-end triggers remaining:

1. the current caster turn end decrements 2 → 1;
2. the end of the caster's next turn expires the effect if no saving throw has consumed it first.

If a target already has the penalty, that existing effect is consumed by the new Mind Sliver Intelligence save before a replacement effect is applied on failure. This naturally preserves the rule that the next saving throw consumes the rider.

## Server adapter

New guarded RPC:

`public.encounter_cast_spell_v10(caster, assignment, target, slot_level, request_id)`

v10 delegates every Phase 1I-1Q reviewed adapter to v9 and owns only `mind-sliver|XPHB`.

It requires the exact XPHB class assignment, active controlled turn, available Action, another visible undefeated creature, line of sight, 60 feet or less, and canonical class spellcasting statistics. Targets with active D&D Conditions remain GM-assisted until generic condition-driven saving-throw modifiers are modeled.

On the Intelligence save:

- cover contributes no save bonus;
- Dodge contributes no advantage;
- a successful save takes no damage and receives no new rider;
- a failed save takes scaled Psychic damage and receives the one-shot 1d4 save penalty through source-turn-end timing.

The command remains request-ID idempotent and uses the existing typed-damage affinity authority.

## Isolation

Phase 1R is tactical-only. It does not reference or modify world routes, world travel advancement, weather, camps, town maps, or world simulation.

## Validation plan

Before UI work:

1. pass the complete tactical validator suite and Next build on the exact server head;
2. apply the additive migration only after that gate is green;
3. rollback-test failed and successful Mind Sliver saves, Psychic damage, Action spending, idempotency, one-shot d4 save consumption through the shared profile, duplicate save idempotency, source-turn-end expiry when unused, and rollback cleanliness;
4. verify v10 authenticated/service-role access, no anon access, and internal-only save-profile access;
5. add Pip Quillspark's reviewed canonical assignment only after rollback validation passes;
6. separately gate combat UI routing, result text, log presentation, and display of consumed save penalties.

Phase 1Q production main `663351cabed8721a896181accd371a96e6572750` is the baseline: 5 characters, 10 reviewed spell assignments, zero tactical fixture/effect rows, and the protected world baseline 20 locations / 4 routes / 9 route points.
