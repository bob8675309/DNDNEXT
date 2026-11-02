# DNDNext — Active Work Contract

> **Planning snapshot:** 2026-11-01. Re-verify branches, CI and production before using these SHAs. This is the **one active-session task list**; it is not permission to deploy or merge. Product decisions remain in [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md).

## Current activity: P1.3 global transaction and lock-order research

**Active phase / subphase:** `P1 / P1.3` — investigate [deployed cross-command lock graph](P1_3_Global_Lock_Order_Research_2026-11-01.md) and prepare disposable two-session concurrency proof. P1.2 [contract](P1_2_Command_Replay_Contract_2026-11-01.md) was merged in PR #316 as research direction; it is **not deployed combat behavior**.

**Status:** `IN RESEARCH / NOT PROVEN` — current static evidence finds lock-class inversions; no actual production deadlock demonstrated and **no accepted universal order**.

**Objective:** Establish source-complete, safe transaction and lock discipline across all 22 cast names, eight nonspell ledger writers, Admin/non-ledger resource writers, reaction and expiry triggers, and shared canonical slot pools before any migration.

**Scope:** Read-only live definition/trigger/SQL audit, machine-readable class-order graph, static CI checks and proposed disposable PG race fixtures. **No live mutations, grants, public combat edits, world/town map work, or AI.**

**Verified P0/P1 releases:** Documentation PRs #313/#314 and P1.1 #315, P1.2 #316 merged. Source baseline for P1.3: `51c351a142d03378dff8e47e05182afe21a15622`; refresh GitHub main, Supabase and deployments before relying on it. PRs #309/#312 remain held research.

**Next single action:** Expand [P1.3 graph](P1_3_Global_Lock_Order_Research_2026-11-01.md) through remaining source branches, trigger/FK/permission-row lock paths and concrete row identities; then execute **disposable two-session PostgreSQL** L↔E, P↔E, W↔L, expiry, S→C and rollback tests. Keep P1.3 unchecked until concurrency and mixed-version behavior are proven.

**Acceptance:** One verified global, deadlock-safe transaction boundary across public versions and triggers, with exact-source evidence, real multi-session PG fixtures and signed-in authorization test plan. Source-class graph validation alone **does not satisfy P1.3**.

## Source starting point and subsequent P1 objective

**Task:** Use the [P1.1 evidence matrix](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md) and held PR #312 existing JWT/concurrency fixtures. Finish P1.2 design without implementing P1.3 prematurely; do not substitute the private core-action candidate for the whole live transaction system.

**Starting PRs:** #309 (`a24006624380570bd693a768e97a0c689f1d42b5`, draft), #312 (`26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`, stacked draft). Exact head/base may have changed; re-fetch.

**Required audit paths:** live `public.encounter_use_core_action_v1`; `encounter_command_requests`, encounter/participant rows, grants and control checks; cast routers and helpers; movement, attacks, reactions, log/ledger writers; character spell slot and rest resource bridge triggers; prior isolation fixtures under PR #312.

**Blockers:** typed immutable intent and requester validation; lock order including existing legacy paths; revocation and stale/pending replay; signed-in multiple-controller concurrency; same canonical actor in more than one active encounter; NPC spell-profile visibility. No production cutover pending explicit scope and rollback approval.

**Not included:** general AI, new one-off spells, feature-effect retrofits, attunement/crafting implementation, world/town-map changes, broad CSS or database schema cleanup.

## Handoff rules

At start: complete session gates S0–S2 in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md); read `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, [PROJECT_STATE.md](PROJECT_STATE.md), this file, the registry, owner decision ledger, and relevant original source; refresh SHA/PR/CI/Vercel/live SQL. At finish: complete S4–S7 gates; update only affected registry records, this task, and append a [handoff receipt](HANDOFF_RECEIPT_TEMPLATE.md) to [HANDOFF_LOG.md](HANDOFF_LOG.md) *on the same work branch as any implementation change*. Record a single next action, failures, exact checks and unknowns. Never infer browser acceptance from CI.