# P1.3 — Original Admin feat-grant G versus signed-in Player level-up CP/CS (F11–F16)

**2026-11-05, HELD SOURCE-ORIGINAL CI CANDIDATE — not production.** Scope is research-only draft PR #317; original live Supabase DnDWeb SQL was read through SELECT/pg_get_functiondef. The source-backed fixture is derived from the existing successful **F06–F10** authentic local GoTrue/PostgREST Fighter 1→2 suite. **The new F11–F16 results must not be marked PASS until their exact executable GitHub Actions run succeeds.**

## New source/transaction finding

The deployed `public.grant_character_option_v1(uuid,uuid,text)` checks `public.is_admin()`, performs an actual canonical `character_option_grants` INSERT/UPSERT (G), then calls unchanged `private.sync_admin_feature_array_v1`. The latter takes `character_sheets FOR UPDATE` (CS), updates sheet and players, and the real `private.sync_character_progression_from_sheet_v1` AFTER UPDATE trigger may then take character progression (CP). Thus **Admin grant G→CS→CP** can oppose the already source-original **signed-in `complete_character_level_up_v5` CP→CS**. This is a candidate deadlock cycle, not evidence of a spontaneous production incident.

Read-only live `md5(pg_get_functiondef)` for all source-copied functions:

| Function | Production fingerprint |
| --- | --- |
| `public.grant_character_option_v1` | `aa0f6a0c6c6a6f2b9aacf57bd40e434c` |
| `private.sync_admin_feature_array_v1` | `f2b6190ecc9400772e054892f63cdc47` |
| `private.current_user_is_admin` | `1fc5fbcb121b2862eeab869edfb3a209` |
| `public.is_admin()` | `629e70fee675bf18f353a19d807e4416` |
| `private.guard_direct_character_authority_mutation_v1` | `04596b0a3fdfb71c1b357056e8c6023b` |
| `private.sync_character_progression_from_sheet_v1` | `bb1a3a2d1600ce33cd4fcadac5e0f3a9` |
| `public.complete_character_level_up_v5` | `02d74b973a763c53c595be20e35e512f` |

Live grant aggregate `(character_id,option_id)` has a unique constraint and a BEFORE INSERT/UPDATE/DELETE authority trigger. Both original G tables are RPC-only under production RLS. Original admin grant is authenticated-executable but denies non-admin users with `42501`. The non-public advancement helper `private.apply_character_level_advancement_v1` starts by locking CS before writing the G instance/aggregate; it **has not been exercised by this bounded Fighter level-2 fixture**. In live production, that private helper's effective authority must be determined from the actual caller; its permissive inherited PostgreSQL EXECUTE grants do not automatically mean PostgREST exposes the private schema.

## Proposed free test implementation (not an approved migration)

- `scripts/fixtures/p1_3_admin_grant_original_source_pg17.sql`: five **unchanged complete source definitions** pulled from live `pg_get_functiondef`. Each has a runtime MD5 drift gate in the extension; existing original F06-F10 sources remain unchanged.
- `scripts/fixtures/p1_3_admin_grant_levelup_extension_pg17.sql`: fails closed unless it runs in an empty disposable local PG17/GoTrue fixture after F06-F10. Creates a reduced grant/profile/canonical Lucky specimen table with a real G unique key, source RLS concept and original G/CS guard triggers. Replaces ONLY the earlier test-only `current_user_is_admin=false` stub with the live source after F10 has already passed.
- TEST-ONLY probes: real signed owner v5 runner prelocks CP and publishes advisory marker `(9315,1)`; a separate AFTER-CS observer for the original Admin grant publishes `(9314,1)` and pauses before the unchanged CS→CP trigger. These delays are **not present in production** and must never be published as fixes.
- `scripts/test_p1_3_levelup_v5_real_jwt_local.mjs`: existing real auth F06–F10 retained. F11 loads the extension; F12 rejects anonymous and non-admin signed grant RPCs; F13 checks actual Admin G INSERT/UPSERT, no duplicate projected feature and real `granted_by`; F14 revokes database Admin privilege and rejects the same JWT; F15 expects two truly signed-in source-original transactions with one real `40P01` victim and no partial grant/level event; F16 retries only the aborted operation and verifies exactly one canonical G, one Admin feat on CS, one level event/session and correct grant owner.

This is a **bounded original Admin G mutation versus original level-up CP/CS**, not a test of simultaneous new player feat-grant G via `apply_character_level_advancement_v1`. It uses simplified class helpers, a single XPHB Fighter 1→2, reduced Auth RLS and a source-shaped G table; it does not load all 31 original Forge creation triggers, real inventory I/deferred COMMIT handlers, GM UI or complete original catalogue. It cannot prove production incidence rates or a universal CP-first lock order.

## Required evidence gate and next task

Run the existing free workflow `.github/workflows/validate-p1-3-levelup-v5-auth-locks.yml` at the **exact changed PR head**. Keep F06-F10 green and only then classify F11-F16 by actual logs. On any fixture failure, explain source/auth/setup versus genuine concurrency outcome; never label a failed fixture as proof of a source defect.

**Next single bounded work after passing:** Follow the original authorized **player advancement grant G** at a valid feat-bearing level (for example a source-qualified Fighter level-4 choice) with the genuine v5 caller, source grant-instance triggers, and actual G/I/CP/CS path. Compare to this original Admin-G counterexample. Coordinate with the separate #324 merchant inventory J70-J77 results; do not copy unreviewed code between stacked research branches or install a partial migration.

**Production effects: NONE.** No DnDWeb SQL/data/grants, `main`, Vercel production release, world/town map, AI or gameplay implementation changed.
