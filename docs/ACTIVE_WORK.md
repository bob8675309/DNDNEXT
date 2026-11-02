# DNDNext — Active Work Contract

> **Planning snapshot:** 2026-11-01. Re-verify branches, CI and production before using these SHAs. This is the **one active-session task list**; it is not permission to deploy or merge. Product decisions remain in [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md).

## Current activity: P1.2 immutable intent / replay / authorization contract — research only

**Active phase / subphase:** `P1 / P1.2` — design the **immutable original request intent and cached replay authorization contract** using the dated [P1.1 live command census](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md). P1.1 inventory is complete as a read-only source/DB audit, not as a remediation or production exploit test.

**Status:** `IN RESEARCH` — read-only inventory phase. Do not patch public combat RPCs or deploy private experimental executors as part of P1.1.

**Objective:** Define an enforceable replay identity per existing command family: encounter, original actor/requester, exact typed action inputs, current control/visibility checks, revocation semantics, and legacy/pending-row behavior. This is a **design-only** step ahead of P1.3 global lock ordering and candidate implementation.

**Scope:** Research-only documentation/fixtures for public encounter command request family normalization, ownership, replay and safe retries; retain P1.1 live matrix and reference PR #312. Read-only validation is permitted; gameplay/SQL migration, grants, deployment and protected map changes are NOT.

**Verified P0 release:** PR [#313](https://github.com/bob8675309/DNDNEXT/pull/313) merged at `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b`, Vercel production deployment `dpl_8LeoXePm93rcz69rABa3B5ZoadpG` READY at that SHA, and GitHub `handoff-registry` CI succeeded on both final PR head `97c819a3f646a0e11934cc922aafa3cc0a34d712` and merged SHA. This is a historical verification point; re-fetch all current heads before action.

**Next single action:** Complete `P1.2`: draft a cross-command typed immutable request/replay authorization matrix for all 14 direct spell processors, eight non-spell command writers and interacting admin/resource routines. Specify original requester/intent, historical pending rows, revoked access, hidden result visibility and safe duplicate retry; collect explicit owner decisions where policy genuinely changes. **Do not change production SQL, migrate ledger columns, or partially deploy a private candidate.**

**Acceptance:** Each command shape has a server-normalized canonical identity and replay decision table (same requester/intent, different intent, revoked controller, completed/pending/legacy record, hidden targets). The contract must cover permission freshness, privacy, and how P1.3 can coordinate legacy and candidate lock ordering; no undocumented authorization or release assumptions.

## Source starting point and subsequent P1 objective

**Task:** Use the [P1.1 evidence matrix](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md) and held PR #312 existing JWT/concurrency fixtures. Finish P1.2 design without implementing P1.3 prematurely; do not substitute the private core-action candidate for the whole live transaction system.

**Starting PRs:** #309 (`a24006624380570bd693a768e97a0c689f1d42b5`, draft), #312 (`26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`, stacked draft). Exact head/base may have changed; re-fetch.

**Required audit paths:** live `public.encounter_use_core_action_v1`; `encounter_command_requests`, encounter/participant rows, grants and control checks; cast routers and helpers; movement, attacks, reactions, log/ledger writers; character spell slot and rest resource bridge triggers; prior isolation fixtures under PR #312.

**Blockers:** typed immutable intent and requester validation; lock order including existing legacy paths; revocation and stale/pending replay; signed-in multiple-controller concurrency; same canonical actor in more than one active encounter; NPC spell-profile visibility. No production cutover pending explicit scope and rollback approval.

**Not included:** general AI, new one-off spells, feature-effect retrofits, attunement/crafting implementation, world/town-map changes, broad CSS or database schema cleanup.

## Handoff rules

At start: complete session gates S0–S2 in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md); read `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, [PROJECT_STATE.md](PROJECT_STATE.md), this file, the registry, owner decision ledger, and relevant original source; refresh SHA/PR/CI/Vercel/live SQL. At finish: complete S4–S7 gates; update only affected registry records, this task, and append a [handoff receipt](HANDOFF_RECEIPT_TEMPLATE.md) to [HANDOFF_LOG.md](HANDOFF_LOG.md) *on the same work branch as any implementation change*. Record a single next action, failures, exact checks and unknowns. Never infer browser acceptance from CI.