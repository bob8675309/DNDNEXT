# DNDNext — Active Work Contract

## 2026-11-06 — Owner-directed next RESEARCH milestone (supersedes the old P1.2 next-task wording below for agent/Forge continuation)

**Single next engineering task:** Start the [deterministic seeded scenario-testing first slice](Deterministic_Scenario_Testing_Next_Phase_2026-11-06.md). Inspect/reuse current #324 source-original PostgreSQL 17 + genuine GoTrue/PostgREST J00–J153 fixtures and add a small schema, seed and machine-readable runner proof on a bounded research continuation; no replacement of existing source handlers/tests. The existing 16 missing original trigger DDL cases are later focused scenarios, not grounds to repeat the 3 independently accepted trigger suites. This is NOT implemented or released yet.

**Why:** the approved free Touchstone/Project Health collector and trigger receipts reduce new-chat rediscovery; the next objective is to reduce repetitive test construction while keeping AI out of rule authority. Continue paid-API-off/Work-on-demand-only. Preserve #317 global CP/CS/G/GI/I/C concurrency, #321 privacy, #324 replay, #325 agent and source-qualified 2024 XPHB contracts as separate held research gates.

**Conflict resolution:** the older section beginning `Current activity: P1.2 ...` below is a dated 2026-11-01 product-security planning snapshot, not the current next Forge/agent research job. P1.2's merged #316 design does **not** fix P1.3 production locks or authorize production cutover. Future chats must recheck the actual exact heads/CI and this top entry, never blindly promote an older next task.

---

