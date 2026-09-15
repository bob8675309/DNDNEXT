# Vercel Deployment Storage and Maintenance Status

Status date: 2026-09-15

This is the current infrastructure handoff for DNDNext Vercel Preview/deployment-storage behavior.

## Project

- Vercel project: `dndnext`
- Project ID: `prj_ihlzMuBEtqywSEAlLLaObzJIelC6`
- Team ID: `team_w2dUJ6xE2KAFW0MsAbbh5imq`
- Framework: Next.js
- Node: 22.x
- Production aliases include `dndnext.vercel.app`, the project alias, and the Git-main alias.

## Root cause identified

The project accumulated a large historical Preview-deployment backlog because work on `agent/*` branches produced many full READY Preview deployments, often seconds/minutes apart during iterative artwork/UI work.

A sampled audit found Preview deployment churn dominating the project’s deployment history. This was the primary deployment-storage target; production deployments were not the cleanup target.

## Cleanup completed 2026-09-15

Two categories were removed:

- **124** old failed/canceled deployments;
- **504** stale READY non-production deployments from `agent/*` branches older than seven days.

Total removed: **628 deployments**.

The final stale READY audit reported:

- stale READY `agent/*` candidates older than seven days: **0**;
- production deployments explicitly protected: **23**.

Vercel may take time to reconcile dashboard storage metrics after deletion. Do not infer cleanup failure solely because the usage graph has not updated instantly.

## Preview-build guard

Current `vercel.json`:

```json
{
  "buildCommand": "npm run build:vercel",
  "ignoreCommand": "node scripts/vercel_ignore_build.mjs"
}
```

`scripts/vercel_ignore_build.mjs` behavior:

- `main` and ordinary non-`agent/*` branches continue normally;
- ordinary `agent/*` commits are skipped before a full Preview build;
- adding `[deploy-preview]` to the commit message intentionally requests a full Preview.

The skipped deployment may still appear in Vercel as a small CANCELED/ignored record. That record is expected and is not equivalent to the old full READY Preview artifact.

## Permanent maintenance workflow

Path:

`.github/workflows/vercel-deployment-maintenance.yml`

Supported maintenance scopes:

- failed/canceled non-production deployments;
- stale READY non-production deployments restricted to `agent/*` and older than a chosen threshold.

Safety rules:

- audit mode is available and should be used before destructive cleanup;
- `target=production` is always excluded;
- stale READY cleanup is hard-restricted to the `agent/` prefix;
- delete mode requires exact confirmation text;
- deletion is paced rather than burst-fired;
- HTTP 429 rate limits honor Vercel `Retry-After` with bounded retry attempts;
- a successful response must identify the expected deployment and report `DELETED` before the workflow continues;
- concurrency does not cancel an in-progress cleanup.

PR #190 hardened these behaviors after the live cleanup demonstrated Vercel can impose long rate-limit windows (including 600-second waits).

## Operational procedure

For routine development:

1. Make ordinary `agent/*` commits without requesting a Preview.
2. Run local/focused CI validation through GitHub Actions as appropriate.
3. When browser/visual integration review is actually needed, create one exact commit containing `[deploy-preview]`.
4. Verify that exact deployment rather than generating multiple near-identical previews.
5. Periodically audit Vercel deployment history rather than waiting for storage to exceed quota again.

For cleanup:

1. run the maintenance workflow in audit mode;
2. confirm candidate scope and production exclusions;
3. use the explicit delete confirmation only when the candidate set is correct;
4. allow rate-limit waits to complete rather than restarting cleanup repeatedly;
5. rerun audit afterward and require zero candidates for the selected scope.

## Production deployment safety

The cleanup performed on 2026-09-15 did not delete production deployments. The production deployment created after PR #190 completed READY and successfully held the production aliases.

Do not use broad project-removal commands or target the project name as a substitute for deleting audited individual stale deployments.

## What the guard does not do

- It does not stop GitHub commits/branches.
- It does not remove Vercel metadata records entirely.
- It does not skip production builds from `main`.
- It does not make every CANCELED record an error.
- It does not replace build/CI validation.
- It does not automatically decide which old READY Preview should be preserved for review; the maintenance workflow’s bounded policy handles cleanup.

## Current monitoring recommendation

Watch:

- Deployment Storage after Vercel reconciliation;
- number of READY Preview deployments by branch;
- whether future work starts bypassing the `agent/*` convention;
- unexpected full Preview builds without `[deploy-preview]`;
- maintenance-workflow rate-limit behavior.

If a future development workflow uses non-`agent/*` scratch branches heavily, revisit the guard intentionally rather than broadening it silently.

## Related files

- `vercel.json`
- `scripts/vercel_ignore_build.mjs`
- `.github/workflows/vercel-deployment-maintenance.yml`
- `scripts/vercel_build_v2.mjs`
- `docs/CHATGPT_REPO_WRITE_PROCEDURE.md`
- `docs/DNDNext_Current_Handoff_Prompt.md`

## Protected boundary

Vercel maintenance is infrastructure/deployment work. It does not authorize application behavior changes, Supabase mutations, or world-map/town-map/tactical/crafting changes.
