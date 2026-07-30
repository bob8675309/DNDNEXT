# Tactical Encounter Phase 1Z — Lightning Bolt

Status: **SERVER DEPLOYED / CLIENT SOURCE VALIDATED**

Phase 1Z adds the XPHB **Lightning Bolt** as the first directional tactical Line spell. It extends the reviewed targeting geometry without modifying the deployed Burning Hands Cone, single-target, caller-chosen Emanation, point-targeted Sphere, or allocated-dart paths.

## Reviewed XPHB spell

The live canonical definition is:

- Sorcerer / Wizard level-3 spell;
- Action;
- self-originating 100-foot-long, 5-foot-wide Line;
- every creature in the Line makes a Dexterity saving throw;
- failed save: shared `8d6` Lightning damage;
- successful save: half the shared Lightning damage, rounded down before affinity;
- each slot level above 3 adds `1d6`;
- instantaneous and non-concentration.

The canonical spell id is `0fa6da13-365f-4980-b37b-e228408ac80a`.

No current reviewed character can legally cast Lightning Bolt. Pip Quillspark is an XPHB Wizard level 2, and the other persistent characters are also below the level required for level-3 spell slots. Phase 1Z therefore does not create an off-level spell assignment or alter a persistent character. Pip is elevated to a legal Wizard level only inside rollback validation, and that temporary progression, sheet, slot snapshot, and assignment state is rolled back.

## Reviewed hex Line contract

The tactical system uses pointy-top axial hexes where one hex equals 5 feet. Phase 1Z represents the spell's 100-foot-long, 5-foot-wide Line as a straight **20-hex centerline**:

- the caster's origin hex is excluded;
- depths 1 through 20 represent 5 through 100 feet;
- direction indices `0–5` retain the deployed east, northeast, northwest, west, southwest, southeast order;
- the private server helper owns authoritative membership;
- the eventual UI helper is preview-only.

The server evaluates the existing encounter LOS/Cover context from the caster to each occupied Line hex. Total Cover excludes the creature; Half and Three-Quarters Cover add their reviewed Dexterity-save bonus.

## Safe server contract

The deployed guarded RPC is:

`public.encounter_cast_directional_area_spell_v2(caster, assignment, direction, slot_level, request_id)`

The v2 authority delegates `burning-hands|XPHB` directly to the unchanged deployed v1 RPC before any Phase 1Z command or resource mutation. It owns only the reviewed `lightning-bolt|XPHB` branch.

For Lightning Bolt, the server:

- validates canonical class, spell list, casting ability, preparation, active turn, controller, Action, conditions, level-3-or-higher spell slot, and the one-slotted-spell-per-turn authority;
- accepts only direction indices `0–5`;
- derives and locks every creature in the 20-hex Line before any resource or HP mutation;
- excludes creatures behind Total Cover and adds Half or Three-Quarters Cover to Dexterity saves;
- rolls one shared `8d6 + 1d6/slot above 3` Lightning result;
- applies full damage on a failed save and half damage on a successful save before Lightning affinity;
- masks hidden target identities, counts, saves, and damage from unauthorized callers;
- spends one Action and one spell slot and writes one idempotent command/log result.

Until defeated-creature and condition-specific Dexterity interactions are modeled, the Lightning Bolt adapter fails consistently whenever a defeated or conditioned participant is present. It also fails for non-GM callers while an unauthorized hidden participant has an active Mind Sliver save modifier, preventing effect-consumption logs from becoming a hidden-target oracle.

## Deliberate deferrals

Phase 1Z does not introduce:

- concentration or persistent zones;
- reaction spellcasting;
- forced movement;
- creature or object ignition/state mutation;
- new characters or permanent spell assignments;
- world-map or town/city-map behavior.

## Validation and deployment gates

1. static server-contract validation;
2. compile the proposed SQL against the live schema inside a transaction ending in `ROLLBACK`;
3. exercise six-direction geometry and a legal level-5 rollback-only caster fixture;
4. verify shared damage, successful-save half damage, Lightning affinity, Cover, Action, slot, one-slotted-spell-per-turn, idempotency, authorization, hidden masking, and failure cleanup;
5. pass the complete tactical spell validator suite and production-equivalent Next build;
6. publish and production-gate the server source;
7. apply the reviewed migration and repeat the rollback matrix;
8. add the isolated Line preview/UI route and production-gate it;
9. recheck the protected database baseline without adding an illegal assignment.

