# Tactical Encounter Phase 1 — Board Foundation Status

Last updated: 2026-07-27

This document is the working Phase 1 amendment/status ledger for `Tactical_Encounter_Combat_Roadmap_Blueprint.md` while the master roadmap remains the long-term source of truth.

## Approved architecture carried forward

- Tactical encounter movement is a separate engine from world/town travel and route progression.
- One tactical hex represents 5 feet.
- Encounter positions use axial `(q, r)` coordinates; screen pixels are rendering output only.
- The browser may preview movement, but accepted movement is validated by protected server-side state transitions.
- Canonical characters remain canonical; encounter participants reference them rather than duplicate permanent character data.
- The unified visual target is the 8-direction sprite runtime already adopted by the world renderer. Portrait and sprite selection remain independent, with optional suggested matches.

## Phase 1A — visual/coordinate foundation

Status: **implemented and deployed**.

Implemented:

- `utils/encounterHex.js`
  - 5-foot hex constant;
  - axial/cube conversion;
  - axial distance;
  - axial neighbors;
  - feet ↔ hex conversion;
  - axial-to-pixel projection;
  - pointy-top hex polygon generation;
  - finite hex-disk generation;
  - baseline difficult-terrain movement-cost helper.
- `components/encounter/EncounterHexBoard.js`
  - isolated SVG hex renderer;
  - normal/difficult/blocked cell visualization;
  - movement-budget reachability visualization;
  - selected-cell state;
  - placeholder PC/enemy tokens;
  - no imports from world route/travel/movement modules.
- `pages/encounters.js`
  - first separate tactical route;
  - 20–60 ft. movement sandbox;
  - one hex = 5 ft. readout;
  - axial selected coordinate and direct-distance display;
  - architecture-boundary messaging to prevent accidental coupling to `/map` movement.

## Phase 1B — persistent GM-authored encounter maps

Status: **implemented, validated, schema deployed, and production green**.

Implemented database contracts:

- `encounter_maps`: reusable board metadata, render radius/size, optional background image references, active state, metadata.
- `encounter_hex_overrides`: sparse terrain/elevation/hazard state with normal/difficult/blocked terrain and movement multiplier.
- `encounter_map_objects`: encounter-local doors, walls, spawn/objective markers, traps, chests, hazards, movement/LOS blocking, cover, visibility, and interaction state.

Write authority:

- authenticated clients receive SELECT-only table grants;
- anon receives no map-table read grants;
- direct authenticated INSERT/UPDATE/DELETE is explicitly revoked;
- GM changes use guarded `SECURITY DEFINER` RPCs;
- RPC bodies require admin or service-role authority.

Implemented RPCs:

- `admin_upsert_encounter_map_v1`
- `admin_set_encounter_hex_v1`
- `admin_upsert_encounter_map_object_v1`
- `admin_delete_encounter_map_object_v1`

Implemented `/encounters` workspace:

- persistent board library;
- GM map creation;
- saved board loading;
- per-hex terrain/elevation/hazard editing;
- map object placement/removal;
- object movement/LOS blocking visualization;
- prototype board remains available when no saved map is selected;
- no world-map state is read or changed by these edits.

## Phase 1C — live encounter sessions and staging

Status: **implemented, schema deployed, Realtime enabled, rollback-tested, and production green**.

Implemented database contracts:

- `encounters`
  - references a reusable `encounter_maps` board;
  - lifecycle states: `draft`, `ready`, `initiative`, `active`, `paused`, `resolved`, `archived`;
  - round, turn-index, active-participant marker, phase, version, settings, start/resolution timestamps;
  - encounter-local state only.
- `encounter_participants`
  - references canonical `characters` instead of copying permanent character data;
  - encounter-local team, controller, axial `(q,r)` position, facing, initiative, temporary combat-resource fields, visibility, defeat state, sprite reference, and extensible state JSON;
  - one canonical character may appear only once per encounter.

Authority and visibility:

- authenticated users have SELECT-only grants on session/participant tables;
- anon has no encounter-session table reads;
- direct authenticated writes are revoked;
- GM lifecycle and staging changes use guarded `SECURITY DEFINER` RPCs;
- hidden participants are readable only by admin or their assigned controller;
- `encounters` and `encounter_participants` are in the Supabase Realtime publication with full replica identity.

Implemented RPCs:

- `admin_create_encounter_v1`
- `admin_set_encounter_status_v1`
- `admin_add_encounter_participant_v1`
- `admin_update_encounter_participant_staging_v1`
- `admin_remove_encounter_participant_v1`
- `admin_set_encounter_turn_marker_v1`

Implemented `/encounters/live` workspace:

- encounter-session library and map association;
- GM session creation;
- lifecycle controls;
- canonical-character staging into encounter-local spawn hexes;
- team assignment and initiative entry;
- encounter-local token visualization;
- manual active-turn marker;
- Realtime refresh of encounter and participant state;
- player-facing read-only behavior when not admin.

## Phase 1D — authoritative player turn movement

Status: **implemented on feature branch, schema deployed, rollback-tested, and preview green**.

Implemented movement authority:

