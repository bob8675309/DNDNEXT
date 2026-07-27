# Tactical Encounter Phase 1E — Core Combat Status

Last updated: 2026-07-27

This document extends the living `Tactical_Encounter_Combat_Roadmap_Blueprint.md` and Phase 1 foundation ledger. Phase 1E builds directly on the server-authoritative movement/turn system from Phase 1D.

## Status

**Implemented on feature branch, schema deployed, rollback-tested, permission-checked, Realtime-enabled, and preview green.**

## Core action economy

The active participant now has server-authoritative Action state for the first generic combat actions:

- **Dash** spends the Action and adds the participant's canonical Speed to the current turn's movement allowance.
- **Disengage** spends the Action and marks the participant disengaged for the remainder of the turn. Opportunity-attack hooks are intentionally deferred.
- **Dodge** spends the Action and marks the participant Dodging until the start of that participant's next turn.
- Action, Bonus Action, and Reaction availability remain encounter-local and are reset by the existing authoritative turn-advance RPC.
- Phase 1E does not yet expose generic Bonus Action or Reaction spending because no supported action currently consumes them.

## First attack-resolution path

`encounter_unarmed_strike_v1` is the first complete server-resolved attack path.

- only the active participant may attack;
- controller / character edit permission is required;
- the target must be another non-defeated participant in the same encounter;
- target range is 5 feet / one adjacent hex;
- attack bonus is derived from canonical Strength modifier + canonical proficiency bonus;
- target AC snapshots from canonical sheet AC when available, otherwise uses the 5e unarmored baseline `10 + Dexterity modifier`;
- target HP snapshots from canonical character-sheet HP when staged;
- natural 1 misses and natural 20 hits;
- a Dodging target causes the attack to roll two d20s and use the lower result;
- the MVP Unarmed Strike deals `1 + Strength modifier` damage, minimum 0;
- temporary HP is consumed before current HP;
- reaching 0 encounter HP marks the participant defeated;
- only the attacker's Action is spent by the attack;
- all HP/damage state remains encounter-local in this phase and does not write the canonical character sheet yet.

Weapon attacks are deliberately deferred until equipped-weapon damage, attack ability, proficiency, reach/range, and magical modifiers can be sourced from canonical inventory/equipment rather than client input.

## Combat log

`encounter_combat_log` records accepted combat actions and outcomes with round/turn metadata, actor, target, event type, summary, detail JSON, and timestamp.

- clients have SELECT only;
- direct authenticated writes are denied;
- log writes happen inside protected action RPCs;
- hidden participants remain hidden from log readers unless the reader is their controller or an admin;
- the table is included in Supabase Realtime with full replica identity.

## UI

`/encounters/combat` provides:

- encounter selection;
- active participant HP, AC, remaining movement, Action / Bonus Action / Reaction indicators;
- Dash, Disengage, and Dodge controls;
- target selection and current hex range;
- authoritative Unarmed Strike submission;
- participant board visualization;
- recent Realtime combat log;
- links back to Turn Movement, GM Staging, and Map Workshop.

Movement remains on `/encounters/play`; Phase 1E does not duplicate or bypass the Phase 1D movement authority.

## Security and authority

- `encounter_use_core_action_v1` and `encounter_unarmed_strike_v1` require authenticated execution and validate the current active participant and controller server-side.
- anon cannot invoke attack RPCs.
- the internal canonical combat snapshot helper cannot be executed directly by authenticated clients.
- request UUIDs use the existing private command ledger, so retries do not double-spend Actions, duplicate damage, or duplicate combat-log entries.

## Validation completed

The rollback combat matrix verified:

- Dash expanded a 30-foot canonical Speed participant to a 60-foot movement allowance;
- difficult terrain still charged 10 feet per affected 5-foot hex;
- Dash idempotent retries did not add Speed twice;
- Dodge was recognized by the attack RPC and used the lower of the two d20 rolls;
- the defender's Action was not spent when attacked;
- Unarmed Strike produced exactly one combat-log entry;
- repeating the same attack request UUID returned the same result without applying damage or logging a second time;
- Disengage set its encounter-local flag;
- all temporary map/session/participant/command/log rows rolled back to zero;
- world state remained 2 characters / 20 locations / 4 routes / 9 route points.

Permission postcheck verified:

- authenticated can read combat logs but cannot insert them;
- authenticated can invoke guarded core-action and attack RPCs;
- anon cannot invoke attacks;
- authenticated cannot invoke the internal combat snapshot helper;
- combat logs are Realtime-published.

## Explicit non-goals still in force

Phase 1E does **not** yet implement:

- equipped weapon attack profiles;
- ranged attacks, ammunition, reach weapons, cover, or line of sight;
- opportunity attacks and reaction timing;
- Help, Ready, Hide, Search, Use an Object, Grapple, Shove, or class-specific actions;
- generic Bonus Action / Reaction spending actions;
- spell targeting, spell slots, saving throws, concentration, AoE templates, or spell damage;
- conditions beyond the narrow Dodge/Disengage flags;
- canonical HP writeback at encounter resolution;
- death saves, unconscious-state rules, healing, resistances, immunities, vulnerabilities, or damage types;
- multi-hex creatures, flying/elevation movement, mounts, forced movement, or grappling movement;
- world-map movement changes.

## Next implementation slice

The next slice should expand combat **without weakening the generic server contract**:

1. canonical equipped-weapon attack profiles and weapon selection;
2. melee reach and ranged-distance validation;
3. attack damage dice and damage types;
4. cover / line-of-sight foundation;
5. basic saving-throw resolution;
6. reaction/opportunity-attack hooks;
7. only then begin spell targeting and spell-resource spending.
