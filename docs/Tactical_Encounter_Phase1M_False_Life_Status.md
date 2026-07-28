# Tactical Encounter Phase 1M — False Life

Status: **SERVER SOURCE PREPARED / BUILD GATE PENDING**

Phase 1M adds the XPHB version of **False Life** as the next reviewed tactical spell adapter. The slice remains narrow: self only, one Action, one spell slot, immediate Temporary HP, no concentration, no attack, no save, no target movement, no condition, and no repeated effect.

## Catalog review and spell choice

The live XPHB cantrip/level-1 catalog was reviewed from structured fields and description text.

Chosen spell:

- key: `false-life|XPHB`
- source: `XPHB`
- level: 1
- classes: Artificer, Sorcerer, Wizard
- casting time: 1 Action
- range: Self
- duration: Instantaneous
- effect: gain `2d4 + 4` Temporary HP
- upcasting: gain `+5` additional Temporary HP for each slot level above 1
- concentration: no
- rider: none beyond the granted Temporary HP.

Other nearby candidates were deferred because their descriptions require mechanics not yet shared by the tactical engine: attack/save penalties, conditions, forced movement, multiple beams/targets, half damage on successful saves, reactions, Bonus Action casting, AoE, or persistent effects.

## Existing engine support

`encounter_participants.temp_hp` already stores tactical Temporary HP. `encounter_apply_damage_internal_v1` consumes Temporary HP before current HP, so False Life does not require a new persistence table or damage path.

Phase 1M intentionally does **not** automate the general choice involved when a participant already has Temporary HP. If the caster currently has any Temporary HP, v5 fails closed with a GM-assisted message rather than stacking or silently replacing it.

## Resolver design

Repository migration:

- `sql/20260728_03_tactical_false_life.sql`

New versioned RPC:

- `public.encounter_cast_spell_v5(caster, assignment, target, slot_level, request_id)`

Version boundary:

- Fire Bolt / Cure Wounds remain on v1;
- Sacred Flame remains on v2;
- Toll the Dead remains on v3;
- Poison Spray remains on v4;
- v5 delegates all five prior reviewed adapters directly to v4;
- v5 owns only `false-life|xphb`.

False Life guardrails:

- exact XPHB whitelist;
- class-source assignment only;
- level-1 canonical spell definition;
- prepared or always-available requirement;
- self target only (`target == caster`);
- active-turn/controller authorization;
- defeated casters cannot cast;
- Action must be available;
- incapacitated/paralyzed/stunned/unconscious still block the Cast action;
- canonical class spellcasting profile required;
- legal remaining slot required at the selected level;
- multiple eligible slot pools fail closed;
- existing Temporary HP fails closed;
- `2d4 + 4` base Temporary HP;
- `+5` per slot level above 1;
- no stacking behavior;
- one spell slot spent only after successful resolution;
- Action spent only after successful resolution;
- request-ID idempotency and combat logging remain server-authoritative;
- anonymous execute remains revoked.

## Test character

Phase 1M will use **Pip Quillspark**, the persistent level-2 XPHB Wizard, because False Life is on the Wizard list and his canonical spell-slot snapshot already exercises the same class-source slot path used by Cure Wounds.

The planned postdeploy fixture will temporarily assign False Life to Pip inside a rollback transaction, stage only tactical encounter data, cast on self, verify Temporary HP and slot/action changes, test duplicate-request idempotency, and test the existing-Temporary-HP fail-closed path. The temporary assignment and all tactical fixture rows must roll back.

## Baseline before Phase 1M

- characters: 5
- character spell assignments: 5
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

- replacing/choosing between competing Temporary HP pools;
- AoE, lines, cones, emanations, and persistent areas;
- concentration;
- repeated saves/effects;
- half-damage-on-success spells;
- persistent save/attack modifiers;
- spell-created conditions or riders;
- forced movement and teleportation;
- reaction spells;
- summons;
- Bonus Action spellcasting and broader spell-per-turn semantics;
- item/feat/background spell-resource semantics;
- multiclass or multiple spell-slot-pool selection.

Next gate: wire the standalone validator and npm check, get the branch build green, apply only the additive v5 migration, then run the rollback fixture against the deployed function before exposing False Life in the combat UI.
