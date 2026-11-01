# DNDNext — Active Work Contract

> **Planning snapshot:** 2026-11-01. Re-verify branches, CI and production before using these SHAs. This is the **one active-session task list**; it is not permission to deploy or merge. Product decisions remain in [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md).

## Current activity: documentation reconciliation (review branch)

**Active phase / subphase:** `P0 / P0.6` — documentation-only branch submitted for review; phase checklist items remain unchecked until their individual evidence and approval gates are satisfied. See [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md) for P0 exit gates and S0–S7 per-chat process.

**Status:** `IN IMPLEMENTATION` / documentation-only review branch; not merged into `main` or released.

**Objective:** Replace stale cross-chat 'current' claims with an evidence-indexed project-state register and durable receipt protocol without altering gameplay, schema, active combat research, Vercel or protected map systems.

**Scope:** `AGENTS.md` and documentation routing/status ledgers; new `docs/PROJECT_STATE.md`, `docs/SYSTEM_REGISTRY.json`, `docs/ACTIVE_WORK.md`, `docs/HANDOFF_LOG.md`, `docs/DOCUMENT_LIFECYCLE.md`, `docs/HANDOFF_RECEIPT_TEMPLATE.md`, `docs/PHASED_DEVELOPMENT_CHECKLIST.md`, and `scripts/validate_handoff_registry.mjs` (read-only validator).

**State:** Documentation-only branch `docs/p0-handoff-registry-20261101`, based on audited `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`. The branch commit SHA is tracked by GitHub; always re-fetch before action. This is not a merge or a production deployment.

**Next single action:** Complete `P0.6`: review the exact documentation branch diff and current checks, run `node scripts/validate_handoff_registry.mjs` in a full repository checkout when available, then request separate owner approval before merging to `main`.

**Acceptance:** Corrected printable/dice/workspace status; current #312 research topology; live-vs-research distinctions; no historical deletions; links and file paths check out; no runtime/source/db deployment changes; exact resulting branch/head/CI recorded on actual push.

## Immediately following engineering objective (after docs acceptance)

**Task:** **Global tactical command replay-ownership and lock-order matrix**, in isolated research only. Do not substitute an isolated private core-action executor for the whole live transaction system.

**Starting PRs:** #309 (`a24006624380570bd693a768e97a0c689f1d42b5`, draft), #312 (`26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`, stacked draft). Exact head/base may have changed; re-fetch.

**Required audit paths:** live `public.encounter_use_core_action_v1`; `encounter_command_requests`, encounter/participant rows, grants and control checks; cast routers and helpers; movement, attacks, reactions, log/ledger writers; character spell slot and rest resource bridge triggers; prior isolation fixtures under PR #312.

**Blockers:** typed immutable intent and requester validation; lock order including existing legacy paths; revocation and stale/pending replay; signed-in multiple-controller concurrency; same canonical actor in more than one active encounter; NPC spell-profile visibility. No production cutover pending explicit scope and rollback approval.

**Not included:** general AI, new one-off spells, feature-effect retrofits, attunement/crafting implementation, world/town-map changes, broad CSS or database schema cleanup.

## Handoff rules

At start: complete session gates S0–S2 in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md); read `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, [PROJECT_STATE.md](PROJECT_STATE.md), this file, the registry, owner decision ledger, and relevant original source; refresh SHA/PR/CI/Vercel/live SQL. At finish: complete S4–S7 gates; update only affected registry records, this task, and append a [handoff receipt](HANDOFF_RECEIPT_TEMPLATE.md) to [HANDOFF_LOG.md](HANDOFF_LOG.md) *on the same work branch as any implementation change*. Record a single next action, failures, exact checks and unknowns. Never infer browser acceptance from CI.