# DNDNext — Active Work Contract

> **Planning snapshot:** 2026-11-01. Re-verify branches, CI and production before using these SHAs. This is the **one active-session task list**; it is not permission to deploy or merge. Product decisions remain in [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md).

## Current activity: P0 documentation acceptance and post-merge verification

**Active phase / subphase:** `P0 / P0.7` — docs-only PR #313 has a verified full-checkout registry CI gate and owner approval to proceed with the reviewed merge; **post-merge main/deployment verification remains next**. Completed P0.1–P0.6 items and their dated evidence are recorded in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md) and [HANDOFF_LOG.md](HANDOFF_LOG.md).

**Status:** `VERIFIED IN ISOLATION` at the reviewed PR head; the PR merge and resulting `main`/production SHA must be independently checked. No gameplay or Supabase changes authorized.

**Objective:** Replace stale cross-chat 'current' claims with an evidence-indexed project-state register and durable receipt protocol without altering gameplay, schema, active combat research, Vercel or protected map systems.

**Scope:** `AGENTS.md` and documentation routing/status ledgers; new `docs/PROJECT_STATE.md`, `docs/SYSTEM_REGISTRY.json`, `docs/ACTIVE_WORK.md`, `docs/HANDOFF_LOG.md`, `docs/DOCUMENT_LIFECYCLE.md`, `docs/HANDOFF_RECEIPT_TEMPLATE.md`, `docs/PHASED_DEVELOPMENT_CHECKLIST.md`, and `scripts/validate_handoff_registry.mjs` (read-only validator).

**State:** Documentation-only PR [#313](https://github.com/bob8675309/DNDNEXT/pull/313), based on audited `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`. A full-checkout GitHub registry-validation job passed on branch commit `6beb583770c3152f4fa5d7e848e5714d1b80ca19`; the final head and merge commit may differ, so re-fetch and verify current checks. This snapshot does not itself prove PR merge or production deployment.

**Next single action:** Complete `P0.7`: verify PR #313's final green exact-head checks and merged `main` commit, inspect Vercel production state, append a post-merge receipt, then move `ACTIVE_WORK.md` to `P1 / P1.1` for a **read-only** tactical command writer/lock-order inventory. Do not treat documentation approval as permission for combat SQL or runtime deployments.

**Acceptance:** Corrected printable/dice/workspace status; current #312 research topology; live-vs-research distinctions; no historical deletions; links and file paths check out; no runtime/source/db deployment changes; exact resulting branch/head/CI recorded on actual push.

## Immediately following engineering objective (after docs acceptance)

**Task:** **Global tactical command replay-ownership and lock-order matrix**, in isolated research only. Do not substitute an isolated private core-action executor for the whole live transaction system.

**Starting PRs:** #309 (`a24006624380570bd693a768e97a0c689f1d42b5`, draft), #312 (`26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`, stacked draft). Exact head/base may have changed; re-fetch.

**Required audit paths:** live `public.encounter_use_core_action_v1`; `encounter_command_requests`, encounter/participant rows, grants and control checks; cast routers and helpers; movement, attacks, reactions, log/ledger writers; character spell slot and rest resource bridge triggers; prior isolation fixtures under PR #312.

**Blockers:** typed immutable intent and requester validation; lock order including existing legacy paths; revocation and stale/pending replay; signed-in multiple-controller concurrency; same canonical actor in more than one active encounter; NPC spell-profile visibility. No production cutover pending explicit scope and rollback approval.

**Not included:** general AI, new one-off spells, feature-effect retrofits, attunement/crafting implementation, world/town-map changes, broad CSS or database schema cleanup.

## Handoff rules

At start: complete session gates S0–S2 in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md); read `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, [PROJECT_STATE.md](PROJECT_STATE.md), this file, the registry, owner decision ledger, and relevant original source; refresh SHA/PR/CI/Vercel/live SQL. At finish: complete S4–S7 gates; update only affected registry records, this task, and append a [handoff receipt](HANDOFF_RECEIPT_TEMPLATE.md) to [HANDOFF_LOG.md](HANDOFF_LOG.md) *on the same work branch as any implementation change*. Record a single next action, failures, exact checks and unknowns. Never infer browser acceptance from CI.