## Local validation evidence

The server source has passed:

- the Phase 1Z static contract validator and the existing Burning Hands and Healing Word validators;
- live-schema compilation inside `BEGIN` / `ROLLBACK`;
- all six private Line-helper directions, each with 20 unique depths, no caster-origin hex, and the reviewed endpoint;
- a rollback-only server behavior matrix covering base `8d6`, level-4 `9d6`, one shared roll, failed and successful Dexterity saves, save-for-half, Lightning resistance, Half Cover, Total Cover, Action and slot use, encounter versioning, one combat log, one command, idempotent replay, the one-slotted-spell-per-turn guard, controller rejection, failed-request cleanup, hidden-target masking with server-applied damage, invalid direction, invalid slot level, no remaining slot, and Burning Hands delegation to v1.
- the complete 38-validator tactical spell suite and the repository's production-equivalent Vercel build, including a successful Next.js production compile and static-page generation.

The fixture temporarily raised both `max_hp` and `current_hp` on its encounter snapshots before testing the one-slot guard. This keeps the assertion focused on that guard instead of allowing a legitimate Lightning Bolt defeat to trigger the broader defeated-creature fail-closed rule first.

After rollback, the proposed v2 RPC and private helper were absent, Pip was restored to Wizard level 2 in progression and both sheet level fields, all tactical fixture tables remained empty, and the exact 5-character / 17-assignment / 0-Lightning-Bolt-assignment baseline remained intact.

## Server deployment evidence

- server source PR #110;
- reviewed server head `55476f64bfc57f6a9a23d9d9bcc7aa25c6a15faa`;
- squash merge / production source `3812b849c5941e5ee170b7eea5e54191c07ca249`;
- migration `20260730195028 tactical_lightning_bolt`;
- exact-head preview and merge-commit production Vercel deployments passed;
- NPC Forge and profession-crafting workflows passed;
- the unrelated enchanting workflow retained its existing canonical `Weapon of` verification failure while its syntax, A/B/C model, and migration-safety steps passed.

The deployed RPC is executable by `authenticated` and `service_role`, not by `anon`. The private Line helper is not executable by authenticated clients. The Supabase security advisor reports the generic warning that authenticated users can execute this `SECURITY DEFINER` function. That exposure is intentional: the RPC is the guarded authority boundary and validates controller, active turn, canonical spellbook/class, preparation, direction, Line membership, LOS/Cover, saves, Action, slot, one-slotted-spell-per-turn, hidden masking, and idempotency internally. No Phase 1Z-specific performance advisory was reported.

The complete deployed behavior matrix passed inside `BEGIN` / `ROLLBACK`, including Burning Hands v1 delegation. The rollback restored the exact persistent and world baselines recorded below.

## Client source evidence

The isolated Pages Router client patch:

- adds `lightning-bolt|xphb` to the reviewed tactical spell set;
- derives a preview-only 20-hex Line from the active encounter participant and the same six deployed direction labels;
- shows visible, undefeated participant previews without making those previews authoritative;
- routes only Lightning Bolt to directional-area v2 while retaining the exact Burning Hands v1 client route;
- displays selected-slot `8d6 + 1d6/slot above 3`, save-for-half, direction, visible outcomes, Cover, and Lightning affinity in action feedback and combat-log detail;
- passes the explicit Line preview to the existing encounter-board `selectedAreaHexes` prop without modifying the board component.

All client helpers, state, memoized values, RPC arguments, and board props are defined in their owning module and passed at each use site. The new dynamic geometry validator confirms 20 unique non-origin hexes and the reviewed endpoint for all six directions. The complete 39-validator tactical spell suite, legacy Burning Hands UI validator, `git diff --check`, and production-equivalent Next.js/Vercel build pass locally.

## Starting baseline and isolation

- GitHub `main` at `c1a874805497679e316bf141d647f3d61711a993`;
- 5 characters, 5 character sheets, and 5 progression rows;
- 17 reviewed spell assignments and 0 Lightning Bolt assignments;
- 0 encounter maps, encounters, participants, command requests, combat-log rows, spell-slot rows, reaction windows, timed effects, or encounter Conditions;
- 20 locations, 4 world routes, and 9 world route points.

Phase 1Z is tactical-only. It does not modify world travel, routes, weather, camps, world maps, town/city maps, merchants, crafters, or world simulation.
