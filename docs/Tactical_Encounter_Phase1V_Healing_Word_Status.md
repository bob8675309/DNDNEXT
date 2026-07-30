# Tactical Encounter Phase 1V — Healing Word

Status: **SERVER + COMBAT UI DEPLOYED / VALIDATED; PHASE COMPLETE**

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

Aurelia Dawnmere is the existing Cleric fixture for the reviewed XPHB version. After the server and UI production gates passed, assignment `fbd5b933-55ba-472e-9a19-f5155c9c4f61` added Healing Word as a prepared class/Cleric/Wisdom spell.

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

## Server deployment and validation

PR #98 (`Phase 1V server: Healing Word and slotted-spell turn guard`) merged the reviewed server source. Supabase migration `20260730055827 tactical_healing_word` is live.

Transactional rollback validation completed the original server plan:

- Healing Word spent Bonus Action + one slot and left Action unchanged;
- the returned healing formula was `2d4 + WIS` at level 1 and scaled by `+2d4` per upcast level;
- duplicate request IDs returned the stored result without a second spend;
- a second Healing Word and established Cure Wounds / False Life / Inflict Wounds / Guiding Bolt paths were blocked after a slotted cast;
- the reverse order blocked Healing Word without spending its Bonus Action;
- Healing Word plus an Action cantrip remained legal in either order;
- Chill Touch prevention still spent the slot and Bonus Action exactly once without restoring HP;
- all temporary assignment, encounter, slot, command, log, HP, and action-economy fixtures were rolled back.

Post-validation state remained 5 characters, 13 reviewed spell assignments, 0 Healing Word assignments, zero tactical encounter rows, and the protected 20-location / 4-route / 9-route-point baseline.

## Combat UI deployment

PR #99 deployed the reviewed adapter to `/encounters/combat`:

- v13 routing for Healing Word while all older spell routes remain unchanged;
- 60-foot selection including self and defeated/0-HP targets;
- Bonus Action readiness instead of the established Action readiness used by other spells;
- a current-turn slot-spend preflight that mirrors the server guard while keeping the server authoritative;
- selected-slot `2d4`-per-level healing display, casting-ability modifier context, slot feedback, healing-prevention feedback, and combat-log action-economy detail;
- a focused UI validator wired into the full tactical spell suite.

The exact UI head `ddac2d04ccc905781549cdb8d88f2564f336d821` passed Vercel before merge. Rebase-merged production `main` commit `76b093e2b7b4c61f8bec9fbd684683215c703906` then passed its independent Vercel deployment.

## Completed validation sequence

Sequence status:

1. complete tactical server suite and exact-head Next build — **passed**;
2. prove guarded compatibility wrappers and service-only preserved bodies — **passed**;
3. apply migration `20260730055827 tactical_healing_word` — **live**;
4. run temporary Aurelia/encounter rollback matrix — **passed and rolled back**;
5. implement and validate the isolated combat UI adapter — **passed**;
6. pass exact-head deployment and production checks — **passed**;
7. add Aurelia's permanent reviewed assignment and recheck tactical/world postconditions — **passed**.

## Isolation

Phase 1V is tactical-only. It does not modify world travel, routes, weather, camps, town maps, merchants, crafters, or world simulation.

Phase 1V server work started from production-green Phase 1U commit `6a63f29be27d0a9435ba6f9ccfa726e9ee6462fc`. The reviewed server head was `bcca9721c2148938f6a83a1af0be32ee989a0f31`; PR #98 was incorporated into `main` at `68d4513721e9f705e2d10be33e81bb708fdbd993`.

Final protected baseline: 5 characters, 5 character sheets, 5 progression rows, 14 reviewed spell assignments, exactly 1 Healing Word assignment on Aurelia, zero tactical fixture rows, 20 locations, 4 world routes, and 9 world route points.
