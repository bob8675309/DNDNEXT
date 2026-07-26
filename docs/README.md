# DNDNext Living Documentation Index

This directory contains the project's living handoff, roadmap, and architecture documents. When starting a new work session, use the document that matches the subsystem being changed and update it when a milestone or architectural decision changes.

## Long-term roadmaps

- [`Tactical_Encounter_Combat_Roadmap_Blueprint.md`](./Tactical_Encounter_Combat_Roadmap_Blueprint.md) — master roadmap for the future hex-grid encounter/dungeon system, multiplayer turn engine, D&D 5e combat automation, portrait/sprite strategy, GM tools, and phased delivery plan.
- [`Tactical_Encounter_Phase0_Status.md`](./Tactical_Encounter_Phase0_Status.md) — active Phase 0 ledger for portrait/sprite independence, 8-direction sprite standards, renderer migration, and first production sprite batches.
- [`Security_Hardening_Roadmap_Status.md`](./Security_Hardening_Roadmap_Status.md) — completed and deferred security/database hardening work.

## Current subsystem handoffs

- [`Town_Crafter_Current_Status.md`](./Town_Crafter_Current_Status.md) — current town crafter/profile-panel state and guardrails.
- [`Source_Patch_Pipeline_Audit.md`](./Source_Patch_Pipeline_Audit.md) — source-bake / validator / patch-pipeline handoff.

## Tactical encounter roadmap rule

`Tactical_Encounter_Combat_Roadmap_Blueprint.md` is the source of truth for the encounter system's end goals. As implementation progresses:

1. update phase/task checkboxes or the linked active phase ledger;
2. record meaningful commits/migrations in its Progress Ledger or active phase ledger;
3. record major architecture choices in its Decision Log;
4. add unresolved decisions to Open Design Decisions instead of silently deciding them inside unrelated patches;
5. preserve the roadmap's world-map separation and server-authority guardrails unless those guardrails are explicitly revised.
