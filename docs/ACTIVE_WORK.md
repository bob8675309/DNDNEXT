# DNDNext — Active Work Contract

> **Planning snapshot:** 2026-11-01. Re-verify branches, CI and production before using these SHAs. This is the **one active-session task list**; it is not permission to deploy or merge. Product decisions remain in [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md).

## Current activity: P1.3 global transaction and lock-order research

**Active phase / subphase:** `P1 / P1.3` — investigate [deployed cross-command lock graph](P1_3_Global_Lock_Order_Research_2026-11-01.md) and prepare disposable two-session concurrency proof. P1.2 [contract](P1_2_Command_Replay_Contract_2026-11-01.md) was merged in PR #316 as research direction; it is **not deployed combat behavior**.

**Status:** `IN RESEARCH / NOT PROVEN` — current static evidence finds lock-class inversions; no actual production deadlock demonstrated and **no accepted universal order**. Owner selected **TC1 Option A** (one active encounter per canonical character), but no guard or live reconciliation has occurred.

**Latest validated research (2026-11-02):** [Guiding Bolt v11 / Mind Sliver v10 live-source tests](P1_3_Legacy_v11_Guiding_Bolt_v10_Mind_Sliver_2026-11-02.md) passed **6/6** in [run 41566917343](https://github.com/bob8675309/DNDNEXT/actions/runs/41566917343), SHA `1f39532` with seven green checks. Original v11 slotted cast/turn-guard pathway deadlocked against original End Turn (**E→P vs P→E**) in scheduled scratch concurrency, while v10 Mind Sliver and End Turn serialized P-first. Both older cast branches returned cached results after **changed target/slot** replay. Auth, roll/damage, targeting and full production trigger graph remain mocked; **no production incident or real signed-in exploit verified**.

**Objective:** Establish source-complete, safe transaction and lock discipline across all 22 cast names, eight nonspell ledger writers, Admin/non-ledger resource writers, reaction and expiry triggers, and shared canonical slot pools before any migration.

**Scope:** Read-only live definition/trigger/SQL audit, machine-readable class-order graph, static CI checks and proposed disposable PG race fixtures. **No live mutations, grants, public combat edits, world/town map work, or AI.**

**Disposable fixture:** [PG16 Option A two-session test matrix](P1_3_Option_A_Concurrency_Model_2026-11-01.md) **PASSED in GitHub run 41385726293** at `cd2c070`; its synthetic inverted L/E sequence produced a real PostgreSQL deadlock in scratch tables. Production RPC, trigger and permission-order behavior is untested. Source review now confirms **paused→active** also needs an Option A guard.


**Verified P0/P1 releases:** Documentation PRs #313/#314 and P1.1 #315, P1.2 #316 merged. Source baseline for P1.3: `51c351a142d03378dff8e47e05182afe21a15622`; refresh GitHub main, Supabase and deployments before relying on it. PRs #309/#312 remain held research.

**Next single action:** (Updated 2026-11-02) Extend source-derived disposable PG16 coverage to **public v9/v8 legacy cast entries and any direct authenticated legacy bypass**, including conflicting target/slot/assignment/replay and checked GM-assisted fallback; then design **genuine signed-in GM/PC/delegated NPC JWT** revocation and hidden-result acceptance. Guiding Bolt v11 and Mind Sliver v10 are now tested, but no global E/P/W/L/X/S/C/grant lock order is approved. Keep P1.3/P1.5 open and [TC1 Option A](TACTICAL_ENCOUNTER_OWNER_DECISIONS.md) undeployed. **No production SQL or merge authorized.**

**Acceptance:** One verified global, deadlock-safe transaction boundary across public versions and triggers, with exact-source evidence, real multi-session PG fixtures and signed-in authorization test plan. Source-class graph validation alone **does not satisfy P1.3**.

## Source starting point and subsequent P1 objective

**Task:** Use the [P1.1 evidence matrix](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md) and held PR #312 existing JWT/concurrency fixtures. Finish P1.2 design without implementing P1.3 prematurely; do not substitute the private core-action candidate for the whole live transaction system.

**Starting PRs:** #309 (`a24006624380570bd693a768e97a0c689f1d42b5`, draft), #312 (`26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`, stacked draft). Exact head/base may have changed; re-fetch.

**Required audit paths:** live `public.encounter_use_core_action_v1`; `encounter_command_requests`, encounter/participant rows, grants and control checks; cast routers and helpers; movement, attacks, reactions, log/ledger writers; character spell slot and rest resource bridge triggers; prior isolation fixtures under PR #312.

**Blockers:** typed immutable intent and requester validation; global order across legacy paths and triggers; revocation/stale replay; signed-in multiple-controller concurrency; **TC1 Option A is approved, but the existing active-character overlap and concurrency-safe admission guard remain unresolved**; NPC spell-profile visibility. No production cutover pending explicit scope and rollback approval.

**Not included:** general AI, new one-off spells, feature-effect retrofits, attunement/crafting implementation, world/town-map changes, broad CSS or database schema cleanup.

## Handoff rules

At start: complete session gates S0–S2 in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md); read `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, [PROJECT_STATE.md](PROJECT_STATE.md), this file, the registry, owner decision ledger, and relevant original source; refresh SHA/PR/CI/Vercel/live SQL. At finish: complete S4–S7 gates; update only affected registry records, this task, and append a [handoff receipt](HANDOFF_RECEIPT_TEMPLATE.md) to [HANDOFF_LOG.md](HANDOFF_LOG.md) *on the same work branch as any implementation change*. Record a single next action, failures, exact checks and unknowns. Never infer browser acceptance from CI.

## Current P1.3 exact-source admission proof — isolated CI passed

[Live-source Admin Start/Resume PG16 fixture](P1_3_Real_Admin_Activation_Resume_Test_2026-11-01.md) **passed seven cases** in GitHub [run 41389394032](https://github.com/bob8675309/DNDNEXT/actions/runs/41389394032) at `2f8c42deee0d85b36793b74b1ea1b488ac2b220a`, with all other checks green. This is source-equivalent logic with mocked dependencies, **not** deployment safety. **Single next task:** trace and test production-derived participant mutation, activation/turn triggers and permission-row ordering in isolated PG16 alongside spell-slot and legacy command paths. P1.3/P1.5 stay open; no production SQL authorized.


## P1.3 source-derived row inversion confirmed (isolated)

[Exact-source Start/Staging PG16 race](P1_3_Staging_Start_Lock_Race_2026-11-01.md) passed at run `41392432969`: PostgreSQL reported a deadlock for same-row E→P/P→E interleaving, while E-first prelock avoided this single cycle. **One next action:** model/verify trigger-expiry, slot bridge, permission revocation and legacy command lock ordering before selecting any production transaction design. P1.3/P1.5 remain open.


## Current next P1.3 evidence — turn-start expiry

[Exact-source turn-start expiry PG16 test](P1_3_Turn_Start_Expiry_Lock_Race_2026-11-01.md) **PASS** on [GitHub run 41394548206](https://github.com/bob8675309/DNDNEXT/actions/runs/41394548206) at `b2db2f8`. The source-derived E→X→P expiry path deadlocked against a target P→E writer in scratch PostgreSQL; E-first prelocking avoided only this pair. **One next action:** build a source-derived `encounter_spell_slots` S→C bridge/sync and grant-revocation two-session test, then expand to legacy cast and reaction paths. No production SQL or release authorization.


## Current P1.3 results: S/C sync and grant revocation

[Slot and permission race evidence](P1_3_Spell_Slot_and_Revocation_PG16_2026-11-01.md) passed five scratch PG16 cases on run 41395991124, tested SHA 0ffcd12. Exact deployed mirror/sync and control helper bodies were used, but the C-first maintenance writer and post-check action were **synthetic**. **Next single task:** identify real resource-maintenance and grant-revocation writer lock orders, then run source-derived mixed-version/JWT concurrency tests. P1.3/P1.5 incomplete; no production SQL authorized.
