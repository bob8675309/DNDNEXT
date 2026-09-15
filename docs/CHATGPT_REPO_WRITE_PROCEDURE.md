# ChatGPT Repository Write Procedure

Updated: 2026-09-15

This project is directly writable from ChatGPT when the GitHub/Supabase/Vercel connectors expose the required actions. Do not claim that repository/database work requires a separate environment without first checking the available connector actions.

## Repository authority

- Repository: `bob8675309/DNDNEXT`
- Default/production branch: `main`
- Reconciled checkpoint for this document: `663281753fc1f789bc7caa3092f6e9980f4458af`

Do **not** hard-code an “active work branch” into this permanent procedure. Branches and PRs change quickly. At the beginning of every task, re-fetch current `main`, current open PRs, the intended target branch, and its exact head.

An old branch/PR referenced by a historical handoff is not automatically the correct place to continue work. This matters especially for PR #187: production carousel/Tarot behavior was restored independently through PR #189, so #187 must be freshly reconciled before any future merge.

## Preferred safe GitHub write path

For any repository change:

1. Re-fetch current `main` and the intended branch/PR head.
2. Inspect the exact target files from that head before writing.
3. Decide whether the change belongs on the existing branch or deserves a new bounded branch.
4. Keep the change scoped to the requested subsystem.
5. Prefer one coherent commit for one coherent multi-file change.
6. Use non-forced exact-head-aware branch/ref movement.
7. Never update/delete the same path repeatedly using a stale blob SHA.
8. Compare the resulting branch to its base and verify only intended files changed.
9. Run focused validators plus regression/protected-boundary checks.
10. Verify exact-head GitHub Actions and Vercel when an intentional deployment is required.
11. Re-fetch the PR head immediately before merge.
12. Merge only after Paul explicitly approves the merge, and guard the merge with the exact validated head when supported.

Never force-push merely to make a patch apply over concurrent work.

## Vercel Preview discipline

`main` contains:

```json
{
  "buildCommand": "npm run build:vercel",
  "ignoreCommand": "node scripts/vercel_ignore_build.mjs"
}
```

Ordinary `agent/*` pushes intentionally skip a full Vercel Preview build. The resulting CANCELED/ignored record is expected and should not be treated as a failed full build.

When a visual/integration Preview is genuinely required, include:

`[deploy-preview]`

in the commit message for the exact commit that should build.

Do not add that marker to every intermediate commit. The purpose of the guard is to prevent the deployment-storage churn that previously produced hundreds of stale READY previews.

Permanent deployment maintenance is in:

`.github/workflows/vercel-deployment-maintenance.yml`

The workflow is intentionally conservative:

- defaults to audit behavior;
- excludes `target=production`;
- stale READY cleanup is restricted to `agent/` refs;
- destructive actions require exact confirmation text;
- deletes are paced;
- HTTP 429 `Retry-After` is honored with bounded retries;
- Vercel must confirm the same deployment ID in `DELETED` state.

Do not broaden these safety gates casually.

## Supabase boundary

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Verified checkpoint for this document: 214 migration-ledger rows, latest `20260814161314 grim_hollow_heritage_catalog_support`.

Before any DB action:

1. inspect the live project/schema/function/policy/data state relevant to the task;
2. use read-only SQL first for diagnosis when possible;
3. use migrations for DDL/schema changes;
4. perform data mutation only when explicitly required by the task;
5. verify the resulting live state;
6. do not re-run SQL merely because an old file/document uses a different migration name/number;
7. never expose service-role credentials to browser code.

Documentation-only, artwork-only, selector-presentation, and current Realistic Dice presentation work should not require a Supabase mutation unless a separate requirement is established.

## Binary artwork procedure

For large/binary art changes, use the established guarded binary workflow rather than giant inline-base64 GitHub writes:

`approved local bytes -> normalized assets -> manifest/checksums -> archive -> transfer location -> guarded GitHub Actions materialization -> exact-head/path/dimension/checksum validation -> intended branch -> CI/Preview verification`

Subclass Tarot assets should follow the dedicated Tarot handoff/card standard. Species/Class artwork should follow their existing resolver-specific ledgers.

## Branch/scope discipline

Keep large systems reviewable:

- Forge/Tarot presentation work should not absorb crafting or tactical changes.
- Character Sheet dice integration should be a bounded consumer phase after the Forge dice baseline.
- Tactical dice integration must consume server-authoritative results and should not share movement/path collision authority with the dice simulation.
- Repository cleanup should remove only files proven dead/superseded; retain import/patch/reference machinery until source-bake equivalence is demonstrated.

## Standing project safety rules

- Do not touch world-map behavior unless Paul explicitly asks.
- Do not mix world-map behavior with town/city-map behavior.
- `components/MapPageClient.js`, world routes/travel/weather/camps/clock are protected outside explicit world-map work.
- Forge/Tarot/dice work does not authorize tactical movement/pathing, crafting, inventory, merchants, economy, or unrelated runtime changes.
- Tactical encounter RPC/combat-log results remain rules-authoritative.
- Dice rigid-body/contact logic must never become tactical-grid movement/collision authority.
- Preserve existing source-choice/runtime/persistence authority; do not create duplicate state because a new UI looks different.
- Verify every new helper, hook, memoized value, state variable, prop, callback, RPC argument, and data-contract field is defined and passed correctly.
- Strengthen validators when necessary; do not weaken contracts merely to make a patch pass.
- Prefer additive database migrations; never rewrite deployed migration history.
- Do not merge any open PR without explicit user approval.

## Documentation discipline

After a meaningful accepted checkpoint:

- update `DNDNext_Current_Handoff_Prompt.md`;
- update the active subsystem ledger;
- update `Documentation_Refresh_Manifest.md` and `README.md` if trust order/current queue changed;
- record exact validation/deployment evidence where useful;
- preserve dated historical evidence instead of rewriting old phase reports into present tense;
- clearly mark superseded design documents when a new production implementation replaces them.

This file is procedural. It should describe how to work safely, not freeze one temporary branch or PR as permanent project state.
