# Forge zero-cost acceptance automation — 2026-11-06

**Draft PR #324 only.** No paid model/API, no production SQL, no app runtime edits, no merges.

## What runs automatically

- `.github/workflows/forge-trigger-acceptance-audit.yml` runs on Forge PR changes using a standard public-repository GitHub Actions runner. It compares the 31 original trigger names against SQL fixtures and emits a detailed acceptance ledger and original DDL report. Three-day retention and minimal artifacts.
- `scripts/agents/forge_trigger_acceptance_receipts.json` contains only independently confirmed, source-specific **J125–J132** and **J133–J141** authenticated exact-head receipts. This conservative ledger does not relabel unrelated triggers as fully tested just because DDL exists or some source/MD5 text appears.
- The existing full disposable PG17/GoTrue workflow continues unchanged in its original acceptance cases. It now emits a separate **metadata-only** failure/pass diagnosis, preserving last observed J marker and broad error category. It never uploads raw logs or credentials as separate artifacts.
- `scripts/agents/forge_automation_selftest.mjs` fail-closes on stale source fingerprints, missing original trigger DDL and untrusted receipt claims.

## Evidence boundaries

Live source census, staged DDL, source text, executed original MD5, positive/negative genuine JWT behavior, rollback, deferred COMMIT, concurrency and browser acceptance must remain distinct. The 31-entry original historical census is immutable. The two accepted sources establish a targeted 14/31 staged DDL checkpoint with **2 specific JWT receipts**, not 14 complete acceptance paths. Earlier J00–J124 were already exercised by the full Forge suite, but are not retrospectively marked as individual trigger-complete by these new receipts.

## Vercel and budget

Vercel project-level `previewDeploymentsDisabled=true` was requested as a temporary safeguard so additional research branch pushes should not auto-create previews. It disables previews project-wide; production deployment remains separate. Confirm no new preview is created after this PR push. Restore legitimate preview creation when needed, ideally after owner-approved narrow branch exclusions are installed and verified.

No Codex invocation, secrets, unattended pushes, production deploys or database changes. PR #325 remains an unmerged/manual review-only AI-agent proposal.
