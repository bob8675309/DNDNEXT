# PR #334 — inherited P1.3 role-authority source RED / candidate GREEN (2026-11-23)

**Research only.** Independent `agent/forge-j168-pr334-preservation-audit-20261123` branch. Neither a live exploit report, main change, gameplay release, SQL migration, nor full NPC security acceptance.

## Verified source and policy

- Original exact `main` Patch0 source `sql/20260612_90_patch0_crafting_authorization_hardening.sql` Git blob `d60b0ded3f94cd9f7db9aa687e72ee0fc589c416`: historical `private.current_user_is_admin()` and zero-argument `public.is_admin()` accept only `role='admin'`; `public.is_admin(uid)` accepts any authenticated non-`player` role when looking up the caller's own UID, including `unknown`, but restricts cross-user inspection.
- Selected original P1.3 functions copied from held #345: `private.can_access_character_v1` blob `9c479d3f044268f73da3a5515d229096ce03f94a`, Stage2 `get_npc_dossier_admin_v1` and editor narrative blob `afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac`, Stage3 creator Story checks blob `01e48823ac3a46aa5880e98200e97c2595501ce7`. The test **deliberately does not** install the complete Stage1/2/3 security stages, Forge graph, RLS, column grants, trigger graph, or production schema.
- Owner's [Nov. 16 role decision](https://github.com/bob8675309/DNDNEXT/blob/2c9e9e4eec41300971b7e9b1e84c2442c46e9172/docs/research/C34_OWNER_ROLE_UNIFICATION_ALL_APP_PERMISSIONS_2026-11-16.md) makes exact `admin`, `gm`, `dm` equivalent application managers, with `player`, unknown and anonymous excluded. Character-scoped permissions remain scoped.

## Bounded research fixtures

Files added: `scripts/fixtures/pr334_role_original_consumers_disposable_pg17.sql`, `scripts/fixtures/pr334_role_current_policy_candidate_pg17.sql`, `scripts/integration/test_pr334_role_equivalence_signed_local_auth.mjs`, and `.github/workflows/validate-pr334-role-equivalence-signed.yml`.

The test requires an **empty local PostgreSQL 17** `127.0.0.1:54322/postgres` and signed local GoTrue/PostgREST at `127.0.0.1:54321`, GitHub Actions, special explicit disposable-only marker, and the exact original Patch0 Git blob. It creates eight distinct real JWTs and tests the historical source-original **RED expected discrepancy** before installing a *separately named, unmounted and unprivileged* `p13_research_*` candidate that reads `auth.uid()` and current `user_profiles.role`.

Coverage expected after green CI: exact admin/gm/dm positives; player/unknown/outsider/anonymous denies; historical UID-spoof deny and new helper refusing spoofed parameters; GM/DM dossier/Story mismatch in original; editor narrative versus private GM Secret and creator Story; creator `can_edit` revocation; **same-JWT GM demotion** and coeditor provenance separation.

**Evidence status: CI pending until the pushed exact-head GitHub Actions run finishes.** Do not claim actual successful signed PG17/GoTrue tests from source inspection or syntax checks. Preserve any first RED failures and fix only new fixtures as necessary. Full source and old accepted browser tests remain intact.

## Blockers and next task

Do **not** globally replace old `public.is_admin` overloads: map their real current callers, grants, RLS, NPC Profile, inventory/merchant, admin reports, site activity, Forge and cross-command consequences first. Original #334/#345/#379 are held; do not retire/merge. Original 54 inherited path exceptions, historical 22/34 unverified legacy account-sheet writers, full original Forge/Story/nonces, privacy ACL, multi-route browser, restored encrypted PostgreSQL backup **plus all 340 Storage objects**, owner release decision remain OPEN. No hosted Supabase SQL (even SELECT), world map, merge, deploy, or paid-agent activation.

**ONE NEXT TASK:** check exact-head signed role workflow and resolve source-authentic fixture failures, then inventory all `is_admin()`, `is_admin(uid)`, and `private.current_user_is_admin()` consumers to design a bounded compatibility migration, without altering live helpers or the agents' held branches.
