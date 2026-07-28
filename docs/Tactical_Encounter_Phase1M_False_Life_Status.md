# Tactical Encounter Phase 1M — False Life

Status: **SERVER DEPLOYED / POSTDEPLOY VALIDATED / COMBAT UI HELD FOR BUILD GATE**

Phase 1M adds the XPHB version of **False Life** as the next reviewed tactical spell adapter. The deployed server slice remains narrow: self only, one Action, one spell slot, immediate Temporary HP, no concentration, no attack, no save, no target movement, no condition, and no repeated effect.

## Catalog review and spell choice

The live XPHB cantrip/level-1 catalog was reviewed from structured fields and description text before selecting the adapter.

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

Other nearby candidates remain deferred because their descriptions require mechanics not yet shared by the tactical engine: attack/save penalties, conditions, forced movement, multiple beams/targets, half damage on successful saves, reactions, Bonus Action casting, AoE, or persistent effects.

## Existing engine support

`encounter_participants.temp_hp` already stores tactical Temporary HP. `encounter_apply_damage_internal_v1` consumes Temporary HP before current HP, so False Life does not require a new persistence table or damage path.

Phase 1M intentionally does **not** automate the general choice involved when a participant already has Temporary HP. If the caster currently has any Temporary HP, v5 fails closed with a GM-assisted message rather than stacking or silently replacing it.

## Resolver deployment

Production migration:

- `20260728042006 tactical_false_life`

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

## Build gate before database deployment

The code-bearing server head `30cd5a224de715cf862541387c09fa47d90cc1fe` was green in Vercel before the account later hit its build-rate limit. The server diff at that gate was limited to this migration, server validator, status ledger, and npm validator wiring.

## Postdeploy rollback validation

The deployed v5 function was exercised against the real persistent **Pip Quillspark** Wizard 2 inside a transaction. The test temporarily assigned False Life, staged a tactical encounter with the normal encounter RPCs, and used Pip's canonical level-1 spell-slot snapshot.

Verified:

- Pip began with 3 level-1 spell slots;
- level-1 False Life granted a legal 6–12 Temporary HP from `2d4 + 4`;
- level-1 `upcastBonus` was 0;
- exactly one spell slot was spent, leaving 2;
- exactly one Action was spent;
- participant `temp_hp` matched the server result;
- duplicate request ID returned the stored result and spent no additional slot;
- with existing Temporary HP, a new cast was rejected;
- the rejected cast preserved the existing Temporary HP;
- the rejected cast spent no Action and no spell slot;
- the rejected cast left no command-request residue;
- all temporary encounter/map/participant/command/log/slot rows and the temporary spell assignment rolled back.

Execution privileges were rechecked:

- v1 authenticated `true`, anon `false`;
- v4 authenticated `true`, anon `false`;
- v5 authenticated `true`, anon `false`, service role `true`.

## Persistent test spell assignment

After the deployed resolver passed validation, False Life was granted permanently to **Pip Quillspark** through the canonical character-spell model:

- assignment id: `36a8925d-495e-42a8-a0ad-b10085b7a76d`
- source type: `class`
- source label: `Wizard`
- prepared: `true`
- casting stat: `int`.

This assignment is intentional persistent test/campaign data and brings the live reviewed spell-assignment count to 6.

## Current live baseline

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

World and town systems were not modified.

## Combat UI gate

The follow-on `phase1m-false-life-ui` branch contains a bounded combat UI adapter for False Life plus a dedicated UI validator. The UI source adds self-target selection, level-slot Temporary HP preview, existing-Temporary-HP preflight, v5 routing, result/log text, and Phase 1M labeling while preserving the prior spell-version routes.

That UI source has **not** been merged into the server-safe `main` because Vercel refused its earlier deployments at the account level with `build-rate-limit` before compilation began. This is an infrastructure quota result, not a compile/runtime failure. The last actual build gate available for Phase 1M is therefore the green server head above.

A fresh no-behavior-change build retry was triggered from this UI branch on July 27, 2026 (America/Chicago) specifically to determine whether Vercel build capacity had resumed.

Do not merge the UI branch by treating a rate-limit result as a green build. Resume the UI gate only when a real build runner is available or an equivalent independent build can be completed.

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

Server Phase 1M is complete and deploy-validated. The remaining Phase 1M work is the combat UI build/deployment gate only.
