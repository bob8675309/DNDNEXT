# I2-I — Source-original signed Admin feat/boon projection legacy-sheet overwrite and Option A scratch

**Status: signed original RED / scratch Option A GREEN VERIFIED at source/test head; documentation-inclusive exact-head CI PENDING. Research only — NOT production.** Prepared November 12, 2026 America/Chicago. The owner explicitly approved *safe, scoped merges and continued testing*, not a production SQL/roles or feature release. [#372](https://github.com/bob8675309/DNDNEXT/pull/372) was safely merged into parent held research [#371](https://github.com/bob8675309/DNDNEXT/pull/371), preserving I2H-01–10 and the **11/34 tested, 23 untested** historical source-writer ledger. Docs-only #348 merged to main, but no gameplay/security/RLS candidate was deployed.

> **2026-11-12 signed-source receipt — 11/11 CASES PASS.** [Actions #43319584048](https://github.com/bob8675309/DNDNEXT/actions/runs/43319584048), source/test head `6f1aeeee6dd48408456220bf12f9758125c4208d`, independent new Admin job `131539899439` SUCCESS; unchanged three prior I2-F/I2-G/I2-H signed jobs also SUCCESS. Original public Admin grant + private helper MD5 unchanged for I2I-03 RED, canonical Lucky/G correct but two unrelated historical accounts overwritten. One MD5-reversible **local only** private statement suppressed after RED, signed Admin I2I-05 GREEN preserved G and canonical CS while all legacy sheets/timestamps remained frozen. All I2I-01..11 present as PASS in actual job log. I2I-11 restored production-like database-role privileges **only inside local rolled-back transaction**: authenticated SQL role could invoke privileged helper without Admin context. This is **not verified remote REST exposure**. Exactly one legacy-sheet writer is now counted: **12/34 bounded tested, 22 untested**. This is NOT full original 31-trigger Forge, production Auth/RLS/browser, all indirect writers or independently restored backup. Final docs-inclusive head must be rechecked before merge.

## Original signed source and why it matters

Deployed DnDWeb PG17 **SELECT-only** `pg_get_functiondef` confirmed original `public.grant_character_option_v1(uuid,uuid,text)` MD5 `aa0f6a0c6c6a6f2b9aacf57bd40e434c` (auth EXECUTE, anon denied). It checks real `public.is_admin()`, inserts/upserts `public.character_option_grants` (G), then calls `private.sync_admin_feature_array_v1(uuid,text,text,boolean)` MD5 `f2b6190ecc9400772e054892f63cdc47`, which writes canonical `character_sheets.adminGrantedFeats` or `adminGrantedBoons` AND every associated editor account's `public.players.sheet` and timestamp. The original private Admin authority and sheet guards are preserved. The new test uses genuine signed **Admin public RPC**, not a privileged direct private function for original RED or Option A GREEN.

In a separate **read-only ACL inspection**, original PG17 showed `authenticated` has both **USAGE on the `private` schema** and **EXECUTE on this SECURITY DEFINER helper**; `anon` lacks schema USAGE but has function EXECUTE. This is a potential database role privilege issue. **Public REST/API exposure is unproven:** schema-level PostgreSQL privileges are not the same as PostgREST schema exposure. The existing P1.3 local Admin fixture intentionally revokes helper EXECUTE, so the new independent case restores live-like `authenticated` USAGE/EXECUTE **only inside a disposable rolled-back SQL transaction** to characterize database-role reachability. A positive SQL-role result is NOT evidence that a real remote client can call the private helper, and is NOT a reason to change hosted grants without a complete service/role audit.

## Reproducible test assembly

Four serial, independent GitHub Actions disposable PG17/GoTrue/PostgREST jobs: unchanged signed I2-F source/Story/nonce regression, unchanged signed I2-G level-up-v1 RED/GREEN, unchanged signed I2-H Tough v5 RED/GREEN, then a **fresh I2-I Admin test**.

The I2-I job installs unchanged original `p1_3_levelup_v5_local_auth_pg17.sql` and original `p1_3_admin_grant_levelup_extension_pg17.sql`, including exact original source MD5s, a reduced local `user_profiles`/grant/catalogue model, real GoTrue session `auth.uid()`, signed Admin/non-Admin JWT, original authority guards, and test-only Admin sheet timing probe. Unlike full modern Forge, the character, permissions and initial sheets are **SQL-seeded**. This is not production Admin rights/sheet RLS equivalence or complete 31-trigger Forge.

Local source gate checks original Admin public/private hash, role checks and original source guards. Only **after** the signed original grant RED is asserted, one exact `UPDATE public.players` statement in the private Admin feature helper is replaced with a source-MD5 reversible no-op in scratch. The original public grant RPC, G upsert, Admin authorization, authority triggers, feat/boon array projection, and other source functions stay unchanged.

### Executed I2-I cases (all PASS on recorded signed source/test head)

| Case | Acceptance |
|---|---|
| I2I-01 | Original public Admin, private feature/role/authority source MD5, signed ACL |
| I2I-02 | Signed non-admin editor/coeditor/outsider and anonymous grant denied without G/CS/account mutation |
| I2I-03 **ORIGINAL RED** | Signed Admin grants Lucky canonically and attributes G correctly, but original private helper overwrites TWO unrelated editable historical account sheets |
| I2I-04 | Only after RED, narrow source-MD5 reversible private mirror scratch correction; original public grant/authority unchanged |
| I2I-05 **SCRATCH GREEN** | Genuine signed Admin grants canonical Lucky G+CS while same-character and unrelated historical accounts and timestamps remain frozen |
| I2I-06 | Signed grant replay/upsert retains unique grant ID, updates note, avoids feat duplicates and preserves legacy snapshots |
| I2I-07 | Signed Admin boon branch coexists with feat; canonical G/CS and all archival sheets consistent |
| I2I-08 | Invalid option and missing character atomic rejection |
| I2I-09 | Revoked Admin role denies the same signed JWT |
| I2I-10 | Original public grant and v5 source intact, one feat+one boon, all historical snapshots frozen |
| I2I-11 | Separate rolled-back SQL ROLE privilege risk characterization under scratch live-like `private` ACL; exact canonical rollback and no REST-reachability claim |

All 11 cases are **verified PASS** in the source/test-head signed workflow. The original `private.sync_admin_feature_array_v1` now counts **one** new bounded local source writer: **12/34 tested, 22 untested**. Do not count duplicate role/SQL tests as additional source writers.

## Release restrictions and next one action

No hosted SQL/DML/DDL, no role grants, production database rows, game/map, Next.js Pages Router code, Vercel deployment, paid agent #325 or new feature rollout. Original 31-trigger modern Forge creation and full Admin/GM/creator roles, original feat acquisition, exact production Auth/RLS/schema exposure, PostgREST and browser access, global locks/multiwriter race, all writer/consumer coverage and **encrypted independently restored database + Storage backup** remain unverified. The local server-generated Admin grant proves a narrow source slice only.

**ONE NEXT TASK:** verify final documentation-inclusive head GitHub Actions, and if all signed inherited and original Admin tests pass at that exact SHA, safely merge **research into its parent research branch only**. Preserve original source hashes and RED assertions. Then choose one of **22 remaining** original UPDATE writers. No production migration or gameplay/security merge without separate release approval.
