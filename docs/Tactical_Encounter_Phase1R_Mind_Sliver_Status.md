# Tactical Encounter Phase 1R — Mind Sliver

Status: **SERVER DEPLOYED / VALIDATED / UI PRODUCTION COMPLETE**

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

## Combat UI

The Phase 1R combat UI is now implemented on `phase1r-mind-sliver-ui`:

- Mind Sliver is the 11th reviewed tactical adapter;
- the UI preflights 60-foot range and presents an Intelligence save against the canonical spell DC;
- level-based `d6` Psychic scaling is shown at character levels 1 / 5 / 11 / 17;
- only Mind Sliver routes through v10 while Chill Touch remains v9 and all earlier adapters retain their prior RPC versions;
- failed-save results show Psychic damage plus the next-saving-throw `−1d4` rider through source-next-turn-end;
- a prior Mind Sliver penalty consumed by Mind Sliver itself is surfaced from `saveProfile.savePenalty`;
- manual saving throws display a consumed Mind Sliver penalty and the pre-penalty base save bonus;
- spell-save log rows display consumed penalties from the shared save profile;
- the combat log gives dedicated visibility to both Mind Sliver rider creation and `effect_consumed` audit events;
- older UI validators were made forward-compatible only where they still treated Mind Sliver as a future spell; their spell-specific routing and rules checks remain active.

Exact UI head `e13a3cff02d58f3016c3b86ac6b38570348c8370` passed the complete tactical validator suite, including the dedicated Mind Sliver UI validator, followed by the Next production build. The UI was subsequently integrated; later tactical phases preserve its v10 routing and one-shot save-modifier behavior in the aggregate suite.

## Isolation

Phase 1R is tactical-only. It does not reference or modify world routes, world travel advancement, weather, camps, town maps, or world simulation.

## Completion note

The former production-gate checklist is complete. The counts above remain the Phase 1R historical checkpoint; use the current development-status document for the live project baseline.
