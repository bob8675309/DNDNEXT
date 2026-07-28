# Tactical Encounter Phase 1K — Toll the Dead

Status: **SERVER SOURCE PREPARED / PREDEPLOY BEHAVIOR VALIDATED**

Phase 1K extends the reviewed single-target spell path with the XPHB version of **Toll the Dead**. It remains deliberately bounded: no AoE, concentration, repeated saves, half-damage-on-success, reaction spellcasting, forced movement, or persistent roll-modifier effects are introduced.

## Reviewed spell definition

Production spell catalog:

- key: `toll-the-dead|XPHB`
- source: `XPHB`
- level: cantrip
- casting time: 1 Action
- range: 60 feet
- target: one creature the caster can see
- save: Wisdom
- damage: Necrotic
- full-health target: `1d8`
- target missing any HP: `1d12`
- cantrip scaling: one additional damage die at class levels 5, 11, and 17
- successful save: no damage
- concentration: no

The wounded-state rule is resolved from authoritative encounter state: `encounter_participants.current_hp < encounter_participants.max_hp`. The existing participant max-HP guard populates `max_hp` from the canonical character sheet when a participant is staged.

## Resolver design

New versioned RPC:

- `public.encounter_cast_spell_v3(caster, assignment, target, slot_level, request_id)`

The version boundary is intentional:

- Fire Bolt and Cure Wounds continue through the Phase 1I implementation;
- Sacred Flame continues through the Phase 1J implementation;
- v3 delegates all three previously reviewed spells to `encounter_cast_spell_v2`;
- v3 owns only `toll-the-dead|xphb`.

Toll the Dead guardrails:

- exact XPHB whitelist;
- class-source spell assignment only;
- cantrip rejects nonzero spell-slot selection;
- active-turn and controller authorization;
- hidden-target protection;
- defeated caster/target rejection;
- Action availability;
- existing action-blocking conditions on the caster;
- targets with any active encounter condition remain GM-assisted in this slice because save-modifier condition semantics are not fully modeled;
- canonical class spellcasting profile and assignment save-DC override support;
- LOS and 60-foot range through the existing targeting context;
- total cover blocks LOS;
- Wisdom save uses the canonical saving-throw profile;
- Dodge does **not** grant advantage on this Wisdom saving throw;
- cover adds no bonus to a Wisdom save;
- successful save deals zero damage;
- failed save uses the existing typed-damage helper with Necrotic damage;
- Action is spent only after a successful spell resolution;
- cantrip spends no spell slot;
- request-ID idempotency and combat-log storage remain server-authoritative.

## Persistent test NPCs

The live campaign now intentionally retains three NPC Forge characters in Xul for tactical testing:

- **Aurelia Dawnmere** — Aasimar Cleric 2, Arena Chirurgeon;
- **Pip Quillspark** — Halfling Wizard 2, Arena Arcanist;
- **Raska Stonejaw** — Orc Fighter 2, Arena Sparring Guard.

They were created through the normal NPC Forge character contract with source-backed progression and portraits. Existing persistent tactical spell assignments before Phase 1K are Sacred Flame and Cure Wounds for Aurelia and Fire Bolt for Pip.

## Predeploy transactional validation

The proposed v3 resolver was compiled inside a transaction and exercised against the real persistent Aurelia/Raska characters using a temporary encounter and a temporary Toll the Dead spell assignment.

Verified:

- full-health Raska resolves `1d8` damage dice;
- wounded Raska resolves `1d12` damage dice;
- save ability is Wisdom;
- Dodge does not create save advantage or a second d20;
- duplicate request IDs return the stored result;
- no spell slot is consumed;
- all encounter/map/participant/command/log/slot fixtures and the temporary assignment roll back.

The first fixture assertion used the wrong live slot-column name (`remaining` instead of `slots_remaining`). PostgreSQL aborted that transaction, leaving no function or fixture residue. The corrected fixture passed.

## Baseline after persistent NPC creation

Intentional live state entering Phase 1K:

- characters: 5
- character spell assignments: 3
- encounter maps: 0
- encounters: 0
- encounter participants: 0
- encounter command requests: 0
- encounter combat log: 0
- encounter spell slots: 0
- locations: 20
- world routes: 4
- world route points: 9

The additional three characters and three spell assignments are intentional persistent campaign data. Tactical encounter fixtures remain zero. World/town systems are untouched.

## Deferred

Still GM-assisted/manual:

- save spells with target conditions that alter saves;
- half-damage-on-success spells;
- persistent save/attack modifiers such as Mind Sliver or Vicious Mockery;
- repeated saves;
- concentration;
- AoE, lines, cones, emanations, and persistent areas;
- reaction spells;
- summons;
- teleportation and forced movement;
- item/feat/background spell-resource semantics;
- multiclass or multiple spell-slot-pool selection.

Next gate: add the migration/validator to the branch, get the branch build green, apply the migration to production, rerun the rollback behavior test against the deployed v3 function, then expose Toll the Dead in the existing combat spell UI.