- movement allowance comes from canonical `character_sheets.sheet.speed`; participant `speed_ft` is refreshed from that source;
- control resolves through explicit `controller_user_id`, existing `character_permissions.can_edit`, or admin/service-role override;
- only the encounter's `active_participant_id` may submit movement or end its turn;
- movement paths are submitted as ordered axial hex steps, not destination teleports;
- every step must be contiguous and remain inside the encounter-map radius;
- blocked terrain, movement-blocking map objects, and occupied participant hexes are rejected;
- sparse terrain `movement_multiplier` is charged per entered hex, so difficult terrain consumes additional Speed;
- movement cannot exceed the participant's remaining canonical Speed;
- accepted movement updates encounter-local `(q,r)`, six-direction-compatible facing, `movement_spent_ft`, and encounter version only;
- accepted movement never writes world-map `x/y`, route, location, travel, camp, weather, or clock state.

Implemented turn authority:

- initiative order is derived server-side from initiative, initiative tiebreaker, creation order, and participant id;
- defeated participants are skipped;
- `encounter_end_turn_v1` advances the active participant and increments the round when initiative wraps;
- the incoming participant's movement/action/bonus-action/reaction availability is reset at turn start;
- command request UUIDs are stored in a private `encounter_command_requests` ledger so movement and end-turn retries are idempotent.

Implemented RPCs:

- `encounter_can_control_participant_v1`
- `encounter_move_active_participant_v1`
- `encounter_end_turn_v1`
- internal `encounter_canonical_speed_ft_v1` (not executable directly by authenticated clients)

Implemented `/encounters/play` workspace:

- active encounter/session selection;
- active-participant and remaining-Speed readout;
- local one-hex-at-a-time route construction;
- provisional blocked/occupied/budget feedback;
- numbered route preview;
- authoritative **Move** submission;
- authoritative **End Turn** submission;
- Realtime refresh of accepted participant movement and active-turn changes;
- view-only behavior when the logged-in user does not control the active participant.

## Explicit non-goals still in force

Phase 1D does **not** yet:

- move canonical characters on the world map or alter route/travel state;
- implement Dash, Disengage, Dodge, Help, Ready, Hide, Search, Use an Object, or class-specific actions;
- resolve opportunity attacks or other reactions triggered by movement;
- spend Action, Bonus Action, spell slots, item uses, charges, superiority dice, Ki/Focus, Rage, Wild Shape, or other class resources;
- resolve attack rolls, saves, damage, healing, conditions, concentration, death saves, spells, area templates, or cover effects;
- implement flying, climbing, swimming, squeezing, mounts, forced movement, grappling, or creature footprints larger than the current single-hex MVP;
- register prototype sprite art as production assets.

## Next implementation slice

The next slice should build on the stable movement authority rather than bypass it:

1. server-authoritative Action / Bonus Action / Reaction availability transitions;
2. core tactical actions, beginning with Dash, Disengage and Dodge;
3. basic target selection and range validation;
4. attack-roll / AC resolution and damage application as the first combat-resolution path;
5. combat log records for accepted actions and outcomes;
6. opportunity-attack/reaction hooks only after normal action spending is reliable;
7. spell and class-feature automation after the generic action contract is stable.

## Validation ledger

| Date | Slice | Result | Notes |
|---|---|---|---|
| 2026-07-27 | Phase 1A axial hex utilities + isolated encounter board | Vercel preview + production passed | No existing world-map source or DB behavior changed. |
| 2026-07-27 | Phase 1B persistent map tables + GM editor | Vercel preview passed; live migrations applied | World counts remained 2 characters / 20 locations / 4 routes / 9 route points. |
| 2026-07-27 | Phase 1B permission postcheck | Passed after grant hardening | Authenticated has SELECT only; anon read/RPC denied; guarded RPC execute available to authenticated callers. |
| 2026-07-27 | Phase 1B rollback integration rehearsal | Passed | Temporary map, terrain override, and object create/delete all succeeded and rolled back to zero test rows. |
| 2026-07-27 | Phase 1C live-session schema + staging UI | Vercel preview + production passed | Added only encounter-local session/staging surfaces. |
| 2026-07-27 | Phase 1C Realtime + permission postcheck | Passed | Session/participant tables are Realtime-published; authenticated direct writes denied; anon reads denied. |
| 2026-07-27 | Phase 1C rollback lifecycle rehearsal | Passed | Temporary map → encounter → character staging → initiative → active marker → activation succeeded and fully rolled back. |
| 2026-07-27 | Phase 1C world-state postcheck | Passed | 0 test encounters / 0 participants / 0 maps remained; world counts stayed 2 characters / 20 locations / 4 routes / 9 route points. |
| 2026-07-27 | Phase 1D preview build | Passed | Added isolated player movement UI and server movement/turn contracts. |
| 2026-07-27 | Phase 1D movement rejection/idempotency matrix | Passed | Difficult terrain charged correctly; blocked terrain/object, occupancy, noncontiguous, over-budget, and unauthorized movement rejected; retries did not double-apply. |
| 2026-07-27 | Phase 1D player ownership rehearsal | Passed | Existing `character_permissions.can_edit` owner successfully controlled their canonical participant without an explicit controller assignment. |
| 2026-07-27 | Phase 1D turn-order rehearsal | Passed | End Turn advanced by initiative, retry did not advance twice, and wrap incremented round. |
| 2026-07-27 | Phase 1D world-state postcheck | Passed | 0 test encounters / 0 participants / 0 maps / 0 command requests remained; world counts stayed 2 characters / 20 locations / 4 routes / 9 route points. |

## Visual asset note

The current sprite concept direction is accepted provisionally. Before bulk sprite registration, one 64×64 production asset should be reviewed in actual animation at native scale and enlarged nearest-neighbor scale. Concept sheets alone are not sufficient to approve motion quality.
