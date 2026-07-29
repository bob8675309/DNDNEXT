# Tactical Encounter Phase 1S — Word of Radiance

Status: **SERVER SOURCE READY / LIVE MIGRATION + UI PENDING**

Phase 1S introduces the first reviewed multi-target area spell adapter through the XPHB version of **Word of Radiance**.

## Reviewed XPHB spell

The live canonical definition is:

- class: Cleric;
- cantrip;
- Action;
- 5-foot Emanation originating from the caster;
- each creature of the caster's choice that the caster can see in the Emanation makes a Constitution saving throw;
- failed save: 1d6 Radiant damage;
- successful save: 0 damage;
- cantrip scaling to 2d6 / 3d6 / 4d6 at character levels 5 / 11 / 17;
- instantaneous and non-concentration.

Aurelia Dawnmere is the intended reviewed Cleric fixture and permanent assignment target after rollback validation succeeds.

## Area-casting contract

New guarded RPC:

`public.encounter_cast_area_spell_v1(caster, assignment, target_ids[], slot_level, request_id)`

The first approved adapter is only `word-of-radiance|XPHB`. The RPC preserves the existing `spell_cast` command-ledger type rather than widening the command vocabulary for area spells.

The caller explicitly supplies the chosen creatures. The server rejects an empty list, duplicate IDs, targets outside the encounter, defeated targets, hidden unauthorized targets, targets outside the 5-foot Emanation, targets without line of sight, and targets with active Conditions that could interact with saving-throw automation.

The caster may be included in the chosen target list. That explicitly represents the 2024 Emanation rule that the origin is not included unless the effect's creator chooses otherwise.

## Simultaneous damage

All selected creatures make independent Constitution saves, but the spell's damage dice are rolled once for the whole simultaneous effect. Every failed save uses that shared damage roll; successful saves take 0 damage.

The adapter therefore returns:

- area type and radius;
- caster/origin participant;
- selected target count;
- shared damage dice and shared roll;
- success/failure counts;
- one result object per selected creature with distance, save profile, save roll, Mind Sliver penalty consumption when applicable, damage affinity resolution, and targeting context.

The shared internal saving-throw profile remains the authority boundary for save bonuses and one-shot Mind Sliver penalty consumption. A later exception rolls the entire area cast back transactionally, including any consumed save penalties and damage already applied earlier in the target loop.

## Isolation

Phase 1S is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

## Validation plan

Before UI work:

1. pass the complete tactical validator suite and Next build on the exact server head;
2. apply the additive migration only after that gate is green;
3. rollback-test one-target and multi-target casts, mixed save outcomes, one shared damage roll, Radiant resistance/immunity handling, explicit self/origin inclusion, invalid/duplicate/out-of-range/blocked targets, Action spending, idempotency, and Mind Sliver penalty consumption inside the area cast;
4. verify authenticated/service-role access and no anonymous access;
5. add Aurelia Dawnmere's reviewed canonical assignment only after rollback validation succeeds;
6. separately gate combat UI target selection, 5-foot Emanation presentation, per-target outcomes, and shared damage display.

Phase 1R production main `ee2cde5ffdfd2d87e99948d7dae3fc6bb6146844` is the baseline: 5 characters, 11 reviewed spell assignments, zero tactical fixture/effect rows, and the protected world baseline 20 locations / 4 routes / 9 route points.