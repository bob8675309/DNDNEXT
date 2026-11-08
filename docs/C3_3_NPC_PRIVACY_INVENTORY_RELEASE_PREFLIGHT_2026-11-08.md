# C3.3 — Owner-controlled NPC privacy + Forge inventory release and fail-closed rollback plan

**2026-11-08 UTC · DRAFT REVIEW ONLY · NO PRODUCTION EXECUTION**

## Source identity and authority

- Work branch: `feature/c3-3-npc-secure-profile-candidate-20261107` / [draft PR #345](https://github.com/bob8675309/DNDNEXT/pull/345), base `main` `9437b9d0a2bedc3ba78110c612543f6033674a72` when last verified. Recheck both source SHAs, deployed Vercel source, Supabase policies and function fingerprints at the instant any release is contemplated.
- **NPC stage 1:** `sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql`, blob `9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3`.
- **NPC stage 2:** `sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql`, blob `afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac`.
- **NPC stage 3:** `sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql`, blob `01e48823ac3a46aa5880e98200e97c2595501ce7`.
- **Forge inventory owner CHECK + DML RLS:** `sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql`, blob `4532ddb8db642d0d0ab14646a3e87c034d4134c6`.
- Supporting evidence: `docs/C3_3_NPC_PRIVACY_RELEASE_GATES_2026-11-07.md`, `docs/C3_3_NPC_READER_COMPATIBILITY_MATRIX_2026-11-07.md`, `docs/C3_3_NPC_PROFILE_SOURCE_PROVENANCE_2026-11-07.json`, and [visual QA](C3_3_NPC_PRINT_VISUAL_QA_2026-11-08.md).
- This plan is based on **GitHub candidate source and accepted disposable tests**; **no new live Supabase fingerprint or role-grant query was performed in preparing it**. Any date-stamped evidence is not automatically an installation receipt.

## Why all four candidates and the client cutover are coupled

1. **NPC stage 1** changes `character_sheets_select_visible_or_assigned` to actual `can_access_character_v1(id,'edit')` and installs `get_npc_profile_visible_v1`. It also corrects the original SECURITY DEFINER `get_my_player_characters_v2` reader, which would otherwise bypass sheet RLS.
2. **NPC stage 2** revokes direct `authenticated` SELECT for five `characters` lore fields (`background,motivation,quirk,mannerism,voice`). It provides an explicitly GM-authorized dossier RPC and a current-editor narrative RPC. Original player/GM/NPC/town/inventory direct readers must be enumerated and adapted; RLS cannot compensate for a missing column ACL.
3. **NPC stage 3** creates immutable creator-attribution capture on `characters` INSERT, denies players writing `characters.secret` in Forge, separates creator-private story from GM secrets, and rewrites legacy secret/profile readers. Existing historical `characters.secret` values must remain unchanged. A UI sheet-reveal `secret` flag **never authorizes disclosing** an old GM secret. Newly created secret data in two new tables requires durable backup/rollback handling.
4. **Inventory candidate** makes direct user-driven DML fail closed for `owner_type='character'`, narrows read rights to current `can_access_character_v1(...,'inventory')`, **then** removes the older `inventory_items_owner_type_chk` CHECK. The older NOT VALID CHECK blocks new character-owned inserts despite the newer validated CHECK permitting them; dropping it alone creates unauthorized direct-DML minting/update risk. The candidate uses `lock_timeout='2s'` and `statement_timeout='20s'` and requires PG17/source-policy/function fingerprints.
5. The #345 **new client depends on the new RPCs**. Deploying it first while RPCs are absent is a broken state; applying the stage-two column revoke while old readers are serving traffic can also break UI flows. Treat coordinated deployment/maintenance as a security release, not a passive PR merge.

## Required read-only live preflight: hard abort on drift

Before any owner release vote, collect a **fresh source/DB snapshot** with operator-approved read-only queries only (no actual data contents in logs):

- Exact current `main`, proposed merge commit, Vercel deployed source SHA, connected Supabase project/reference and PG major version; ensure no unreviewed concurrent migration.
- Exact `pg_get_functiondef` hashes and existing `EXECUTE` ACLs for `private.can_access_character_v1(uuid,text)`, `private.materialize_player_forge_starting_equipment_v1(uuid)`, `public.create_player_character_v1/v2/v3`, `public.get_my_player_character_v1`, `public.get_my_player_characters_v2`, `public.get_character_secrets_v1`, `public.set_character_secret_v1`, admin helpers, and relevant new RPC names (must be **absent** until installation).
- `pg_policies` and `pg_policy` for `characters`, `character_sheets`, `character_permissions`, `inventory_items`, and existing privilege/grant matrix for both `anon` and `authenticated`. Verify stage-one policy name and four inventory policy names/expressions are the same sources the candidate expects.
- `pg_constraint` status and definitions for both overlapping `inventory_items` owner CHECKs; non-valid old CHECK still blocks **new** rows. Verify character owner data and malformed `owner_id` counts by category only, not item personal content.
- Trigger names and ordering on `characters`; all 31 original Forge trigger paths and concurrent logic; 2024/XPHB spell and world-map dependencies remain untouched. Confirm stage-three new trigger/function/table names do not conflict.
- Aggregate-only count and recovery snapshot of existing GM-only `characters.secret` values (earlier documentation mentions **seven**; **not reverified live here**). Capture protected DB backup/snapshot and a tested recovery route, not plain-text secrets in artifacts.
- Project Data API exposure settings and post-migration PostgREST schema-cache refresh requirements; verify that new RPCs are callable only by expressly granted roles, and that SECURITY DEFINER functions have fixed `search_path`, explicit `auth.uid()` and authority gates.
- Fail closed if any fingerprint, column privilege, policy text, trigger shape, count assumption, lock risk, or cross-client source does not match; don't adapt SQL blindly on production.

## Disposable release rehearsal — **must pass before production approval**

1. Clone a source-authentic PG17 schema/roles/grants and relevant safe test data. Replay *all* original v1/v2/v3 Forge creation triggers (including blank first-load and level-up/rollback), materializer, nonce/replay, concurrent writes/locks and ledger updates. Current disposable tests are substantial but use reduced catalogs and only a subset of 31 original triggers. These are **open blockers**, not rhetorical checks.
2. Run original positive and negative role tests on **anon, unassigned visible outsider, hidden outsider, inventory-only, convert-only, current `can_edit` coeditor, original creator with and without current edit, GM, and signed-out/switching identities**; cover NPC and merchant Profile-first, Sheet, Print, inventory, town Bazaar→Shop, creation/private story and GM dossier. Revoke edit and verify creator story immediately disappears. Attempt unauthorized direct PostgREST character-item INSERT/UPDATE/DELETE and confirm rejection.
3. Take disposable state snapshot; apply review-approved **migration-shaped** change under a single explicitly reviewed transaction/maintenance strategy. The four existing research files each contain their own `BEGIN/COMMIT` and **are not a pre-approved atomic bundled migration**. Do **not** simply concatenate them or assume `psql --single-transaction` makes embedded `COMMIT` boundaries atomic.
4. Gate real traffic during DB/client cutover; verify new SQL contracts before enabling new client traffic. Explicitly define release pause, credential authority, lock timeout, PostgREST visibility/cache refresh, health checks, UI deployment source SHA, and failure abort behavior. If old UI sees revoked columns during maintenance it must be unavailable rather than using an unsafe fallback.
5. Test creation atomicity: when creator-private Story insert rejects/aborts, no half-created character or materialized gear should survive; same nonce replay must never replace a later edited private story. Verify original GM-created NPCs do not get forged creator rights and historical GM secret values remain unchanged.
6. Capture fresh before/after `pg_policies`, `pg_constraint`, `pg_proc`, triggers, ACLs and row-count invariants, with all private-data fields redacted. Repeat role tests **after** schema cache refresh and in authentic actual Next.js browser routes. Preserve negative tests from earlier failed CI.
7. Rehearse fail-closed rollback under every failure checkpoint (before SQL, between stage transitions under traffic hold, after full DB cutover before UI, and after real creation/write). Demonstrate rollback safety with new private-story/revelation writes, not merely reversing a DDL file.

## Fail-closed rollback contract

- **Before any schema commit:** abort the transaction, restore prior client traffic only after confirming original schema/ACLs remain intact. The future migration must prove a single abort point or keep all stages under maintenance with traffic disabled.
- **After schema changes, before enabling new UI:** if verification fails, keep traffic held. Prefer a safe corrected forward migration or a reviewed reversible snapshot-based downgrade; **do not** reactivate old permissive sheet/secret RPCs just to make the old frontend work.
- **After UI starts serving:** on any GM secret, private backstory, inventory minting, or cross-account stale-role issue, immediately deny risky API access / hold affected flows, revert app traffic to a compatible privacy-safe build only if its RPC contracts are proven, and prepare DBA-reviewed remediation. A naive revert of #345's UI with stage-two column revoke in place is **not** a proven rollback.
- Creator attribution and `character_backstory_secrets` / `character_public_secret_revelations` become newly written source-of-truth data. Do not drop them on downgrade or overwrite creator attribution; preserve and separately reconcile any data created after migration.
- Never restore direct SELECT of GM secrets/lore or the broad old character-sheet policy as a workaround. Any rollback restoring former ACLs/RPCs must pass fresh adversarial negative role/JWT tests **before** reopening traffic.
- Rollback owner, decision threshold, secure DB backup restore point, maximum downtime budget, and the precise prior **privacy-compatible** UI commit are **not yet specified**. Block approval until each is fixed and rehearsed.

## Release acceptance / authorization

- **Current status:** draft-only research/source compatibility plus successful disposable Next town/inventory and official printable PDF QA. It is **NOT** installed, merged, deployment-ready, or a full 31-trigger/role/recovery signoff.
- **Approval sequence:** owner reviews actual checked source SHA, full migration generated under accepted Supabase tooling and SQL review, complete positive+negative role and Forge replay, new privacy-safe rollback artifact, backup and traffic-cutover plan. Owner gives **separate explicit authorization** for SQL migration and production client deployment/merge. A green GitHub workflow alone never grants that authority.
- **ONE NEXT TASK:** close the missing original-catalog/31-trigger plus end-to-end rollback rehearsal gaps in a disposable environment and submit the versioned release decision packet for owner approval; **no execution of live SQL before that vote**.

No live DB query/write, PR merge, Vercel production deployment, world map, tactical engine or paid agent change was performed in authoring this document.

## 2026-11-08: source-only precommit transaction-abort test extension

C3R01–03 (NPC stages 1–3) and C3R04–05 (joint inventory CHECK/RLS) are added to disposable exact-source signed workflow on draft PR #345. They remove each source candidate's single verified top-level transaction wrapper **in process memory only** to simulate a coordinated outer transaction and assert before/after original grants/functions/policies/checks and synthetic GM-secret retention on both explicit ROLLBACK and a deliberately late SQL error. C3M00–01 includes source-exact non-map `protect_mog_delete_v1` deletion behavior. CI pending at the authoring SHA. These checks are NOT a proof of reversing committed data or an approved SQL migration; real backup and client release/rollback remain independent owner-gated steps.
