<!-- DNDNext full-scope and PR ancestry evidence, required for new PRs after 2026-11-12.
Do not delete sections or confuse individual green CI with complete feature integration.
Use exact Git SHA/branch, and acknowledge what is NOT included. -->

## Scope and inheritance

<!-- State ONE exact deliverable, source/target branch and whether the PR is stacked.
Read the ENTIRE inherited HEAD tree against current main, not only the changed-files tab.
Name inherited work, dependency PRs and original design choices. -->

## Original sources and preserved work

<!-- List every source PR/commit and original positive AND negative fixtures, code, UI,
migrations, permission/role contracts and documentation carried forward.
Distinguish byte-identical copied files from behavioral successor implementations.
For partial extraction state explicitly 'partial; not the whole feature'. -->

## Changes intentionally deferred

<!-- List every original behavior/file/fixture not integrated and its preserved reference.
Do not call a feature complete or close its original PR while anything remains unresolved.
"No deferred work" requires the full feature/file and test matrix to prove it. -->

## Testing and evidence

<!-- Include actual final-head CI run links, failures/retries and source hashes.
Separate static tests, disposable DB mock, real signed GoTrue/Auth, component Chromium,
whole Next.js/browser, production behavior, and original failed negative controls.
Any final-head push invalidates earlier head-only CI as a merge gate. -->

## Release and rollback

<!-- State whether this is docs/test-only, held research, coordinated UI+SQL, or a live release.
Record existing SQL schema/RLS, role/grant/hidden-data, command replay/lock, and backup restore risks.
No world-map/city-map crossover, paid agents or production data/DDL/Storage unless separately authorized.
List main merge and Vercel auto-deploy implications, and explicit approval still required. -->
