# Tactical Encounter Phase 1S — Word of Radiance

Status: **SERVER + COMBAT UI DEPLOYED / VALIDATED**

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

Aurelia Dawnmere is the reviewed Cleric fixture. Her permanent canonical assignment is `bd979a85-dea6-4e78-aa1a-42149262d5b4` with `source_type=class`, `source_label=Cleric`, `prepared=true`, and `casting_stat=wis`.

## Area-casting contract

Guarded RPC:

`public.encounter_cast_area_spell_v1(caster, assignment, target_ids[], slot_level, request_id)`

The first approved adapter is only `word-of-radiance|XPHB`. The RPC preserves the existing `spell_cast` command-ledger type rather than widening the command vocabulary for area spells.

The caller explicitly supplies the chosen creatures. The server rejects an empty list, duplicate IDs, targets outside the encounter, defeated targets, hidden unauthorized targets, targets outside the 5-foot Emanation, targets without line of sight, and targets with active Conditions that could interact with saving-throw automation.

The caster may be included in the chosen target list. That explicitly represents the 2024 Emanation rule that the origin is not included unless the effect's creator chooses otherwise.

## Simultaneous damage

All selected creatures make independent Constitution saves, but the spell's damage dice are rolled once for the whole simultaneous effect. Every failed save uses that shared damage roll; successful saves take 0 damage.

The adapter returns area type/radius, caster/origin, selected-target count, shared damage dice/roll, success/failure counts, and one result object per selected creature with distance, save profile, save roll, Mind Sliver penalty consumption when applicable, damage affinity resolution, and targeting context.

The shared internal saving-throw profile remains the authority boundary for save bonuses and one-shot Mind Sliver penalty consumption. A later exception rolls the entire area cast back transactionally, including any consumed save penalties and damage already applied earlier in the target loop.

## Server deployment and rollback validation

The exact server-source head `0176434a5a5464715380c743a38ce1f17b1d305d` passed the complete tactical validator suite and Next build before live migration.

Production migration:

- `20260729192806 tactical_word_of_radiance`.

Post-deploy transactional rollback validation used Aurelia Dawnmere as the caster/origin with Raska Stonejaw and Pip Quillspark adjacent. It verified mixed save outcomes, one shared damage roll, explicit origin selection, Radiant immunity/resistance, Mind Sliver consumption, invalid/duplicate/out-of-range/Total-Cover rejection, one Action/command/log per successful cast, request idempotency, and complete fixture rollback.

Privilege checks confirm the area RPC is executable by `authenticated` and `service_role`, not `anon`.

The server slice was rebase-merged through PR #90 and production-verified on `main` at `c4f39180ce4aba3523268fa4bc914ee21d550df7`.

## Combat UI validation and deployment

The Phase 1S combat UI keeps the established single-target spell state and v1-v10 routing intact. Word of Radiance alone uses separate `areaTargetIds` state and `encounter_cast_area_spell_v1`.

The UI presents the caster-centered 5-foot Emanation, explicit creature-choice checkboxes including optional caster/origin selection, Constitution save DC and scaled Radiant dice, one shared damage roll, per-target results, and area-specific combat-log detail.

The baseline spell UI validator was made area-safe without weakening authority or targeting checks: it requires the global cast readiness guard before the area branch and separately requires the single-target target guard after that branch.

Draft PR #91 used an isolated diagnostic workflow after an old validator blocked the first build. Run `30507079942` passed dependency installation, the complete tactical spell validator suite, and `next build`. The diagnostic workflow/document were then removed.

The cleaned UI branch head `a9f7ccf42082ae022445fdfeaaec0993f9b2cfc2` was independently Vercel green. PR #91 was rebase-merged without force, producing app-bearing `main` commit `1b52051a8d5a4bb672f77a1c48abd3a993a29961`, which was production-verified green.

## Final protected baseline

After production deployment:

- 5 characters;
- 12 reviewed spell assignments;
- Aurelia has exactly one reviewed Word of Radiance assignment;
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

## Isolation

Phase 1S is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1S is complete. Phase 1T may begin from the production-green Phase 1S baseline.

Phase 1S started from the Phase 1R production main `ee2cde5ffdfd2d87e99948d7dae3fc6bb6146844` with 5 characters, 11 reviewed spell assignments, zero tactical fixture/effect rows, and the protected world baseline 20 locations / 4 routes / 9 route points.
