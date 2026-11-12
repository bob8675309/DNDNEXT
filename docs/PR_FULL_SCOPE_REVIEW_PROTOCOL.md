# DNDNext — Mandatory full-PR source, ancestry, feature and evidence review

**Owner directive, November 12, 2026:** Do not judge a pull request by title, the visible PR Files subset, or successful CI alone. Inspect the *entire changed-source and inherited branch tree*; preserve all owner-approved features, code, SQL, UI, fixtures, negative tests, source lineage and decisions before merging/retiring any PR. This protocol applies to **every future PR** and also remediates the **45 open drafts in the November 12 pre-#375-merge snapshot** recorded on 2026-11-12: **20 original source PRs and 25 additional research/audit PRs**.

> A successful automated Git blob inventory is only **source completeness evidence**. A feature-completeness and production-compatibility decision remains a reviewer responsibility. Do not label partial work as a completed integration.

## 0. Required source inputs (no skip)

1. Re-fetch live `main` SHA, PR HEAD SHA, PR base branch **and base SHA**, draft/merged status, and all paginated changed-file rows, including renamed/deleted paths. The exact Git blob SHA and whether each path is added, modified, renamed or removed matter.
2. Retrieve non-truncated recursive Git trees of **HEAD, its immediate base and current `main`**. Compute FULL HEAD-vs-main source differences, not only the immediate PR diff. **Stacked PRs inherit parent code even when their PR Files tab shows 3–10 files.** Record which inherited files are currently absent, different or identical on main.
3. Read **every immediate source file plus each relevant inherited subsystem implementation**—not just PR descriptions or CI status. Trace imports, UI→RPC→SQL→table/RLS/trigger, original unit/signed/browser tests and service consumers. A file list or hash equality alone does not certify intended behavior.
4. Enumerate all affected original features and consumers in a per-PR crosswalk, including any retired/transformed files. Assign one and only one disposition: `exact_copy` (blob SHA verified), `behavioral_successor_verified` (new code + source-authentic tests), `deferred_preserved` (named intact original commit/branch with reason and next task), `superseded_with_source_test` (explicitly proved non-regression), or `unresolved_blocker`. **No silent omissions, no ambiguous "done".**
5. Compare with current owner [I0–I6](PR_INTEGRATION_PRIORITIZED_PHASED_PLAN_2026-11-09.md), [original 20 dossiers](pr-integration/README.md), [2026-11-12 current 45-PR live register](audits/ALL_OPEN_PR_REGISTER_2026-11-12.json), [all recent PR changed-file parity manifests](audits/RECENT_PR_NO_LOST_WORK_REVIEW_2026-11-12.md), and the [full original Spell Engine source audit](audits/SPELL_ENGINE_AND_ORIGINAL_PR_NO_LOST_WORK_AUDIT_2026-11-12.md) first reviewed in #375 and safely merged to main as docs/CI only. Historic snapshots are not current facts.

## 1. Test acceptance hierarchy; preserve negatives

| Level | What a PASS actually proves | What is NOT established |
| --- | --- | --- |
| T0 — inventory/static | File metadata, immutable blobs, validator contracts and pure utility shapes | Executable behavior, user authorization, deployment |
| T1 — disposable SQL mock | A bounded simplified SQL fixture and mock role behaves as asserted | Genuine JWT, production RLS, full original trigger graph |
| T2 — real local GoTrue/PostgREST | Signed source-original RPC/role/rollback in local PG17 under stated fixture assumptions | Full real service configuration, browser, production grants/ACL |
| T3 — component Chromium | Tested React component user clicks in isolation | Complete Pages Router, navigation, runtime/Auth/Storage flow |
| T4 — real application browser | End-to-end signed application flow in a compatible staging environment | Production backup/restore or multi-session cross-command safety unless specifically tested |
| T5 — real post-release smoke/restore | Verified deployed SHA plus controlled user-visible behavior, data integrity and independent encrypted DB+Storage restore evidence | Untested unrelated systems or all future content |

- Require explicit **original failing RED** before a scratch Option A GREEN when a regression is being repaired. Preserve historical failures and expected negative cases; never rewrite original fixtures to produce only green logs.
- Every material changed HEAD SHA invalidates the old "final-head all green" claim. Verify the actual job steps and source log evidence, not just summary badges. PR #373 is the concrete example: prior I2I 11/11 passed; an intervening documentation-inclusive commit failed a strict report-wording assertion; the CI was repaired; [run 43324887497](https://github.com/bob8675309/DNDNEXT/actions/runs/43324887497) subsequently passed **I2I-01..11** and all inherited signed jobs at exact `b1b6a5179aee3bb27a0bf534c3e001b4222ba642`.
- Source MD5 guards, production SQL role/schema access, GoTrue signatures, RLS, replica fidelity, two-user/encounter locks, original negative tests and full browser acceptance are separate, never interchangeable evidence.

