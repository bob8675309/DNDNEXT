# Tactical Encounter Phase 1G — LOS, Cover, Saves & Damage Status

Last updated: 2026-07-27

This document extends the tactical encounter roadmap and Phase 1F weapon-combat ledger. Phase 1G adds the visibility, cover, saving-throw, and generic typed-damage primitives that future reactions and spell automation will depend on.

## Status

**Implemented, schema deployed, rollback-tested, permission-checked, and preview green.**

## Deterministic axial line tracing

`encounter_hex_line_internal_v1` now provides a deterministic axial hex line between two encounter positions.

- the trace includes origin and target hexes;
- cube-coordinate interpolation and deterministic cube rounding are used server-side;
- the returned line is encounter-coordinate data only and does not use world-map pixels or route state;
- the client combat board receives the server-resolved line for visualization rather than inventing a separate targeting path.

## Line of sight and cover

`encounter_targeting_context_internal_v1` resolves the authoritative targeting context between two participants in the same encounter.

Current semantics:

- `blocks_movement` remains movement-only;
- `blocks_los` is the hard LOS-blocking flag;
- `cover_level='total'` also prevents line of sight;
- half cover grants **+2 AC** and **+2 Dexterity saving throws** against a source across that cover;
- three-quarters cover grants **+5 AC** and **+5 Dexterity saving throws**;
- the strongest cover object encountered on the traced line wins;
- the first LOS-blocking object stops the trace for targeting purposes;
- object anchors at `(q,r)` are authoritative for this single-hex object MVP; multi-hex `footprint` LOS semantics remain deferred.

The controller-facing `encounter_targeting_context_v1` exposes distance, traced line, LOS state, cover level, AC/save bonus, and blocking hex while requiring control of the originating participant (or admin/service-role authority).

## Weapon and Unarmed Strike integration

Both existing attack paths now consume the shared targeting and damage primitives.

Weapon attacks now:

- reject total cover / hard LOS blockers before spending the Action;
- add half/three-quarters cover to target AC;
- preserve existing reach, thrown range, ranged range, Dodge disadvantage, and long-range disadvantage;
- retain natural 1 / natural 20 handling;
- send typed damage through the shared generic damage applicator.

Unarmed Strike now uses the same LOS, cover AC, and typed-damage path with bludgeoning damage.

## Server-authoritative saving throws

`encounter_saving_throw_profile_internal_v1` derives a save profile from canonical character data:

- ability score from `character_sheets.sheet.abilities`;
- proficiency bonus from the canonical character sheet;
- preferred class from the character sheet class key;
- saving-throw proficiencies from `class_catalog_preferred.saving_throws`.

`encounter_roll_save_v1` provides the first controller-facing manual saving-throw path.

- only the participant controller/admin/service role may roll it;
- ability modifier and proficiency are calculated server-side;
- DC must be an explicit integer from 1–40;
- optional source participant enables cover evaluation;
- only Dexterity saves currently receive cover bonuses;
- the roll does not spend Action / Bonus Action / Reaction;
- request UUIDs make retries idempotent;
- accepted saves are written to the Realtime combat log.

The manual save RPC is a foundation/testing surface. Future spell/class-effect RPCs should call the private save primitives from authoritative effect resolution rather than trusting a client to define an effect's DC.

## Generic typed damage and affinities

`encounter_apply_damage_internal_v1` is now the shared typed-damage primitive used by weapon and unarmed attacks.

Encounter participants have explicit encounter-local arrays for:

- `damage_resistances`
- `damage_immunities`
- `damage_vulnerabilities`

`admin_set_encounter_damage_affinities_v1` is GM/admin guarded and validates standard D&D damage types.

Current damage order:

1. start from non-negative raw typed damage;
2. immunity reduces damage to 0;
3. otherwise resistance halves damage, rounding down;
4. vulnerability doubles the remaining damage;
5. temporary HP absorbs damage before current HP;
6. current HP reaching 0 marks the encounter participant defeated.

Affinities are encounter-local in Phase 1G because the current canonical character sheets do not expose a reliable structured resistance/immunity/vulnerability field. Phase 1G deliberately does not scrape prose traits to infer them.

## Combat UI

`/encounters/combat` now adds:

- server-resolved LOS state;
- cover level and effective target AC;
- targeting-line visualization on the encounter board;
- visible LOS-blocking hex indication;
- weapon attack disablement when LOS is blocked;
- cover warnings on supported attacks;
- manual Strength/Dexterity/Constitution/Intelligence/Wisdom/Charisma saving throws;
- optional selected-target source for Dexterity-cover save evaluation;
- combat-log feedback for raw vs adjusted typed damage and saving-throw outcomes.

Movement remains on `/encounters/play`; Phase 1G does not duplicate or alter the Phase 1D movement authority.

## Validation completed

The rollback integration matrix verified:

- a four-hex axial line produced the expected five traced cells including origin and target;
- clear LOS returned no cover;
- half cover returned +2 AC / +2 Dex save cover;
- three-quarters cover returned +5;
- `blocks_los` converted the target to total cover and identified the blocking hex;
- a weapon attack through blocked LOS was rejected without spending Action;
- Fighter Constitution save proficiency resolved from the class catalog;
- Fighter Dexterity save remained non-proficient and used the canonical Dexterity modifier;
- a Dexterity save across half cover received +2;
- saving-throw retries returned the same result and did not duplicate combat-log entries;
- saving throws did not spend Action;
- 7 piercing damage against piercing resistance became 3;
- fire immunity reduced damage to 0;
- 4 slashing damage against slashing vulnerability became 8;
- weapon attacks used cover-adjusted AC and the shared damage-affinity hook;
- weapon attack retries did not duplicate damage or logs;
- all temporary encounter, map-object, inventory, command, and combat-log rows rolled back to zero;
- world state remained 2 characters / 20 locations / 4 routes / 9 route points.

The player-auth rehearsal verified:

- an explicit non-admin participant controller can use the public targeting and save RPCs;
- the same identity cannot inspect targeting from an uncontrolled participant;
- the same identity cannot edit damage affinities;
- authenticated clients cannot execute internal targeting, save-profile, or generic-damage helpers;
- authenticated direct UPDATE on `encounter_participants` remains denied;
- anon cannot roll saves.

## Explicit non-goals still in force

Phase 1G does **not** yet implement:

- multi-hex LOS footprints;
- elevation-based visibility;
- darkness, light sources, invisibility, obscurement, blindsight, truesight, or darkvision targeting rules;
- ranged-attacks-while-threatened disadvantage;
- ammunition/reload rules;
- opportunity attacks or reaction timing;
- versatile mode selection, dual wielding, Nick/Light bonus attacks, or weapon mastery effects;
- canonical resistance/immunity/vulnerability import from species/class/items;
- healing or generic HP restoration;
- death saves / unconscious-state rules;
- canonical character-sheet HP writeback;
- spell targeting, spell slots, concentration, AoE templates, or class-resource spending;
- world-map movement, travel, route, weather, camp, or clock changes.

## Next implementation slice

The next bounded slice should establish **reaction timing and generic effect resolution** before spell automation:

1. threat / melee-reach detection around movement steps;
2. reaction availability spending and opportunity-attack prompts/authority;
3. Disengage suppression of opportunity attacks;
4. generic damage/healing/effect-result envelope for future actions;
5. basic conditions with duration/expiry hooks;
6. effect-originated saving throws that use the private save resolver and authoritative DC;
7. only then begin spell targeting, spell-slot spending, concentration, and AoE templates.
