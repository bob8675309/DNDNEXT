# DNDNext — Active Work Contract

> **2026-11-04 read-only continuation at draft PR #317:** [Historical P1.3 source recovery, G/I writer audit, and delegated-character acceptance](P1_3_Historical_Recovery_Inventory_Grant_Delegation_2026-11-04.md) checked closed research PRs #251/#253/#255/#259/#299/#304 plus held #309/#312 against live DnDWeb. Source findings are **not** new concurrency test passes or installed fixes. Owner prefers GM-configurable full character handoff, player-created underlings/alternates without required preapproval, plus an Admin creation notice and GM post-creation control and temporary NPC combat control with player-safe, individually scoped sheet visibility. Specifically verify spell profiles **v1 and v2**, tagged PC full-sheet read RPCs, and deferred Forge item materialization. Active P1.3/P1.5 stay open. **One next task:** source-derived disposable GoTrue/PG17 Admin grant-revoke vs original equip/transfer I race, including exact row-lock/FK waits, then deferred Forge materialization effects; do not select a global G/I/S/C order from source inspection alone. No live SQL/grants/merge/gameplay or manually requested deployment authorized.

> **2026-11-04 updated owner decision:** [Character Creation / Admin Notices / Delegated Rights](CHARACTER_CREATION_ADMIN_NOTICE_AND_DELEGATED_RIGHTS_2026-11-04.md) approves reusing Forge for alternates/underlings with **immediate creation (no approval gate)**, an informational Admin notice, and after-creation NPC-page permission/GM-note management. A safe permissions redesign is authorized for research and review, not unilateral production alteration. The existing `player_character_created` level event can be an Admin-only notice source; test replay/idempotency and multiple-character assumptions. This replaces the prior 2026-11-04 provisional pending-approval wording. **Next P1.3 lock-research task is unchanged.**

> **Planning snapshot:** 2026-11-01. Re-verify branches, CI and production before using these SHAs. This is the **one active-session task list**; it is not permission to deploy or merge. Product decisions remain in [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md).

## Current activity: P1.3 global transaction and lock-order research

**Active phase / subphase:** `P1 / P1.3` — investigate [deployed cross-command lock graph](P1_3_Global_Lock_Order_Research_2026-11-01.md) and prepare disposable two-session concurrency proof. P1.2 [contract](P1_2_Command_Replay_Contract_2026-11-01.md) was merged in PR #316 as research direction; it is **not deployed combat behavior**.

**Status:** `IN RESEARCH / NOT PROVEN` — current static evidence finds lock-class inversions; no actual production deadlock demonstrated and **no accepted universal order**. Owner selected **TC1 Option A** (one active encounter per canonical character), but no guard or live reconciliation has occurred.

**Latest validated research (2026-11-03):** [Signed-in grant/controller revocation plus live-policy RLS model](P1_3_Grant_Revoke_Controller_and_RLS_2026-11-03.md) **cases 142–156 PASS** in [run 41709639824](https://github.com/bob8675309/DNDNEXT/actions/runs/41709639824), source/test SHA `04b8d784`. The previous I-only guard admitted an attack during an uncommitted Admin G revoke; E→P→L→I→G→W research guard waited for Admin and denied after revocation. The exact original Admin staging API refused active reassignment; an explicitly **modeled-only active Admin E/P writer** serialized controller changes and R2 replay. Critically, **deployed-policy predicates allow an unrelated signed-in user to read the full sheet of a VISIBLE NPC** (case 151, synthetic rows), while hiding inaccessible hidden NPC sheets; owner visibility policy remains OPEN. **Global grant/resource lock safety and production protection not established.**

**Objective:** Establish source-complete, safe transaction and lock discipline across all 22 cast names, eight nonspell ledger writers, Admin/non-ledger resource writers, reaction and expiry triggers, and shared canonical slot pools before any migration.

**Scope:** Read-only live definition/trigger/SQL audit, machine-readable class-order graph, static CI checks and proposed disposable PG race fixtures. **No live mutations, grants, public combat edits, world/town map work, or AI.**

**Disposable fixture:** [PG16 Option A two-session test matrix](P1_3_Option_A_Concurrency_Model_2026-11-01.md) **PASSED in GitHub run 41385726293** at `cd2c070`; its synthetic inverted L/E sequence produced a real PostgreSQL deadlock in scratch tables. Production RPC, trigger and permission-order behavior is untested. Source review now confirms **paused→active** also needs an Option A guard.


**Verified P0/P1 releases:** Documentation PRs #313/#314 and P1.1 #315, P1.2 #316 merged. Source baseline for P1.3: `51c351a142d03378dff8e47e05182afe21a15622`; refresh GitHub main, Supabase and deployments before relying on it. PRs #309/#312 remain held research.

**Next single action:** (2026-11-03) [Continue I/G/X/S/C global source lock research](P1_3_Grant_Revoke_Controller_and_RLS_2026-11-03.md): locate original **G→I versus I→G** inventory/permission/crafting/trade/level-up writers and test conflict schedules, including Admin activation and S/C resource bridges. Owner decision also needed: **are full sheets of visible NPCs meant to be player-readable, or only player-safe summaries?** No unilateral live RLS edit. P1.3/P1.5 remain OPEN; R1/R2 approved but undeployed, R3 unresolved, TC1 Option A undeployed, `Unknown Events` timing open. **No production SQL, grants, merge, gameplay or world/town map changes authorized.**

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
