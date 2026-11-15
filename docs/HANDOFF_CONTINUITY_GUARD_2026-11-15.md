# DNDNext — Authored handoff continuity guard (proposal, 2026-11-15)

## Why this exists

The merged #326 handoff contract and #327 free research-status publisher were useful but did not guarantee that each source change carried an up-to-date authored engineering receipt. The existing publisher in `research-docs-maintenance.yml` watches owner pushes under `research/**` and `agent/**`, publishes a dated snapshot to `docs/agent-status`, and queries only four historical PRs (#317/#321/#324/#325) for consolidated project health. Its generated reports cannot reconstruct the developer's reasons, actual source-compatible behavior, hidden defects, owner decisions, or the current T27 scope.

**Preserve #325–#327 and all historical source/evidence documents.** This proposal adds one bounded, read-only *acceptance check*; it does **not** replace the publisher, enable paid #325, edit game source or promote the research branch #379.

## New mechanical contract

The proposed `validate-handoff-continuity.yml` invokes the audited default/base-branch copy of `scripts/agents/check_handoff_continuity.mjs`, not untrusted PR HEAD code. The job has read-only `contents` permission and no production token or database access. For substantive changes under `pages/`, `components/`, `lib/`, `utils/`, `hooks/`, `styles/`, `sql/`, `supabase/`, `scripts/`, `public/`, GitHub workflow/action paths or key app/host configuration, it checks:

1. **Both** `docs/ACTIVE_WORK.md` and `docs/HANDOFF_LOG.md` differ from the actual Git merge base to PR HEAD; this is not a generic dated global snapshot.
2. `HANDOFF_LOG.md` is **strictly append-only** compared with the merge-base content, and the addition contains a substantive dated receipt with an explicit next action.
3. The last source-changing commit in the PR is **not newer** than the last `HANDOFF_LOG.md` update. Later source commits require a new source-aware closeout.
4. It fails closed for unresolved Git ancestry, missing/rewritten handoff documents, malformed source SHA inputs and untraceable source history. It does not auto-correct or infer missing decisions.

Documentation-only changes are not automatically required to duplicate the two authored files; **meaningful research, decisions and audits still carry the existing mandatory manual receipt policy**. Each old PR is assessed when its trusted-base workflow next runs; no historical PR is automatically changed or retired. The source-policy gate is separate from the existing complete-PR provenance audit and its five-section owner-review contract.

## Evidence, acceptance and limits

- `scripts/agents/test_handoff_continuity.mjs` runs offline Node + isolated Git repositories and covers missing docs, successful source-then-closeout, stale receipt after later source, rewritten historical entries, docs-only changes and partial handoffs. These are mechanical tests, not owner acceptance or behavioral game tests.
- A freshly authored but inaccurate or incomplete receipt could still pass: reviewers must compare it against source/SQL, negative tests, browser evidence and owner decisions. A separate task must replace the publisher's hardcoded four-PR set with a reviewed, paginated workstream discovery/index; do not silently overwrite the historical snapshot.
- A GitHub Actions result is **not automatically a required branch-protection check**. A maintainer must explicitly approve enabling the relevant GitHub ruleset/status requirement after confirming existing stacked PR compatibility. Before main integration, the draft's `pull_request` self-test can run, but the trusted `pull_request_target` job only activates once the workflow is on the targeted base branch.
- GitHub cannot infer conversations or uncommitted owner decisions. Those must be recorded explicitly in Git, with evidence labels distinguishing deployed, signed scratch, current-browser, pending and rejected.
- No automatic PR merge, deletion, release, Vercel preview/deployment, hosted Supabase SQL, secret handling, AI/model invocation, or world/town/tactical map change is authorized.

## Rollback

The candidate is additive (one workflow, two local scripts, documentation updates). If its semantics or GitHub branch event behavior fail, disable/remove the **new workflow only** in a separately reviewed scoped PR; the prior #326 handoff and #327 publisher remain intact. No data/schema/gameplay rollback is involved.

## Current workstream and next action

C34 research #379 T26 and the owner-protected production/recovery gates remain the authoritative gameplay/privacy context. The next engineering task after this **process-only CI review** is still **T27 shared Profile/town/merchant stock/wallet consumer and rollback compatibility, plus delayed stock-response-after-logout signed scratch negative**, not a release of #345 or #379. Verify the isolated continuity PR's exact HEAD/self-tests and complete full-PR scope before seeking owner approval for any integration.
