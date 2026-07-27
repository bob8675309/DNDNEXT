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

Status: **implemented on feature branch; validation pending/green as recorded below**.

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

## Explicit non-goals of this slice

This foundation does **not** yet:

- persist encounter maps;
- create encounter sessions;
- move canonical characters;
- alter world-map position, route, travel, weather, camp, or clock state;
- enforce turn ownership;
- perform pathfinding around blockers;
- broadcast Realtime state;
- apply HP, attacks, actions, spells, conditions, or initiative;
- register prototype sprite art as production assets.

## Next implementation slice

Phase 1B should introduce only the minimum persistent encounter contracts needed for a GM-authored board:

1. `encounter_maps` reusable board metadata;
2. sparse `encounter_hex_overrides` for terrain/elevation/hazards;
3. `encounter_map_objects` for walls/doors/blockers/spawn/objective markers;
4. admin-only create/update RPCs;
5. read policies suitable for later player encounter membership;
6. board loader/editor on `/encounters` without participant movement authority yet.

After the map definition is stable, Phase 1C can introduce `encounters` and `encounter_participants`, followed by authoritative movement in the later movement phase.

## Validation ledger

| Date | Slice | Result | Notes |
|---|---|---|---|
| 2026-07-27 | Phase 1A axial hex utilities + isolated encounter board | Vercel preview build passed | No existing world-map source or DB behavior changed. |

## Visual asset note

The current sprite concept direction is accepted provisionally. Before bulk sprite registration, one 64×64 production asset should be reviewed in actual animation at native scale and enlarged nearest-neighbor scale. Concept sheets alone are not sufficient to approve motion quality.
