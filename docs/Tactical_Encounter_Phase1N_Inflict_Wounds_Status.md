# Tactical Encounter Phase 1N — Inflict Wounds

Status: **SERVER DEPLOYED / POSTDEPLOY VALIDATED / COMBAT UI BUILD GATE PENDING**

Phase 1N introduces one reusable tactical mechanic—successful-save damage adjustment—and uses it for the reviewed XPHB version of **Inflict Wounds**. The phase remains intentionally narrow: one Action, Touch range, one creature, Constitution save, necrotic damage, half damage on a successful save, ordinary spell-slot upcasting, and no concentration, condition, forced movement, reaction, area, or repeated effect.

## Catalog review and spell choice

The live canonical spell catalog was rechecked before implementation.

Chosen spell:

- id: `757df55a-766e-4017-ae67-4b1b46de67bf`
- key: `inflict-wounds|XPHB`
- source: `XPHB`
- level: 1
- class: Cleric
- school: Necromancy
- casting time: 1 Action
- range: Touch
- duration: Instantaneous
- save: Constitution
- base damage: `2d10` Necrotic
- successful save: half damage
- upcasting: `+1d10` damage for each spell slot level above 1
- concentration: no.

The older PHB record remains deliberately unsupported by this adapter. Its rules use a melee spell attack and `3d10`, so Phase 1N does not collapse the PHB and XPHB versions into one behavior.

## Shared mechanic

New internal helper:

- `private.encounter_damage_after_save_v1(full_damage, save_success, half_on_success)`

The helper returns:

- full nonnegative damage when the save fails;
- half the rolled damage, rounded down, when the save succeeds and the caller explicitly enables half-on-success;
- zero on a successful save when half-on-success is false.

This remains separate from typed damage affinity. The spell first resolves the saving throw and determines the save-adjusted raw damage; only then does `encounter_apply_damage_internal_v1` apply resistance, immunity, vulnerability, Temporary HP consumption, HP reduction, and defeat state. The helper is internal and is not executable directly by authenticated or anonymous clients.

## Resolver deployment

Repository migration:

- `sql/20260728_04_tactical_inflict_wounds.sql`

Production migration:

- `20260728162036 tactical_inflict_wounds`

New versioned RPC:

- `public.encounter_cast_spell_v6(caster, assignment, target, slot_level, request_id)`

Version boundary:

- Fire Bolt / Cure Wounds remain on v1;
- Sacred Flame remains on v2;
- Toll the Dead remains on v3;
- Poison Spray remains on v4;
- False Life remains on v5;
- v6 delegates all six prior reviewed adapters directly to v5;
- v6 owns only `inflict-wounds|xphb`.

Inflict Wounds guardrails:

- exact XPHB whitelist;
- class-source assignment only;
- level-1 canonical spell definition;
- prepared or always-available requirement;
- another creature target required in this automation slice;
- active-turn/controller authorization;
- defeated caster or target rejected;
- Action required;
- incapacitated/paralyzed/stunned/unconscious still block the Cast action;
- targets with active conditions remain GM-assisted until condition/save interactions are modeled centrally;
- canonical class spellcasting profile required;
- Touch range is limited to 5 feet and blocked line of sight / Total Cover fails closed;
- Constitution saving throw uses the server-derived save profile;
- Dodge does not alter this Constitution save;
- Half and Three-Quarters Cover do not modify the Constitution save;
- legal slot level 1-9 required;
- exactly one eligible slot pool required;
- damage dice are `2d10` at level 1 and add `1d10` per slot level above 1;
- a successful save halves the rolled damage before damage affinity is applied;
- one spell slot and one Action are spent only after successful resolution;
- request-ID idempotency and combat logging remain server-authoritative;
- anonymous execute remains revoked.

## Server build gate

Code-bearing server commit:

- `c56e3bdbb13c103ccc8a989ca871b71c71c79ec6`

The bounded server commit changed only the Phase 1N migration, server validator, status ledger, and npm validator wiring. Its Vercel build completed successfully:

