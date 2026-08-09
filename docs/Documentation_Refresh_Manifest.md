# Documentation Refresh Manifest

Updated: 2026-08-09

## Trust order

For active PR #170 work, trust sources in this order:

1. live Supabase schema/migrations/grants/data;
2. current PR source and exact-head CI/Vercel;
3. dedicated runtime/progression ledgers;
4. broader roadmap/history prose.

If prose conflicts with live source/database state, live authority wins until docs are corrected.

## Current PR #170 runtime checkpoint

Production is accepted through **migration 81**.

Recent sequence:

- 74-75 — Wizard Memorize Spell;
- 76 — shared Wizard runtime helper repair;
- 77 — PHB Wizard Cantrip Formulas;
- 78 — Armorer Armor Model + shared `short_or_long_rest` cadence repair;
- 79 — Bestial Soul runtime;
- 80 — Bestial Soul list-item option resolver fix;
- 81 — XPHB Wild Heart Aspect of the Wilds runtime.

Latest registered migration: `wild_heart_aspect_runtime` (`20260809232923`).

## Authoritative recent ledgers

Read before modifying these areas:

- `Wizard_Memorize_Spell_Runtime_Status.md`
- `Wizard_Cantrip_Formulas_Runtime_Status.md`
- `Armorer_Armor_Model_Runtime_Status.md`
- `Bestial_Soul_Runtime_Status.md`
- `Wild_Heart_Aspect_Runtime_Status.md`
- `Boon_Energy_Resistance_Runtime_Status.md`
- `Feat_Runtime_Expertise_Status.md`
- `Cartomancer_Runtime_Status.md`
- `DNDNext_Current_Handoff_Prompt.md`

Older runtime ledgers remain authoritative for their accepted slices unless contradictory live evidence exists.

## Modeling rule

- permanent source-owned acquisition → Forge/progression authority;
- rest-configurable choice → runtime authority;
- next-rest-expiring choice → rest-anchored runtime state whose getter treats stale state as inactive;
- per-use/per-cast choice → action/spell resolver;
- informational/always-on feature → display/consumer logic.

Accepted contrasts:

- Armor Model: immediate initial choice; Short/Long-Rest replacement; persists until changed.
- Bestial Soul: first choice after a qualifying Short/Long Rest; expires at the next qualifying rest.
- Aspect of the Wilds: immediate initial choice; **Long-Rest-only** replacement; persists through rests until changed.

## Current production integrity

After migration 81 and rollback-only acceptance:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 18 inventory rows;
- 0 live Aspect runtime rows;
- 0 Aspect QA characters;
- 20 locations;
- 4 map routes;
- 9 map route points.

Migration-81 candidate head `0c51a7ab905a623106f9d1a77b71912a0a2b0508` passed all 28 PR workflows and Vercel before deployment.

## Next bounded audit

Next source family: **Hunter's Prey**. Do not infer its lifecycle from Wild Heart/Bestial; inspect exact class/subclass source, level, option shape, acquisition choice, and rest replacement language first.

After that, known queue candidates include Defensive Tactics and Phantom Whispers of the Dead.

## Remaining PR closure work

- finish the bounded source-family sweep;
- progression RPC/ACL cleanup where live grants still prove a gap;
- final authenticated browser acceptance;
- action-layer-only integrations that were explicitly deferred;
- final documentation/PR reconciliation;
- merge only after exact-head closure gates pass.

## Protected boundaries

This work does not authorize changes to world-map, town/city-map, route/travel/weather, unrelated crafting/inventory, or tactical action execution. `components/MapPageClient.js` remains outside current scope unless explicitly requested.
