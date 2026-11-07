# DNDNext — Phased Objectives, Chat Workflow, and Release Gates

> **2026-11-07 authoritative closure clarification (owner).** See [ordered C0–C5 plan](PHASE_CLOSEOUT_AND_PR_CONSOLIDATION_ORDER_2026-11-07.md) and the single [ACTIVE_WORK](ACTIVE_WORK.md) task. **P0.1–P0.7 complete; original tactical Phase 1A–1Z implementation/deployment complete; P1.1 source/live census complete. P1.2 immutable-replay DESIGN contract accepted for research only** after merged #316 and owner R1–R3 protective defaults; R4 is separately deferred to P1.5. The production request/replay/locking protocol is **not** fixed, and P1.3–P1.9 remain open. P2 structural research and the 19-spell reference baseline are not an installed composable executor. A checked P1.2 design line is NOT a deployment/authorization acceptance claim. Preserve dated older phase statements below.


> **2026-11-07 single-entry handoff consolidation:** Start at [NEXT_CHAT_START_HERE.md](NEXT_CHAT_START_HERE.md) (canonical owner task and short reality map), then [ACTIVE_WORK.md](ACTIVE_WORK.md) + latest [HANDOFF_LOG.md](HANDOFF_LOG.md) + relevant [WORKSTREAMS_AND_PR_DEPENDENCIES.md](WORKSTREAMS_AND_PR_DEPENDENCIES.md) row. This checklist remains the repeatable **S0–S7** gate process and **P0–P6** long-lived objectives, **not** a second independent next-task queue. Old phases and instructions are dated; full-source/role/lock/production evidence still decides actual release readiness.

> **Prepared 2026-11-01; P0 documentation branch PR #313 submitted for review.** This is a dated process/roadmap checkpoint, **not** approval to run SQL, grant permissions, deploy gameplay, purchase services, alter the world map, or turn on AI. Reverify the current branch and real system state each session. Read [`AGENTS.md`](../AGENTS.md), [`START_HERE_ACTIVE_HANDOFF.md`](START_HERE_ACTIVE_HANDOFF.md), [`PROJECT_STATE.md`](PROJECT_STATE.md), [`ACTIVE_WORK.md`](ACTIVE_WORK.md), [`SYSTEM_REGISTRY.json`](SYSTEM_REGISTRY.json) and approved [`SPELL_ENGINE_DECISIONS.md`](SPELL_ENGINE_DECISIONS.md) first. Record evidence in [`HANDOFF_LOG.md`](HANDOFF_LOG.md).

## How to use this document

This file provides **two different checklists**:

1. **Session gates S0–S7:** repeat in *every* development chat, regardless of feature. Do not skip recovery or closeout when working on small tasks.
2. **Product phases P0–P6:** longer-lived engineering objectives. Complete one bounded task at a time, with explicit exit gates. The next eligible objective is selected in `ACTIVE_WORK.md`, not by silently choosing the next unchecked box below.

**Status vocabulary:** `NOT STARTED`, `IN RESEARCH`, `IN IMPLEMENTATION`, `BLOCKED`, `VERIFIED IN ISOLATION`, `MERGED`, `DEPLOYED`, `BROWSER ACCEPTED`, `SUPERSEDED`. These are **not** interchangeable. A checkbox is marked `[x]` only when the specified evidence and exit conditions exist. A blocked item stays `[ ]` with a receipt describing the blocker; don't mark it done to progress. Never treat this prepared checklist as a record of work already performed.

**Immutable boundaries:** 2024 XPHB-first, source-qualified spell definitions; existing server-authoritative rules; GM-assisted fallback for unsupported spells; future admin recipe builder and optional shared human/AI actions (AI-off-capable); separately versioned house-rule overlays. Next.js Pages Router, Bootstrap/SCSS (no Tailwind), stable Forge/NPC/inventory/crafting/rest/tactical behavior. **World map and town maps remain separate from tactical hex maps; do not change world-map behavior without discussing it.**

## A. Every-chat checklist — session gates

### S0 — Establish identity and permissions (before planning a patch)

