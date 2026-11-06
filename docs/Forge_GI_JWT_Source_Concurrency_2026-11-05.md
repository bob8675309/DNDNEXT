# Forge G/I under signed-in CP/CS lock contention — J63–J69

**Status:** [held draft PR #324](https://github.com/bob8675309/DNDNEXT/pull/324) **RESEARCH ONLY**; original-source PostgreSQL 17 and genuine local Supabase GoTrue/PostgREST tests are green. No production migration, DB writes or permission change.

**Exact executable evidence:** [GitHub Actions 42058859598](https://github.com/bob8675309/DNDNEXT/actions/runs/42058859598), source/test SHA **`639d1cfa3f51bb35e0258c0073e7b39a81442f63`**, **SUCCESS** both original PG17 replay and local-authentication jobs. Earlier source-equivalent run [42058650731](https://github.com/bob8675309/DNDNEXT/actions/runs/42058650731) also passed all J63–J69. These results extend J00–J62 without changing the source-original creation functions or the held verified creator seed.

## Source and timing fidelity

The disposable fixture already loads and source-MD5-checks the original live function bodies:

| Function | Live `md5(pg_get_functiondef)` | Tested role |
| --- | --- | --- |
| `private.materialize_player_forge_feat_instances_v1()` | `c27c4181a51cfd018bbb8244e9931550` | Immediate CP INSERT canonical Lucky feat instance and aggregate grant **G** |
| `private.materialize_player_forge_starting_equipment_v1(uuid)` | `653e1b9d7cc47dcff2cef33a674b97f4` | Deferred CP INSERT materializer creates source-like equipment **I** and currency, and on later invocation acquires CP `FOR UPDATE` then CS `FOR UPDATE` |
| `private.sync_character_progression_from_sheet_v1()` | `bb1a3a2d1600ce33cd4fcadac5e0f3a9` | Original CS AFTER UPDATE trigger upserts/locks CP; opposing **CS → CP** path |

Both real grant tables—`character_option_grant_instances` and `character_option_grants`—are installed with their original columns, unique keys, FKs, checks, and the five original downstream grant-table triggers. The character is a source-validated, genuine-JWT XPHB Lucky player Forge creation by **OUTSIDER** with a separate, permission-granted genuine-JWT **PLAYER** co-editor (names refer to fixture roles, not production account identities). Its grant instance, aggregate grant, inventory item and currency were originally created in earlier J49–J62 source tests and independently asserted in J63. The original new-character `granted_by` provenance is correct in this held creator-seed fixture, but **is not corrected in live production**.

`scripts/fixtures/forge_gi_cp_cs_local_jwt_race_pg17.sql` adds **three TEST-ONLY helpers**: an authenticated editor-gated gear wrapper that prelocks CP, marks advisory `(9360,1)` and pauses before invoking the **unchanged source-original** gear function; an invoker/RLS-authenticated note updater that only changes the permitted sheet `note`; and an alphabetically earlier AFTER sheet UPDATE pause to hold CS before the **unchanged original** sheet→CP sync. Both HTTP calls are actually initiated with `.then()` on local signed-in PostgREST RPC builders; the harness polls for the visible CP advisory lock before launching the co-editor's CS UPDATE. **Neither prelock nor the pauses is present in production or a proposed global fix.**

## Exact J63–J69 results (genuine local JWT)

- **J63 PASS:** one canonical Lucky grant instance, one canonical aggregate G row, one original deferred materialized inventory I row and one currency row, all correctly associated with the verified original authenticated creator. Initial creation and G/I writes happened **before** the race.
- **J64 PASS:** another signed-in user without current `can_edit` cannot invoke the fixture gear or sheet adapter (`42501`); grants/inventory unchanged. This is the test adapter's permission policy, not proof of real GM role handling.
- **J65 PASS:** two actual signed-in sessions, original gear helper **CP → CS** versus original sheet trigger **CS → CP**, produce PostgreSQL **`40P01`** under the test-only prelock and CS hold. Exactly one transaction is aborted.
- **J66 PASS:** full-record MD5 snapshots for both G tables, original inventory item and currency are unchanged after the aborted transaction; all four canonical row counts remain one.
- **J67 PASS:** retrying both signed-in operations completes; the source original gear function finds the previously materialized currency and returns `applied:false`, producing no duplicate grants, items or currency.
- **J68 PASS:** revoking the co-editor's current edit permission prevents further sheet and gear-wrapper access, without modifying G/I rows.
- **J69 PASS:** replaying the original player Forge creation request ID under the verified creator returns the same character and leaves G/I hashes unchanged.

**Critical scope distinction:** The timed J65 race invokes the source-original gear helper on **already-materialized** equipment. It takes the original CP/CS locks but exits through the existing currency idempotency guard; **no fresh grant-row G INSERT/UPDATE or new inventory I INSERT occurs during that two-session deadlock**. The passing G/I snapshots prove **transactional integrity, rollback and safe idempotent reuse of previously created rows**, *not* a complete G↔I lock graph or deadlock-free concurrent materialization. Other feat families, original 24 omitted creation-adjacent triggers, real production RLS/ACL, level-up v5 in this same test, merchant stock market purchases and trading paths remain untested together. The new fixture's editor-only wrapper is deliberately scoped; do not infer privileged GM/service access.

## Relation to P1.3 PR #317 and next step

The separate held [PR #317 original v5 player level-up F10](https://github.com/bob8675309/DNDNEXT/blob/docs/p1-3-global-lock-order-design-20261101/docs/P1_3_Player_Levelup_V5_Signed_Editor_CP_CS_Race_2026-11-05.md) also proves a two-authenticated-user, test-timed CP→CS/CS→CP `40P01`. Source code was **not merged across PRs**. PR #324's new creator-seed `BEFORE INSERT` remains isolated and does not correct CP UPDATE/CS UPDATE inversions.

**Next bounded research:** identify an original production source path that **actually writes G or I while another authenticated transaction holds G/I/CS/CP**, and capture the full, true original supporting triggers and permission boundaries. Candidates include source market-purchase `character_stock FOR UPDATE` with inventory INSERT and a concurrent stock/inventory operation, plus actual feat grant changes through a permitted level-up. Require a valid test-owned character, source backing, two real JWTs, explicit timing control, observed locks, rollback and item/stock conservation; do not fabricate direct browser grants or force a universal CP-first lock protocol. Coordinate the resulting graph with owner-approved #317 P1.3 global locks, #321 creator/privacy and #324 immutable replay before any reviewed release.

**Production effects:** NONE. No live G/I rows, function, trigger, grants, historical attribution, `main`, Vercel, world/town map or Actor AI changed.
