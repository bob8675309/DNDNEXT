# Tactical Encounter Phase 1 — Board Foundation Status

Last updated: 2026-07-27

This document is the working Phase 1 amendment/status ledger for `Tactical_Encounter_Combat_Roadmap_Blueprint.md` while the master roadmap remains the long-term source of truth.

## Approved architecture carried forward

- Tactical encounter movement is a separate engine from world/town travel and route progression.
- One tactical hex represents 5 feet.
- Encounter positions use axial `(q, r)` coordinates; screen pixels are rendering output only.
- The browser may preview movement, but authoritative movement will later be validated by protected server-side state transitions.
- Canonical characters remain canonical; encounter participants will reference them rather than duplicate permanent character data.
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

Status: **implemented, validated, schema deployed, and approved for production**.

Implemented database contracts:

- `encounter_maps`
  - reusable board metadata;
  - pointy-top axial hex rendering metadata;
  - board radius and render size;
  - optional background image references;
  - active/archive flag and metadata.
- `encounter_hex_overrides`
  - sparse per-hex terrain state;
  - normal/difficult/blocked terrain;
  - movement multiplier;
  - elevation;
  - hazard key and metadata.
- `encounter_map_objects`
  - doors, walls, spawn markers, objectives, traps, chests, hazards, and future object types;
  - encounter-local axial position;
  - movement/LOS blocking;
  - cover level;
  - hidden/default interaction state.

Write authority:

- authenticated clients receive SELECT-only table grants;
- anon receives no map-table read grants;
- direct authenticated INSERT/UPDATE/DELETE is explicitly revoked;
- GM changes use guarded `SECURITY DEFINER` RPCs;
- RPC bodies require admin or service-role authority;
- no participant or combat-state writes exist in this phase.

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

## Explicit non-goals still in force

Phase 1B does **not** yet:

- create live encounter sessions;
- create encounter participants;
- move canonical characters;
- alter world-map position, route, travel, weather, camp, or clock state;
- enforce turn ownership;
- perform authoritative pathfinding around blockers;
- broadcast Realtime combat state;
- apply HP, attacks, actions, spells, conditions, initiative, or resources;
- register prototype sprite art as production assets.

## Next implementation slice

Phase 1C should introduce the minimum live-session contracts:

1. `encounters` session lifecycle (`draft`, `ready`, `initiative`, `active`, `paused`, `resolved`);
2. `encounter_participants` referencing canonical characters/creatures;
3. GM-only participant staging and spawn placement;
4. initiative data model without automated combat resolution yet;
5. Realtime-readable encounter/session state;
6. no player-authoritative movement until the later movement RPC phase.

After those contracts are stable, the movement phase can add server-authoritative path validation, movement budgets, player control, and turn enforcement.

## Validation ledger

| Date | Slice | Result | Notes |
|---|---|---|---|
| 2026-07-27 | Phase 1A axial hex utilities + isolated encounter board | Vercel preview + production passed | No existing world-map source or DB behavior changed. |
| 2026-07-27 | Phase 1B persistent map tables + GM editor | Vercel preview passed; live migrations applied | World counts remained 2 characters / 20 locations / 4 routes / 9 route points. |
| 2026-07-27 | Phase 1B permission postcheck | Passed after grant hardening | Authenticated has SELECT only; anon read/RPC denied; guarded RPC execute available to authenticated callers. |
| 2026-07-27 | Phase 1B rollback integration rehearsal | Passed | Temporary map, terrain override, and object create/delete all succeeded and rolled back to zero test rows. |
| 2026-07-27 | Phase 1B final branch build | Vercel preview passed | Branch remained 0 behind main; only encounter board/UI/docs and two Phase 1B migrations changed. |

## Visual asset note

The current sprite concept direction is accepted provisionally. Before bulk sprite registration, one 64×64 production asset should be reviewed in actual animation at native scale and enlarged nearest-neighbor scale. Concept sheets alone are not sufficient to approve motion quality.
