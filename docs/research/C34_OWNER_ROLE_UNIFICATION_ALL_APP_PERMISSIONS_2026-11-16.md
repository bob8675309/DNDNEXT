# C34 — Owner decision: Admin / GM / DM have one application permission tier

**2026-11-16 CST; owner feedback after signed T37-P1. Research branch PR #379.** This note supersedes the scope limitation in historical T31/T34 policy descriptions, **not** their prior observed test outcomes.

## Owner instruction and intended behavior

The owner states that **Admin and GM/DM are the same and redundant; there is no need to maintain a separation**. Within the DNDNext application, treat the existing exact role strings `admin`, `gm` and `dm` as aliases of one effective **Game Master / application administrator** authorization tier. There should be no separate higher "Admin" application permission set for website features merely because of the label. This includes character/NPC/merchant management, private authorized campaign dossiers, sheets and Story, wallet/inventory/stock, campaigns/encounters and application site-activity/admin interface abilities once safe, specific access controls are audited.

This direction supersedes the **policy** in T34 that only `admin` may view application site/visitor activity while `gm`/`dm` are denied. **T34's signed strict-Admin-only behavior remains a correct historical verification of the old design**, not a current intended authorization requirement. Do not erase or rewrite the old signed tests, logs or source evidence: build new revised-policy tests separately, then explicitly classify earlier policy negatives as historical. Do not silently change a historic audit or claim it was wrong.

Keep existing exact role strings and account rows recognized so users do not lose access; a cosmetic single "Game Master" label can be considered without destructive role renames or migration. Enforce decisions server-side using current signed identity/current database role, never untrusted client hints or arbitrary `is_admin(uid)` arguments. `player`, `unknown`, noncanonical and anonymous actors remain denied elevated permissions. Delegated `can_edit`, `can_inventory`, `can_convert` remain narrowly character-scoped and never become global Game Master authority.

**Boundary:** Application role equivalence does not confer GitHub organization or repository administration, Vercel team ownership, Supabase project ownership, `service_role` credentials, database superuser, billing access, or any external provider privilege. Those are infrastructure identities outside app role rows and cannot be granted by application labels. Site-activity contains user-related data, so any revised reader must retain authenticated/current-role authorization, output minimization, negative-role tests and revocation checks; do not replace policy with an unscoped GRANT or public report.

## Chat feedback is separate

The owner also says "other than chat everything looks good." Treat this as a separate report that the **chat feature** is not yet satisfactory; it is **not** a requested exception to Admin/GM/DM application authorization. No precise chat defect has been specified. Do not invent a fix or silently modify messaging, map chat or chat-roles behavior. Ask for the concrete failure/expected behavior before changing chat.

## Implementation, release and acceptance boundaries

This commit is **documentation of a policy decision only**. It changes NO application routes, components, SQL, policies, security-definer bodies, roles, live data, site reporting, map, deployment or external account privileges. The current signed T37-P1 executable SHA `ae67599353d977ec2e97162f056d404d56b7b17e` remains the latest genuinely executed /npcs research acceptance; T34 site-Admin-only test is expected to continue passing on unmodified historical fixture code until a distinct revised-role research test is intentionally added.

Before eventual release, perform an exact-source cross-consumer inventory of app `admin` checks (including `get_recent_site_activity_v1`, its site-only helper, campaign settings and UI), implement explicitly bounded application-role-equivalent server checks and fail-closed negatives in disposable local PG17/GoTrue/PostgREST/Chromium, preserve all historical logs/fixtures, validate same-JWT demotion and actor switching, and verify original public-site-report boundaries. Neither merging PR #379 nor production SQL or deployment is authorized here; retain independent full PostgreSQL plus 340 Storage-object restored rollback and owner release go/no-go.

**ONE NEXT bounded development milestone:** T37-P2 genuine source-original `/npcs` NewNpcModal submission/persistence and invalid/replay/role/rollback signed browser checks, with this revised one-tier role policy treated as authoritative for further application integration. Carry the site-activity equivalence implementation and separately reported chat defect as explicit follow-up gates, not as work already complete.
