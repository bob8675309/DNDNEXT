# Tactical Encounter Phase 1L — Poison Spray

Status: **SERVER SOURCE PREPARED / PREDEPLOY BEHAVIOR VALIDATED**

Phase 1L extends the reviewed tactical spell path with the XPHB version of **Poison Spray**. The slice remains intentionally narrow: one creature, one Action, one ranged spell attack, immediate typed damage, no concentration, no save, no repeated effect, no forced movement, and no persistent condition/rider.

## Catalog review and spell choice

The production XPHB cantrip catalog was reviewed from both structured fields and description text before selecting the next adapter.

Chosen spell:

- key: `poison-spray|XPHB`
- source: `XPHB`
- level: cantrip
- classes: Artificer, Druid, Sorcerer, Warlock, Wizard
- casting time: 1 Action
- range: 30 feet
- target: one creature
- attack: ranged spell attack
- damage: `1d12` Poison
- cantrip scaling: `2d12` at level 5, `3d12` at level 11, `4d12` at level 17
- concentration: no
- rider: none

**Acid Splash was not selected** even though its structured `area_type` field is null. Its XPHB description explicitly creates a 5-foot-radius Sphere and affects every creature in that Sphere, so it remains deferred with AoE mechanics. This reinforces that tactical automation must review spell description semantics rather than trusting one metadata field.

## Resolver design

Repository migration:

- `sql/20260728_02_tactical_poison_spray.sql`

New versioned RPC:

- `public.encounter_cast_spell_v4(caster, assignment, target, slot_level, request_id)`

Version boundary:

- Fire Bolt / Cure Wounds remain owned by the Phase 1I path;
- Sacred Flame remains owned by the Phase 1J path;
- Toll the Dead remains owned by the Phase 1K path;
- v4 delegates all four previously reviewed spells to `encounter_cast_spell_v3`;
- v4 owns only `poison-spray|xphb`.

Poison Spray guardrails:

- exact XPHB whitelist;
- class-source spell assignment only;
- cantrip rejects nonzero spell-slot selection;
- active-turn and controller authorization;
- hidden-target protection;
- caster and target must not be defeated;
- another-creature target only;
- Action availability;
- existing action-blocking caster conditions;
- canonical spellcasting profile and assignment attack-bonus override support;
- LOS and 30-foot range through the existing targeting context;
- total cover blocks LOS;
- Half and Three-Quarters Cover modify target AC through the existing targeting context;
- Dodge imposes disadvantage on the ranged spell attack;
- close-quarters ranged spell attacks remain GM-assisted while the full hostile-adjacency semantics are not modeled;
- any active encounter condition on caster or target keeps the spell attack GM-assisted in this slice;
- natural 1 misses and natural 20 hits/criticals using the same reviewed Fire Bolt attack contract;
- crit doubles damage dice;
- failed/missed attack deals zero damage;
- hit uses the existing typed-damage helper with Poison damage;
- Action is spent only after successful resolution of the attack attempt;
- cantrip consumes no spell slot;
- request-ID idempotency and combat-log storage remain server-authoritative.

## Persistent test NPCs

The live Xul tactical test roster remains:

- **Aurelia Dawnmere** — Aasimar Cleric 2;
- **Pip Quillspark** — Halfling Wizard 2;
- **Raska Stonejaw** — Orc Fighter 2.

Phase 1L uses Pip as the spell-attack caster and Raska as the target. Pip's canonical XPHB Wizard profile is level 2 with Intelligence 17, proficiency +2, and spell attack +5. A temporary attack-bonus override is used only inside rollback validation to make the attack result deterministic without changing Pip's live character.

## Predeploy transactional validation

The proposed `encounter_cast_spell_v4` function was compiled inside a transaction and exercised against the real persistent Pip/Raska characters. The fixture used the normal encounter map/create/stage/status/turn-marker RPCs, a temporary class-source Poison Spray assignment, and an authenticated controller claim.

Verified:

- normal level-2 Poison Spray resolves `1d12` Poison damage on a deterministic hit;
- range resolves from the tactical hex targeting context;
- duplicate request IDs return the stored result;
- the cantrip consumes no spell slot;
- Dodge produces ranged spell-attack disadvantage and a second d20;
- a target at 35 feet is rejected;
- rejected out-of-range casting spends no Action and leaves no command request;
- an adjacent hostile triggers the existing close-quarters fail-closed rejection;
- rejected close-quarters casting spends no Action and leaves no command request;
- temporary map, encounter, participants, command requests, combat log, spell-slot snapshots, Poison Spray assignment, and the temporary v4 definition all roll back.

Post-rollback baseline:

- characters: 5
- character spell assignments: 4
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

- AoE, lines, cones, emanations, and persistent areas;
- concentration;
- repeated saves/effects;
- half-damage-on-success spells;
- persistent save/attack modifiers;
- conditions or riders created by spells;
- forced movement and teleportation;
- reaction spells;
- summons;
- Bonus Action spellcasting and broader spell-per-turn semantics;
- item/feat/background spell-resource semantics;
- multiclass or multiple spell-slot-pool selection.

Next gate: add the standalone Phase 1L validator and npm check, get the branch build green, deploy only the reviewed v4 migration, rerun the rollback behavior test against the deployed function, grant Poison Spray canonically to Pip, then expose the spell in the existing combat UI through v4.
