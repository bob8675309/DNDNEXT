# DNDNext — Active Work Contract

> **2026-11-05 PR #324 IMMUTABLE PLAYER FORGE REPLAY — exact-head isolated research VERIFIED:** The owner explicitly decided that reusing a player creation request ID with altered original character/spell selections must be rejected; identical intent must return the original character with no mutation. [Draft PR #324](https://github.com/bob8675309/DNDNEXT/pull/324), **stacked on unmerged PR #321** (not main), implements an **unapplied** private, SHA-256 fingerprint + authenticated owner + immutable API version request reservation, and source-pinned private copies of original v2/v3. [PG17 run 41978655925](https://github.com/bob8675309/DNDNEXT/actions/runs/41978655925) passed FCR-B00 expected unsafe source replay and FCR-01–04 guarded behavior with simulated auth; [genuine local GoTrue/PostgREST run 41979085727](https://github.com/bob8675309/DNDNEXT/actions/runs/41979085727) **SUCCESS** at source `4cb4f6c41ef357acc6ba374667c4b4a0ebd66dbb`, J00–J09 PASS (including equal-intent and changed-intent two-session races, current grant revocation and failed-create rollback). **NOT production/fully Forge-ready:** reduced catalogue/RLS and missing 19 progress triggers; original Admin NPC nonce/v1 unpatched; source-old `players.sheet` overwrite needs #319 reconciliation, GM/creator backstory/secret routing and global P1.3 locks remain; no actual browser acceptance. [Full report](Player_Forge_Immutable_Creation_Intent_Candidate_2026-11-05.md). **One next action on #324:** extend exact original Forge deferred-trigger/gear and permissions parity with genuine local JWT and reconcile #319's source conflict before production migration planning. **No live SQL/grants/data/merge/deploy/map changes.**\n\n
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