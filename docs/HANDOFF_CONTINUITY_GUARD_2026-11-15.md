> **NOVEMBER 15 IMPLEMENTATION REVISION — PR #380 DRAFT, NOT INSTALLED ON MAIN:** The candidate now includes the complete paginated open-PR metadata publisher alongside the authored-handoff guard. The guard reads only trusted default-branch code and PR Git objects; new PRs created **from 2026-11-16T00:00:00Z** are enforced, while all earlier PRs (including held #345 and #379) are **advisory only** to avoid retroactive blockers. The existing #327 publisher still retains its four-PR detailed CI report, and the NEW complete open-PR index records **metadata only**, not PR acceptance. None of these proposed mechanisms is an active required merge check until reviewed, merged, activated and independently verified.

# DNDNext — Authored handoff continuity guard (proposal, 2026-11-15)

## Why this exists

The merged #326 handoff contract and #327 free research-status publisher were useful but did not guarantee that each source change carried an up-to-date authored engineering receipt. The existing publisher in `research-docs-maintenance.yml` watches owner pushes under `research/**` and `agent/**`, publishes a dated snapshot to `docs/agent-status`, and queries only four historical PRs (#317/#321/#324/#325) for consolidated project health. Its generated reports cannot reconstruct the developer's reasons, actual source-compatible behavior, hidden defects, owner decisions, or the current T27 scope.

**Preserve #325–#327 and all historical source/evidence documents.** This proposal adds one bounded, read-only *acceptance check*; it does **not** replace the publisher, enable paid #325, edit game source or promote the research branch #379.

## New mechanical contract

The proposed `validate-handoff-continuity.yml` invokes the audited default-branch copy of `scripts/agents/check_handoff_continuity.mjs`, not untrusted PR HEAD code. The job has read-only `contents` permission and no production token or database access. For substantive changes under `pages/`, `components/`, `lib/`, `utils/`, `hooks/`, `styles/`, `sql/`, `supabase/`, `scripts/`, `public/`, GitHub workflow/action paths or key app/host configuration, it checks:

1. **Both** `docs/ACTIVE_WORK.md` and `docs/HANDOFF_LOG.md` differ from the actual Git merge base to PR HEAD; this is not a generic dated global snapshot.
2. `HANDOFF_LOG.md` is **strictly append-only** compared with the merge-base content, and the addition contains a substantive dated receipt with an explicit next action.
3. The last source-changing commit in the PR is **not newer** than the last `HANDOFF_LOG.md` update. Later source commits require a new source-aware closeout.
4. It fails closed for unresolved Git ancestry, missing/rewritten handoff documents, malformed source SHA inputs and untraceable source history. It does not auto-correct or infer missing decisions.

Documentation-only changes are not automatically required to duplicate the two authored files; **meaningful research, decisions and audits still carry the existing mandatory manual receipt policy**. Existing PRs created before the 2026-11-16 UTC cutoff are checked only for **advisory warnings** and are never retroactively blocked solely by this proposal. Existing research branches are not modified or retired. The source-policy gate is separate from the existing complete-PR provenance audit and its five-section owner-review contract.

## Evidence, acceptance and limits

- `scripts/agents/test_handoff_continuity.mjs` runs offline Node + isolated Git repositories and covers missing docs, successful source-then-closeout, stale receipt after later source, rewritten historical entries, docs-only changes and partial handoffs. These are mechanical tests, not owner acceptance or behavioral game tests.
- A freshly authored but inaccurate or incomplete receipt could still pass: reviewers must compare it against source/SQL, negative tests, browser evidence and owner decisions. The candidate adds a **separate fully paginated all-open-PR head/base/draft/updated inventory** without replacing the original four-PR detailed CI assessment. This metadata index is a navigation aid; it cannot prove all open PRs passed CI, document every branch, or reconstruct decisions.
- A GitHub Actions result is **not automatically a required branch-protection check**. A maintainer must explicitly approve enabling the relevant GitHub ruleset/status requirement after confirming existing stacked PR compatibility. Before main integration, the draft's `pull_request` self-test can run, but the trusted `pull_request_target` job only activates once the workflow is on the targeted base branch.
- GitHub cannot infer conversations or uncommitted owner decisions. Those must be recorded explicitly in Git, with evidence labels distinguishing deployed, signed scratch, current-browser, pending and rejected.
- No automatic PR merge, deletion, release, Vercel preview/deployment, hosted Supabase SQL, secret handling, AI/model invocation, or world/town/tactical map change is authorized.

