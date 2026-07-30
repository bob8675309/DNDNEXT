# Tactical Encounter Phase 1X — Magic Missile

Status: **SERVER PATCH LOCALLY VALIDATED / AWAITING PRODUCTION GATE**

Phase 1X adds the XPHB **Magic Missile** as the first allocated multi-target tactical spell. The slice is deliberately independent of the existing single-target v13, caller-chosen Emanation, and point-targeted Sphere spell paths.

## Reviewed XPHB spell

The live canonical definition is:

- Sorcerer / Wizard level-1 spell;
- Action;
- one or more creatures the caster can see within 120 feet;
- three darts at slot level 1, plus one dart for every higher slot level;
- each dart independently deals `1d4 + 1` Force damage;
- every dart strikes simultaneously;
- instantaneous and non-concentration.

The server therefore derives the dart budget as **slot level + 2** and requires the caller to allocate every dart across a unique list of targets. Pip Quillspark is the reviewed XPHB Wizard candidate, but Magic Missile remains unassigned until server and combat-UI production gates pass.

## Safe server contract

The new guarded RPC is:

`public.encounter_cast_allocated_spell_v1(caster, assignment, allocations, slot_level, request_id)`

`allocations` is a JSON array of `{ "targetId": "<uuid>", "darts": <positive integer> }` entries. The server:

- accepts only the reviewed `magic-missile|XPHB` level-1 class assignment;
- checks the canonical class, spell list, casting ability, preparation, active turn, controller, Action, conditions, spell slot, and one-slotted-spell-per-turn authority;
- rejects duplicate targets and requires the allocation total to equal the exact slot-derived dart budget;
- locks all selected targets in deterministic UUID order;
- verifies every target is available to the controller, undefeated, within 120 feet, and not behind Total Cover;
- completes every target validation before rolling damage or mutating HP, slots, action economy, logs, or command results;
- rolls each dart independently and applies Force resistance, immunity, or vulnerability per dart;
- spends one Action and one spell slot and writes one idempotent `spell_cast` command/log result.

The caller selects only creatures it can already see. Unlike server-derived point-area membership, no hidden participant is discovered or resolved by this adapter.

## Deliberate deferrals

The Shield reaction is not yet an automated spell path, so Phase 1X does not invent a reaction window or silently model Shield immunity. A GM must resolve Shield before using the automated cast whenever that reaction is relevant.

Concentration is also not yet an automated tactical subsystem. Magic Missile itself is non-concentration, and no reviewed automated concentration spell can currently be active. When concentration is introduced, each dart must integrate with the eventual per-damage-instance concentration-save authority before that combined state is enabled.

## Validation and deployment gates

1. complete tactical validator suite and exact Next production build for the server source;
2. publish and production-gate the server source;
3. apply the reviewed SQL migration;
4. run a transactional live rollback matrix covering allocation, range/LOS, affinities, slots, action economy, idempotency, and failure rollback;
5. add isolated combat-page dart-allocation controls;
6. production-gate the combat UI;
7. add Pip's permanent reviewed assignment and recheck tactical and protected world postconditions.

No permanent spell assignment or live tactical fixture is part of the server patch.

Pre-deploy validation passed the complete 34-validator tactical spell suite, the repository's Vercel build runner, and a live-schema transaction that ended in `ROLLBACK`. That transaction exercised exact allocation totals, range rejection, independent Force affinity handling, one Action, one slot, idempotency, and the one-slotted-spell-per-turn guard. The rollback restored the exact starting database counts.

## Starting baseline and isolation

- GitHub `main` at `1100db0438680a30cdbbd900f9bc688db8473f86`;
- 5 characters, 5 character sheets, and 5 progression rows;
- 15 reviewed spell assignments and 0 Magic Missile assignments;
- zero encounter, participant, command, combat-log, spell-slot, reaction-window, timed-effect, or encounter-Condition fixture rows;
- 20 locations, 4 world routes, and 9 world route points.

Phase 1X is tactical-only. It does not modify world travel, routes, weather, camps, world maps, town/city maps, merchants, crafters, or world simulation.
