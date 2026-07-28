# Tactical Encounter Phase 1L — Poison Spray

Status: **SERVER + COMBAT UI DEPLOYED / VALIDATED**

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

**Acid Splash was not selected** even though its structured `area_type` field is null. Its XPHB description explicitly creates a 5-foot-radius Sphere and affects every creature in that Sphere, so it remains deferred with AoE mechanics. Tactical automation therefore continues to review spell-description semantics rather than trusting one metadata field.

## Resolver deployment

Production migration:

- `20260728025432 tactical_poison_spray`

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
- critical hits double damage dice;
- missed attacks deal zero damage;
- hits use the existing typed-damage helper with Poison damage;
- Action is spent only after successful resolution of the attack attempt;
- cantrip consumes no spell slot;
- request-ID idempotency and combat-log storage remain server-authoritative.

## Persistent test NPCs and spell assignment

The live Xul tactical test roster remains:

- **Aurelia Dawnmere** — Aasimar Cleric 2;
- **Pip Quillspark** — Halfling Wizard 2;
- **Raska Stonejaw** — Orc Fighter 2.

Phase 1L uses Pip as the spell-attack caster and Raska as the target. Pip's canonical XPHB Wizard profile is level 2 with Intelligence 17, proficiency +2, and spell attack +5. A temporary attack-bonus override was used only inside rollback validation to make the attack result deterministic without changing Pip's live character.

After the deployed v4 resolver passed postdeploy validation, Poison Spray was granted permanently to Pip through the normal canonical Spellbook assignment model:

- source type: `class`
- source label: `Wizard`
- casting stat: `int`
- no slot resource because it is a cantrip.

Persistent reviewed tactical assignments are now:

- Aurelia — Sacred Flame, Cure Wounds, Toll the Dead;
- Pip — Fire Bolt, Poison Spray.

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
- temporary map, encounter, participants, command requests, combat log, spell-slot snapshots, Poison Spray assignment, and the temporary v4 definition all rolled back.

The predeploy rollback restored the prior live baseline of 5 characters, 4 character-spell assignments, zero tactical fixture rows, 20 locations, 4 world routes, and 9 world route points.

## Postdeploy server validation

After applying `20260728025432 tactical_poison_spray`, the behavior fixture was rerun against the deployed `encounter_cast_spell_v4` without redefining the function.

Verified again:

- deterministic level-2 hit uses `1d12` Poison damage;
- duplicate request IDs return the stored result;
- cantrip consumes no spell slot;
- Dodge imposes ranged spell-attack disadvantage and returns the second d20;
- 35-foot range rejection spends no Action and leaves no command-request residue;
- all temporary encounter/map/participant/command/log/slot rows roll back.

Execution privileges were rechecked:

- v1: authenticated `true`, anon `false`;
- v2: authenticated `true`, anon `false`;
- v3: authenticated `true`, anon `false`;
- v4: authenticated `true`, anon `false`, service role `true`.

## Combat UI deployment

`pages/encounters/combat.js` exposes Poison Spray alongside Fire Bolt, Cure Wounds, Sacred Flame, and Toll the Dead.

Routing remains explicitly versioned:

- Fire Bolt / Cure Wounds → `encounter_cast_spell_v1`;
- Sacred Flame → `encounter_cast_spell_v2`;
- Toll the Dead → `encounter_cast_spell_v3`;
- Poison Spray → `encounter_cast_spell_v4`.

The UI:

- keeps the existing offensive-spell target filter;
- applies a 30-foot client preflight for Poison Spray;
- displays the canonical spell-attack bonus against AC;
- identifies base level-2 damage as `1d12 poison`;
- explains Dodge disadvantage, Half/Three-Quarters Cover AC, close-quarters fail-closed behavior, and total-cover LOS blocking;
- renders hit/miss attack total versus target AC from server-returned roll/attack bonus data;
- shows disadvantage, cover AC, critical state/dice, typed Poison damage, and damage-affinity result in the combat log;
- leaves target legality, LOS, cover, Dodge, close-quarters state, conditions, attack roll, crit, scaling, damage, Action spend, and idempotency authoritative on the server.

The Phase 1K Toll UI validator was made forward-compatible for later tactical UI versions while retaining Toll→v3 and Sacred→v2 assertions. Phase 1L adds:

- `scripts/validate_tactical_poison_spray.mjs`
- npm `check:tactical-poison-spray`
- `scripts/validate_tactical_poison_spray_ui.mjs`
- npm `check:tactical-poison-spray-ui`.

The code-bearing Phase 1L branch and UI-validator/package head were green in Vercel before merge. The non-force fast-forward placed the Phase 1L code on `main` at `c362cd0f8832366678c2fbb1c5ccbc7b9ebae7f1`, and the resulting Vercel production deployment was green.

## Final live baseline

Intentional live state after the deployed v4 resolver and permanent Pip assignment:

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

The three Xul test NPCs and five reviewed tactical spell assignments are intentional persistent campaign data. Tactical fixtures remain zero. World and town systems were not modified.

## Advisor review

Security advisor results after deployment show the existing backlog plus the expected v4 authority-boundary notice:

- `encounter_command_requests` remains RLS-enabled with no direct policies intentionally;
- the generic authenticated `SECURITY DEFINER` warning now includes `encounter_cast_spell_v4`, matching v1-v3 and the guarded tactical RPC pattern;
- existing public storage-bucket listing, auth OTP expiry, leaked-password protection, and Postgres security-patch notices are unrelated to Phase 1L.

Performance advisor results remain the existing hardening backlog:

- tactical unindexed foreign-key notices;
- tactical RLS auth-initplan warnings;
- unrelated unused indexes and multiple permissive policies.

Phase 1L introduced no table or index, so it added no Phase 1L-specific performance structure.

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

Phase 1L is complete. Future rules work should remain a bounded single-target slice unless shared engine semantics are added first for one of the deferred categories.
