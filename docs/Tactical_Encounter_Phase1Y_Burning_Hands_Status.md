# Tactical Encounter Phase 1Y — Burning Hands

Status: **SERVER DEPLOYED / VALIDATED; UI PRODUCTION DEPLOYED / VALIDATED; ASSIGNMENT COMPLETE**

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

Pip Quillspark is the reviewed XPHB Wizard. After both production gates passed, Burning Hands was assigned to his canonical spellbook with the reviewed class-source metadata.

## Reviewed hex Cone contract

The tactical system uses pointy-top axial hexes where one hex equals 5 feet. Phase 1Y defines a deterministic 15-foot Cone as a symmetric **seven-hex** footprint:

- depth 1: 1 forward hex;
- depth 2: 3 hexes;
- depth 3: 3 hexes.

This `1 / 3 / 3` footprint excludes the caster's origin hex. Direction indices `0–5` follow the existing encounter-local axial direction order: east, northeast, northwest, west, southwest, southeast. The private server helper owns authoritative membership; the UI helper is only a preview of the same reviewed offsets.

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

## Server deployment

PR #107 merged the exact reviewed server head `529d64e703f66886de4d86955eb786aa828a11dd` into GitHub `main` at `4884d23ec4998e997b26fd60a8a44be57930754a`. The exact PR head and merged production commit both passed Vercel. NPC Forge and profession-crafting Actions passed on the exact head; the unrelated established canonical-enchanting fixture step remained outside this phase.

Supabase migration `20260730183119 tactical_burning_hands` is live. The merged SQL blob `49ff30e0941e866b4c7082f57867fca5f470467e` exactly matched the validated migration source. The deployed RPC remains executable by `authenticated`, denied to `anon`, and its geometry helper remains private.

The deployed function passed the full rollback matrix after the established encounter participant HP snapshot and max-HP guards were represented correctly in the fixture. All temporary assignments, maps, encounters, participants, objects, slots, commands, logs, and HP changes rolled back.

The Supabase security advisor reports the generic warning that authenticated users can execute this `SECURITY DEFINER` function. That exposure is intentional: the RPC is the guarded authority boundary and validates controller, active turn, canonical spellbook/class, preparation, direction, Cone membership, LOS/Cover, saves, Action, slot, one-slotted-spell-per-turn, hidden masking, and idempotency internally.

## Combat UI source

The isolated combat page now recognizes Burning Hands through its separate directional-area path:

- six labeled direction controls use the existing encounter-local axial order;
- `makeHexCone15` previews the same reviewed seven-hex footprint as the private server helper;
- `EncounterTurnBoard` accepts an optional explicit selected-area hex list while preserving the existing Acid Splash origin/radius props;
- visible participant names are preview-only and an empty visible Cone remains castable because the server owns authoritative membership;
- success messages and combat-log details render shared Fire damage, saves, Cover, affinities, and half damage;
- object ignition remains explicitly GM-assisted;
- movement selection, point-area clicks, caller-chosen Emanations, allocated darts, and single-target spell routing remain unchanged.

No world-map or town/city-map component is imported or modified.

The combat UI source passed the complete 37-validator tactical spell suite, the executable six-direction helper matrix, `git diff --check`, and the repository's production-equivalent Vercel build runner.

PR #108 production-gated the exact reviewed UI head `b2404a96018defda7c1f8582b2920648a536842d` and squash-merged it into GitHub `main` at `abfe34f02886114ac1f208a925b33c35f0422def`. Vercel passed for both the exact PR head and merged production commit. NPC Forge and profession-crafting Actions passed on the exact head; the unrelated established enchanting workflow failed only at `Verify canonical Weapon of enchantments`.

After the merged production deployment passed, Burning Hands was assigned once to Pip:

- assignment `939a0bd4-4c38-4cea-bc06-80bacc12e3fe`;
- `source_type = class`, `source_label = Wizard`;
- prepared and not always available;
- Intelligence casting stat;
- notes `Reviewed XPHB Phase 1Y tactical adapter.`;
- empty canonical raw payload.

## Deliberate deferrals

Tactical map objects do not yet have a reviewed flammability or burning-state contract. Phase 1Y therefore leaves unattended-object ignition GM-assisted and does not mutate map objects.

The spell is instantaneous and non-concentration. Phase 1Y does not introduce reaction spellcasting, forced movement, persistent zones, or concentration state.

## Validation and deployment gates

1. compile the new SQL against the live schema inside a transaction that ends in `ROLLBACK` — **passed**;
2. pass the complete tactical validator suite and production-equivalent Next build — **passed**;
3. publish and production-gate the server source — **passed**;
4. apply the reviewed migration and run a transactional live rollback matrix — **passed**;
5. add isolated direction controls and tactical Cone preview — **passed**;
6. production-gate the combat UI — **passed**;
7. add Pip's permanent reviewed assignment and recheck tactical and protected world postconditions — **passed**.

No permanent spell assignment or live tactical fixture was part of the server patch. The assignment was added only after the UI merge passed its production deployment.

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
- zero tactical fixture rows after every pre-deploy and post-deploy rollback matrix;
- 20 locations, 4 world routes, and 9 world route points.

Phase 1Y is tactical-only. It does not modify world travel, routes, weather, camps, world maps, town/city maps, merchants, crafters, or world simulation.

## Final protected baseline

- GitHub `main` at `abfe34f02886114ac1f208a925b33c35f0422def`;
- 5 characters, 5 character sheets, and 5 progression rows;
- 17 reviewed spell assignments, exactly 1 Burning Hands assignment, and exact assignment metadata for Pip;
- 0 encounter maps, encounters, participants, hex overrides, map objects, command requests, combat-log rows, spell-slot rows, reaction windows, timed effects, or encounter Conditions;
- 20 locations, 4 world routes, and 9 world route points;
- `encounter_cast_directional_area_spell_v1` remains executable by `authenticated` and denied to `anon`;
- `private.encounter_cone_15ft_hexes_v1` remains denied to `authenticated`;
- migration `20260730183119 tactical_burning_hands` remains present.
