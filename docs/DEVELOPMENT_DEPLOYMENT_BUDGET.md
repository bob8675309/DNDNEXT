# DNDNext — Git Push and Vercel Deployment Budget (2026-11-05)

This is an owner-requested **operational conservation policy**, not permission to change the linked project's settings or skip required tests. Vercel free-tier preview deployment attempts reached `api-deployments-free-per-day` on 2026-11-05, while PG16/PG17/GitHub Actions continued to run successfully.

## Before each push

1. Check the intended branch, PR stack, exact base/head, scope, target and whether Git integration will automatically create a Vercel deployment. A GitHub push is **not** inherently 'Vercel free' when the project auto-deploys previews.
2. Collect compatible source edits, fixes, tests, docs and handoff receipts. **Prefer one reviewed push for a coherent unit**, not one per typo, fixture, report paragraph, or conversation checkpoint.
3. Run all practical local source assertions and disposable free database/auth fixtures first; avoid repeatedly pushing simply to discover an obvious syntax/test error.
4. Preserve exact-head GitHub Actions validation for source/SQL research. Do not interpret failed Vercel quota checks as a failed application test, or green source CI as browser acceptance.
5. Reserve scarce preview builds for meaningful visual/client acceptance; coordinate production merges and DB migrations separately with owner authorization.

## Sustainable skip strategy (proposal, not configured here)

Vercel Project > Settings > Build and Deployment > **Ignored Build Step** may be configured to run a reviewed docs-only/fixture-only filter (exit 0 skips the build; 1 builds). Alternatively review supported branch deployment controls. Verify exact project root, monorepo structure, and source paths; never suppress essential code or production builds by accident. A skipped build is not always the same as avoiding a deployment API attempt; confirm quota behavior in Vercel docs and project telemetry. Request owner approval before touching project settings, `vercel.json`, deployment protection or ignore rules.

`[skip ci]` may skip GitHub Actions, with required checks pending, and **does not independently guarantee Vercel skips**. Do not use it as a deployment-control mechanism without actual confirmation.

Vercel reference: https://vercel.com/docs/project-configuration/project-settings
