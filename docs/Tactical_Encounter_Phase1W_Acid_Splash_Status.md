# Tactical Encounter Phase 1W — Acid Splash

Status: **SERVER DEPLOYED / VALIDATED; UI PRODUCTION DEPLOYED / VALIDATED; ASSIGNMENT COMPLETE**

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

Pip Quillspark is the reviewed XPHB Wizard fixture. After the server and combat UI production gates passed, assignment `7c09a0ac-566c-4527-943f-d1a2bbec2180` added Acid Splash as a prepared class/Wizard/Intelligence cantrip.

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

## Server deployment and validation

PR #101 merged the exact reviewed server source into GitHub `main` at `c09c3d3b57e6b14bc8fc5312ef6bf8b4c861afd2`. The exact PR head passed Vercel, and the merged production deployment passed Vercel before database deployment.

Supabase migration `20260730151224 tactical_acid_splash` is live. Its source blob matches the merged SQL. A transactional live rollback matrix passed:

- server-derived membership for all creatures within one hex of the origin;
- one shared damage roll with independent Dexterity saves;
- Half Cover `+2`, Total Cover exclusion, Acid immunity/resistance/vulnerability;
- exact idempotent command/log behavior and Action spend;
- no partial state after out-of-range or blocked-origin rejection;
- encounter-wide defeated/Condition and hidden Mind Sliver fail-closed guards;
- hidden targets resolved authoritatively while their result rows and visible counts remained masked.

The transaction rolled back all test fixtures. Post-validation state remained 5 characters, 5 character sheets, 5 progression rows, 14 reviewed spell assignments, 0 Acid Splash assignments, zero tactical fixture rows, and the protected 20-location / 4-route / 9-route-point baseline.

## Combat UI deployment

PR #102 merged the exact reviewed UI head `52356b4841df9267a2eaf9ea08b4a25b68453957` into GitHub `main` at `2fc4daded20373535aa43b017832fe8b93e61806`. The exact PR head and the merged production commit both passed Vercel. NPC Forge and profession-crafting Actions passed; the unrelated established enchanting fixture mismatch remained outside this phase's scope.

The isolated combat page now:

- accepts a point only while Acid Splash is selected and the active participant is controllable;
- highlights the selected origin plus its one-hex tactical Sphere on `EncounterTurnBoard`;
- displays origin range and a clearly labeled visible-only membership preview;
- allows an empty visible preview because the spell targets a point, not a selected creature;
- sends only the origin coordinates to `encounter_cast_point_area_spell_v1`;
- displays only the server-returned visible counts and target results, including save cover;
- keeps Word of Radiance on its separate caller-chosen `encounter_cast_area_spell_v1` path.

No movement behavior was added to the combat board. The overlay and click contract are tactical-spell presentation only.

## Validation sequence

1. complete tactical validator suite and exact Next production build for the server source — **passed**;
2. publish and production-gate the server source — **passed**;
3. apply the migration — **passed**;
4. run the transactional live rollback matrix — **passed**;
5. add isolated combat-board origin selection and Sphere highlighting — **passed**;
6. production-gate the combat UI — **passed**;
7. add Pip's permanent reviewed assignment and recheck all tactical/world postconditions — **passed**.

## Baseline and isolation

Starting protected baseline:

- GitHub `main` at `691785cadd838140ce18d5e603c9fff6e3edd0cc`;
- 5 characters, 5 character sheets, and 5 progression rows;
- 14 reviewed spell assignments and 0 Acid Splash assignments;
- 0 encounter maps, encounters, participants, command requests, combat-log rows, spell-slot rows, reaction windows, timed effects, or encounter Conditions;
- 20 locations, 4 world routes, and 9 world route points.

Phase 1W is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Final protected baseline:

- 5 characters, 5 character sheets, and 5 progression rows;
- 15 reviewed spell assignments, exactly 1 Acid Splash assignment, and exact assignment metadata for Pip;
- 0 encounter maps, encounters, participants, command requests, combat-log rows, spell-slot rows, reaction windows, timed effects, or encounter Conditions;
- 20 locations, 4 world routes, and 9 world route points;
- authenticated execution and anonymous denial remain correct for the point-area RPC;
- Word of Radiance's area RPC and Healing Word v13 remain present.
