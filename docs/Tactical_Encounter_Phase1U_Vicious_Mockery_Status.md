# Tactical Encounter Phase 1U — Vicious Mockery

Status: **SERVER DEPLOYED / VALIDATED; COMBAT UI DEPLOYED / VALIDATED; PHASE COMPLETE**

Phase 1U adds the XPHB **Vicious Mockery**, a reusable one-shot next-attack **Disadvantage** modifier, and the `target_turn_end` timed-effect boundary.

## Reviewed XPHB spell

The live canonical definition is a Bard cantrip with an Action casting time, 60-foot range, Wisdom saving throw, `1d6` Psychic damage on a failed save scaling to `2d6 / 3d6 / 4d6` at character levels `5 / 11 / 17`, and Disadvantage on the target's next attack roll before the end of its next turn after a failed save.

The five persistent tactical fixtures contain no Bard. Phase 1U intentionally added no artificial sixth character and no off-class assignment. Eligible future Bard spellbooks automatically expose the reviewed adapter.

## Server authority

`public.encounter_cast_spell_v12(...)` delegates every non-Vicious-Mockery spell to v11 and owns only `vicious-mockery|XPHB`.

The adapter requires the reviewed XPHB version, class/Bard source, canonical Bard profile, Charisma casting ability, active-turn authority, available Action, a target within 60 feet, and the established tactical fail-closed guards. It resolves a Wisdom save through the shared saving-throw profile, applies typed Psychic damage on failure, and applies `vicious_mockery_next_attack_disadvantage`.

The XPHB target can be a creature the caster can see or hear. The tactical engine does not yet model hearing, deafness, or silence, so the automated adapter supports the visible-target subset and leaves hearing-only targeting GM-assisted.

`private.encounter_resolve_attack_roll_v1(...)` consumes Vicious Mockery Disadvantage from the attacker on its next qualifying attack. Guiding Bolt Advantage remains target-scoped. If both apply, Advantage and Disadvantage cancel to one normal d20 while both one-shot effects are consumed and audited.

`encounter_timed_effects.expiry_trigger` supports `target_turn_end`, and `public.encounter_end_turn_v1` expires an unused Vicious Mockery rider at the end of that target's next turn.

Production migration:

- `20260730045806 tactical_vicious_mockery`.

v12 is executable by `authenticated` and `service_role`, not `anon`. The target-turn-end helper remains service-only.

## Validation

Server validation used transaction-only Bard progression/assignment data on Dawn Whiteflame; rollback restored her Artificer EFA state. The fixture proved failed/successful Wisdom saves, Psychic damage, Action/no-slot economy, request idempotency, Unarmed consumption, Guiding Bolt cancellation, reviewed Fire Bolt consumption through v1 -> v11, target-turn-end expiry/audit, and full rollback.

PR #96 diagnostic run `30515060866` passed the complete tactical validator suite and `next build`. Clean server head `02e9288e70094018ad523a2c93d34da004bf8290` was Vercel green, and the rebased production server baseline `14f7870a1c59490a5a7d6804637dca90d89f0af2` was also Vercel green.

The combat UI adds Vicious Mockery only for eligible Bard spellbooks, routes it through `encounter_cast_spell_v12`, displays Wisdom/Psychic/rider results, surfaces shared `attackRoll` consumption, and renders spell/effect combat-log details while preserving Guiding Bolt v11, established older single-target routes, and Word of Radiance area routing.

PR #97 diagnostic run `30517334163` passed dependency installation, the complete tactical spell validator suite including the Vicious Mockery UI validator, and `next build`. The cleaned UI head `22b7f27df8d41b4fb5ab1258aae09e4661f99e17` was Vercel green. PR #97 rebase-merged without force, producing production `main` commit `6a63f29be27d0a9435ba6f9ccfa726e9ee6462fc`, which was Vercel green.

## Final protected baseline

- 5 characters;
- 13 reviewed spell assignments;
- 0 Vicious Mockery assignments;
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

Phase 1U is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1U started from production-green Phase 1T `80ea7ba3f4d08695bf923672e5a4d69475b0de8e` and completed at production-green `6a63f29be27d0a9435ba6f9ccfa726e9ee6462fc`.
