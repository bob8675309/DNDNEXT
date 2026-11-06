# DNDNext — Append-only Development Handoff Log

> See [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md) for S0–S7 gate reporting and P0–P6 milestones. P0.1–P0.7 are recorded as complete on dated evidence below; repeat verification before any new deployment.

> This log records what was verified or actually changed. Do **not** replace older entries when a new chat begins. Use [HANDOFF_RECEIPT_TEMPLATE.md](HANDOFF_RECEIPT_TEMPLATE.md); link exact PR/head, tests and deployment. The snapshot dates here are historical after publication.

## 2026-11-01 — Whole-project documentation reconciliation, local preparation

- **Base reviewed:** GitHub `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`; Vercel production READY at the same SHA.
- **Research:** #309 open draft (head `a24006624380570bd693a768e97a0c689f1d42b5`); #312 open draft stacked on #309 (head `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`). Draft code and successful isolated JWT tests do not mean main/live code was changed.
- **Read-only database:** 243 recorded migrations, 253 public functions and 292 private functions; live core-action replay authorization weakness confirmed from function text; two active encounters and one character represented in both; v10 alchemy sampled as live; no `request_intent` or `can_control` column.
- **Verified source corrections:** official NPC printable sheet is integrated; Forge reusable 2.5D cube dice exists; PR #301 unified workspace/rest is merged; v10 breath recipes exist live; runtime resistance helper is not called by the live shared damage function.
- **Prepared scope:** system registry, current state, active work, evidence-based handoff log, document lifecycle, and read-only registry validator; corrections to active documentation entry points and two outdated feature headers.
- **No production action:** no DB writes, grants, pushes, merges, rollouts, destructive file removal or new Vercel deployment. This entry is part of a **locally prepared, unpushed documentation change**, not a remote commit receipt.
- **Testing limits:** source/read-only database inspection completed. New docs validator and patches require execution against the actual checkout before push; no new signed-in browser smoke was run.
- **Next one task:** review the documentation-only patch on a clean checkout, run `node scripts/validate_handoff_registry.mjs`, inspect `git diff`, then seek explicit push approval.

---

**Add newer dated receipts above this divider or below it consistently; never silently rewrite the evidence in this initial audit receipt.**
## 2026-11-01 — P0 documentation review branch (separate continuation receipt)

- **Target:** `docs/p0-handoff-registry-20261101` based on audited `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`; fetch actual branch HEAD/CI from GitHub because a commit cannot embed its own final SHA.
- **Scope:** eight existing documentation entry points corrected without deletions, plus seven handoff/registry documents and one read-only validator. Phased S0–S7 and P0–P6 objectives added.
- **Verification:** exact old text anchors matched on audited `main`; all 58 registry source/test references existed in the GitHub tree; staging fixture and structural validations passed. A complete local repository checkout and authenticated browser acceptance were **not** executed in this session.
- **Release status:** documentation-only review branch, **not merged**. No live Supabase writes, grants, manual deployment, world/town map changes or gameplay modification.
- **Remaining gate:** review actual branch diff, verify exact-head CI and run the registry validator in a complete checkout; obtain explicit approval before merging. Continue at `P0.6` in `ACTIVE_WORK.md`.

## 2026-11-01 — P0.1–P0.6 review and exact-head validation

