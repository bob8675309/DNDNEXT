# C34 independent CI Issue #389 — path-trigger proof, approved source-only research

**Date:** 2026-11-21 CST. **Separate branch:** `research/c34-ci-efficiency-independent-20261121` (based on PR #379 research executable `21d6b18f5b6e5baba0aa2dd06d9480d456b92ec3`). Do not merge/activate/rewrite active PR #379. No SQL, application, production, world-map or paid API changes.

## Verified executable

**`f3219f5cb9c8d973eacff2f2889af3ad94fcc153`**, [GitHub Actions #44926792884](https://github.com/bob8675309/DNDNEXT/actions/runs/44926792884), job **136914527984**, SUCCESS. Entire **15,865-character decoded CI log** was retrieved and reviewed. Exact source test `scripts/audits/test_c34_ci_filter_independent.mjs`; read-only standalone Node22 workflow `.github/workflows/validate-c34-ci-efficiency-independent.yml`. No npm install, PG17, browser, GoTrue, paid model or hosted connection. The original expensive `.github/workflows/validate-c34-joint-local-auth.yml` Git blob **`9d30f81f820dda5d799ada5836a612b9276fbb1b`** was pinned and remains unchanged.

The original signed workflow has twelve PR and three push path entries, with `scripts/integration/c34/**` matching the source-only C2-B13 census `scripts/integration/c34/test_t46_p3_p4b_c2b13_merchant_writer_census.mjs`. That file already has its OWN dedicated short Node22 source-census workflow. This is proven redundant full-suite triggering, **not** a verified GitHub bill.

## Tested trigger matrix

The **PROPOSAL ONLY** appends the single ordered negative pattern `!scripts/integration/c34/test_t46_p3_p4b_c2b13_merchant_writer_census.mjs` to **both** existing PR and push lists, preserving every other entry and `workflow_dispatch`. The source test modeled the GitHub ordered positive/negative path semantics for separate/simultaneous file changes, and all assertions PASS.

| Changed file(s) | Current signed suite | Proposed signed suite | Result |
| --- | --- | --- | --- |
| Only standalone C2-B13 census | Runs | Skips | PASS intended |
| Census plus docs-only | Runs | Skips | PASS intended |
| New genuine C2-B14 signed runner | Runs | Runs | PASS preserved |
| Original joint PG17 auth fixture | Runs | Runs | PASS preserved |
| Census + genuine signed runner together | Runs | Runs | PASS preserved |
| Signed workflow itself | Runs | Runs | PASS preserved |
| Original `components/c34/MerchantPanelT28P2Research.jsx` (PR) | Runs | Runs | PASS preserved |
| Original held privacy SQL candidate (PR) | Runs | Runs | PASS preserved |
| Docs-only | Skips | Skips | PASS unchanged |
| `workflow_dispatch` manual execution | Available | Available | PASS unchanged |

**Caution:** This is an exact-source unit model, not a GitHub branch-protection validation or a live event proving changed workflow dispatch. It does not model all GitHub file-list limits/merge-base handling. The actual workflow's job name and checked-in source remain intact; its current full-suite tests and owner original-source protections were **not** modified.

## Owner decision needed before changing real workflow

The GitHub app returned HTTP **403 Resource not accessible by integration** when inspecting `main` branch protection/required statuses. The returned empty repository-rulesets listing does not disprove other branch protection rules. If a required check is excluded by path filtering, it can remain Pending and block merge. Therefore **DO NOT APPLY** this negative pattern to the actual workflow until the owner or a suitably authorized GitHub principal confirms merge-required checks on `main`, active #379's target, and its original feature PR bases. A more robust future design may preserve the existing required check name and skip only the expensive DB steps after a proven source-change classifier; that design also requires a signed test and review.

## Next

After owner verification of required checks, prepare a separately reviewed, reversible **CI-only** patch on this independent branch or a successor, run changed-file matrix and confirm actual GitHub status. Never merge without owner GO; do not use `pull_request_target` to execute untrusted head code, weaken source-preservation gates or blindly cancel signed evidence. Record actual GitHub Actions runner times separately from Plus/usage or guessed dollar savings. Issue [#389](https://github.com/bob8675309/DNDNEXT/issues/389) remains open until the owner makes the trigger-change decision.
