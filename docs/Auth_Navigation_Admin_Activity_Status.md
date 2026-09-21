# Auth Navigation and Admin Activity Status

Updated: 2026-09-21

## Accepted production checkpoint

PR #195 — `Gate unauthenticated navbar and add admin activity view` — is merged to `main`.

- merged main commit: `320671a22b83432177dcc67e9efd035f3c3ccc5d`;
- validated PR head before merge: `30befd23507081fcbaa3b06c6634b1022d404ab7`;
- production Vercel deployment: `dpl_ETZZCzVZq8Cpw56Fndf9pfYmp5B8`;
- production deployment state at handoff: **READY**.

This status is source-backed. Re-fetch current `main`, Vercel, and live Supabase before any follow-up mutation.

## Navbar behavior

Unauthenticated visitors now receive only the public auth surface after auth-session resolution:

- non-clickable **DnDNext** brand text;
- Create account;
- Login.

Unauthenticated visitors no longer receive navbar links to campaign/private areas such as Map, NPCs, Crafting, Inventory, Encounters, Profile, Magic, or Admin.

Authenticated users receive the existing campaign navigation. Admin-only links remain admin-gated.

This is navbar exposure only; it does not replace route/database authorization.

Relevant source:

- `components/AppNavbar.js`.

## Admin activity surface

Admins receive an **Admin activity** card in the existing Account tab linking to:

- `/admin/activity`.

The page reads a privacy-minimized 30-day account/visitor activity summary through:

- `public.get_recent_site_activity_v1()`.

Authorization is intentionally layered:

1. the page checks session + `is_admin()`;
2. the read RPC independently calls `private.current_user_is_admin()`.

The anonymous database role cannot execute the admin read RPC.

Relevant source:

- `components/PlayerAccountPanel.js`;
- `pages/admin/activity.js`.

## Privacy-minimized visit tracker

The global app shell mounts `SiteVisitTracker`.

Stored visit data is intentionally limited to:

- browser-generated anonymous UUID;
- current authenticated user id when the observation is authenticated;
- first seen;
- last seen;
- approximate visit/session count using a 30-minute gap;
- last path with query/hash removed.

The tracker does **not** store:

- IP address;
- user-agent string;
- browser fingerprint;
- precise location.

Relevant source:

- `components/SiteVisitTracker.js`;
- `pages/_app.js`.

## Review hardening completed before merge

Automated review identified two real issues and they were fixed before PR #195 was merged.

### Anonymous-row flood bound

`record_site_visit_v1` remains callable by the anonymous role because the browser tracker needs it, but creation of **new anonymous rows** is bounded inside Postgres:

- anonymous admission is serialized with a transaction advisory lock;
- maximum 12 new anonymous visitor rows per minute;
- maximum 2,500 retained anonymous rows;
- existing visitor keys can continue updating normally;
- rows older than ~31 days are pruned during writes.

This prevents arbitrary public UUID generation from growing the recent activity ledger without bound.

### Signed-out attribution fix

The old tracker used one browser key across signed-in and signed-out states. That could leave signed-out activity attributed to the previous account.

The accepted fix has two layers:

- browser storage now uses one anonymous visitor UUID plus separate per-account visitor UUIDs;
- the database upsert sets `user_id = auth.uid()` for the **current** observation instead of retaining a previous user id.

Pre-hardening visit rows had their `user_id` reset to anonymous when the hardening migration was applied because their historical attribution could not be trusted safely.

## Live Supabase checkpoint

Project:

- `DnDWeb`;
- project ref `ucggczovhmauhshvhusx`.

Latest relevant registered migrations:

- `20260921152546 admin_site_activity_v1`;
- `20260921153151 admin_site_activity_acl_fix`;
- `20260921153328 admin_site_activity_retention_v1`;
- `20260921185225 admin_site_activity_hardening_v1`.

Verified after hardening:

- `anon` can execute `record_site_visit_v1(uuid,text)`;
- `authenticated` can execute `record_site_visit_v1(uuid,text)`;
- `anon` cannot execute `get_recent_site_activity_v1()`;
- `authenticated` can execute the admin read RPC, whose internal admin guard still fails closed for non-admin users;
- direct anonymous/authenticated table access remains revoked and RLS remains enabled.

The security advisor can still report the visit recorder as an exposed `SECURITY DEFINER` RPC. That exposure is intentional for this narrow write function; the bounded-ingestion logic and limited data model are the compensating controls.

## Repository SQL

Applied migration history must not be rewritten.

Relevant repo SQL:

- `sql/20260921_01_admin_site_activity_v1.sql`;
- `sql/20260921_02_admin_site_activity_acl_fix.sql`;
- `sql/20260921_03_admin_site_activity_retention_v1.sql`;
- `sql/20260921_04_admin_site_activity_hardening_v1.sql`.

The fourth file is the controlling final-state hardening layer.

## Validation

Focused validator:

- `scripts/validate_auth_nav_admin_activity.mjs`.

It covers navbar auth gating, privacy-minimized tracker fields, per-account/anonymous visitor-key separation, admin read protection, and the final ingestion hardening contract.

## Protected boundaries

PR #195 did not authorize or change:

- world-map behavior;
- town/city-map behavior;
- crafting mechanics;
- inventory mechanics;
- tactical encounter runtime;
- subclass carousel behavior.

Keep this work separate from Character Forge/Tarot refinement.