- **Review:** PR [#313](https://github.com/bob8675309/DNDNEXT/pull/313) is a docs-only delta from audited `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`, initially 16 paths: eight existing doc edits, seven new docs, one read-only validator; no deletion, SQL or gameplay modification. An additional scope-limited `.github/workflows/validate-handoff-registry.yml` was added to test the validator on actual GitHub checkout.
- **CI evidence:** exact-head full-checkout validator succeeded at `6beb583770c3152f4fa5d7e848e5714d1b80ca19` ([run 41362632909](https://github.com/bob8675309/DNDNEXT/actions/runs/41362632909)); both other `validate` jobs also passed there. The verifier confirms all 18 system entries, linked source/test paths, phase headings and required document links. All latest-head results must be checked again before merge.
- **Approval:** Owner said `PROCEED` after being informed of the review/merge gate, authorizing the documentation review and merge contingent on passing checks. **No** approval was given to execute combat database migrations or deploy research code.
- **P0 objective state:** P0.1–P0.6 evidenced as review, checkout validation, navigation, classification, preservation and approved PR. P0.7 remains explicitly open until PR merge, Vercel production SHA and final handoff receipt are verified.
- **One next task:** `P0.7` — verify exact post-merge source and deployment and append receipt; then move to read-only `P1.1` command writer/lock-order inventory.

## 2026-11-01 — P0.7 merged production documentation foundation; handoff to P1.1

- **Review and merge:** [PR #313](https://github.com/bob8675309/DNDNEXT/pull/313) squash-merged into `main` at `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b` after final PR-head `97c819a3f646a0e11934cc922aafa3cc0a34d712` recorded four successful GitHub checks, including the dedicated full-checkout `handoff-registry` job.
- **Production verification:** Vercel deployment `dpl_8LeoXePm93rcz69rABa3B5ZoadpG` was independently observed READY in production with Git SHA `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b`; post-merge GitHub `handoff-registry` also completed successfully at that SHA.
- **Boundaries:** No gameplay JS, SQL migration, grant, Supabase data mutation, world/town map edit, AI action or research PR #309/#312 modification. Deployment occurred automatically because a documentation-only `main` merge triggers Vercel; READY does not imply owner browser acceptance.
- **Closure:** P0.1–P0.7 checkboxes have been marked on documented evidence. The living one-next-task pointer in `ACTIVE_WORK.md` advances to `P1 / P1.1`: **read-only deployed encounter command writer/replay/lock order inventory**. Do not deploy private core-action or spell-recipe research in this milestone.
- **Caveat:** This closeout receipt is committed in a separate docs-only follow-up, whose own SHA/deployment may supersede this observed checkpoint. Always verify the new branch and `main` after any follow-up merge.

## 2026-11-01 — P1.1 read-only live tactical command and resource inventory

- **Base/source:** production main `e10f2b28da8181cdc59bc47797f07c5f4d058c3d` (P0 complete); PR #309 draft head `a24006624380570bd693a768e97a0c689f1d42b5`; PR #312 draft head `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254` stacked on #309. Verify freshness before any next session.
- **Queries:** SELECT-only live `pg_proc`, `pg_get_functiondef`, function grants, `pg_constraint`, RLS/policies, triggers and aggregate counts. No mutating public RPC was called. Full scoped evidence [P1.1 matrix](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md) and repeatable [SQL](../scripts/audits/p1_encounter_command_authority_readonly.sql).
- **Observed:** 22 public spell-cast functions (14 ledger processors, eight wrappers); 22 direct public command-ledger inserters (18 authenticated-executable); zero existing request-row requested_by comparisons in direct replay logic. Additional Admin and character-rest/slot/feature resource writers outside the ledger, plus trigger-induced cross-locks. Legacy core/movement/end/attack duplicate checks can precede reauthorization; save and Admin effect have earlier guards, while reaction has an already-resolved pre-guard return. Do not assert every function has the same risk.
- **Other boundary:** 2 active encounters, 4 character participations, 3 distinct characters, one present in two active encounters (aggregate only). No live double spend or deadlock observed. Client source traced in combat/play/live/workspace, sheet resource module. PR #312 evidence is research only, no public candidate installed.
- **Status:** P1.1 read-only inventory evidenced complete; security defect **NOT remediated**. New documents prepared on an isolated docs research branch for review. No world/town map edits, prod SQL, auth grants, live data modifications, rollout or browser acceptance.
- **Next single task:** P1.2 canonical typed immutable request and replay policy design across all relevant command/actor/resource families. Require explicit review before P1.3 lock-order changes.

## 2026-11-01 — P1.2 proposed immutable command identity/replay policy (research only)

- **Source:** merged P1.1 on main `7727d75a92abb5904fdb7fd4e109accfe8e4603f`; live SELECT-only command ledger count 78, 20 null requester and zero null result rows. This is an aggregate snapshot, not requester provenance.
- **Proposal:** [P1.2 contract](P1_2_Command_Replay_Contract_2026-11-01.md) documents thirteen command-intent families, completed/pending/legacy/revoked replay decisions, same-NPC multi-controller isolation, role/visibility barriers and P1.3 locking dependencies.
- **Evidence boundary:** Declarative acceptance-case matrix plus pure Node checker verify **document coverage only**; they do not test JWT/SQL concurrency or demonstrate a fixed security vulnerability.
- **Owner gates:** R1 legacy fail-closed, R2 revoked-controller cache denial, R3 named trusted service principal, R4 same-character two-encounter resource policy (deferred to P1.5). P1.2 checklist intentionally remains unchecked until review.
- **Next one task:** review and approve/amend P1.2 proposal before starting P1.3. No production SQL, grants, gameplay, world/town maps or NPC delegation deployed.

## 2026-11-06 — Research docs-maintainer operational closeout (agent PR #325; draft, no paid API)

- **Authority / scope:** Owner requested that legacy 2014 PHB content become an optional Admin-controlled campaign setting, analogous in UX to Future weapons & armor. This request is **design-only** in [Legacy PHB content decision](Legacy_PHB_Optional_Content_Design_2026-11-06.md), not a completed toggle or live migration; 2024/XPHB remains canonical. The owner separately requested that the research agent maintain the documentation as engineering changes occur, without extra API charges.
- **Agent source:** `agent/research-orchestrator-20261105` draft [#325](https://github.com/bob8675309/DNDNEXT/pull/325), functional implementation verified at exact SHA `51428cf99a433b23190e32d188f987e4e711d04f`. [Source validation 42241801501](https://github.com/bob8675309/DNDNEXT/actions/runs/42241801501) **SUCCESS**; no paid Codex run or API key configured by this work.
- **Docs source / status:** `.github/workflows/research-docs-maintenance.yml`, `scripts/agents/research_docs_maintainer.mjs`, `scripts/agents/validate_research_docs_maintainer.mjs`, and `docs/Research_Docs_Maintenance_2026-11-06.md`. Automatic publisher [42241789973](https://github.com/bob8675309/DNDNEXT/actions/runs/42241789973) **SUCCESS** for the agent branch; the parallel Forge branch publisher [42242114281](https://github.com/bob8675309/DNDNEXT/actions/runs/42242114281) **SUCCESS**. Their status files live under `docs/research-status/*.generated.md` on the independent `docs/agent-status` branch, not the PR heads. The controller rejects source/fixture patches without **both** `docs/HANDOFF_LOG.md` and affected living Markdown updates; these are proposals on held research only.
- **Errors recovered:** The initial GraphQL mutation used `refName` rather than `branchName`; fixed. A new docs scope guard initially masked protected-file violations; check order corrected. Pushing generated docs onto the working PR caused `action_required` CI approvals; resolved by publishing to a dedicated archive branch. The **latest exact-head checks are green**; earlier failed runs are historical, not unresolved at this checkpoint. The generated status is evidence, not a CI acceptance claim.
- **Forge cross-check:** Held draft [#324](https://github.com/bob8675309/DNDNEXT/pull/324) source SHA `2cb408c784b2a46699eca82574eeeb4dffb1562a`, [PG17 and true local GoTrue J00–J153 run 42242127957](https://github.com/bob8675309/DNDNEXT/actions/runs/42242127957) **SUCCESS**, 15/31 original creation-table trigger DDL staged and three conservatively receipted original handler suites. This does **not** establish full live RLS, original catalog parity, cross-table grant concurrency, browser signoff, or Vercel deployment.
- **Production and policy:** No production database SQL, app runtime, world/town/tactical map, deployment, PR merge or paid model work. Existing preview suppression is temporary and project-wide. Historical handoff paragraphs remain valid as historical snapshots but cannot override current head/CI evidence. No source has been removed.
- **Next bounded task:** Continue the held original Forge progression-trigger fixture inventory using the independent zero-cost evidence audits; review 2014 PHB campaign toggle at a later separate server/UI design gate, and keep the original source-selection ambiguity explicit. Do not merge or release until the owner separately approves scope and rollback.

## 2026-11-06 — New-chat research touchstone (draft agent navigation)

- **Owner goal:** make the existing research coordinator a reusable new-chat point of reference while preserving the repetitive, no-cost original Forge trigger audit and separate authenticated fixtures. The architecture stays modular: central navigation and scope contract, independent free trigger/JWT/CI/docs workflows, and manual-only paid Codex research.
- **Proposed additions:** `docs/AGENT_TOUCHSTONE.md` on draft agent PR #325 and the separate `docs/agent-status` archive; links added to research-branch `docs/README.md` and `docs/START_HERE_ACTIVE_HANDOFF.md`. The touchstone lists mandatory main-source read order, latest generated snapshots, held PRs, source-of-truth gates, and copy-ready new-chat instructions.
- **Evidence boundary:** the archive is a stable **document URL**, not an independent persistent AI agent, connector endpoint, transcript reader or promise of live background work. No automatic inference of production acceptance from staged trigger DDL or PR CI.
- **No-cost safety:** this handoff adds navigation/validation documentation only. No source fixture SQL, runtime code, production database, Vercel release, paid AI invocation, or PR merge. The separate docs snapshot workflow continues updating factual per-branch status; handoff and system contracts require authored review.
- **Next bounded task:** in the next DNDNext research chat, open the stable touchstone, verify current main/Forge/agent SHA and exact-head CI, then choose one missing original trigger for source-exact disposable authenticated acceptance without disturbing the held locks/privacy work.

## 2026-11-06 — Free GitHub project-health collector (prototype-only, pending exact-head CI)

- Owner confirmed that ChatGPT Work is to remain **on demand for difficult engineering investigations**, with no scheduled Work tasks or purchases. DNDNext remains a **prototype**: NPCs, inventories, characters and campaign content are test data, not live active-player state; destructive operations still require an explicit isolated fixture boundary.
- Building a consolidated `docs/PROJECT_HEALTH.generated.md` report on the held agent PR #325 using read-only GitHub PR/workflow APIs and existing Forge/agent archive snapshots. Its separate pure validator tests successful/pending/failed exact-head checks, stale Forge evidence and explicit release boundaries. It cannot assert deployed production SHA or post-capture CI conclusions.
- The free owner-push publisher will update **only** the existing per-research-branch status and the consolidated `PROJECT_HEALTH.generated.md` on `docs/agent-status`, atomically with `expectedHeadOid`. No source PR head, main branch, production SQL or application runtime changed. The current branch implementation and exact-head CI must be verified before this record is marked accepted.
- Next bounded verification: confirm health collector source tests and GitHub API permissions, archive publication and no new Vercel previews, then extend the same verified script to held Forge PR #324.