- `https://vercel.com/pauls-projects-2016aa54/dndnext/9Ywn2BbF9SXkuyf8Nppzk1L5ujh4`

## Postdeploy rollback validation

The deployed v6 resolver was exercised against persistent **Aurelia Dawnmere** (level-2 XPHB Cleric) and **Raska Stonejaw** inside a transaction. The fixture staged only tactical encounter data and rolled all fixture state back.

The first fixture attempt intentionally exposed the existing `character_spells_unique_source_idx` guard when two duplicate class assignments were proposed for deterministic save testing. The transaction persisted nothing. The corrected fixture used one temporary assignment and changed only its test-only `save_dc_override` between casts.

Verified:

- shared helper: 11 damage on a successful half-damage save becomes 5;
- shared helper: a failed save preserves 11 damage;
- shared helper: a successful non-half save returns 0;
- Aurelia's canonical tactical snapshot began with 3 level-1 spell slots;
- forced failed Constitution save (DC 40) dealt the complete rolled `2d10` damage;
- failed-save full roll remained within 2–20;
- typed-damage application preserved that value on a neutral-affinity target;
- the cast spent exactly one level-1 slot and one Action;
- replaying the same request ID returned the stored result and spent no additional slot;
- after reset, forced successful Constitution save (DC 1) dealt `floor(full roll / 2)` damage;
- successful-save result reported `halfDamageOnSuccessfulSave=true` and `damageHalvedBySave=true`;
- the successful-save cast spent exactly one level-1 slot and one Action;
- self-targeting was rejected with no Action or slot spend;
- exactly two successful command requests and two spell-cast log rows existed inside the fixture before rollback;
- rollback restored all temporary map, encounter, participant, slot, command, log, and temporary assignment state.

Execution privileges were rechecked:

- v6 authenticated: `true`;
- v6 anon: `false`;
- v6 service role: `true`;
- shared save-damage helper authenticated: `false`;
- shared save-damage helper anon: `false`.

## Persistent reviewed assignment

After the deployed resolver passed rollback validation, canonical Inflict Wounds was granted to **Aurelia Dawnmere**:

- assignment id: `c0721724-912e-4981-96ea-b04885e8ef9d`
- spell id: `757df55a-766e-4017-ae67-4b1b46de67bf`
- source type: `class`
- source label: `Cleric`
- prepared: `true`
- always available: `false`
- casting stat: `wis`
- notes: `Phase 1N reviewed tactical adapter`.

This raises the intentional reviewed character-spell assignment count to 7.

## Current live baseline after server validation

- characters: 5
- character spell assignments: 7
- encounter maps: 0
- encounters: 0
- encounter participants: 0
- encounter command requests: 0
- encounter combat log: 0
- encounter spell slots: 0
- locations: 20
- world routes: 4
- world route points: 9

World and town systems were not modified.

## Combat UI gate

The follow-on UI source adds only the reviewed Inflict Wounds adapter to the combat page:

- seven-spell approved set;
- 5-foot Touch preflight;
- selected-slot `d10` damage preview;
- Constitution-save / half-damage rules text;
- v6 routing only for Inflict Wounds while v1-v5 remain intact;
- result text distinguishing full versus half damage;
- combat-log rendering for damage on successful half-damage saves;
- Phase 1N labeling;
- dedicated UI validator;
- False Life validator made forward-compatible without weakening its spell-specific checks.

This UI source must receive a real green build before any fast-forward to `main`.

## Deferred

Still GM-assisted/manual:

- save advantage/disadvantage from arbitrary conditions and features;
- competing Temporary HP pool replacement/choice;
- AoE, lines, cones, emanations, and persistent areas;
- concentration;
- repeated saves/effects;
- persistent save/attack modifiers;
- spell-created conditions or riders;
- forced movement and teleportation;
- reaction spells;
- summons;
- Bonus Action spellcasting and broader spell-per-turn semantics;
- item/feat/background spell-resource semantics;
- multiclass or multiple spell-slot-pool selection.

Next gate: build the Phase 1N combat UI commit, verify the bounded diff and validators, then non-force fast-forward to `main` only after a green build and production-verify that exact application ancestry.