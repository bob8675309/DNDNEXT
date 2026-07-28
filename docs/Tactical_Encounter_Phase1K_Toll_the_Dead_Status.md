# Tactical Encounter Phase 1K — Toll the Dead

Status: **SERVER + COMBAT UI DEPLOYED / VALIDATED**

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

Production migration:

- `20260728014526 tactical_toll_the_dead`

Repository migration:

- `sql/20260728_01_tactical_toll_the_dead.sql`

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

The live campaign intentionally retains three NPC Forge characters in Xul for tactical testing:

- **Aurelia Dawnmere** — Aasimar Cleric 2, Arena Chirurgeon;
- **Pip Quillspark** — Halfling Wizard 2, Arena Arcanist;
- **Raska Stonejaw** — Orc Fighter 2, Arena Sparring Guard.

They were created through the normal NPC Forge character contract with source-backed progression and portraits. Persistent reviewed tactical spell assignments are now:

- Aurelia — Sacred Flame, Cure Wounds, Toll the Dead;
- Pip — Fire Bolt.

Toll the Dead was granted to Aurelia using the same canonical Spellbook assignment semantics as the live admin UI: `source_type=class`, source label `Cleric`, casting stat `wis`, and no spell-slot resource because it is a cantrip.

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

## Postdeploy server validation

After applying `20260728014526 tactical_toll_the_dead`, the same behavioral fixture was run against the deployed `encounter_cast_spell_v3` without redefining the function.

Verified again:

- full-health target uses `1d8`;
- wounded target uses `1d12`;
- Wisdom save uses one d20 even while the target is Dodging;
- duplicate request IDs return the stored result;
- cantrip consumes no spell slot;
- all temporary encounter data rolls back.

Execution privileges were rechecked:

- v1: authenticated `true`, anon `false`, service role `true`;
- v2: authenticated `true`, anon `false`, service role `true`;
- v3: authenticated `true`, anon `false`, service role `true`.

## Combat UI

`pages/encounters/combat.js` now exposes Toll the Dead alongside Fire Bolt, Cure Wounds, and Sacred Flame.

Routing remains versioned:

- Fire Bolt / Cure Wounds → `encounter_cast_spell_v1`;
- Sacred Flame → `encounter_cast_spell_v2`;
- Toll the Dead → `encounter_cast_spell_v3`.

The UI:

- uses the existing offensive spell target filter;
- applies a 60-foot client preflight for Toll the Dead;
- reads participant `max_hp` only to preview whether the current target is full health or wounded;
- displays `WIS vs DC` from the canonical spellcasting profile;
- explains that full-health targets use d8 and wounded targets use d12;
- explains that cover does not modify the Wisdom save while total cover still blocks LOS;
- renders the server-returned save total, DC, damage die, wounded/full-health state, necrotic damage, and damage affinity result;
- leaves final HP-state, save, die choice, damage, Action spend, idempotency, LOS, and range authority on the server.

The old Phase 1J UI validator was made forward-compatible while retaining Sacred Flame's v2 routing and cover-save contracts. A dedicated Phase 1K UI validator was added:

- `scripts/validate_tactical_toll_the_dead_ui.mjs`
- npm: `check:tactical-toll-the-dead-ui`

The standalone server validator remains:

- `scripts/validate_tactical_toll_the_dead.mjs`
- npm: `check:tactical-toll-the-dead`

The code-bearing Phase 1K branch build is green in Vercel.

## Final live baseline

Intentional live state after Phase 1K server deployment and the persistent Toll assignment:

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

The additional three characters and four reviewed spell assignments are intentional persistent campaign data. Tactical encounter fixtures remain zero. World/town systems are untouched.

## Advisor review

Security advisor results after deployment show the expected existing backlog:

- `encounter_command_requests` RLS-enabled/no-policy informational notice remains intentional;
- the generic authenticated `SECURITY DEFINER` warning now includes `encounter_cast_spell_v3`, matching the existing guarded tactical authority-boundary pattern;
- existing storage-bucket listing, OTP-expiry, leaked-password-protection, and Postgres security-patch warnings remain unrelated to Phase 1K.

Performance advisor results remain the existing hardening backlog:

- tactical unindexed foreign-key notices;
- tactical RLS auth-initplan warnings;
- unrelated unused indexes and multiple permissive policies.

Phase 1K introduced no table or index and therefore no new Phase 1K-specific performance structure.

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

Next rules work should remain a bounded single-target slice unless the encounter engine first gains the missing shared semantics required by one of the deferred categories.
