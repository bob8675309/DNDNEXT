# C34 Issue #389 — live workflow drift and real job timing preflight

**2026-11-22 CST / 2026-11-23 UTC. INDEPENDENT CI SOURCE RESEARCH ONLY.**
Ownership: `research/c34-ci-efficiency-independent-20261121`, originally at commit `1065a3157ea544814724d4a5c1e0d1be6d1fa301`. This document does not alter the main branch, active PR #379, signed workflow, database, gameplay or required checks.

## 1. Actual live head and original-source drift

- `main` = `bb3939eeb9a38cf416996a1dca3b196b156b2915`.
- [Active held PR #379](https://github.com/bob8675309/DNDNEXT/pull/379), HEAD `2c9e9e4eec41300971b7e9b1e84c2442c46e9172` (draft), is the latest authority for C34 gameplay research.
- `.github/workflows/validate-c34-joint-local-auth.yml` at the original independent research branch has Git blob `9d30f81f820dda5d799ada5836a612b9276fbb1b`.
- **The live #379 version of this file is a DIFFERENT Git blob**, `7343fcffdca0ee76c0785b6e9e341b48a7951d2e`. It contains later P14/P16/P18/P19 signed gates and other steps. The independently passing unit source test `scripts/audits/test_c34_ci_filter_independent.mjs` intentionally pins its historical original workflow blob. Therefore old PASS is not acceptance of the current #379 workflow byte-for-byte.
- The live #379 workflow's **event filter** still has `pull_request` paths including `scripts/integration/c34/**`, `components/c34/**`, `utils/c34/**`, specific historical SQL/fixture paths and the workflow itself. Its **push** event still allows `scripts/integration/c34/**` or the workflow file on the designated research branch. `workflow_dispatch` is present. The original check job identifier remains `signed-real-original-research`; the job's `if` accepts manual dispatch, same-repository PR heads, and pushes to the exact C34 research branch.
- Consequence: a future classifier must be tested against **the current live workflow SHA and exact trigger list**, not silently reuse original source pin or declare current source unchanged. This is not permission to edit #379.

## 2. Verified separate expensive job durations, not guessed billed usage

GitHub Actions REST `/actions/runs/{id}/jobs` was read for all four executions below. Job time is `completed_at - started_at`; it is not the repository's billable-minutes invoice.

| Actual Actions run | Head | Job | Started (UTC) | Completed (UTC) | Elapsed seconds | Conclusion |
| --- | --- | --- | --- | --- | ---: | --- |
| [44894584649](https://github.com/bob8675309/DNDNEXT/actions/runs/44894584649) | `bd4f07f6ec858aeacb8f19f0664eb685c012f66e` | `signed-real-original-research` | 2026-11-21 10:29:32 | 10:43:49 | 857 | success |
| [44894595735](https://github.com/bob8675309/DNDNEXT/actions/runs/44894595735) | `4e831fc254867c1e69a9c1e3f7aab75092496036` | `signed-real-original-research` | 2026-11-21 10:29:41 | 10:41:30 | 709 | success |
| [44894654835](https://github.com/bob8675309/DNDNEXT/actions/runs/44894654835) | `dbb453a9d1eb3e04c113caa9d95414e2f7035428` | `signed-real-original-research` | 2026-11-21 10:30:26 | 10:42:13 | 707 | success |
| [44926792884](https://github.com/bob8675309/DNDNEXT/actions/runs/44926792884) | `f3219f5cb9c8d973eacff2f2889af3ad94fcc153` | `path-filter-proof` | 2026-11-21 16:50:55 | 16:51:08 | 13 | success |

The three overlapping signed jobs total **2,273 elapsed job-seconds (37 min 53 sec)**; this sum is not the elapsed clock window and **not** verified billable runner minutes or dollar cost. Each signed job showed 39 reported steps. The isolated source proof showed 9. Repeated expensive jobs show optimization potential, but only a dependency/source diff can establish whether any particular trigger was avoidable.

## 3. Candidate status-preserving design, no implementation authorization

A `paths: '!census.mjs'` exclusion is **not** merge-safe without confirmed required-check policy. GitHub connector previously returned branch-protection HTTP 403; ruleset list being empty did not settle the question. A filtered required workflow can leave a check Pending.

A safer *research candidate*, not an approved patch: keep both current workflow event filters unchanged and keep the existing **job identifier and status**. Before preparing PG17/GoTrue or npm dependencies, perform a conservative, unprivileged change classification using the appropriate event base/head and repository diff. Skip only expensive setup/signed steps when it is **provably a census/docs-only commit with no transitive signed dependency**. Otherwise **run all signed steps**: unknown/empty diff, GitHub diff API limits, changed workflow/script/fixture/SQL, mixed changes, unexpected renamed paths, manual dispatch, stale/missing PR base, fork/untrusted context, failed fetch, cancellation/reruns or ambiguous event. Never mark verified signed acceptance for unexecuted tests, even if a lightweight status is green. Ensure source provenance, warning telemetry and a separate explicit signed acceptance gate continue to distinguish a 'cheap-only source check' from 'signed PG17 PASS'.

A future isolated source test should lock the **current** workflow's event filter and job identifier, compare both old/new event/source dependency signatures, and exhaust negative/positive cases (push, PR, manual, mixed, fork, no-base, changed workflow, SQL, fixture, runner, docs-only, renames, and uncertain diff). Source assertions and cheap GitHub Actions cannot by themselves validate actual required-check configuration, billing, or complete production release safety.

## Explicit holds and next bounded task

- **No modifications** to `.github/workflows/validate-c34-joint-local-auth.yml`, `main`, PR #379, protected map, SQL, client, paid agent or PR merge; no real signed PG17 suite dispatched in this investigation.
- Required-status configuration remains **unverified**, and source-only filter model at 44926792884 is a **historical executable proof for old workflow blob**, not current-head release acceptance.
- **ONE NEXT TASK:** create an independent source-locked **current-workflow** classifier test with explicit fail-closed-to-full-suite cases for ambiguous diffs and a verified status-preserving job design, then run a cheap workflow from this independent branch; do not change production signed workflow or required checks without owner review.
