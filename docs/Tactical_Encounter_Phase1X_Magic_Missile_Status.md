# Tactical Encounter Phase 1X — Magic Missile

Status: **SERVER DEPLOYED / VALIDATED; UI PRODUCTION DEPLOYED / VALIDATED; ASSIGNMENT COMPLETE**

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

The server therefore derives the dart budget as **slot level + 2** and requires the caller to allocate every dart across a unique list of targets. Pip Quillspark is the reviewed XPHB Wizard candidate. After both production gates passed, assignment `13cf4598-cfb1-4389-bea2-caaf35368bdc` added Magic Missile as a prepared class/Wizard/Intelligence spell.

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

## Server deployment and validation

PR #104 merged the exact reviewed server head `8c0d007c0189f3c6e0310782ad390e80e843b275` into GitHub `main` at `2f0c6078036b77f8754af258058f7c7f5a2f6111`. The exact PR head and merged production commit both passed Vercel. NPC Forge and profession-crafting Actions passed; the unrelated established enchanting fixture mismatch remained outside this phase.

Supabase migration `20260730155810 tactical_magic_missile` is live. Its SQL blob exactly matched the merged commit. The post-deploy transactional rollback matrix passed:

- exact and duplicate allocation validation;
- authenticated non-admin hidden-target rejection;
- 120-foot range and Total Cover rejection before any mutation;
- no partial damage when a later selected target fails validation;
- independent Force immunity, resistance, and vulnerability handling per dart;
- exactly one Action, one slot, one command, and one combat-log event;
- idempotent replay and the one-slotted-spell-per-turn guard.

The transaction rolled back every fixture. Post-validation state remained 5 characters, 5 character sheets, 5 progression rows, 15 reviewed spell assignments, 0 Magic Missile assignments, zero tactical fixture rows, and the protected 20-location / 4-route / 9-route-point baseline.

## Combat UI source

The isolated combat page now has source-level Magic Missile support:

- the selected slot derives the exact dart budget;
- visible, undefeated creatures within 120 feet receive explicit plus/minus allocation controls;
- the cast stays disabled until every dart is allocated;
- only positive, unique target allocations are sent to `encounter_cast_allocated_spell_v1`;
- success messages and combat-log details render server-returned per-target dart totals and Force affinities;
- no tactical-board movement or area-selection behavior is changed.

The UI source passed the complete 35-validator tactical spell suite, `git diff --check`, and the repository's production-equivalent Vercel build runner.

## Combat UI deployment

PR #105 merged the exact reviewed UI head `9d16dc195f0670e71baf549673921f81b99ec39e` into GitHub `main` at `2e0f9f8779eb53691995421b83ee2276356c1e3c`. The exact PR head and merged production commit both passed Vercel. NPC Forge and profession-crafting Actions passed on the exact head; the unrelated established enchanting fixture mismatch remained outside this phase.

After the merged production deployment passed, Magic Missile was assigned once to Pip with the reviewed metadata:

- assignment `13cf4598-cfb1-4389-bea2-caaf35368bdc`;
- `source_type = class`, `source_label = Wizard`;
- prepared, not always available;
- Intelligence casting stat;
- canonical `magic-missile|XPHB` level-1 spell.

## Validation and deployment gates

1. complete tactical validator suite and exact Next production build for the server source — **passed**;
2. publish and production-gate the server source — **passed**;
3. apply the reviewed SQL migration — **passed**;
4. run a transactional live rollback matrix covering allocation, range/LOS, affinities, slots, action economy, idempotency, and failure rollback — **passed**;
5. add isolated combat-page dart-allocation controls and pass the complete local validator/build gate — **passed**;
6. production-gate the combat UI — **passed**;
7. add Pip's permanent reviewed assignment and recheck tactical and protected world postconditions — **passed**.

No permanent spell assignment or live tactical fixture is part of the server patch.

Pre-deploy validation passed the complete 34-validator tactical spell suite, the repository's Vercel build runner, and a live-schema transaction that ended in `ROLLBACK`. That transaction exercised exact allocation totals, range rejection, independent Force affinity handling, one Action, one slot, idempotency, and the one-slotted-spell-per-turn guard. The rollback restored the exact starting database counts.

## Starting baseline and isolation

- GitHub `main` at `1100db0438680a30cdbbd900f9bc688db8473f86`;
- 5 characters, 5 character sheets, and 5 progression rows;
- 15 reviewed spell assignments and 0 Magic Missile assignments;
- zero encounter, participant, command, combat-log, spell-slot, reaction-window, timed-effect, or encounter-Condition fixture rows;
- 20 locations, 4 world routes, and 9 world route points.

Phase 1X is tactical-only. It does not modify world travel, routes, weather, camps, world maps, town/city maps, merchants, crafters, or world simulation.

## Final protected baseline

- 5 characters, 5 character sheets, and 5 progression rows;
- 16 reviewed spell assignments, exactly 1 Magic Missile assignment, and exact assignment metadata for Pip;
- 0 encounter maps, encounters, participants, command requests, combat-log rows, spell-slot rows, reaction windows, timed effects, or encounter Conditions;
- 20 locations, 4 world routes, and 9 world route points;
- `encounter_cast_allocated_spell_v1` remains executable by `authenticated` and denied to `anon`;
- the reviewed migration `20260730155810 tactical_magic_missile` remains present.
