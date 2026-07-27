# Tactical Encounter Phase 1I — Spell Foundation Status

Status: **DEPLOYED / VALIDATED**

This ledger covers the first bounded tactical spellcasting foundation after Phase 1H reactions/effects. It intentionally stops before a player-facing casting command.

## Scope

Phase 1I establishes two authoritative contracts only:

- a canonical caster profile derived from the participant's existing character progression, class progression, character sheet, and Known spell assignments;
- an encounter-local spell-slot snapshot initialized when a participant is staged into an encounter.

No casting RPC, spell attack resolver, save-spell resolver, AoE geometry, concentration engine, or spell UI is introduced by this patch.

## Canonical caster profile

`public.encounter_spellcasting_profile_v1(participant_id)` resolves the participant through existing tactical authorization and returns:

- exact assigned class ID/source/ruleset and character level;
- canonical casting ability and ability score;
- proficiency bonus from `class_level_progression`;
- default spell attack bonus and spell save DC;
- canonical class slot progression for the current level;
- encounter-local remaining slot state;
- the character's actual `character_spells` assignments, including prepared/always-available flags and per-assignment overrides.

The profile follows the class version already stored in `character_progression`; it does not silently swap a character to another source version during combat.

## Encounter-local spell-slot snapshot

`public.encounter_spell_slots` stores one row per participant, slot pool, and slot level. The snapshot is created from the exact `class_catalog` + `class_level_progression` row assigned to that character.

Important behavior:

- normal spellcasting uses the canonical slot array from `class_level_progression`;
- Pact Magic uses a separate `pact_magic` pool key;
- initialization inserts missing rows only and does not refill an existing partially spent snapshot;
- authenticated clients can read only slot rows for participants they can control;
- authenticated clients cannot directly insert, update, or delete slot rows;
- the canonical character spellbook and class progression tables are not mutated.

## Isolation guardrail

This migration is tactical-only. It contains no references to world-map routes, world travel advancement, town-map state, weather, camp logic, or world simulation functions.

The world-map and town/city-map systems remain behaviorally unchanged.

## Deployment and validation

Production migration:

- `20260727225258 tactical_spell_foundation`

Source/preview checkpoint:

- branch `phase1i-spell-foundation`;
- Vercel preview green at commit `852adcca167477d26e84aa54c5d3802eaaa3a69b` before production migration application.

The migration was exercised in rolled-back production transactions before deployment and then the same behavioral test was repeated against the deployed functions.

Observed contracts:

- current Artificer level 2 resolved from its assigned class source and received exactly two level-1 slots;
- INT 15 resolved to a +2 casting modifier;
- proficiency +2 produced spell attack +4 and spell save DC 12;
- current Fighter produced no spell-slot rows and reported `isClassCaster=false`;
- changing the Artificer snapshot to 1/2 remaining and rerunning the initializer left it at 1/2;
- the full DDL/function/postcondition migration completed successfully;
- the post-deploy behavior test completed inside a rollback transaction and left no test encounters, participants, or slot rows;
- the protected production baseline remained 2 characters, 20 locations, 4 world routes, and 9 route points.

Post-deploy privilege checks confirm authenticated users have SELECT-only table access through participant-control RLS. The public profile RPC is intentionally callable by authenticated users but performs `encounter_can_control_participant_v1` authorization internally before returning the profile.

The post-DDL performance advisor reported the new `encounter_spell_slots_source_class_idx` as unused while the table contains zero production rows; it did not report a missing foreign-key index for the new table. Existing tactical and application advisor notices remain separate hardening work.

## Explicitly deferred

No casting RPC is part of this patch.

The next slice should add a narrow `encounter_cast_spell_v1` contract only after this profile/snapshot foundation is deployed and verified. The first executable spell set should remain explicit and conservative: single-target spells with validated structured behavior, with unsupported spells left GM-assisted/manual.

AoE, concentration, repeated saves, reaction spells, summoned creatures, teleportation, forced movement, and persistent spell-created terrain remain later work.
