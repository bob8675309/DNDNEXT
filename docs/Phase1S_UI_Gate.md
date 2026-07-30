# Phase 1S UI Gate

This branch is the isolated combat UI gate for XPHB Word of Radiance after the Phase 1S server baseline reached production at `c4f39180ce4aba3523268fa4bc914ee21d550df7`.

The branch must pass the complete tactical spell validator suite and a Next production build before integration. The new area UI keeps the existing single-target spell state and v1-v10 routing intact, while Word of Radiance alone uses explicit `areaTargetIds` and `encounter_cast_area_spell_v1`.

No world-map, town-map, merchant, crafter, travel, weather, or world-simulation behavior is part of this gate.
