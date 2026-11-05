# DNDNext — Active Work Contract

## CURRENT 2026-11-05 OVERRIDE — P1.3 cross-system source/JWT research (not deployed)

**Active phase / subphase:** `P1 / P1.3` — original source-authorized grant/inventory and progression/sheet lock-order verification. Historical P1.2 text below is preserved as an earlier checkpoint; **P1.2 documentation was merged into `main` via PR #316**, while the runtime security remediation has NOT been deployed.

**Exact dated identity:** `main` `51c351a142d03378dff8e47e05182afe21a15622`; Vercel production `dpl_7RHKpiQuQ9AuiUS7xSXA9krRtT9K` READY at same SHA; DnDWeb live function source MD5s matched the held research fixtures in a SELECT-only 2026-11-05 check. Draft [#317](https://github.com/bob8675309/DNDNEXT/pull/317) head `a6d334f611075791359429822acfab83608370fd`, 10/10 Actions passed; separate stacked draft [#324](https://github.com/bob8675309/DNDNEXT/pull/324) head `3daa79c2cecf0a62831e8e3d7eac157e37a6c707`, 3/3 Actions passed. Check again before code changes.

**What the research actually proves:** Original Admin `set_character_progression_v1` CP→CS versus original sheet-trigger CS→CP and original signed-in level-up v5 versus co-editor sheet edit can produce true PostgreSQL `40P01` in **deliberately timed disposable** transactions; natural production frequency is unknown. PR #324 confirms source-original Forge feats/equipment creation with immutable replay and genuine JWT test cases; its J65 deadlock operates on **already-materialized** grants and gear. Original `buy_from_merchant` J70–J77 did create actual inventory I items while competing JWT buyers correctly serialized stock/wallet writes; it did NOT concurrently mutate grant G. Only 7/31 original Forge creation-adjacent triggers have been source-loaded in the cited local acceptance fixture; 24 remain.

**Next single action:** Read original `public.grant_character_option_v1` and/or `private.apply_character_level_advancement_v1` plus original G grant writer, triggers, permissions and dependencies; reproduce a truly authorized **concurrent G write** against a signed-in level-up/sheet operation using disposable PG17 + real GoTrue/PostgREST. Observe genuine locks; validate revocation, deferred COMMIT, rollback, unchanged I/currency, grant attribution, nonce replay and exactly-once events. Carry the resulting graph into #317; **do not declare CP-first a global production lock protocol**.

**Related held work:** #321 NPC creator/privacy/RLS; #318 GM creation notices; #319 populated legacy `players.sheet` retention; #320/#322/#323 centered secure Profile; #309/#312 isolated spell P1/P2 research. Check PR heads/merges before assuming state. Owner behavior: primary/alternate/underling creation without GM pre-approval, GM notification, verified creator+GM private backstory access (creator requires current edit), GM-only secrets, Profile-first NPC/merchant UX.

**Hard release/coverage gates:** full source grant G & I writer graph, original trigger/RLS/role parity, multi-controller/cross-encounter replay policy, signed-in browser acceptance, authorization/security review, reviewed coordinated migration and rollback. Production remains unchanged. Do not merge, deploy, mutate Supabase, or touch world/town maps.

**Vercel budget:** 2026-11-05 preview attempts hit `api-deployments-free-per-day`. Batch changes and documentation into few deliberate pushes; validate via free local/CI fixtures, not repeated Vercel previews. See [DEVELOPMENT_DEPLOYMENT_BUDGET.md](DEVELOPMENT_DEPLOYMENT_BUDGET.md).

---



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