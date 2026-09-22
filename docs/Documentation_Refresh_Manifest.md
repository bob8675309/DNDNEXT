# Documentation Refresh Manifest

Updated: 2026-09-21

## Trust order

For current work, trust sources in this order:

1. live Supabase schema, migration ledger, grants, RPC definitions, and relevant data;
2. current GitHub `main`/active PR source, exact remote head, exact-head CI, and Vercel state;
3. `DNDNext_Current_Handoff_Prompt.md` plus the dedicated active subsystem ledger;
4. broader roadmap/history prose;
5. raw exports and old PR ledgers as historical snapshots only.

If prose conflicts with live source/database state, live authority wins until documentation is corrected.


## 2026-09-21 current checkpoint override

This override was re-verified during the documentation reconciliation pass against live GitHub/Supabase state.

The older checkpoint sections below are retained as history. Current live authority is:

- accepted runtime checkpoint from merged PR #195: `320671a22b83432177dcc67e9efd035f3c3ccc5d`;
- documentation-only merges may place current `main` ahead of that runtime SHA, so re-fetch `main` before every write or merge;
- PR #195 is closed/merged: auth-gated navbar + admin activity view;
- production Vercel for that merge: `dpl_ETZZCzVZq8Cpw56Fndf9pfYmp5B8` — **READY** at handoff;
- active Character Forge presentation work: PR #194, branch `agent/subclass-carousel-drag-crisp-20260918`, reviewed head `f21a81435946b1ae8ec6112e5376062cfc2b62f4`, open/unmerged;
- PR #194 exact-head Vercel is READY, but GitHub `Validate Class browser polish` currently fails because the validator still asserts the superseded browsed-card dossier fallback; current source intentionally requires explicit click/inspection ownership;
- PR #194 is behind current `main`; its only overlap with post-base `main` changes is `docs/DNDNext_Current_Handoff_Prompt.md`, so runtime integration risk is narrow but the branch still needs an exact-head rebase/reconciliation before merge;
- PR #194 exact-head preview: `dndnext-86xs3s1d4-pauls-projects-2016aa54.vercel.app` — **READY** at handoff.

Current focused handoff/status documents:

- `Next_Chat_Handoff_2026-09-21.md` — concise copy-ready next-chat takeover note;
- `Auth_Navigation_Admin_Activity_Status.md` — merged PR #195 and live Supabase hardening;
- `Character_Forge_Subclass_Tarot_Flexible_Ring_Status.md` — active PR #194 flexible-ring architecture and acceptance target.

### Live database update

Live migration ledger count at this reconciliation: **218**.

Latest registered migration:

`20260921185225 admin_site_activity_hardening_v1`.

The PR #195 activity slice also includes:

- `20260921152546 admin_site_activity_v1`;
- `20260921153151 admin_site_activity_acl_fix`;
- `20260921153328 admin_site_activity_retention_v1`.

The previous `20260814161314 grim_hollow_heritage_catalog_support` checkpoint is no longer the latest migration.

### Current work queue

1. Complete this documentation-only reconciliation on its dedicated branch and review the resulting diff before merge.
2. Continue PR #194 only after rebasing/reconciling it with current `main` and fixing the stale Class-browser validator contract.
3. Browser-test the PR #194 flexible ring with a small catalogue (especially Monster Hunter) and a dense catalogue (Wizard), preserving explicit click/inspection ownership.
4. Keep the completed 149/149 Tarot deck unchanged while selector geometry/stage work continues.
5. Realistic Dice core + Forge adapter are already merged; future dice priorities are true polyhedral presentation, Character Sheet visualization, then tactical visualization as separate bounded projects when Paul prioritizes them.
6. Tactical Milestone 2 still requires durable real multi-user/reconnect acceptance before broader shared-5e expansion.
7. Continue broader crafting redesign, sprite production, or other subsystems only according to user priority and on isolated branches.
8. Repository housekeeping only with evidence; do not mass-close old PRs/issues by age.
9. Quest/NPC dialogue work remains the future home for narrative unlocks such as Gift of the Aetherborn.

A concrete production regression can supersede this queue, but otherwise keep each subsystem change isolated and exact-head validated.
