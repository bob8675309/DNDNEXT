# Tactical Encounter Phase 1Y — Burning Hands

Status: **SERVER PATCH IN DEVELOPMENT / NOT DEPLOYED**

Phase 1Y adds the XPHB **Burning Hands** as the first directional tactical Cone spell. It extends the reviewed targeting geometry without modifying the existing single-target, caller-chosen Emanation, point-targeted Sphere, or allocated-dart paths.

## Reviewed XPHB spell

The live canonical definition is:

- Sorcerer / Wizard level-1 spell;
- Action;
- Self-originating 15-foot Cone;
- every creature in the Cone makes a Dexterity saving throw;
- failed save: shared `3d6` Fire damage;
- successful save: half the shared Fire damage, rounded down before affinity;
- each slot level above 1 adds `1d6`;
- instantaneous and non-concentration;
- unattended flammable objects in the Cone start burning.

Pip Quillspark is the reviewed XPHB Wizard candidate. Burning Hands remains unassigned until the server and combat-UI production gates pass.

## Reviewed hex Cone contract

The tactical system uses pointy-top axial hexes where one hex equals 5 feet. Phase 1Y defines a deterministic 15-foot Cone as a symmetric **seven-hex** footprint:

- depth 1: 1 forward hex;
- depth 2: 3 hexes;
- depth 3: 3 hexes.

This `1 / 3 / 3` footprint excludes the caster's origin hex. Direction indices `0–5` follow the existing encounter-local axial direction order: east, northeast, northwest, west, southwest, southeast. The private server helper owns authoritative membership; the future UI helper is only a preview of the same reviewed offsets.

## Safe server contract

The new guarded RPC is:

`public.encounter_cast_directional_area_spell_v1(caster, assignment, direction, slot_level, request_id)`

The server:

- accepts only the reviewed `burning-hands|XPHB` level-1 class assignment;
- validates canonical class, spell list, casting ability, preparation, active turn, controller, Action, conditions, spell slot, and the one-slotted-spell-per-turn authority;
- accepts only direction indices `0–5`;
- derives and locks every creature in the seven-hex Cone before any resource or HP mutation;
- excludes creatures behind Total Cover and adds Half or Three-Quarters Cover to Dexterity saves;
- rolls one shared `3d6 + 1d6/slot` Fire result;
- applies full damage on a failed save and half damage on a successful save before Fire affinity;
- masks hidden target identities, counts, saves, and damage from unauthorized callers;
- spends one Action and one spell slot and writes one idempotent command/log result.

Until defeated-creature and condition-specific Dexterity interactions are modeled, the adapter fails consistently whenever a defeated or conditioned participant is present. It also fails for non-GM callers while an unauthorized hidden participant has an active Mind Sliver save modifier, preventing effect-consumption logs from becoming a hidden-target oracle.

## Deliberate deferrals

Tactical map objects do not yet have a reviewed flammability or burning-state contract. Phase 1Y therefore leaves unattended-object ignition GM-assisted and does not mutate map objects.

The spell is instantaneous and non-concentration. Phase 1Y does not introduce reaction spellcasting, forced movement, persistent zones, or concentration state.

## Validation and deployment gates

1. compile the new SQL against the live schema inside a transaction that ends in `ROLLBACK`;
2. pass the complete tactical validator suite and production-equivalent Next build;
3. publish and production-gate the server source;
4. apply the reviewed migration and run a transactional live rollback matrix;
5. add isolated direction controls and tactical Cone preview;
6. production-gate the combat UI;
7. add Pip's permanent reviewed assignment and recheck tactical and protected world postconditions.

No permanent spell assignment or live tactical fixture is part of the server patch.

## Pre-deploy validation

The exact migration compiled against the live production schema inside a transaction that ended in `ROLLBACK`. All six rotations returned seven distinct cells, excluded the caster origin, and retained depths 1 through 3.

A second rollback-only production transaction used Pip, Raska, Aurelia, Letho, and Dawn Whiteflame with a temporary Burning Hands assignment and tactical encounter. It verified:

- server-derived in-Cone membership and an untouched out-of-Cone participant;
- hidden target resolution without exposing its identity, count, save, or damage;
- one shared damage roll, full damage on failure, and half damage on success;
- level-1 `3d6` and level-2 `4d6` scaling;
- Fire resistance after save damage is determined;
- Half Cover Dexterity bonus and Total Cover exclusion;
- exact Action and selected-slot spending;
- duplicate request idempotency and one command/log result;
- the one-slotted-spell-per-turn guard, no-slot guard, direction validation, controller authorization, and failed-request cleanup;
- no automated map-object ignition.

The first fixture assertion also confirmed that the established participant snapshot trigger replaces inserted HP with each character's canonical HP. The corrected matrix records those post-trigger baselines before casting. Every fixture and the proposed functions rolled back.

## Starting baseline and isolation

- GitHub `main` at `3534ffaaf8aa7dc09057130a147bfefcd49216d4`;
- 5 characters, 5 character sheets, and 5 progression rows;
- 16 reviewed spell assignments and 0 Burning Hands assignments;
- 0 encounter maps, encounters, participants, command requests, combat-log rows, spell-slot rows, reaction windows, timed effects, or encounter Conditions;
- 20 locations, 4 world routes, and 9 world route points.

Phase 1Y is tactical-only. It does not modify world travel, routes, weather, camps, world maps, town/city maps, merchants, crafters, or world simulation.
