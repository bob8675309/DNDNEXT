# Tactical Encounter Phase 1 — Board Foundation Status

Last updated: 2026-07-27

This document is the working Phase 1 amendment/status ledger for `Tactical_Encounter_Combat_Roadmap_Blueprint.md` while the master roadmap remains the long-term source of truth.

## Approved architecture carried forward

- Tactical encounter movement is a separate engine from world/town travel and route progression.
- One tactical hex represents 5 feet.
- Encounter positions use axial `(q, r)` coordinates; screen pixels are rendering output only.
- The browser may preview movement, but authoritative movement will later be validated by protected server-side state transitions.
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
- player-facing read-only behavior when not admin;
- no player movement authority yet.

## Explicit non-goals still in force

Phase 1C does **not** yet:

- move canonical characters on the world map;
- alter world-map position, route, travel, weather, camp, or clock state;
- let players directly write participant coordinates;
- validate a submitted tactical path against movement budget, blockers, difficult terrain, occupancy, or turn ownership;
- spend movement, Action, Bonus Action, Reaction, spell slots, item uses, or class resources;
- resolve attacks, saves, damage, healing, conditions, concentration, death saves, or spells;
- register prototype sprite art as production assets.

## Next implementation slice

Phase 1D should establish the **authoritative turn-movement MVP** before combat actions:

1. controller/ownership resolution for each player-controlled participant;
2. initiative-order derivation and controlled round/turn advancement;
3. server-authoritative movement budgets derived from canonical Speed;
4. path submission as contiguous axial hex steps rather than destination-only movement;
5. blocker, occupancy, board-boundary, and difficult-terrain validation;
6. protected `encounter_move_participant_v1` and `encounter_end_turn_v1` RPCs with request IDs/idempotency;
7. player UI that previews routes locally but commits only accepted server movement;
8. Realtime synchronization of accepted movement and active turns.

Combat attacks/spells remain a later phase after this movement/turn authority is stable.

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

## Visual asset note

The current sprite concept direction is accepted provisionally. Before bulk sprite registration, one 64×64 production asset should be reviewed in actual animation at native scale and enlarged nearest-neighbor scale. Concept sheets alone are not sufficient to approve motion quality.