- [ ] Read `AGENTS.md` and `START_HERE_ACTIVE_HANDOFF.md` **from the current branch**, then `PROJECT_STATE.md`, `ACTIVE_WORK.md`, the registry, approved owner decisions and the last handoff receipt.
- [ ] Fetch exact `main` SHA, work branch/head SHA, PR state and true base/head ancestry; identify committed versus unmerged research (especially #309/#312 if still relevant).
- [ ] Check current Vercel production SHA/state and relevant free CI outcomes. A READY deployment proves a build was published, **not** functional acceptance.
- [ ] Read live Supabase *schema, RPC definitions, grants, migrations and only relevant data* using read-only queries. Do not assume historical SQL snapshots are live.
- [ ] Record discrepancies between docs, source and live systems. Identify what is verified, inferred and unknown. Stop if the selected branch or project does not match the intended target.

**S0 exit:** A dated baseline record with repository/project identity, main+research SHAs, branch/PR ancestry, applicable live backend and known gaps. No unverified claim of completion.

### S1 — Select one scoped objective

- [ ] Read the **single active objective** and phase ID in `ACTIVE_WORK.md`; verify the user still wants that objective. Update it if the user's new priority supersedes it; note the reason.
- [ ] Define one measurable change, exact files/functions allowed, out-of-scope systems and protected invariants.
- [ ] List dependencies and conflicts, including shared helpers, grant/ownership checks, transaction order, UI data loading, state/props/hooks and validators.
- [ ] Set acceptance criteria and evidence levels: static check, executable test, isolated database/auth, deployment, browser review and owner acceptance as applicable.
- [ ] Identify approval gates before using any write or paid action; research approval does **not** authorize production DB, merge, deployment, destructive cleanup or world-map modifications.

**S1 exit:** One explicit objective, implementation boundary, risks, tests and stop conditions. If the scope is too large, split into separately reviewable substeps with one first task.

### S2 — Audit the existing vertical slice

- [ ] Read actual entry points and call sites end to end: UI → data model/source rules → permission boundary → server RPC/transaction → effects/resources → refresh/realtime → user-visible result.
- [ ] Check what already exists in production and in held/archived branches before adding a new helper or versioned RPC.
- [ ] Trace relevant migrations, triggers, row-level policies and permission grants. Check equipment/character effects, source attribution and rest/encounter lifecycle where relevant.
- [ ] Review current source tests **and what each test really asserts**; do not equate a text-token validator with functional behavior.
- [ ] Define specific before/after failure reproduction or parity fixtures; preserve existing behavior when a defect is not reproduced.

**S2 exit:** A source-linked dependency map, known behavior, test plan and explicit evidence gaps. No speculative rewrite.

### S3 — Prepare and implement a bounded change

- [ ] Prefer a small, isolated branch/commit and existing authority. Avoid mixing documentation cleanup, art, UI refactors, schema and tactical changes.
- [ ] Confirm all newly introduced functions/hooks/props/state variables are defined and all call sites are updated; no missing imports or dead interface paths.
- [ ] Keep immutable request intent, permissions, actor ownership, resource/ledger authority and transaction ordering server-side. The client/AI never determines canonical combat results.
- [ ] If a migration is considered, include backward-compatibility, idempotency, rollback and least-privilege grants. **Do not apply it to production without explicit approval.**
- [ ] Record changed paths and exact behavior. If no safe patch can be made, document the blocker instead of forcing a change.

**S3 exit:** Small reviewable diff or documented research finding; protected boundaries unchanged.

### S4 — Verify the exact revision

- [ ] Run relevant static/contract validators and executable behavior tests; report commands, results and omissions.
- [ ] Use isolated Postgres and real signed-in JWT/multi-controller tests when authorization or concurrency is involved. Validate wrong actor, revoked access, replay reuse and stale action intent.
- [ ] Exercise existing regressions (Forge, sheet, equipped items, rest, crafting, map and tactical) **only where impacted**.
- [ ] Recheck exact pushed branch/head/CI before claiming passing tests. Do not borrow green CI from another SHA or stacked base.
- [ ] If a browser review is required, report test account/role, steps, screenshots or observed outcomes; otherwise explicitly write `BROWSER ACCEPTANCE: UNVERIFIED`.

**S4 exit:** Evidence table for *this* revision, including failed tests, missing tests, and whether the result is research-only or releasable.

### S5 — Gate any release or data change

- [ ] Review dependency PR base, migrations/grants, rollback, concurrency compatibility and deployment impact.
- [ ] Obtain **explicit** owner approval for merge, live schema/functions/grants, production data changes, any production deployment or paid resource; do not infer approval from a documentation request.
- [ ] Apply the approved change only to its named target; verify GitHub/Vercel and database state afterwards.
- [ ] Perform targeted authenticated browser/multiplayer acceptance where required; distinguish deploy from acceptance.
- [ ] If approval is absent, keep the work on its existing isolated branch/local patch and label it `NOT DEPLOYED`.

**S5 exit:** Either an approved and verified release receipt, or a clear **no-release** statement with the held work's exact location.

### S6 — Reconcile living documentation

- [ ] Update only affected entries in `SYSTEM_REGISTRY.json`: status, real source paths, relevant DB function, test evidence, remaining gaps, verification date and browser/owner acceptance.
- [ ] Update `PROJECT_STATE.md` for independently rechecked whole-project facts; do not rewrite unrelated historical phase logs.
- [ ] Update `ACTIVE_WORK.md` to show exactly one next action, current phase/subphase, blocking dependency and objective-specific exit criterion.
- [ ] Record any stale-document conflict with its superseding evidence. Consult `DOCUMENT_LIFECYCLE.md` before considering deletion; **never delete merely because a file is old**.
- [ ] Run `node scripts/validate_handoff_registry.mjs`, path/link checks and `git diff --check` as applicable.

**S6 exit:** Documentation and touched code agree about *what is installed*, *what was only tested*, and *what remains unknown*.

### S7 — Issue the next-chat receipt (do not omit)

- [ ] Append a dated entry in `HANDOFF_LOG.md` using `HANDOFF_RECEIPT_TEMPLATE.md`. Include exact current SHAs, PR base, CI URLs/test commands, DB activity or `none`, deployment/acceptance status, approvals, changed files and failures.
- [ ] Record **completed checkboxes with evidence** and **unchecked carry-forward items**, plus whether the phase exit gate is met.
- [ ] Specify **one actionable next step** in `ACTIVE_WORK.md` and the receipt (avoid a vague list of possibilities).
- [ ] Put a minimal resumption instruction and direct source paths in the receipt; new chat must still re-verify before starting.
- [ ] Stop. Do not claim work will continue between chats or that files were pushed when they were only prepared locally.

**S7 exit:** Someone with no previous chat transcript can recover the task, evidence, blockers and next step from repository files alone.

## B. Product development phases — durable objective queue

These represent planned work and known evidence **as of 2026-11-01**. Phase order is a dependency plan, not blanket permission to start every phase or mark broad systems unfinished. Parallel read-only research is permitted; merging/production cutovers have stricter prerequisites.

### P0 — Reliable project truth and handoff infrastructure

**Baseline:** Documentation-only PR [#313](https://github.com/bob8675309/DNDNEXT/pull/313) was submitted against audited `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`. The registry-validation workflow executed successfully on the full GitHub checkout (run `41362632909` at head `6beb583770c3152f4fa5d7e848e5714d1b80ca19`); **refresh current final head, CI, merge and deployment state every session**.

- [x] P0.1 Review staged documentation-only diff; confirm no application code, SQL or source-of-truth decisions changed.
- [x] P0.2 Apply the package in a clean checkout at its exact audited base, run handoff validator and inspect all diffs.
- [x] P0.3 Verify `AGENTS.md`, `START_HERE_ACTIVE_HANDOFF.md`, `PROJECT_STATE.md`, `SYSTEM_REGISTRY.json`, `ACTIVE_WORK.md`, this checklist and `HANDOFF_LOG.md` consistently link to one another.
- [x] P0.4 Confirm the registry distinguishes implementation, deployment, executable tests and browser/owner acceptance; fix any unsupported “done” claims.
- [x] P0.5 Preserve historical docs and source decisions. Make a deletion proposal **only** for a file with checked inbound references, extracted unique facts and specific owner approval.
- [x] P0.6 On explicit approval, push/PR the docs-only commit and verify resulting exact head, CI and documentation links. **Do not merge without separate approval.**
- [x] P0.7 Verified PR #313 merged at `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b`, Vercel production `dpl_8LeoXePm93rcz69rABa3B5ZoadpG` READY from the same SHA, post-merge handoff-registry CI passed, appended release evidence to `HANDOFF_LOG.md`, and set `ACTIVE_WORK.md` to exactly one next read-only task: `P1.1`. This is dated evidence; always recheck current main.

**P0 exit:** Self-contained source-linked status registry and checkable handoff files available on an approved branch; validation/review evidence recorded, and no gameplay/production mutations.

### P1 — Tactical command security and transaction integrity

**Baseline:** Deployed `encounter_use_core_action_v1` returns cached results before current authorization and does not bind original requester/action intent. Held PR #312 includes private research with isolated JWT tests but **not a safe isolated rollout**. Another character is in two active encounters in live data (observed at audit, no exploit inferred).

- [x] P1.1 Inventory live command writers: 22 spell-cast names (14 ledger processors plus eight wrappers), eight additional non-spell ledger writers, 14 directly mutating Admin encounter/map RPCs, character slot/rest/progression writers and trigger expansion; document current clients, grants, replay/lock gaps, with live read-only SQL and a dated P1.1 evidence matrix. **This is an audit milestone, not a security fix or comprehensive gameplay test.**
- [x] P1.2 **Design contract completed for research, NOT deployed:** merged #316 specifies canonical idempotency/immutable requester, encounter/actor, typed original intent, fail-closed legacy/pending behavior and revocation checks. Owner accepted R1–R3 protective defaults for later implementation; R4 same-character two-active-encounters policy intentionally deferred to P1.5. No live `request_intent` column or production replay/authorization change.
- [ ] P1.3 Standardize encounter → participant → request/ledger/resource lock ordering **across all affected commands**, including conflicts with current triggers. Identify rollback/deadlock cases.
- [ ] P1.4 Establish current-controller checks **before** duplicate lookup/replay. Verify admin/service-role handling without broadening client privileges.
- [ ] P1.5 Define the shared-character/multiple-active-encounters policy before modifying resource synchronization. Verify user expectations and transaction semantics.
- [ ] P1.6 Specify NPC delegated combat permission independently from inventory, edit and profile visibility; inspect spell-profile read paths for hidden enemy/GM-only data.
- [ ] P1.7 Build isolated concurrent signed-JWT tests: two legitimate controllers, wrong actor, same UUID/different action, revoked access, stale client, retry, deadlock, rollback and multi-encounter resources.
- [ ] P1.8 Prepare one coordinated migration + client compatibility + rollback plan. **No private core-action-only production hotfix.**
- [ ] P1.9 Seek explicit approval for production changes; if authorized, perform controlled cutover and authenticated multi-session acceptance.

**P1 exit:** Unified server-side authorization/replay/transaction protocol with passing exact-head isolated tests and documented production approval/rollback. Research work alone can satisfy *research* objectives, **not** the deploy gate.

### P2 — Source-qualified composable spell engine, shadow parity first

**Baseline:** Current production has 19 reviewed source-qualified tactical UI spell adapters and existing server-owned mechanics. PR #309 contains held Eldritch Blast/P1 ancestry; PR #312 contains P2 shadow-parity and private executor research. Production has **no deployed composable interpreter**.

- [ ] P2.1 Preserve the six approved owner decisions and distinct XPHB/source identity. Review P1 schema/validator, closed vocabulary, branch/repeat scope and immutable recipe versioning at exact draft head.
- [ ] P2.2 Inventory existing authoritative target/geometry, attack/save, damage mitigation, effects/conditions, slot/resource and action-cost helpers. Avoid a duplicate numeric rules engine.
- [ ] P2.3 Build golden, non-executing parity fixtures for Fire Bolt, Sacred Flame, Magic Missile, Acid Splash, Word of Radiance, Burning Hands and Lightning Bolt; include held Eldritch Blast as a **research oracle only**.
- [ ] P2.4 Test scaling, repeat/ray independence, selected targets, directional areas, one-shot effects, save-half, immunity/resistance/vulnerability, resource ownership and visible-versus-hidden target redaction.
- [ ] P2.5 Make unsupported operations fail closed or go **explicitly GM-assisted**; never consume resource/action then silently skip required mechanics.
- [ ] P2.6 Validate source-qualified spell grant and eligible casting class/source, including Warlock invocation binding and 2024 versus older-source differences.
- [ ] P2.7 Reconcile parity findings with the tactical command transaction/security changes in P1 before proposing a production executor.
- [ ] P2.8 Define a narrowly scoped server-side interpreter, rollout switch, versioned recipe migrations and rollback; require a separate owner approval for merging/deployment.

**P2 exit:** Versioned, bounded, source-validated recipes show documented parity to existing resolvers in isolated tests; any live engine deployment awaits P1 security and separate release acceptance.

### P3 — Spell complexity, lifecycle, and authorized human/NPC use

- [ ] P3.1 Model concentration, expiry and recurring/lifecycle hooks from established timed effects rather than introducing separate clocks.
- [ ] P3.2 Cover multiattack rays, reactions such as Shield, area persistence, object effects and multi-round outcomes with dedicated fixtures; keep unresolved mechanics GM-assisted.
- [ ] P3.3 Connect **visibility-filtered** legal actions and spell profiles for player-owned characters and delegated NPCs; require P1 authorization design.
- [ ] P3.4 Verify action economy, per-turn spell limitations, slot/Pact pools, rest synchronization, duplicate retries, cancellation and transactional rollbacks.
- [ ] P3.5 Validate through two signed-in player sessions plus GM where applicable; preserve manual override, deterministic server result and combat log audit.
- [ ] P3.6 Add narrowly scoped browser affordances without replacing existing 19 adapters wholesale or touching world/town maps.

**P3 exit:** Complex spell behavior and the shared human-controller surface work through server-owned, authorized, auditable lifecycle operations; acceptance scoped to the implemented spell set.

### P4 — Existing feature effects and shared resource integration

- [ ] P4.1 Build a per-feature matrix: acquired/configured → saved/rest lifecycle → shown on sheet → consumed by tactical effects → tested/deployed/accepted. Start from the registry; do not assume a configuration panel proves combat integration.
- [ ] P4.2 Audit Fiendish Resilience, Dread Allegiance, Cartomancer, Defensive Tactics, Primal Companion and species movement/vision effects **individually**. Prioritize by reproduced use case and owner approval.
- [ ] P4.3 Reuse `character_equipment_effects_v1`, shared damage mitigation, `encounter_timed_effects` and character resource authorities; do not introduce duplicate damage/AC/grant engines.
- [ ] P4.4 For each accepted gap, implement one isolated vertical slice with source, lifecycle, revoke/expiry, resource and browser/DB regression tests.
- [ ] P4.5 Evaluate spell-slot *current/remaining* printing as an optional fidelity enhancement only; current printable-sheet feature is already implemented.
- [ ] P4.6 Preserve v10 alchemy authority and crafted-item final stats before adding consumable action execution; check code/data parity before altering recipes.

**P4 exit:** A bounded, prioritized set of previously missing tactical consumers is implemented and tested without overwriting established source or equipment calculations. Remaining gaps stay explicitly recorded.

### P5 — Independent visual, content, and maintenance workstreams

- [ ] P5.1 Dice: retain existing tested 2.5D Forge cube tray; separately approve and test d4/d6/d8/d10/d12/d20 polyhedral visuals, then Character Sheet and tactical **result-only** adapters. Physics must not choose rules outcomes.
- [ ] P5.2 Sprites: obtain explicit visual acceptance of South-facing Dawn idle/walk **before** producing another full 8-direction atlas. Preserve animation/anchor/export contracts.
- [ ] P5.3 Portraits/Forge/Town: fix only reproduced defects; keep approved visual assets and character interaction/selection ownership.
- [ ] P5.4 Crafting/merchant/alchemy: preserve final crafted-item outcomes, inventory, recipe source and price authority. Test any genuine v10 mismatch before patching.
- [ ] P5.5 Optional build/style maintenance: establish reachability and regression coverage before removing stale Tailwind artifacts or consolidating global CSS. Do not mix into tactical migration work.
- [ ] P5.6 Database performance/security advisories: create individual call-site, grants and index evidence; don't apply blanket changes or confuse linter warnings with confirmed vulnerabilities.

**P5 exit:** Each separately approved workstream has its own scoped branch, acceptance evidence and registry update. P5 is **not** a prerequisite to resume P1/P2 research.

### P6 — Future admin tooling and Actor AI (design only until separately approved)

- [ ] P6.1 After the spell schema stabilizes, specify a versioned visual Admin recipe editor that only emits validated closed-vocabulary operations and requires GM review.
- [ ] P6.2 Preserve canonical imported source definitions and store optional campaign house-rule overlays separately, with provenance and rollback.
- [ ] P6.3 Design opt-in GM-controlled Actor AI and manual/AI-off modes; AI sees only permissioned, visibility-filtered legal actions and cannot roll, write game state or bypass server executors.
- [ ] P6.4 Build safe local/disposable proof fixtures, with explicit costs and security review. No automatic model deployment or paid usage.
- [ ] P6.5 Require new owner approval for each integration, release and data-access expansion; never treat this roadmap as permission to activate AI.

**P6 exit:** Approved designs and isolated evidence first; production usage requires explicit later authorizations and acceptance.

## C. Progress-tracking contract: what future chats must maintain

| Field | Canonical owner | Required format / invariant |
| --- | --- | --- |
| `active_phase` / `active_subphase` | `ACTIVE_WORK.md` | Example `P0 / P0.2`; exactly one next objective; never infer from unchecked list alone. |
| Phase status and blockers | `ACTIVE_WORK.md` | `IN RESEARCH`, `BLOCKED`, etc., with dated evidence links. |
| Capability implementation and gaps | `SYSTEM_REGISTRY.json` | Actual source, live DB, tests, deployment and browser acceptance tracked separately. |
| Verification snapshot | `PROJECT_STATE.md` | Exact dated SHA/deployment/database observation, not a live monitor. |
| Session-by-session audit trail | `HANDOFF_LOG.md` | Append-only receipts with S0–S7, exact result, failed checks, approvals and carry-forward tasks. |
| Stable owner decisions | `SPELL_ENGINE_DECISIONS.md` | Never silently reopen/replace approved choices. |
| Historical deletion and archive | `DOCUMENT_LIFECYCLE.md` | Evidence-checked, separate approval; historical code/PR facts preserved. |

### Required completion rules

- Do not mark `P#.#` complete because a PR was opened, a source validator existed, a test was green on a different SHA, or a deployment was READY.
- At a new chat, **re-verify** the next task's prerequisites; if an upstream change invalidates prior evidence, mark the task `BLOCKED` and record the contradiction.
- If an urgent regression changes priorities, update `ACTIVE_WORK.md` with the user-driven override and note which phase was paused. Do not silently change the roadmap.
- If one session stops mid-task, leave **its** checkbox unchecked and carry forward the smallest reproducible next action with source paths and failing/passing evidence.
- Update this roadmap only when owner priorities or independently verified implementation change; **do not rewrite the entire checklist** after every small commit.
- On handoff, a successor must be able to answer: *Which phase? Which exact task? Which branch and baseline? What already works? What is blocked? What evidence passes? What approval is missing? What single action comes next?*

## D. Short resume-and-close template

**At chat start:** `S0` identify exact authority → `S1` choose the single `ACTIVE_WORK.md` task → `S2` trace its real vertical slice. **During work:** `S3` narrow implementation → `S4` exact-revision evidence → `S5` explicit release gate. **Before stopping:** `S6` synchronize living docs → `S7` append handoff receipt and one next step. Link the exact `P#.#` task in each receipt.