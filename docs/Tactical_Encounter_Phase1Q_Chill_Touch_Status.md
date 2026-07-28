# Tactical Encounter Phase 1Q — Chill Touch

Status: **SERVER + COMBAT UI DEPLOYED / VALIDATED**

Phase 1Q added a third tactical duration boundary, **source-turn-end**, and used it for the reviewed XPHB version of **Chill Touch**.

## Reviewed adapter

Chill Touch is the XPHB Wizard-compatible cantrip: Action, Touch, melee spell attack, 1d10 Necrotic scaling at character levels 5/11/17, and on a hit the target cannot regain Hit Points until the end of the caster's next turn.

Pip Quillspark's permanent reviewed assignment is `03201317-0c4e-40bc-a7fd-f792a41260d6` (`class` / `Wizard` / prepared / `int`).

## Server contract

`public.encounter_cast_spell_v9(caster, assignment, target, slot_level, request_id)` delegates all Phase 1I-1P adapters to v8 and owns only `chill-touch|XPHB`.

The server preserves active-turn/controller/Action authority, exact class/XPHB assignment, Touch range, LOS, Dodge disadvantage, cover AC, natural 1/20, critical dice, typed Necrotic damage, and fail-closed active-Condition handling.

`encounter_timed_effects.expiry_trigger` supports:

- `target_turn_start` — Phase 1O;
- `source_turn_start` — Phase 1P;
- `source_turn_end` — Phase 1Q.

Chill Touch applies `chill_touch_no_healing` with two source-turn-end triggers: current turn end decrements 2→1, and the end of the caster's next turn expires it.

`public.encounter_apply_healing_internal_v1` centrally enforces the lock. Blocked healing applies 0 HP and does **not** mutate HP or defeated state; a defeated target at 0 HP stays defeated. Normal healing/revival behavior is unchanged after expiry.

## Deployment and validation

Production migration:

- `20260728193929 tactical_chill_touch`

Server validation and rollback proved damage, critical scaling, one Action spend, request idempotency, normal-HP and 0-HP healing prevention, defeated-state preservation, source-turn-end decrement/expiry, restored healing after expiry, private helper privileges, and zero surviving tactical fixture rows.

The server-safe ancestry was rebased through PR #86 and production-verified on main at `07db67a3c9ba1f376139ec4c9ef152d642c470b6` before UI exposure.

## Combat UI

The separately gated UI:

- exposes Chill Touch as the tenth reviewed tactical adapter;
- routes only Chill Touch through v9 while preserving v1-v8 routing;
- presents 5-foot melee spell attack rules, d10 Necrotic scaling, and source-next-turn-end no-healing duration;
- renders the healing-prevention rider in combat results/logs;
- makes Cure Wounds explicitly report healing prevention rather than falsely presenting a successful 0-HP heal.

The exact UI head `72cfd2b73a0cc6c774c0a6b80cef5fcb381aa704` passed all **19 tactical validators** plus Next compilation. PR #87 rebased the UI ancestry linearly to `main` at `663351cabed8721a896181accd371a96e6572750`, and the resulting Vercel production deployment completed successfully.

Final live integrity after production:

- characters: 5;
- reviewed `character_spells`: 10;
- Pip Chill Touch assignments: 1;
- encounter maps/sessions/participants/commands/logs/slot rows/reaction windows/timed effects: 0;
- locations/routes/route points: 20 / 4 / 9.

## Isolation

Phase 1Q is tactical-only. World travel, routes, weather, camps, town maps, and world simulation were not changed.

Phase 1Q is complete. Phase 1R starts from production main `663351cabed8721a896181accd371a96e6572750`.
