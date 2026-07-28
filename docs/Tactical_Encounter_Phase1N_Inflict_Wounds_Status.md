# Tactical Encounter Phase 1N — Inflict Wounds

Status: **SERVER SOURCE PREPARED / BUILD GATE PENDING**

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

The older PHB record remains deliberately unsupported by this adapter. Its rules use a melee spell attack and `3d10`, so Phase 1N must not silently collapse the PHB and XPHB versions into one behavior.

## Shared mechanic

New internal helper:

- `private.encounter_damage_after_save_v1(full_damage, save_success, half_on_success)`

The helper returns:

- full nonnegative damage when the save fails;
- half the rolled damage, rounded down, when the save succeeds and the caller explicitly enables half-on-success;
- zero on a successful save when half-on-success is false.

This is intentionally separate from typed damage affinity. The spell first resolves the saving throw and determines the save-adjusted raw damage; only then does `encounter_apply_damage_internal_v1` apply resistance, immunity, vulnerability, Temporary HP consumption, HP reduction, and defeat state. The helper is internal and is not granted directly to authenticated or anonymous clients.

## Resolver design

Repository migration:

- `sql/20260728_04_tactical_inflict_wounds.sql`

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

## Test character

Phase 1N uses **Aurelia Dawnmere**, the persistent level-2 XPHB Cleric. The postdeploy fixture will temporarily assign the canonical XPHB Inflict Wounds spell to Aurelia inside a rollback transaction, stage only tactical encounter data, and validate both save branches plus slot/action/idempotency behavior. If the resolver passes, the assignment can then be granted permanently through the canonical character-spell model for continued tactical review.

## Baseline before Phase 1N

- characters: 5
- character spell assignments: 6
- encounter maps: 0
- encounters: 0
- encounter participants: 0
- encounter command requests: 0
- encounter combat log: 0
- encounter spell slots: 0
- locations: 20
- world routes: 4
- world route points: 9

World and town systems are outside this phase and must remain unchanged.

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

Next gate: get the bounded server branch green, apply only the additive v6 migration, run the rollback fixture against the deployed resolver, then wire the combat UI and its validator before any fast-forward to `main`.