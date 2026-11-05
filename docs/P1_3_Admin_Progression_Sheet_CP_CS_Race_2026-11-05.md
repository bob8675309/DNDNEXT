# P1.3 — Source-original Admin Progression vs Sheet Edit CP/CS Lock Inversion (2026-11-05)

**Status:** Research-only, reproducible two-session PostgreSQL 17 deadlock on [held draft PR #317](https://github.com/bob8675309/DNDNEXT/pull/317), **NOT** production rollout or universal real-browser reachability. [Exact-head CI run 42049546692](https://github.com/bob8675309/DNDNEXT/actions/runs/42049546692) **SUCCESS**, tested SHA `c7ba39df492bce3b64a5547aa1da0fbaee10aefa`. This remains separate from [held Forge PR #324](https://github.com/bob8675309/DNDNEXT/pull/324), stacked on unmerged #321; no code was merged between these research branches.

## Verified exact deployed source paths

All original SQL function bodies below were read from live DnDWeb in **SELECT-only** mode and reverified by PostgreSQL's `md5(pg_get_functiondef)` inside a disposable PostgreSQL 17 CI service:

| Source function | Live MD5 | Relevant row-lock/operation order |
| --- | --- | --- |
| `public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)` | `eb467b7c7a8d548581a36cfcb0d8f77b` | **CP → CS**: `INSERT ... ON CONFLICT DO UPDATE` progression, then `INSERT ... ON CONFLICT DO UPDATE` sheet, then level event |
| `private.sync_character_progression_from_sheet_v1()` | `bb1a3a2d1600ce33cd4fcadac5e0f3a9` | **CS → CP** when invoked by original `character_sheets AFTER INSERT OR UPDATE OF sheet` trigger |
| `private.materialize_player_forge_starting_equipment_v1(uuid)` | `653e1b9d7cc47dcff2cef33a674b97f4` | **CP → CS → currency/inventory**, including two original `SELECT FOR UPDATE` prefixes, triggered at deferred commit |
| `private.materialize_player_forge_starting_equipment_trigger_v1()` | `23fa54dd0a6d7b42b802d613f39ea27c` | Original DEFERRABLE INITIALLY DEFERRED AFTER CP INSERT |

The source-original Admin function lives in `scripts/fixtures/p1_3_admin_progression_original_pg17.sql`, with **unchanged original SQL** and its checked fingerprint. The existing original Forge functions are from `scripts/fixtures/p1_3_forge_materializer_original_functions_pg17.sql`.

The new `scripts/fixtures/p1_3_admin_progression_race_extension_pg17.sql` adds only the class/event columns needed to compile this source and **explicitly reduced scratch helper replacements** for `private.require_character_admin_v1`, `public.get_character_progression_v1`, and `auth.uid()`. These are NOT production authorization parity or real JWT, and some production triggers/RLS remain missing.

## Exact executable outcomes: F01–F05

The existing `F01` original deferred gear commit, `F02` original materializer CP/CS inversion and `F03` CP-first control tests remain intact and passing.

**F04 (new) — PostgreSQL deadlock 40P01 reproduced:** Two scratch transactions operate on the same source-character UUID. T1 explicitly prelocks CP, pauses using a test-only advisory marker/sleep, then invokes the **entire original Admin** `public.set_character_progression_v1` code, which writes CP followed by CS. T2 issues an actual `UPDATE public.character_sheets`, acquiring CS and then calling the **entire original** sheet-to-progression trigger, which needs CP. After the observed `Lock:transactionid` wait, PostgreSQL emits a genuine `deadlock detected`/SQLSTATE `40P01` and aborts exactly one transaction. The survivor leaves one progression row and does not duplicate the already materialized inventory item or currency record.

**F05 (new) — limited control PASS:** Both transactions use **test-only CP-first `SELECT ... FOR UPDATE`** prelocking before the same original Admin RPC and original sheet-trigger update. Both finish without deadlock; the sheet note persists and the existing inventory/currency remain singular. This is a **synthetic ordering control only**; it is NOT an accepted code patch, transaction design or proof that all operations can safely acquire CP before CS.

Exact run: [42049546692](https://github.com/bob8675309/DNDNEXT/actions/runs/42049546692), `c7ba39df492bce3b64a5547aa1da0fbaee10aefa`, both original hash gate and F01–F05 assertions **SUCCESS**, with PostgreSQL server logs independently showing deadlock detection. [PostgreSQL 17 row-lock and deadlock semantics](https://www.postgresql.org/docs/17/explicit-locking.html) explain why these opposing row locks can deadlock.

## Implication for the separate PR #324 verified creator seed

The **unapplied** `private.seed_verified_forge_progression_creator_v1()` on held #324 is a new CP `BEFORE INSERT` handler, using MVCC SELECT on the already-existing sheet and immutable creator record. Its J49–J62 actual signed-in tests succeed, but **it does not run on ordinary CP UPDATE operations** and **cannot repair the already existing Admin CP→CS vs sheet CS→CP inversion**. Its lack of explicit `FOR UPDATE` or data writes in a BEFORE INSERT does not constitute global transaction-order safety, because the original immediate grant and deferred equipment triggers still acquire G/I/CS/CP locks in their own paths.

Do **not** claim `#324` changes created this Admin inversion: both handlers in F04 are original deployed source, and the new creator seed is **not installed in this F04 database**. Nor should the global P1.3 spell/encounter lock class `P` (participant) be confused with this narrower **CP = public.character_progression** row.

## Remaining uncertainties and one next bounded task

- **Player level-up still untested here:** live `public.complete_character_level_up_v5` (MD5 `02d74b973a763c53c595be20e35e512f`) starts with **CP `FOR UPDATE`** and delegates via v4/v3 to original level-up handlers, while permitted sheet edits start with CS. This is a source-derived **candidate second inversion**, not yet a source-authentic completed level-up deadlock test.
- Exactly one user-controlled Admin vs sheet edit with normal production RLS/roles, all original 19 CP triggers, genuine JWT, real source catalogue/feat/gear helpers, multi-character lock ordering, grant G→CS callbacks, and inventory I transactions have **not** been reproduced together.
- The source-original Admin function writes `public.character_level_events` and calls multiple domain helpers. This fixture's events and Admin authorization are deliberately reduced and do not validate actual service/GM permissions.
- **Single next source task:** expand the fixture to the original level-up v5→v4→v3 transaction prefix and the specific source helpers needed for a valid simple XPHB Fighter level-up, **with real signed-in local GoTrue/JWT sessions**, then execute a deterministic two-session `level-up CP→CS` versus `sheet-edit CS→CP` race. Preserve original source semantics, test rollback/inventory/grant idempotence and record exactly which helpers/triggers remain absent. In parallel, review owner-approved global P1.3 CP/CS/G/I precedence rather than prescribing CP-first universally.

**Production effects: NONE.** Live source verified read-only; no DnDWeb writes/grants/trigger alterations, no `main` merge, Vercel release, world/town map or Actor AI modifications. #317 and #324 remain draft/unmerged.
