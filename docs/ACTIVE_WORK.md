# DNDNext — Active Work Contract

> **Planning snapshot:** 2026-11-01. Re-verify branches, CI and production before using these SHAs. This is the **one active-session task list**; it is not permission to deploy or merge. Product decisions remain in [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md).

## Current activity: P1.1 read-only tactical command-authority inventory

**Active phase / subphase:** `P1 / P1.1` — inventory the **deployed** tactical command writers, controlling permissions, idempotency/replay behavior, lock order and resource triggers. The documentation foundation P0 is complete through P0.7; read the recorded evidence in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md) and [HANDOFF_LOG.md](HANDOFF_LOG.md).

**Status:** `IN RESEARCH` — read-only inventory phase. Do not patch public combat RPCs or deploy private experimental executors as part of P1.1.

**Objective:** Document the complete server-authoritative tactical command graph and its security/transaction invariants. Identify replay-before-reauthorization flaws, conflicting lock order and shared-character cross-encounter resource behavior before choosing any migration.

**Scope:** Read-only current `public`/`private` Supabase function definitions, grants, relevant triggers and tables; existing `pages/encounters/*` command callers; held PR #312 JWT/replay fixtures and #309 ancestry; existing equipment/slot/rest authorities. Only documentation and isolated tests may be proposed after evidence gathering.

**Verified P0 release:** PR [#313](https://github.com/bob8675309/DNDNEXT/pull/313) merged at `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b`, Vercel production deployment `dpl_8LeoXePm93rcz69rABa3B5ZoadpG` READY at that SHA, and GitHub `handoff-registry` CI succeeded on both final PR head `97c819a3f646a0e11934cc922aafa3cc0a34d712` and merged SHA. This is a historical verification point; re-fetch all current heads before action.

**Next single action:** Complete `P1.1`: enumerate every **live** encounter command and resource mutation entry point (core actions, movement, end turn, attack, cast, reactions, logs, slot/rest resource guards) with actual function/grant, client caller, idempotency checks, lock sequence and known gaps in a source-linked **read-only** matrix. Do not implement P1.2 or change production SQL yet.

**Acceptance:** A complete enumerated command/ledger writer matrix against the live DB and current main; named caller/read/control dependencies; grants and privilege boundaries; lock/replay ordering conflicts recorded without unsupported conjecture; one next task P1.2 only after P1.1 evidence review.

## Source starting point and subsequent P1 objective

**Task:** Continue the P1.1 command-graph and replay/lock-order audit in isolated research only. Do not substitute an isolated private core-action executor for the whole live transaction system.

**Starting PRs:** #309 (`a24006624380570bd693a768e97a0c689f1d42b5`, draft), #312 (`26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`, stacked draft). Exact head/base may have changed; re-fetch.

**Required audit paths:** live `public.encounter_use_core_action_v1`; `encounter_command_requests`, encounter/participant rows, grants and control checks; cast routers and helpers; movement, attacks, reactions, log/ledger writers; character spell slot and rest resource bridge triggers; prior isolation fixtures under PR #312.

**Blockers:** typed immutable intent and requester validation; lock order including existing legacy paths; revocation and stale/pending replay; signed-in multiple-controller concurrency; same canonical actor in more than one active encounter; NPC spell-profile visibility. No production cutover pending explicit scope and rollback approval.

**Not included:** general AI, new one-off spells, feature-effect retrofits, attunement/crafting implementation, world/town-map changes, broad CSS or database schema cleanup.

## Handoff rules

At start: complete session gates S0–S2 in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md); read `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, [PROJECT_STATE.md](PROJECT_STATE.md), this file, the registry, owner decision ledger, and relevant original source; refresh SHA/PR/CI/Vercel/live SQL. At finish: complete S4–S7 gates; update only affected registry records, this task, and append a [handoff receipt](HANDOFF_RECEIPT_TEMPLATE.md) to [HANDOFF_LOG.md](HANDOFF_LOG.md) *on the same work branch as any implementation change*. Record a single next action, failures, exact checks and unknowns. Never infer browser acceptance from CI.