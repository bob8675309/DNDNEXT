# One-time GitHub branch cleanup — 2026-10-30

The branch retirement action runs **only** on a push to `work/consolidated-encounter-research-20261030` whose most recent commit message equals `maintenance: retire verified covered preview branches`. It uses the runner's short-lived GitHub token, not any developer's credentials.

Safety gates:
- The archive must be `bob8675309/DNDNEXT` and the workflow's exact commit SHA must be known.
- All existing open PRs must be **draft**, internal, not pointing to main/archive/protected branches, and their exact heads must be ancestors of the archive. Unexpected PRs abort before any mutation.
- Before closing each archived draft PR, refresh and revalidate its head.
- Branches are deleted only if their **current exact SHA** is an ancestor of the consolidation commit, and after a fresh SHA/protection recheck.
- Never delete `main`, `master`, `production`, `staging`, `develop`, or the consolidation branch. Skip all unique/uncovered branches. Cap deletions at 350.
- Failures are logged and skipped. All kept PR code remains available as an ancestor through the archive's multi-parent commits.
- Closing a PR is not merging it into main; no active unfinished code is promoted.
- GitHub deletion does not immediately remove Vercel preview artifacts or free deployment storage. Use Vercel Security > Deployment Retention Policy / specific deployment deletion separately.
- CI job output lists actual closed PR and deleted ref counts; inspect logs before claiming completion.

This script is source controlled for auditability. To repeat cleanup, a reviewed manual process and new explicit trigger is required. Do not treat the workflow as general-purpose branch pruning.
