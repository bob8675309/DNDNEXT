# Defensive Tactics Runtime — Status

Status: **deployed and rollback-accepted** on PR #170.

## Source split

- **PHB Ranger / PHB Hunter / level 7:** permanent acquisition choice among Escape the Horde, Multiattack Defense, and Steel Will. This remains Forge/progression authority.
- **XPHB Ranger / XPHB Hunter / level 7:** immediate runtime choice between Escape the Horde and Multiattack Defense. A newer Short Rest or Long Rest authorizes one optional replacement.

The current XPHB tactic persists across rests until changed. A rest does not make the existing selection inactive.

## Runtime authority

Migration 83: `defensive_tactics_runtime` (`20260809235754`).

- runtime key: `ranger-hunter-defensive-tactics`
- cadence: `short_or_long_rest`
- sheet projection: `runtimeFeatures.defensiveTactics`
- active encounter blocks configuration
- the same rest cannot be reused for a second change
- no combat effect is implemented by this slice; it stores the source-backed current option only

`CharacterDefensiveTacticsPanel` is mounted in the always-reachable character runtime chain and passes `characterId` plus `p_tactic_key` explicitly to the feature RPC.

## Acceptance

Rollback proof covered:

- exact PHB/XPHB edition split;
- XPHB initial Escape the Horde selection;
- Short-Rest replacement to Multiattack Defense;
- Long-Rest replacement back to Escape the Horde;
- persistent current selection between rests;
- same-rest and active-encounter guards;
- authenticated/service-role RPC authority;
- unchanged combat fields;
- zero fixture residue.

Migration 89 later classifies an unlocked Defensive Tactics replacement as an **optional persistent change**, never as a flashing missing-rest-cycle choice.

## Protected boundaries

No world-map, town/city-map, route/travel/weather, crafting/inventory, or tactical combat execution behavior is changed here.