## 2. Safe merge, deployment and original PR retirement

- **Research→research** merge is not production deployment. [#372](https://github.com/bob8675309/DNDNEXT/pull/372) merged only into #371's held research branch; it must not count as a runtime implementation on main. A merged GitHub badge is insufficient without checking base.
- **Docs/source-only→main** merges #348 and #374 were narrow: #348 **38 docs/AGENTS files**, #374 **8 P1 parser/preflight/workflow/handoff paths** (exact source-binary P1 hashes). They do not release #309 Eldritch Blast, #312 Fire Bolt or delegated NPC control, #317 combat locks, #345 NPC secure panel or original Forge Story/trigger SQL.
- **Main integration may trigger automatic Vercel deployment.** Verify linked SHA, successful build/READY status and separate real-browser acceptance; do not conflate them.
- New public or private `SECURITY DEFINER` functions, grants, RLS, schema/typed intent, player/GM/creator data, Storage, game tables, encounter commands and actor effects require coordinated source, ACL, signed Auth and restore test gates before production. No partial UI before compatible SQL or isolated E-first RPC before universal lock order.
- Preserve current 19 production source-qualified XPHB spell adapters, full Deployed Tactical Effects engine, independent World Map/town/tactical maps, Pages Router+Bootstrap/SCSS, D&D 2024 source identity and GM-assisted fallbacks, original NPC privacy/GM Story, inventory/merchant resources, real signed character creation and source choices.
- No destructive branch cleanup, PR closure or claim "all original work integrated" unless **every relevant original file/feature/test** has a recorded and reviewed disposition. Paid agent PR #325 is I6 last and OFF without explicit approval. Independent encrypted DB+Storage restore remains a production gate.

## 3. Future PR author/reviewer contract

GitHub [PR template](../.github/PULL_REQUEST_TEMPLATE.md) contains five named required sections:

1. **Scope and inheritance:** target/base/HEAD and *entire inherited* source, plus single deliverable.
2. **Original sources and preserved work:** full upstream PR list, source hashes, UI/SQL/data/negative tests and exact copied or behaviorally replaced contributions.
3. **Changes intentionally deferred:** exact original filenames/SHAs and why untouched; never "nothing left" without whole-feature proof.
4. **Testing and evidence:** exact latest HEAD checks, signed user/browser/DB fixture labels, expected RED and rollback.
5. **Release and rollback:** production risk, grants/RLS, data restore, main auto-deploy and owner authorization.

New PRs created on/after **2026-11-13 00:00 UTC** fail the automated scope check if sections are missing or unfilled; existing drafts are warned, not silently rewritten. Unfilled HTML comments are not evidence. A completed template still **does not prove semantic accuracy**; reviewers must compare it with actual source.

## 4. Automated and manual enforcement

The free [`.github/workflows/audit-pr-full-inheritance.yml`](../.github/workflows/audit-pr-full-inheritance.yml) uses:

- **`pull_request_target`**, `opened/reopened/synchronize/edited/ready_for_review`, for new/changed PRs where the trusted workflow runs; checks out the **trusted default branch only**, never executes PR HEAD code, uses **read-only GitHub token**, fully paginates PR file lists and source/head/base/main Git trees. It posts a detailed GitHub Step Summary and retains JSON evidence.
- **`workflow_dispatch` with PR number** for original/stacked branches where the PR-base event may not pick up the workflow. This manual audit is **mandatory for a research-stack PR that does not get an automatic check**, especially one whose base predates workflow installation.
- **`pull_request` self-test** for changes to the audit workflow/validator/manifest itself, without remote token calls in PR code. The historical 45-PR and recent 29-PR scope manifests have their own static fail-closed validator.

**Non-negotiable limitation:** GitHub does not automatically make the workflow a required branch-protection check merely because a workflow file exists. A repository maintainer must verify/enable required status checks in branch protection or rulesets, including the trusted inventory job when supported, and separately require source/feature review and approvals. This assistant cannot claim branch protection is configured without API proof. A green automated audit is NOT full line-by-line source equivalence, permission safety, production readiness or a PR merge authorization.

## 5. End-of-session and change-cycle requirements

For every material audit or implementation: pin the before/after HEAD, list **all original source files/PRs** and inherited changes, record missing/excluded contributions and why, run exact-head checks, append to `docs/HANDOFF_LOG.md`, and update `docs/ACTIVE_WORK.md` with a **single next action**. If the user reports an omitted feature, reopen the full original PR/branch review rather than rationalize the narrower extraction.

**ONE NEXT TASK (current):** check PR #373's exact-head Admin source RED/scratch GREEN source/coverage review against all inherited I2-F/G/H gates, then permit only a separately validated research-parent merge; keep 22 legacy writer/consumer gaps and full production SQL/role/browser/restore gates explicitly unresolved. Continue I0–I6, including complete #309/#312 source and P2 parity/executor security integration, without silent original PR closure.
