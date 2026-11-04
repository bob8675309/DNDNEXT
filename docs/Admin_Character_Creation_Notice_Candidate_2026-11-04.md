# Admin Character-Creation Notices — Additive Draft Candidate (2026-11-04)

> **UNMERGED / NOT INSTALLED.** Research/development candidate; independent of active P1.3 security draft #317. No production SQL, user account, permission, character, world-map, deployment or `main` mutation authorized by this branch.

## Purpose and owner direction

The GM approved **using the existing shared Forge** to create PCs, alternates, and underlings immediately, with an **informational Admin creation notice** rather than a required approval gate. Afterward the GM can use `/npcs` to adjust existing/custom permissions and enter private GM-authored notes. A comprehensive permissions redesign remains under held P1.3 with separate tests and production cutover.

## Source of truth, verified live read-only

- `components/NewNpcModalV3.js` player path calls `public.create_player_character_v3` (source hash `6ba73e6f12fcf826cc0a739cce45ff40`), which calls v2 (`0351f0a00acae023278e1b8b065b00c9`).
- The existing v2 transaction inserts a `public.character_level_events` row of type `player_character_created`, with canonical `character_id`, `created_by`, and timestamp. Five such events existed at the prior read-only checkpoint; the number is historical, not a target.
- Current `character_level_events` is RLS protected and does **not** grant direct authenticated SELECT/INSERT. Its `details` field is not for user-facing display.
- Existing `pages/admin/activity.js` lists site/account visitors but not creation events. Existing `/npcs?focus=npc:<uuid>` selects a canonical NPC; player-created characters are `kind='npc'` with `is_hidden=true`, so Admin access and selection must still be tested with genuine JWTs.
- Existing `character_notes` supports author/Admin private notes; do not put new GM notes into player-readable sheets or unrestricted character fields.

## Proposed additive implementation

- `sql/candidates/20261104_admin_character_creation_notices_v1.sql`: creates only `private.admin_character_creation_notice_reviews`, with per-Admin `event_id` receipts, RLS and no public table privilege. **No creation trigger or second player-writable event queue**.
- Admin-only `get_admin_character_creation_notices_v1` projects committed source-event identity, creator email (Admin-only), character name/ID, timestamp, reviewed status and total unread count. It excludes raw source `details`, character `secret`, sheet and inventory.
- Admin-only `review_admin_character_creation_notice_v1` marks a real source event reviewed for one GM, idempotently. Other Admins retain independent unread state. Full event retention follows existing character/event lifecycle; this candidate does not change data retention.
- `pages/admin/activity.js` retains existing visitor dashboard, adds a creation-notice table, unread count, explicit review action and a direct link to NPC management. It reports when its matching database migration is not yet installed; no silently successful fake notice.
- No permission changes are triggered by a notice and no GM preapproval blocks Forge creation. Alt-character multi-ownership and NPC page Admin reachability remain separate acceptance work.

## Validation and limitations

- `scripts/validate_admin_character_creation_notices_candidate.mjs`: source/ACL/client-boundary validator.
- `scripts/fixtures/admin_character_creation_notice_candidate_pg17.sql`: isolated Postgres 17 setup and simulated role assertion for committed-only rows, unread totals, independent GM receipts, idempotent review, non-Admin denial and no direct receipt access.
- `.github/workflows/validate-admin-character-creation-notices.yml`: executes candidate SQL in an ephemeral PG17 service and runs the existing Next.js build check.

**Evidence caveat:** The PostgreSQL fixture simulates role-claim setting; it is **not** an actual GoTrue/PostgREST browser test. The full live `auth.users`/RLS/permission interaction, browser loading, missing-migration behavior, Admin `/npcs` deep-link handling and app acceptance are unverified until genuine staging tests. A green build is not a production migration approval.

## Release gates and database safety

Before live installation, verify current deployed function signatures, event constraints/ACL, Admin helper and schema; produce a migration with the repository's Supabase CLI, review index/FK/rollback and approval scope, then perform genuine signed-in Admin/non-Admin tests and browser acceptance. Preserve every existing `character_level_events` row; do not alter v2/v3 creation code or current user grants as part of this feature.

**No destructive SQL is planned in this candidate.** The owner requires approval before any large destructive database operation; for this feature, all live DB changes still need a reviewed release action and post-apply verification. No merge or deployment was performed.

**Future enhancement:** Display an unread badge outside `/admin/activity` if needed, but do not add global frequent polling without performance review. This version gives an Admin inbox and manual refresh, not push notifications.

## Additional genuine signed-in local JWT gate — pending exact-head CI

The held candidate now includes a *separate* free Supabase CLI/GoTrue/PostgREST GitHub workflow job, not merely simulated SQL claim checks. `scripts/fixtures/admin_character_creation_notice_local_auth_pg17.sql` prepares a throwaway local schema with real `auth.users`; `scripts/test_admin_character_creation_notice_local_auth.mjs` signs in **two GMs, a creating player and an unrelated player** with real GoTrue JWTs, then asserts (N01–N04) Admin-only notice projection, denial of unauthorized/anonymous API calls, idempotent per-Admin reviews, distinct unread totals and no raw event read by the creating player.

All local test credentials are generated in ephemeral CI; no DnDWeb production URL or access key is used. The `private.current_user_is_admin()` helper is an intentionally **reduced local role fixture**, not a claim that the entire production user-profile/permission system is represented. Exact-head results are **pending**, and genuine local JWT tests still do not substitute for a final owner browser review or a reviewed live migration.