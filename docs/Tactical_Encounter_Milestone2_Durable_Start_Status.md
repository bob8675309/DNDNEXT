# Tactical Encounter Milestone 2 — Durable Start Authority

Status: **DURABLE START + SMOKE SETUP HELPER COMPLETE / MILESTONE 2 IN PROGRESS**

Last reconciled: 2026-08-02

This ledger records the production work that prepares Milestone 2 for its first real durable campaign encounter. It does **not** mark the milestone complete. The remaining acceptance gate is a persistent reusable encounter exercised over multiple rounds and reconnects with one GM and at least two distinct player sessions.

## Production evidence

- PR #113, **Milestone 2: durable encounter start**, squash-merged as `8028813cb0ca665d06271946198f2db331d79cf2`.
- PR #114, **Milestone 2: guard legacy encounter activation**, squash-merged as `e1cfdf9d83ecd18a79fb5ac27db55ae5e96758de`.
- PR #116, **Milestone 2: add durable smoke setup**, squash-merged as `09b48ff839af105a0ae0bed61611eceb6eefdc86` from validated head `b2c9e65cadbe357e1335e9374a66098b111eb045`.
- Exact PR heads and merged production commits received green Vercel deployments after their final reviewed changes.
- Supabase migrations:
  - `20260731031421 tactical_durable_encounter_start`;
  - `20260731032917 tactical_encounter_lifecycle_guard`.
- The helper has now produced its intended durable tactical rows. Current protected live baseline: 5 characters, 17 character-spell assignments, 1 encounter map, 5 encounters, 16 participants, 20 combat-log rows, 2 resolved reaction windows, 20 locations, 4 world routes, and 9 world route points.

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
- Admin staging now loads the RLS-protected `players` roster and assigns or clears a participant controller through the existing guarded staging RPC; no Auth table is exposed to the browser.

## Smoke setup helper delivered

`/encounters/smoke` is now the GM-only preparation surface for the first Milestone 2 smoke encounter. It deliberately composes the already-reviewed guarded encounter RPCs instead of adding a test-only database bypass.

The helper:

- verifies the current session is an Admin and confirms the four canonical smoke actors exist;
- creates or reuses one active tactical map identified by `milestone2-smoke-arena-v1` metadata;
- prepares a radius-6 arena with three difficult-terrain hexes, one movement/LOS-blocking total-cover pillar, and one half-cover low wall;
- creates or reuses one staged smoke session identified by `milestone2-smoke-session-v1` metadata;
- stages Pip Quillspark, Raska Stonejaw, Letho, and Aurelia Dawnmere through `admin_add_encounter_participant_v1`;
- repairs/reapplies the intended teams, coordinates, and initiative through `admin_update_encounter_participant_staging_v1`;
- preserves an existing participant controller assignment when repairing a partially prepared session;
- moves the prepared session only to `initiative`; it never calls `admin_start_encounter_v1` and therefore never auto-starts combat;
- is idempotent for the reusable map and an unfinished staged smoke session; if a prior smoke encounter is already active/resolved, the next preparation can create a fresh staged session on the same map;
- performs no direct `.insert`, `.update`, `.upsert`, or `.delete` calls against encounter state.

The live database contains one reusable smoke arena and an active smoke encounter at Round 6 / Version 63. The helper's active-session guard must preserve this encounter without restaging participants or resetting initiative.

## Live smoke acceptance through Version 63

- Crafted/equipped Dagger, Spear, Rapier, and opportunity-attack weapon paths resolved from canonical inventory.
- Movement, difficult terrain, Dodge disadvantage, reactions, saves, healing, Temporary HP, spell slots, single-target casting, and multi-target Magic Missile were exercised across the durable session.
- Duplicate request replay produced one command/log/damage application; stale-client input was rejected without a version or state change.
- Pause/resume preserved the full turn snapshot.
- Campaign-owner browser acceptance confirmed Round 6 reconstruction after tab-away/tab-return and refresh, including HP, position, active turn, character sheet, and equipped armor identity.
- Current handoff remains Round 6 / Version 63 with Pip active at 5 HP and no pending reaction window.

## Validation

- `check:tactical-durable-start` covers both server migrations plus the staging UI contract.
- `check:tactical-smoke-setup` guards the new smoke page, required actors/RPCs, no-auto-start rule, direct-write prohibition, and world/town isolation tokens.
- The complete tactical spell validator suite through Phase 1Z remains green.
- Both tactical Milestone 2 checks are part of `scripts/vercel_build_v2.mjs` before the tactical spell suite.
- The smoke validator is invoked through its package command so the existing handoff-doc / runner-script alignment contract remains intact.
- PR changed-file audits confirmed the smoke helper work stayed inside tactical encounter, validation, package/build-runner, and documentation surfaces.
- No world-map or town/city-map runtime file changed.

## Remaining Milestone 2 work

1. Create two additional player accounts and keep them signed in through separate browser sessions. The live project currently has one Auth user, so the GM + Player A + Player B gate is not yet claimable.
2. Prepare a fresh staged session on the reusable smoke map; do not repair or reset the active Round 6 / Version 63 session.
3. In `/encounters/live`, assign participant controllers from the Admin-only player roster and start through `admin_start_encounter_v1`.
4. Run the three-session ownership, turn-sync, movement-sync, reconnect, stale-client, reaction-owner, and GM-override matrix.
5. Resolve/archive and verify cleanup only after the multi-client evidence is recorded. Then reconcile campaign state while preserving the reusable tactical map and all world/town state.

## Guardrails retained

- Tactical coordinates and state never mutate world routes, travel, weather, camps, world clock, or town/city positioning.
- Canonical characters, sheets, inventory/equipment, spellbooks, classes, and progression remain source of truth.
- Realtime remains a synchronization signal; database state is authoritative.
- Existing versioned tactical RPCs remain compatibility contracts unless explicitly superseded with validator-backed equivalence.
