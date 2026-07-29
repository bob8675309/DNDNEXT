# Tactical Encounter Phase 1R — Mind Sliver

Status: **SERVER DEPLOYED / VALIDATED; COMBAT UI PENDING**

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

Pip Quillspark is the reviewed Wizard character for this adapter. His permanent canonical assignment is `2df1b481-7074-4578-b2e9-2a55fde3cba0` with `source_type=class`, `source_label=Wizard`, `prepared=true`, and `casting_stat=int`.

## Shared save modifier

All current automated saving throws converge on `public.encounter_saving_throw_profile_internal_v1(participant, ability)`: Sacred Flame, Toll the Dead, Inflict Wounds, and the manual save resolver. The function is internal-only; authenticated and anonymous clients cannot execute it directly.

Phase 1R makes that profile the one-shot consumption boundary. If `mind_sliver_save_penalty` is active on the participant, the profile:

- rolls 1d4;
- subtracts that value from the normal save bonus;
- deletes the timed effect immediately so it can affect exactly one real saving throw;
- returns both `baseSaveBonus` and the rolled `savePenalty` with the final `saveBonus`;
- records an `effect_consumed` combat-log event.

Because the profile is called inside the same database transaction as each saving throw, a later exception rolls the consumption back with the rest of the failed command.

## Save-profile compatibility fix

The first Phase 1R migration compiled, but pre-fixture inspection caught an invalid assumption before any tactical test rows were created: it attempted to source all six ability scores and saving-throw proficiencies from `encounter_canonical_combat_snapshot_v1`, whose contract only exposes Strength, Dexterity, proficiency bonus, Armor Class, and Hit Points.

The corrective migration `20260729_01_tactical_mind_sliver_save_profile_fix.sql` preserves the proven pre-1R saving-throw semantics instead:

- ability scores continue to come from `character_sheets.sheet.abilities`;
- class saving-throw proficiencies continue to come from `class_catalog_preferred.saving_throws`;
- proficiency application remains identical to the pre-1R save profile;
- the Mind Sliver `1d4` penalty is layered on only after the canonical base save bonus is calculated;
- the final profile remains mutating/internal-only because consuming the one-shot effect deletes the timed-effect row and writes the audit event.

The Mind Sliver validator checks this compatibility fix explicitly and rejects any final save-profile migration that returns to the limited combat-snapshot source.

## Duration

Mind Sliver reuses Phase 1Q's **source-turn-end** timing. On a failed Intelligence save it applies `mind_sliver_save_penalty` with two source-turn-end triggers remaining:

1. the current caster turn end decrements 2 → 1;
2. the end of the caster's next turn expires the effect if no saving throw has consumed it first.

If a target already has the penalty, that existing effect is consumed by the new Mind Sliver Intelligence save before a replacement effect is applied on failure. This preserves the rule that the next saving throw consumes the rider.

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

## Deployment and validation

The original server tree was blocked only by Vercel build-rate limits. After the quota window reset, retry head `d51bbea369d6fe64098162cd9e07259705928838` passed. The corrected save-profile tree then passed the full tactical validator suite and Next build at `2baea2fb988cc16a165031c9c4aeb55a18a87d9a`.

Production migrations:

- `20260729183810 tactical_mind_sliver`;
- `20260729184616 tactical_mind_sliver_save_profile_fix`.

Post-deploy transactional rollback validation used Pip Quillspark and Raska Stonejaw and verified:

- Raska's pre-1R Fighter save contract remained exact: STR +4, DEX +3, CON +4, INT -1, WIS +0, CHA +1;
- a forced failed Intelligence save dealt level-2 `1d6` Psychic damage and created exactly one two-trigger `mind_sliver_save_penalty` effect;
- the cast spent exactly one Action;
- duplicate cast replay returned the identical stored result without extra damage, effect rows, or spell-cast log rows;
- the next real Wisdom save consumed exactly one `1d4` penalty through the shared save profile while preserving the canonical base save bonus;
- duplicate save replay returned the identical stored result and did not consume or audit the effect twice;
- a forced successful Mind Sliver save dealt 0 damage and created no rider;
- an unused rider decremented 2 → 1 at Pip's current turn end, did not change at Raska's turn end, and expired exactly at the end of Pip's next turn;
- expiry and consumption were both audited in the combat log;
- rollback restored encounter maps, encounters, participants, command requests, combat log, spell slots, reaction windows, and timed effects to zero rows.

Privilege checks confirm v10 is executable by `authenticated` and `service_role`, not `anon`. The save-profile function remains executable by `service_role` only.

After rollback and permanent assignment, the protected live state is 5 characters, 11 reviewed spell assignments, zero tactical fixture/effect rows, 20 locations, 4 world routes, and 9 route points.

## Isolation

Phase 1R is tactical-only. It does not reference or modify world routes, world travel advancement, weather, camps, town maps, or world simulation.

## UI gate remaining

The combat UI still intentionally hides Mind Sliver. Remaining Phase 1R work:

1. hand the validated server ancestry to `main` linearly and production-verify it;
2. branch UI work from that exact green server baseline;
3. add Mind Sliver to the reviewed whitelist and 60-foot save-spell preflight;
4. route only Mind Sliver through v10 while preserving v1-v9 routing;
5. present Intelligence save, `d6` Psychic scaling, and the next-save `1d4` rider;
6. surface consumed save penalties in saving-throw/spell results and the combat log;
7. pass the complete tactical validator suite and Next build on the exact UI head;
8. integrate linearly to `main` and production-verify before Phase 1S begins.
