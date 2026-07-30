# Tactical Encounter Phase 1U — Vicious Mockery

Status: **SERVER DEPLOYED / VALIDATED; COMBAT UI VALIDATED / PRODUCTION PENDING**

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

The five persistent tactical fixtures contain no Bard. Phase 1U intentionally adds no artificial sixth character and no off-class permanent assignment. The server was validated with transaction-only Bard progression/assignment data; future eligible Bard characters automatically surface the reviewed adapter through their real spellbooks.

## Shared next-attack modifier

`private.encounter_resolve_attack_roll_v1(attacker, target, base_disadvantage)` remains the single attack-roll authority for weapon attacks, Unarmed Strike, Opportunity Attacks, and reviewed spell attacks.

Phase 1U extends it with `vicious_mockery_next_attack_disadvantage`:

- Guiding Bolt Advantage remains target-scoped and is consumed from the attack target;
- Vicious Mockery Disadvantage is attacker-scoped and is consumed from the creature making the next attack;
- either one-shot effect is consumed by the next qualifying attack even if another source of Advantage/Disadvantage cancels its numerical effect;
- Guiding Bolt Advantage plus Vicious Mockery Disadvantage cancels to one normal d20 roll while both one-shot effects are consumed and audited;
- existing base Disadvantage such as Dodge continues to combine through the same resolver.

## Target-turn-end timed effects

`encounter_timed_effects.expiry_trigger` now supports `target_turn_end` in addition to the established target/source turn-start and source-turn-end boundaries.

`private.encounter_apply_target_turn_end_effect_v1(...)` stores target-owned timed effects that expire at the end of that target's next turn. `public.encounter_end_turn_v1` is the authoritative expiry boundary and writes the existing `effect_expired` audit event when an unused effect ends.

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

The XPHB spell can target a creature the caster can **see or hear**. The tactical engine does not yet model hearing, deafness, or silence, so hearing-only targeting remains GM-assisted rather than guessed. The automated adapter proves the visible-target subset and fails closed when LOS cannot establish that subset.

On a failed Wisdom save, v12 rolls typed Psychic damage through the existing damage authority and applies the one-shot attack Disadvantage effect. On a successful save, it deals 0 damage and applies no rider. Mind Sliver save-penalty consumption remains inherited through the shared internal saving-throw profile.

The command remains request-ID idempotent and consumes no spell slot.

Production migration:

- `20260730045806 tactical_vicious_mockery`.

v12 is executable by `authenticated` and `service_role`, not `anon`. `private.encounter_apply_target_turn_end_effect_v1(...)` is executable by `service_role` only.

## Server validation

The exact server source passed the complete tactical spell validator suite and `next build` in PR #96 diagnostic run `30515060866`. The temporary workflow was removed before handoff, and cleaned server head `02e9288e70094018ad523a2c93d34da004bf8290` was Vercel green before live migration.

Post-deploy validation used one transaction only:

- Dawn Whiteflame's existing progression was temporarily swapped to canonical XPHB Bard 2; rollback restored Artificer EFA automatically;
- a transaction-only Vicious Mockery Bard/CHA assignment used forced save DC 40 for deterministic failure and DC 1 for deterministic success;
- failed Wisdom save produced `1d6` Psychic damage, spent one Action, spent no slot, and created exactly one `target_turn_end` rider;
- duplicate cast returned the stored result without extra log/resource spend;
- Dawn's turn end advanced to Raska while preserving the rider through the start of Raska's turn;
- Raska's Unarmed Strike consumed the attacker-scoped rider and the shared resolver selected the lower of two d20s;
- a synthetic Guiding Bolt target rider plus Vicious Mockery attacker rider canceled to one normal d20 while both one-shot effects were consumed;
- Pip's reviewed Fire Bolt through the legacy v1 -> v11 path consumed Vicious Mockery Disadvantage from the attacker, proving reviewed spell attacks inherit the shared modifier;
- an unused rider expired exactly at Raska's target turn end and produced an `effect_expired` audit row with `expiry=target_turn_end`;
- forced successful Wisdom save dealt 0 damage and applied no rider;
- rollback restored all temporary progression, assignment, map, encounter, participant, command, log, slot, and effect data.

After rollback and privilege checks:

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

PR #96 rebase-merged the validated server slice without force. Production `main` commit `14f7870a1c59490a5a7d6804637dca90d89f0af2` is Vercel green and is the Phase 1U UI branch baseline.

## Combat UI validation

The Phase 1U combat UI adds Vicious Mockery only for eligible Bard spellbooks; it does not add a persistent Bard or off-class assignment. The UI:

- includes `vicious-mockery|xphb` in the reviewed tactical adapter set;
- uses 60-foot single-target selection;
- displays the Wisdom save and level-scaled `d6` Psychic damage;
- routes only Vicious Mockery through `encounter_cast_spell_v12` while preserving Guiding Bolt v11, the established older single-target routes, and Word of Radiance area routing;
- shows successful-save and failed-save outcomes, including inherited Mind Sliver save-penalty display;
- explains that hearing-only targeting remains GM-assisted;
- surfaces the failed-save next-attack Disadvantage rider;
- reports Vicious Mockery consumption through the shared nested `attackRoll` result for weapon/Unarmed feedback;
- renders spell-cast and `effect_consumed` combat-log detail for the rider;
- preserves Guiding Bolt Advantage / Vicious Mockery Disadvantage cancellation messaging.

Historical UI validators were changed only to remove Vicious Mockery from obsolete future-spell forbidden lists or to make phase/list wording forward-compatible; their established spell-specific routing/rule assertions remain active.

Draft PR #97 diagnostic run `30517334163` passed dependency installation, the complete tactical spell validator suite including `validate_tactical_vicious_mockery_ui.mjs`, and `next build` on UI head `e7ea58117af1132b57bb7f0249805c5a633c1691`.

The temporary UI diagnostic workflow is removed before integration. The live protected baseline remains 5 characters / 13 reviewed assignments / 0 Vicious Mockery assignments / tactical zero-state / world 20-4-9.

## Remaining Phase 1U sequence

1. remove the temporary PR-only UI validation workflow;
2. verify the cleaned final branch diff contains only Phase 1U UI/validator/ledger changes;
3. Vercel-gate the cleaned final UI head;
4. rebase-merge PR #97 without force;
5. production-verify the rebased `main` commit;
6. recheck the protected 5 / 13 / 0 Vicious Mockery / tactical-zero / 20-4-9 baseline;
7. mark Phase 1U complete before beginning Phase 1V.

## Isolation

Phase 1U is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1U starts from production-green Phase 1T `main` commit `80ea7ba3f4d08695bf923672e5a4d69475b0de8e`. The production-green Phase 1U server baseline is `14f7870a1c59490a5a7d6804637dca90d89f0af2`.