> **Prototype / owner usage decision (2026-11-06):** No active players; generated NPCs, inventories and related game-world records are primarily prototype test data. ChatGPT Work remains **on demand for difficult investigations**, not scheduled. The free consolidated [project-health snapshot](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/PROJECT_HEALTH.generated.md) is being added to the held research docs workflow; it reports GitHub/CI state at capture time and cannot prove deployed game behavior. The report must be verified at exact source SHA before claiming acceptance.
>
> **2026-11-06 research automation branch update (NOT production):** Draft [PR #325](https://github.com/bob8675309/DNDNEXT/pull/325) at `51428cf99a433b23190e32d188f987e4e711d04f` has a verified **free, no-model** docs snapshot publisher and supervised research patch documentation gates. The publisher writes only to the separate `docs/agent-status` archive, never to the working PR head. [Agent safety CI 42241801501](https://github.com/bob8675309/DNDNEXT/actions/runs/42241801501) and [docs publisher CI 42241789973](https://github.com/bob8675309/DNDNEXT/actions/runs/42241789973) passed. Forge draft [#324](https://github.com/bob8675309/DNDNEXT/pull/324) at `2cb408c784b2a46699eca82574eeeb4dffb1562a` passed [JWT J00–J153 + PG17 42242127957](https://github.com/bob8675309/DNDNEXT/actions/runs/42242127957) and [auto docs snapshot 42242114281](https://github.com/bob8675309/DNDNEXT/actions/runs/42242114281). Forge original trigger DDL remains **15/31 staged, 16 missing, 3 individually authenticated receipts**, not production parity. The 2014 PHB Admin source toggle is **designed only**, 2024 XPHB remains default. Source-omitted subclass fallback is an unresolved backend review gate. No merge, production SQL, game runtime change, paid AI/API invocation, or Vercel release; previews remain disabled project-wide for this research. The historical work-plan paragraphs below are dated and should not be mistaken for the current Forge/agent heads. [Live archive](https://github.com/bob8675309/DNDNEXT/tree/docs/agent-status/docs/research-status); [Docs policy](Research_Docs_Maintenance_2026-11-06.md).


> **Planning snapshot:** 2026-11-01. Re-verify branches, CI and production before using these SHAs. This is the **one active-session task list**; it is not permission to deploy or merge. Product decisions remain in [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md).

## Current activity: P1.2 immutable intent / replay / authorization contract — research only

**Active phase / subphase:** `P1 / P1.2` — design the **immutable original request intent and cached replay authorization contract** using the dated [P1.1 live command census](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md). P1.1 inventory is complete as a read-only source/DB audit, not as a remediation or production exploit test.

**Status:** `IN RESEARCH / OWNER CONTRACT REVIEW PENDING` — P1.2 proposal exists in [P1.2 replay contract](P1_2_Command_Replay_Contract_2026-11-01.md), but decisions R1–R4 and P1.3 lock order remain unapproved. No production SQL or combat code changed.

**Objective:** Define an enforceable replay identity per existing command family: encounter, original actor/requester, exact typed action inputs, current control/visibility checks, revocation semantics, and legacy/pending-row behavior. This is a **design-only** step ahead of P1.3 global lock ordering and candidate implementation.

**Scope:** Research-only documentation/fixtures for public encounter command request family normalization, ownership, replay and safe retries; retain P1.1 live matrix and reference PR #312. Read-only validation is permitted; gameplay/SQL migration, grants, deployment and protected map changes are NOT.

**Verified P0 release:** PR [#313](https://github.com/bob8675309/DNDNEXT/pull/313) merged at `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b`, Vercel production deployment `dpl_8LeoXePm93rcz69rABa3B5ZoadpG` READY at that SHA, and GitHub `handoff-registry` CI succeeded on both final PR head `97c819a3f646a0e11934cc922aafa3cc0a34d712` and merged SHA. This is a historical verification point; re-fetch all current heads before action.

**Next single action:** Review [the proposed P1.2 typed intent/authorization/replay contract](P1_2_Command_Replay_Contract_2026-11-01.md), particularly R1 fail-closed legacy requests, R2 revoked-controller replay, R3 named trusted service principals and R4 cross-encounter resource policy reserved for P1.5. Validate the declarative matrix and seek owner signoff before P1.3 global lock-order design. **No production SQL/gameplay changes.**

**Acceptance:** Document 13 intent families, every existing ledger writer and cast wrapper, original identity/typed input binding, fresh authorization and projection, legacy/revoked/pending policy, plus executable *static coverage* checks. Record owner disposition of R1–R4; do not mark P1.2 complete from source checks alone.

## Source starting point and subsequent P1 objective

**Task:** Use the [P1.1 evidence matrix](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md) and held PR #312 existing JWT/concurrency fixtures. Finish P1.2 design without implementing P1.3 prematurely; do not substitute the private core-action candidate for the whole live transaction system.

**Starting PRs:** #309 (`a24006624380570bd693a768e97a0c689f1d42b5`, draft), #312 (`26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`, stacked draft). Exact head/base may have changed; re-fetch.

**Required audit paths:** live `public.encounter_use_core_action_v1`; `encounter_command_requests`, encounter/participant rows, grants and control checks; cast routers and helpers; movement, attacks, reactions, log/ledger writers; character spell slot and rest resource bridge triggers; prior isolation fixtures under PR #312.

**Blockers:** typed immutable intent and requester validation; lock order including existing legacy paths; revocation and stale/pending replay; signed-in multiple-controller concurrency; same canonical actor in more than one active encounter; NPC spell-profile visibility. No production cutover pending explicit scope and rollback approval.

**Not included:** general AI, new one-off spells, feature-effect retrofits, attunement/crafting implementation, world/town-map changes, broad CSS or database schema cleanup.

## Handoff rules

At start: complete session gates S0–S2 in [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md); read `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, [PROJECT_STATE.md](PROJECT_STATE.md), this file, the registry, owner decision ledger, and relevant original source; refresh SHA/PR/CI/Vercel/live SQL. At finish: complete S4–S7 gates; update only affected registry records, this task, and append a [handoff receipt](HANDOFF_RECEIPT_TEMPLATE.md) to [HANDOFF_LOG.md](HANDOFF_LOG.md) *on the same work branch as any implementation change*. Record a single next action, failures, exact checks and unknowns. Never infer browser acceptance from CI.