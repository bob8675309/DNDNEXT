# Tactical Encounter Phase 1V — Healing Word

Status: **SERVER SOURCE READY / LIVE MIGRATION + UI PENDING**

Phase 1V adds the XPHB **Healing Word** and establishes the 2024 Bonus Action spellcasting / one-spell-slot-per-turn authority rule for the reviewed tactical spell engine.

## Reviewed XPHB spell

The live canonical definition is:

- Bard / Cleric / Druid level 1;
- Bonus Action;
- 60-foot range;
- a creature of the caster's choice that the caster can see;
- `2d4 + spellcasting ability modifier` Hit Points restored at level 1;
- `+2d4` healing for each slot level above 1;
- instantaneous and non-concentration.

Aurelia Dawnmere is the existing Cleric fixture that can exercise the reviewed XPHB version after validation. A permanent assignment is intentionally deferred until server + UI production gates are complete.

## One spell slot per turn

The 2024 spellcasting rule permits only one spell slot to be expended to cast a spell on a turn. This is independent of whether that spell uses the Magic action, Bonus Action, or another casting time.

`private.encounter_enforce_spell_slot_cast_turn_v1(caster, assignment, request_id)` is the shared tactical authority guard. For a leveled spell assignment it locks the active encounter row, then checks the authoritative current round/turn combat log for an earlier `spell_cast` by the same caster with a positive `slotLevel`.

The current request ID is excluded so an idempotent replay of the same successful cast still returns the stored result instead of being rejected as a second slot expenditure.

Cantrips bypass the guard because they expend no spell slot. This means Healing Word followed by an Action cantrip remains legal, while Healing Word plus Cure Wounds, False Life, Inflict Wounds, Guiding Bolt, or another Healing Word on the same turn is rejected.

The encounter-row lock serializes concurrent slotted-spell attempts so two requests cannot both pass the preflight before either combat-log row exists.

## Legacy compatibility hardening

The established public implementations that currently own reviewed slotted spells are preserved under service-only names:

- `encounter_cast_spell_v1_pre_1v` — Cure Wounds owner / Fire Bolt compatibility path;
- `encounter_cast_spell_v5_pre_1v` — False Life owner;
- `encounter_cast_spell_v6_pre_1v` — Inflict Wounds owner;
- `encounter_cast_spell_v11_pre_1v` — Guiding Bolt owner and canonical reviewed spell-attack resolver.

Public v1, v5, v6, and v11 remain authenticated/service compatibility entry points, but each calls the shared slot-turn guard before entering its preserved implementation. The preserved `*_pre_1v` functions are not executable by authenticated or anon clients.

Higher reviewed version chains continue to delegate through these guarded public entry points, so an old client cannot bypass the 2024 one-slot rule by choosing an older reviewed RPC.

## Healing Word v13

`public.encounter_cast_spell_v13(caster, assignment, target, slot_level, request_id)` delegates every non-Healing-Word spell to v12 and owns only `healing-word|XPHB`.

The adapter requires:

- reviewed XPHB level-1 spell definition;
- class-source assignment;
- prepared or always-available state;
- canonical class spellcasting profile;
- assignment source label matching the canonical class;
- the spell actually appearing on that canonical class's spell list;
- assignment casting ability matching the canonical class casting ability;
- active turn, controller/service authority, available Bonus Action, and existing incapacitation fail-closed guards;
- a visible target within 60 feet; self-targeting is explicitly supported at distance 0;
- one eligible remaining spell-slot pool at the selected level;
- no earlier spell-slot expenditure to cast a spell on the current encounter turn.

On success, v13 rolls `2d4` per slot level, adds the canonical casting ability modifier once, and resolves through `encounter_apply_healing_internal_v1`, preserving Chill Touch healing prevention and defeated/0-HP recovery semantics already owned by that helper.

The cast spends exactly one spell slot and the caster's Bonus Action. It does **not** spend the caster's Action. The combat-log result records `actionType=bonus_action`, the slot level, remaining slots, healing breakdown, and `oneSpellSlotPerTurn=true`.

v13 remains request-ID idempotent and delegates all established reviewed spell behavior to v12 unchanged.

## Validation plan

Before live migration:

1. run the complete tactical validator suite and Next build on the exact Phase 1V server head;
2. prove the four public legacy wrappers preserve their established implementation chain while the renamed pre-1V bodies are service-only;
3. apply the migration only after the exact source gate is green;
4. transactionally add a temporary Aurelia Healing Word class assignment and encounter fixture;
5. verify Healing Word spends Bonus Action + one slot, leaves Action available, and heals with `2d4 + WIS` at level 1;
6. verify duplicate request idempotency;
7. verify a second Healing Word on the same turn is rejected without extra slot/Bonus Action spend;
8. verify Cure Wounds / False Life / Inflict Wounds / Guiding Bolt are rejected after Healing Word through their existing public entry points;
9. verify the reverse order: a reviewed slotted Action spell first blocks Healing Word while leaving Bonus Action unspent;
10. verify an Action cantrip after Healing Word remains legal;
11. verify a cantrip before Healing Word remains legal;
12. verify Chill Touch healing prevention still produces a successful cast with prevented healing while spending the slot/Bonus Action exactly once;
13. rollback all temporary assignment, encounter, slot, command, log, HP, and action-economy state;
14. then gate combat UI exposure separately before adding Aurelia's permanent reviewed assignment.

## Isolation

Phase 1V is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1V starts from production-green Phase 1U `main` commit `6a63f29be27d0a9435ba6f9ccfa726e9ee6462fc`: 5 characters, 13 reviewed spell assignments, 0 Vicious Mockery assignments, all tactical fixture/effect tables at zero, and the protected world baseline of 20 locations / 4 routes / 9 route points.
