# Tactical Encounter Milestone 2 — Durable Start Authority

Status: **START-AUTHORITY SLICE COMPLETE / MILESTONE 2 IN PROGRESS**

Last reconciled: 2026-07-30/31

This ledger records the first production slice of Milestone 2. It does **not** mark the durable campaign encounter milestone complete. The remaining acceptance gate is a real reusable encounter exercised over multiple rounds and reconnects with one GM and at least two distinct player sessions.

## Production evidence

- PR #113, **Milestone 2: durable encounter start**, squash-merged as `8028813cb0ca665d06271946198f2db331d79cf2`.
- PR #114, **Milestone 2: guard legacy encounter activation**, squash-merged as `e1cfdf9d83ecd18a79fb5ac27db55ae5e96758de`.
- Exact PR heads and both merged production commits received green Vercel deployments.
- Supabase migrations:
  - `20260731031421 tactical_durable_encounter_start`;
  - `20260731032917 tactical_encounter_lifecycle_guard`.
- Post-deploy protected baseline remained exact: 5 characters, 17 character-spell assignments, no persistent tactical fixture rows, 20 locations, 4 world routes, and 9 world route points.

## Server authority delivered

`public.admin_start_encounter_v1(uuid)` is the guarded staged-to-active transition. It:

- requires Admin or service-role authority;
- locks the encounter and only accepts `draft`, `ready`, or `initiative` sessions;
- requires an active tactical map;
- requires at least one non-defeated participant and initiative for every non-defeated participant;
- rejects participants staged outside the map radius;
- rejects blocked start hexes and duplicate occupied start hexes;
- chooses the first turn deterministically by initiative, initiative tiebreaker, creation time, then participant id;
- resets movement, Action, Bonus Action, Reaction, Disengage, Dodge, canonical Speed, and turn-start state for the staged participants;
- activates the encounter at round 1 / turn index 0 with the first participant as authority owner;
- writes an `encounter_started` combat-log event;
- is executable by `authenticated` and `service_role`, not `anon`.

The existing `admin_set_encounter_status_v1(uuid,text)` remains a compatibility entry point. A staged request for `active` delegates to `admin_start_encounter_v1`; a paused encounter can still resume through the existing status path without resetting the active turn.

## Client staging delivered

`/encounters/live` now represents the current tactical engine instead of Phase 1C:

- stale “movement locked” and presentation-only turn-marker guidance is removed;
- Turn Play, Combat, and Map Workshop are directly linked;
- durable encounter metadata replaces Phase 1C fixture labels;
- staging exposes Draft / Ready / Initiative followed by **Start encounter**;
- Start is disabled until the staged initiative requirement is satisfied;
- active encounters expose Pause / Resolve;
- paused encounters expose Resume / Resolve;
- resolved encounters expose Archive;
- normal GM flow no longer rewrites the active participant manually; guarded End Turn owns turn advancement.

## Validation

- `check:tactical-durable-start` covers both server migrations plus the staging UI contract.
- The complete tactical spell validator suite through Phase 1Z remains green.
- The durable-start validator is part of `scripts/vercel_build_v2.mjs` before the tactical spell suite.
- PR changed-file audits confirmed the work stayed inside tactical encounter, validation, and migration surfaces.
- No world-map or town/city-map runtime file changed.

## Remaining Milestone 2 work

1. Create one reusable tactical map and durable smoke encounter.
2. Stage representative canonical PCs/NPCs/enemies. Letho, Aurelia Dawnmere, Pip Quillspark, and Raska Stonejaw remain suitable existing actors.
3. Run several full rounds with one GM and at least two distinct player sessions.
4. Exercise movement, difficult terrain/occupancy, weapons, reactions, saves, healing, Temporary HP, spell slots, single-target and AoE casting, End Turn, pause/resume, reconnect, duplicate/stale commands, resolve/archive, and cleanup.
5. Record real usability failures before adding more spell breadth or moving to the shared 5e rules milestone.

At reconciliation the live project has only one Auth user, so the GM + two distinct player-session acceptance test cannot yet be claimed complete.

## Guardrails retained

- Tactical coordinates and state never mutate world routes, travel, weather, camps, world clock, or town/city positioning.
- Canonical characters, sheets, inventory/equipment, spellbooks, classes, and progression remain source of truth.
- Realtime remains a synchronization signal; database state is authoritative.
- Existing versioned tactical RPCs remain compatibility contracts unless explicitly superseded with validator-backed equivalence.
