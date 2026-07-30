# DNDNext Living Documentation Index

This directory contains the project's living handoff, roadmap, and architecture documents. When starting a new work session, use the document that matches the subsystem being changed and update it when a milestone or architectural decision changes.

## Long-term roadmaps

- [`Tactical_Encounter_Combat_Roadmap_Blueprint.md`](./Tactical_Encounter_Combat_Roadmap_Blueprint.md) — master roadmap for the future hex-grid encounter/dungeon system, multiplayer turn engine, D&D 5e combat automation, portrait/sprite strategy, GM tools, and phased delivery plan.
- [`Tactical_Encounter_Phase0_Status.md`](./Tactical_Encounter_Phase0_Status.md) — Phase 0 ledger for portrait/sprite independence, the unified 8-direction sprite runtime, renderer migration, and first production sprite batches. **Its explicit Phase 0 amendments supersede older master-roadmap statements about retaining the retired 4-direction sprite format.**
- [`Tactical_Encounter_Phase1_Foundation_Status.md`](./Tactical_Encounter_Phase1_Foundation_Status.md) — Phase 1 board/session/movement foundation through authoritative player turn movement.
- [`Tactical_Encounter_Phase1E_Core_Combat_Status.md`](./Tactical_Encounter_Phase1E_Core_Combat_Status.md) — first server-authoritative action economy, Unarmed Strike, HP/AC encounter state, and Realtime combat log.
- [`Tactical_Encounter_Phase1F_Weapon_Combat_Status.md`](./Tactical_Encounter_Phase1F_Weapon_Combat_Status.md) — canonical equipped weapon profiles plus melee/thrown/ranged attack and typed weapon-damage foundations.
- [`Tactical_Encounter_Phase1G_LOS_Cover_Saves_Damage_Status.md`](./Tactical_Encounter_Phase1G_LOS_Cover_Saves_Damage_Status.md) — deterministic LOS, cover, server saves, generic typed damage, and damage-affinity foundations.
- [`Tactical_Encounter_Phase1H_Reactions_Effects_Status.md`](./Tactical_Encounter_Phase1H_Reactions_Effects_Status.md) — opportunity-reaction timing, Disengage suppression, healing, generic effects, and structured-condition foundations.
- [`Tactical_Encounter_Phase1I_Spell_Foundation_Status.md`](./Tactical_Encounter_Phase1I_Spell_Foundation_Status.md) — current combat ledger for canonical caster profiles and encounter-local spell-slot snapshots before the first guarded casting RPC.
- [`Tactical_Encounter_Phase1J_Save_Spells_Status.md`](./Tactical_Encounter_Phase1J_Save_Spells_Status.md) through [`Tactical_Encounter_Phase1S_Word_of_Radiance_Status.md`](./Tactical_Encounter_Phase1S_Word_of_Radiance_Status.md) — incremental reviewed cantrip, leveled-spell, attack, save, healing, effect, and multi-target tactical adapters.
- [`Tactical_Encounter_Phase1T_Guiding_Bolt_Status.md`](./Tactical_Encounter_Phase1T_Guiding_Bolt_Status.md) — shared one-shot attack-roll modifier authority plus Guiding Bolt.
- [`Tactical_Encounter_Phase1U_Vicious_Mockery_Status.md`](./Tactical_Encounter_Phase1U_Vicious_Mockery_Status.md) — Vicious Mockery and next-attack Disadvantage consumption.
- [`Tactical_Encounter_Phase1V_Healing_Word_Status.md`](./Tactical_Encounter_Phase1V_Healing_Word_Status.md) — Healing Word, Bonus Action casting, and the 2024 one-slotted-spell-per-turn authority rule.
- [`Tactical_Encounter_Phase1W_Acid_Splash_Status.md`](./Tactical_Encounter_Phase1W_Acid_Splash_Status.md) — point-targeted Sphere authority and server-derived Acid Splash membership.
- [`Tactical_Encounter_Phase1X_Magic_Missile_Status.md`](./Tactical_Encounter_Phase1X_Magic_Missile_Status.md) — allocated multi-target dart authority for Magic Missile.
- [`Security_Hardening_Roadmap_Status.md`](./Security_Hardening_Roadmap_Status.md) — completed and deferred security/database hardening work.

## Current subsystem handoffs

- [`Town_Crafter_Current_Status.md`](./Town_Crafter_Current_Status.md) — current town crafter/profile-panel state and guardrails.
- [`Source_Patch_Pipeline_Audit.md`](./Source_Patch_Pipeline_Audit.md) — source-bake / validator / patch-pipeline handoff.

## Tactical encounter roadmap rule

`Tactical_Encounter_Combat_Roadmap_Blueprint.md` is the source of truth for the encounter system's end goals. The linked active phase ledger may explicitly amend implementation decisions for its phase; when it does, the amendment takes precedence until the master roadmap is synchronized. As implementation progresses:

1. update phase/task checkboxes or the linked active phase ledger;
2. record meaningful commits/migrations in its Progress Ledger or active phase ledger;
3. record major architecture choices in its Decision Log or active phase amendment;
4. add unresolved decisions to Open Design Decisions instead of silently deciding them inside unrelated patches;
5. preserve the roadmap's world-map separation and server-authority guardrails unless those guardrails are explicitly revised.
