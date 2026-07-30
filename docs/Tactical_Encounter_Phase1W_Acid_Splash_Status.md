# Tactical Encounter Phase 1W — Acid Splash

Status: **SERVER SOURCE READY / NOT DEPLOYED**

Phase 1W adds the XPHB **Acid Splash** as the first point-targeted tactical area spell. It extends the shared combat engine from caster-centered chosen-target Emanations to a server-derived Sphere at a selected tactical point.

## Reviewed XPHB spell

The live canonical definition is:

- Artificer / Sorcerer / Wizard cantrip;
- Action;
- a point within 60-foot range;
- 5-foot-radius Sphere centered on that point;
- every creature in the Sphere makes an independent Dexterity saving throw;
- failed save: shared `1d6` Acid damage;
- successful save: 0 damage;
- cantrip scaling to `2d6` / `3d6` / `4d6` at character levels 5 / 11 / 17;
- instantaneous and non-concentration.

Pip Quillspark is the intended reviewed XPHB Wizard fixture. No permanent Acid Splash assignment will be added until the server and combat UI both pass their production gates.

## Safe server contract

The new guarded RPC is:

`public.encounter_cast_point_area_spell_v1(caster, assignment, origin_q, origin_r, slot_level, request_id)`

It does not modify or replace `encounter_cast_area_spell_v1`, which remains the caster-centered, caller-chosen target contract for Word of Radiance. It also leaves every single-target spell version through Healing Word v13 unchanged.

The chosen axial hex center is the tactical point of origin. The server:

- verifies the point is inside the encounter map and no more than 60 feet from the caster;
- requires an unblocked line from the caster to the point;
- derives all participants at the origin or within one adjacent hex;
- evaluates Total Cover and lesser cover from the Sphere origin to each creature;
- excludes a creature behind Total Cover because the area cannot extend through that obstruction;
- adds Half or Three-Quarters Cover to the creature's Dexterity save;
- rolls damage once for the simultaneous effect;
- resolves each eligible creature's saving throw and Acid affinity independently;
- spends one Action and writes one idempotent `spell_cast` command/log result.

Hidden participants are still resolved by the authoritative server, but their identities, counts, saves, and damage are omitted from an unauthorized caller's result and combat-log detail. This prevents the point-area adapter from becoming a hidden-creature position oracle.

Until defeated-creature damage and condition-specific Dexterity interactions are modeled, automated Acid Splash fails consistently whenever any defeated or conditioned participant is present in the encounter. This avoids silently omitting a mandatory creature and avoids revealing its location through repeated point probes.

The cast also fails before origin resolution when an unauthorized hidden participant has an active Mind Sliver saving-throw modifier. The shared save helper audits modifier consumption with the target identity, so resolving that hidden modifier would otherwise leak it through the combat log.

## Planned validation sequence

1. pass the complete tactical validator suite and exact Next production build;
2. publish and production-gate the server source;
3. apply the migration;
4. run a transactional rollback matrix covering origin range/LOS, server membership, independent saves, one shared damage roll, cover, Acid affinities, hidden-result masking, idempotency, Action spend, and failure rollback;
5. add isolated combat-board origin selection and Sphere highlighting;
6. production-gate the combat UI;
7. add Pip's permanent reviewed assignment and recheck all tactical/world postconditions.

## Baseline and isolation

Starting protected baseline:

- GitHub `main` at `691785cadd838140ce18d5e603c9fff6e3edd0cc`;
- 5 characters, 5 character sheets, and 5 progression rows;
- 14 reviewed spell assignments and 0 Acid Splash assignments;
- 0 encounter maps, encounters, participants, command requests, combat-log rows, spell-slot rows, reaction windows, timed effects, or encounter Conditions;
- 20 locations, 4 world routes, and 9 world route points.

Phase 1W is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.
