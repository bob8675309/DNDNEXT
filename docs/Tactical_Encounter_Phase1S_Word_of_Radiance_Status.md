# Tactical Encounter Phase 1S — Word of Radiance

Status: **SERVER DEPLOYED / VALIDATED; COMBAT UI SOURCE VALIDATED / PRODUCTION PENDING**

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

New guarded RPC:

`public.encounter_cast_area_spell_v1(caster, assignment, target_ids[], slot_level, request_id)`

The first approved adapter is only `word-of-radiance|XPHB`. The RPC preserves the existing `spell_cast` command-ledger type rather than widening the command vocabulary for area spells.

The caller explicitly supplies the chosen creatures. The server rejects an empty list, duplicate IDs, targets outside the encounter, defeated targets, hidden unauthorized targets, targets outside the 5-foot Emanation, targets without line of sight, and targets with active Conditions that could interact with saving-throw automation.

The caster may be included in the chosen target list. That explicitly represents the 2024 Emanation rule that the origin is not included unless the effect's creator chooses otherwise.

## Simultaneous damage

All selected creatures make independent Constitution saves, but the spell's damage dice are rolled once for the whole simultaneous effect. Every failed save uses that shared damage roll; successful saves take 0 damage.

The adapter returns:

- area type and radius;
- caster/origin participant;
- selected target count;
- shared damage dice and shared roll;
- success/failure counts;
- one result object per selected creature with distance, save profile, save roll, Mind Sliver penalty consumption when applicable, damage affinity resolution, and targeting context.

The shared internal saving-throw profile remains the authority boundary for save bonuses and one-shot Mind Sliver penalty consumption. A later exception rolls the entire area cast back transactionally, including any consumed save penalties and damage already applied earlier in the target loop.

## Deployment and rollback validation

The exact server-source head `0176434a5a5464715380c743a38ce1f17b1d305d` passed the complete tactical validator suite and Next build before live migration.

Production migration:

- `20260729192806 tactical_word_of_radiance`.

Post-deploy transactional rollback validation used Aurelia Dawnmere as the caster/origin with Raska Stonejaw and Pip Quillspark adjacent. The rollback fixture verified:

- deterministic mixed outcomes: Raska succeeded while Aurelia and Pip failed;
- all three selected creatures used one shared `1d6` damage roll;
- a successful Constitution save took 0 damage;
- Aurelia could be explicitly selected as the Emanation origin and remained at distance 0;
- Radiant Immunity reduced Aurelia's failed-save damage to 0;
- Radiant Resistance correctly halved Pip's failed-save damage after the shared roll;
- Pip's active `mind_sliver_save_penalty` was consumed exactly once by his area-spell Constitution save and audited once;
- duplicate target IDs were rejected without spending the Action;
- a target 10 feet away was rejected as outside the 5-foot Emanation;
- an adjacent creature behind Total Cover was rejected because the caster could not see it;
- a successful cast spent exactly one Action and wrote exactly one `spell_cast` command/log result;
- replaying the same request ID returned the identical stored result with no extra damage, log rows, or Mind Sliver consumption;
- rollback restored maps, encounters, participants, command requests, combat log, spell slots, reaction windows, timed effects, and Conditions to zero fixture rows.

Privilege checks confirm the area RPC is executable by `authenticated` and `service_role`, not `anon`.

After rollback and the permanent assignment, the protected live state is 5 characters, 12 reviewed spell assignments, zero tactical fixture/effect rows, 20 locations, 4 world routes, and 9 route points.

The server slice was rebase-merged through PR #90 and production-verified on `main` at `c4f39180ce4aba3523268fa4bc914ee21d550df7`.

## Combat UI source gate

The Phase 1S combat UI keeps the established single-target spell state and v1-v10 routing intact. Word of Radiance alone uses separate `areaTargetIds` state and `encounter_cast_area_spell_v1`.

The UI presents:

- the caster-centered 5-foot Emanation;
- explicit checkbox-style creature choice, including optional caster/origin selection;
- Constitution save DC and cantrip-scaled Radiant dice;
- one shared damage roll for the cast;
- per-target save, affinity, Mind Sliver penalty, damage, and origin-selection results;
- area-specific combat-log detail without changing the legacy single-target log contract.

The baseline spell UI validator was made area-safe without weakening its authority or targeting checks: it requires the global cast readiness guard before the area branch and separately requires the single-target target guard after that branch.

Draft PR #91 ran the isolated Phase 1S UI validation workflow. Run `30507079942` passed dependency installation, the complete tactical spell validator suite, and `next build`. The validated source head was `3bd71a0a8af2a2f6b7be4ae2bd2eb2b1fecc92c4` before diagnostic-only workflow/document cleanup.

## Isolation

Phase 1S is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

## Remaining production gate

Before Phase 1T begins:

1. remove the diagnostic-only PR workflow/document from the UI branch;
2. verify the final bounded UI diff contains only intended combat UI, validator, package/suite wiring, and this status ledger;
3. integrate the validated UI source linearly to `main` without a force update;
4. production-verify the resulting `main` commit;
5. recheck the protected baseline: 5 characters, 12 reviewed spell assignments, zero tactical fixture/effect rows, 20 locations, 4 routes, and 9 route points.

Phase 1R production main `ee2cde5ffdfd2d87e99948d7dae3fc6bb6146844` was the starting baseline: 5 characters, 11 reviewed spell assignments, zero tactical fixture/effect rows, and the protected world baseline 20 locations / 4 routes / 9 route points.
