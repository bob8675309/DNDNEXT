# Tactical Encounter Phase 1N — Inflict Wounds

Status: **SERVER + COMBAT UI DEPLOYED / POSTDEPLOY VALIDATED**

Phase 1N adds one reusable tactical mechanic—successful-save damage adjustment—and uses it for the reviewed XPHB version of **Inflict Wounds**. The automated slice is deliberately narrow: one Action, Touch range, one other creature, Constitution save, Necrotic damage, half damage on a successful save, ordinary spell-slot upcasting, and no concentration, condition, forced movement, reaction, area, or repeated effect.

## Canonical spell contract

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
- upcasting: `+1d10` for each spell slot level above 1.

The older PHB record remains unsupported by this adapter because its rules use a melee spell attack and `3d10`; the two versions are not collapsed into one behavior.

## Shared mechanic

Phase 1N adds:

- `private.encounter_damage_after_save_v1(full_damage, save_success, half_on_success)`

It preserves full nonnegative damage on a failed save, returns half rounded down when half-on-success is enabled, and returns zero for a successful save when half-on-success is disabled. Save adjustment happens before the existing typed-damage helper applies resistance, immunity, vulnerability, Temporary HP, HP reduction, and defeat state.

The helper remains internal: authenticated and anonymous roles cannot execute it directly.

## Resolver deployment

Repository migration:

- `sql/20260728_04_tactical_inflict_wounds.sql`

Production migration:

- `20260728162036 tactical_inflict_wounds`

Versioned RPC:

- `public.encounter_cast_spell_v6(caster, assignment, target, slot_level, request_id)`

Version boundary:

- Fire Bolt / Cure Wounds: v1
- Sacred Flame: v2
- Toll the Dead: v3
- Poison Spray: v4
- False Life: v5
- Inflict Wounds: v6

v6 delegates all six prior reviewed adapters to v5 and owns only `inflict-wounds|xphb`.

## Server guardrails

- exact XPHB whitelist;
- class-source assignment only;
- canonical level-1 definition;
- prepared or always-available requirement;
- another-creature target requirement;
- active-turn/controller authority;
- defeated caster or target rejected;
- Action required;
- incapacitated/paralyzed/stunned/unconscious caster rejected;
- targets with active conditions remain GM-assisted until condition/save interactions are modeled centrally;
- canonical class spellcasting profile required;
- Touch range capped at 5 feet;
- blocked line of sight / Total Cover fails closed;
- Constitution save uses the server-derived save profile;
- Dodge does not modify this Constitution save;
- Half and Three-Quarters Cover do not modify this Constitution save;
- legal slot level 1–9 required;
- exactly one eligible spell-slot pool required;
- `2d10` at level 1 and `+1d10` per slot level above 1;
- successful save halves the full rolled damage before damage affinity;
- one spell slot and one Action spent only after successful resolution;
- request-ID idempotency and combat logging remain server-authoritative;
- anonymous execute remains revoked.

## Build and production gates

Green server-source commit:

- `c56e3bdbb13c103ccc8a989ca871b71c71c79ec6`
- Vercel: `https://vercel.com/pauls-projects-2016aa54/dndnext/9Ywn2BbF9SXkuyf8Nppzk1L5ujh4`

Green server + combat UI branch head:

- `f9a4e12a60f662c1515fc8ed6cddd619cee23990`
- Vercel: `https://vercel.com/pauls-projects-2016aa54/dndnext/CF9QxgPifcMJrQ8dMXyPd2SnwJEp`

GitHub connector safety prevented a direct ref move to `main`, so the same bounded branch was merged through PR #81 using a linear rebase merge rather than a force update.

Production `main` head after that rebase:

- `89bc8c3fda81b9c0c5d3b907ca37edf929a3a65b`
- production Vercel: `https://vercel.com/pauls-projects-2016aa54/dndnext/8VAehEHVYV1d99imHoFSSdmDQiVx`
- status: success.

## Postdeploy rollback validation

The deployed v6 resolver was exercised transactionally with persistent **Aurelia Dawnmere** (level-2 XPHB Cleric) targeting **Raska Stonejaw**. The fixture staged only tactical data and rolled all fixture rows back.

Verified:

- shared helper: 11 damage on a successful half-damage save becomes 5;
- shared helper: failed save preserves 11 damage;
- shared helper: successful non-half save returns 0;
- Aurelia's tactical snapshot began with 3 level-1 spell slots;
- forced failed Constitution save (DC 40) dealt the full rolled `2d10` damage;
- full roll remained in legal 2–20 bounds;
- neutral-affinity target preserved the save-adjusted amount through typed damage;
- one slot and one Action were spent;
- replaying the same request ID returned the stored result and spent nothing extra;
- forced successful Constitution save (DC 1) dealt `floor(full roll / 2)` damage;
- successful result reported `halfDamageOnSuccessfulSave=true` and `damageHalvedBySave=true`;
- successful-save cast spent one slot and one Action;
- self-targeting was rejected without slot or Action spend;
- exactly two successful command requests and two spell-cast log rows existed inside the fixture before rollback;
- rollback restored all temporary map, encounter, participant, slot, command, log, and temporary-assignment state.

Execution privileges:

- v6 authenticated: `true`
- v6 anon: `false`
- v6 service role: `true`
- save-damage helper authenticated: `false`
- save-damage helper anon: `false`.

## Persistent reviewed assignment

Aurelia Dawnmere now has the canonical reviewed assignment:

- assignment id: `c0721724-912e-4981-96ea-b04885e8ef9d`
- source type: `class`
- source label: `Cleric`
- prepared: `true`
- always available: `false`
- casting stat: `wis`
- notes: `Phase 1N reviewed tactical adapter`.

## Combat UI

The combat surface now includes seven reviewed adapters and routes only Inflict Wounds through v6. It adds:

- 5-foot Touch preflight;
- selected-slot `d10` damage preview;
- Constitution-save and half-damage rules text;
- full-versus-half result messaging;
- successful-save damage rendering in the combat log;
- Phase 1N labeling;
- dedicated Phase 1N UI validation while preserving v1-v5 routing.

## Final live baseline

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

Phase 1N is complete. The tactical spell validators are part of the source contract; the follow-up closeout wires the complete spell-validator suite into the actual Vercel build runner so future tactical spell phases cannot bypass those guards.