## Rollback

The candidate is additive (one new read-only enforcement workflow, two original guard/test scripts, two read-only PR-index renderer/test scripts, narrowly extended existing free publisher/validators, and authored documentation updates). If enforcement semantics or trusted-branch event behavior fail, disable/remove the **new workflow** in a separately reviewed scoped PR. If the metadata publisher fails, revert the added third-file archive output and retain the original two-file publisher, the four-PR detailed report, and prior #326 handoff contract intact. No data/schema/gameplay rollback is involved.

## Current workstream and next action

C34 research #379 T26 and the owner-protected production/recovery gates remain the authoritative gameplay/privacy context. The next engineering task after this **process-only CI review** is still **T27 shared Profile/town/merchant stock/wallet consumer and rollback compatibility, plus delayed stock-response-after-logout signed scratch negative**, not a release of #345 or #379. Verify the isolated continuity PR's exact HEAD/self-tests, all-open-PR index tests and complete full-PR scope before seeking owner approval for any integration.

## Complete PR metadata publisher (same isolated PR; no automatic acceptance)

The existing `.github/workflows/research-docs-maintenance.yml` remains owner-push-only for `research/**` and `agent/**`. A bounded new **read-only GitHub API step** uses `gh api --paginate` to capture every open PR returned by `GET /pulls?state=open&per_page=100`. The pure renderer `scripts/agents/render_open_pr_index.mjs` validates unique PR numbers, `open` state, real head/base SHAs, draft status and timestamp; it writes a standalone generated `docs/OPEN_PRS.generated.md` beside the existing `docs/PROJECT_HEALTH.generated.md` and the per-source status snapshot in **one atomic expected-head archive commit** on `docs/agent-status`. No `main` write.

The dedicated offline validator `scripts/agents/validate_open_pr_index.mjs` uses **215 synthetic PRs** (more than two API pages) to prove the renderer does not truncate, plus malformed SHA, duplicate, merged-status and invalid draft failures. These synthetic cases are **not** current repository PRs. Actual workflow/API pagination and archive atomic publication must be verified after activation with a qualifying owner research-branch push.

The detailed CI health report still verifies only **four anchor PRs** (#317/#321/#324/#325) as historically designed. The all-open-PR catalogue **does not fetch GitHub Actions runs for every PR**; it never labels 44 or another number of open PRs as tested. GitHub time-stamped lists also exclude 371 branch-only refs unless they have open PRs. The publisher remains scheduled **only by qualifying owner pushes**, never cron or paid AI.

### Backward-compatibility gate boundaries

- New PRs created **at or after 2026-11-16T00:00:00Z** require both authored handoff files for material changes.
- Older and stacked PRs (#379 C34, #345 secure profile, historical Forge and Spell Engine) produce **ADVISORY LEGACY PR** and warning messages for missing receipts; no automatic failure purely from old source history.
- The trusted-workflow checkout must use **default branch** so the auditor exists even when a research parent predates it. The job fetches and verifies the exact PR head **and** base branch refs as inert Git objects, never executing PR code.
- The new gate is not live merely because its draft PR self-tests pass. A target-branch workflow event and later GitHub required-status rule are independent reviewed steps.
- A meaningful owner decision made only in conversation still must be recorded explicitly; no bot can infer it from source hashes.

### Historical context preserved

The owner remains concerned about 44+ open PRs, inherited source/test provenance and stale handoffs. Full source/feature/negative-test review protocol and original 20 PR dossiers are the authority for completeness. This candidate addresses **freshness visibility and all-open-PR navigation only**, not full semantic documentation coverage. T27 stays the next domain task after this bounded process review.
