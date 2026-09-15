# ChatGPT Repository Write Procedure

Updated: 2026-09-13

DNDNext is directly operable from ChatGPT through connected **GitHub, Supabase, Vercel, and Dropbox** services. A future session must check those tools before claiming that repository, database, deployment, or binary-transfer work requires Paul to leave ChatGPT and do it manually.

## Connected-tool responsibility map

- **GitHub**: repository source, branches, PRs, exact heads, file reads/writes, commit/ref operations, workflow/check state.
- **Supabase**: live Postgres/project state, SQL diagnosis, functions/tables/policies, reviewed migrations/data actions.
- **Vercel**: preview/production deployment lookup, exact Git-SHA matching, build state/logs, protected preview fetching.
- **Dropbox**: byte-preserving transport bridge for generated/approved binary bundles that should not be encoded as giant GitHub text payloads.

Source and live-state precedence:

`current GitHub source + live Supabase + exact-head validators + exact-head Vercel behavior > stale prose`

## Current repository checkpoint

Repository: `bob8675309/DNDNEXT`

- `main` handoff-time head: `02854698298f357d2dfde21dd292ba7caf73e1c1`.
- active PR: **#187**, `Redesign subclass selector as cinematic looping gallery`.
- active branch: `agent/subclass-carousel-selector-20260911`.
- handoff-time head before this documentation commit: `12cc27de6f128f5670307fce9a7c5c1f6104bfaf`.

Always re-fetch these values. Never treat a SHA in documentation as permanently current.

## Preferred safe write paths

### A. Ordinary text/source/documentation changes

1. Re-fetch the real target branch/PR head.
2. Read the current target files from that exact branch.
3. Keep the requested scope bounded.
4. Use GitHub branch/file/blob/tree/commit/ref actions with non-forced exact-head discipline.
5. Re-fetch the branch after writing and verify the actual diff.
6. Run relevant validators/checks.
7. Match the Vercel deployment to the exact resulting Git SHA when deployment behavior matters.

### B. Work requiring a checkout/shell/grouped transformation

Use a **bounded scratch/preview branch + one-shot GitHub Actions runner**.

This is the established pattern:

`exact current target head -> create scratch/preview branch -> add temporary workflow there -> workflow checks out real target branch -> guard exact target SHA -> modify/test -> commit -> push HEAD:real-target-branch -> inspect target branch through GitHub -> inspect exact-head Vercel preview`

The scratch branch is a runner/transport surface. It does **not** need to be merged into the real PR to deliver the result. This pattern is useful for:

- binary materialization;
- real filesystem operations;
- Node/Python/shell transforms;
- grouped multi-file changes where a runner is safer than many independent API writes;
- deterministic validation/build commands.

Required guard before mutation:

```bash
test "$(git rev-parse HEAD)" = "<EXPECTED_TARGET_HEAD_SHA>"
```

Re-fetch the intended target branch immediately before the runner pushes and abort if it has moved unexpectedly.

### C. Binary artwork/assets

Read `docs/ARTWORK_BINARY_TRANSFER_RUNBOOK.md` and use:

`local approved bytes -> ZIP + manifest/checksums -> Dropbox /DNDNext-Transfer -> temporary download URL -> guarded scratch/preview Actions runner -> exact target branch -> verify -> commit/push -> Vercel`

Do not re-encode large images as inline source merely because GitHub's ordinary file action is text-oriented.

## Vercel verification procedure

GitHub integration normally creates the preview automatically after a branch push.

1. Use the Vercel connector to list DNDNext deployments.
2. Match deployment metadata to the **exact Git commit SHA and branch** you just pushed.
3. Wait for `READY` before reporting browser/deployment acceptance.
4. If it fails or stalls, inspect build logs through the Vercel connector.
5. For protected previews, use the Vercel fetch/access capability rather than assuming the preview is unreachable.

Do not validate a newer/older deployment and call it evidence for the target commit.

## Supabase procedure

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Before any database change:

1. inspect the current live schema/function/policy/data involved;
2. use read-only diagnosis first;
3. distinguish live production effects from repository migration filenames;
4. use the migration action for reviewed DDL/schema changes;
5. use SQL/data writes only when the requested task actually authorizes them;
6. verify the live result afterward;
7. never expose service-role credentials to the browser.

Artwork, CSS, and presentation-only work normally require **no Supabase mutation**.

## Branch and concurrency discipline

- Never force-push simply to make a stale patch apply.
- Never assume an open PR head has not moved.
- For direct file updates, re-fetch/use current blob SHAs rather than chaining stale SHAs.
- For a scratch/preview runner, hard-guard the target SHA before changes and again before push when practical.
- Keep temporary workflows on the scratch branch; do not pollute the working PR unless the workflow is intentionally becoming permanent tooling.
- Do not merge an open PR without Paul's explicit approval.

## Standing project safety rules

- Do not touch the world map unless Paul explicitly asks.
- Do not mix world-map and town/city-map behavior.
- A Forge/artwork patch does not authorize tactical, crafting, inventory, merchant, travel, or economy changes.
- Preserve canonical source-choice/runtime/persistence authority.
- Verify every new helper, hook, state variable, prop, callback, RPC argument, and data field is defined and passed correctly.
- Preserve validators; do not weaken contracts to hide regressions.

## Documentation discipline

At a meaningful handoff/checkpoint:

- update `DNDNext_Current_Handoff_Prompt.md`;
- update the active subsystem handoff/ledger;
- update `docs/README.md` when the trust/startup order changes;
- update `REPO_ACCESS_STANDING_RULE.md` / transfer runbook when a better connector or transfer path is proven;
- record exact branch/PR/SHA as a checkpoint **and** tell the next model to re-fetch current live state.

The purpose of this file is to prevent future sessions from forgetting the tools already available and wasting time rediscovering how to write, transfer, validate, and preview DNDNext changes.
