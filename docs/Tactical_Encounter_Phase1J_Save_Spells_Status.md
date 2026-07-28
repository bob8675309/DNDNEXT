# Tactical Encounter Phase 1J — Single-Target Save Spells

Status: **SERVER DEPLOYED / VALIDATED**

Phase 1J extends the tactical spell engine without changing the Phase 1I Fire Bolt/Cure Wounds resolver. The first save-based automated spell is deliberately limited to the reviewed XPHB version of **Sacred Flame**.

## Scope

New server contract:

- `public.encounter_cast_spell_v2(caster, assignment, target, slot_level, request_id)`.

`encounter_cast_spell_v2` delegates the Phase 1I adapters back to `encounter_cast_spell_v1` and owns only the new Sacred Flame path. This preserves the already-validated Fire Bolt and Cure Wounds behavior instead of rewriting it.

## Sacred Flame adapter

The adapter follows the reviewed XPHB catalog definition already stored in production:

- Action cast;
- cantrip; no spell slot;
- 60-foot creature target;
- requires line of sight;
- Dexterity saving throw;
- `1d8` Radiant damage at levels 1–4, scaling to `2d8`/`3d8`/`4d8` at character levels 5/11/17;
- no damage on a successful save;
- Half Cover and Three-Quarters Cover give **no save bonus** for Sacred Flame;
- total cover / blocked line of sight still prevents the cast.

The save DC uses the assignment override when present, otherwise `8 + proficiency + casting ability modifier` from the canonical encounter spellcasting profile.

## Save-state guardrails

The current tactical save profile models ability modifier and class save proficiency. Phase 1J therefore fails closed to GM-assisted play when the target has an active `encounter_conditions` row that could alter saving-throw behavior.

The existing Dodge tactical state is explicitly supported: a Dodging target rolls the Sacred Flame Dexterity save with advantage. This is separate from cover; Sacred Flame still receives `+0` cover bonus on the save.

Hidden targets remain protected by the same controller/admin visibility rule used by Phase 1I. Failed validation spends neither the Action nor a spell slot and leaves no completed spell effect.

## Deployment

Production migration:

- `20260728003957 tactical_single_target_save_spell`

Source branch:

- `phase1j-sacred-flame`
- server preview green at commit `8552a460c0b6723ab938084f546f4d77cb1b3fd7` before production migration application.

Both `encounter_cast_spell_v1` and `encounter_cast_spell_v2` remain executable by `authenticated` and `service_role`, and neither is executable by `anon`.

## Transactional validation

Before deployment, the exact migration compiled successfully inside a production rollback transaction.

A second pre-deploy rollback test created a temporary level-1 XPHB Cleric, a real Sacred Flame assignment, a Cure Wounds assignment, encounter/map/participants, a Half Cover object, authoritative slot state, and synthetic authenticated controller claims.

The same behavior test was repeated against the deployed `encounter_cast_spell_v2` function after migration application.

Verified behavior:

- the canonical Cleric profile resolved Wisdom 16, proficiency +2, and spell save DC 13;
- Sacred Flame appeared in the guarded Known-spell profile;
- Half Cover was detected by targeting but Sacred Flame reported `coverSaveBonus=0`;
- the cantrip spent the Action and spent no spell slot;
- duplicate request replay returned the stored result without a second resolution;
- Dodge granted advantage on the Dexterity save;
- hidden-target rejection spent no Action and left no command request;
- `encounter_cast_spell_v2` delegated Cure Wounds to the deployed Phase 1I v1 resolver and Cure Wounds spent exactly one level-1 slot.

The first fixture run also caught the existing `character_sheets -> character_progression` synchronization trigger; the corrected fixture uses that real trigger rather than creating a duplicate progression row.

All test data was rolled back. Post-deploy counts returned to zero for `character_spells`, encounter maps/sessions/participants/commands/logs, and encounter spell-slot rows. The protected baseline remained **2 characters, 20 locations, 4 world routes, and 9 route points**.

## Advisor review

The security advisor reports the same generic `SECURITY DEFINER` warning for `encounter_cast_spell_v2` that it reports for the existing guarded tactical RPCs. This exposure is intentional: the RPC is the authenticated authority boundary and performs controller, active-turn, spellbook, target visibility, LOS/range, save-rule, Action, and idempotency validation internally. The authenticated-controller rollback tests verify those checks rather than relying only on service-role execution.

The performance advisor introduced no Phase 1J-specific table/index issue. Existing tactical foreign-key indexing and RLS init-plan notices remain separate behavior-neutral hardening work.

## Isolation guardrail

Phase 1J is tactical-only. It does not reference or modify world routes, world travel advancement, weather, camps, town-map state, or world simulation functions.

The Phase 1I resolver remains available and unchanged.

## Deferred

Still GM-assisted/manual:

- save spells with target conditions that alter saves;
- spells with half-damage-on-save or other success riders;
- repeated saves;
- concentration;
- AoE, lines, cones, and persistent areas;
- reaction spells;
- summons;
- teleportation and forced movement;
- item/feat/background spell-resource semantics;
- multiclass/multiple spell-slot-pool selection.

The next bounded step is to expose Sacred Flame in the existing combat spell UI without changing weapon targeting or movement behavior.
