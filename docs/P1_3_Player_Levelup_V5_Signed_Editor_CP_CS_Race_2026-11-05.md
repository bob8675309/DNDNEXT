# P1.3 — Authentic Player Level-Up v5 vs Co-editor Sheet CP/CS Race

**Date:** November 5, 2026 · **State:** source-original, signed-in **disposable CI evidence only**, on held [draft PR #317](https://github.com/bob8675309/DNDNEXT/pull/317), **NOT** a released fix.

**Executable receipt:** [GitHub Actions run 42055043840](https://github.com/bob8675309/DNDNEXT/actions/runs/42055043840), exact tested SHA **`d09b3981f04ceceb09ff0a1489f589041a441164`**, **SUCCESS** for disposable PostgreSQL 17, real local Supabase GoTrue and PostgREST, static original-function hash checks, and authenticated cases F06–F10. Earlier [F01–F05 original Admin/Forge source lock CI](https://github.com/bob8675309/DNDNEXT/actions/runs/42049546692) remains an independent passing checkpoint.

## Exact live source loaded (not rewritten)

Read-only `pg_get_functiondef` on DnDWeb PG17.4 supplied all seven full function bodies in `scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql`. The disposable test **rechecks `md5(pg_get_functiondef)` at runtime**, not just comments:

| Original source function | Live-source MD5 | Key behavior tested |
| --- | --- | --- |
| `public.complete_character_level_up_v5(uuid,jsonb)` | `02d74b973a763c53c595be20e35e512f` | Current edit-authorization, **CP `FOR UPDATE` first**, passes to v4, postprocesses events |
| `public.complete_character_level_up_v4(uuid,jsonb)` | `f8338ef170c6e27b972e777eeae406b8` | CP `FOR UPDATE`, source delegation to v3 |
| `public.complete_character_level_up_v3(uuid,jsonb)` | `4467e166234c67fc12dd73da0e46b379` | CP `FOR UPDATE`, source class-choice gating, core base call |
| `private.complete_character_level_up_base_v3(uuid,jsonb)` | `e33639d549ef557976a3970ea51f5238` | CP then level-up session locks, **CS `FOR UPDATE`**, original HP/spell/progression/CS writes and event |
| `private.can_manage_character_progression_v1(uuid)` | `ac70e4ec033d86c4e0a254d50d429a45` | Signed-in `auth.uid()` with **current** `character_permissions.can_edit` |
| `private.sync_player_forge_class_spell_summary_v1(uuid)` | `5b1b275a268a57591a2e35a05ce7480d` | Rewrites CS from canonical class spells through original sync |
| `private.sync_character_progression_from_sheet_v1()` | `bb1a3a2d1600ce33cd4fcadac5e0f3a9` | Genuine **CS → CP** `AFTER UPDATE OF sheet` trigger |

**Important fidelity limits:** The scratch schema has a synthetic XPHB Fighter with two class-progression rows, a manually opened valid level-up review, no spells, feats, subclass, inventory change or class-choice groups. The actual **v5→v4→v3→base-v3**, permission helper and both original sheet functions are source-unchanged; many class-specific helper functions are **explicit reduced stubs**, guarded to only allow empty selections for Fighter 1→2. Preferred-class predicate, XP thresholds, spell-slot metadata, return projection and Admin checks are also reduced. The scratch sheet RLS is editor-only and narrower than live production; no whole-application browser flow, all 19 progression triggers or full source catalogue. Never infer general Wizard/Artificer/Warlock, feats, spell selection, level 3+ or G/I acceptance from this case.

## Actual authenticated test sequence

`scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql` provisions isolated PG17/GoTrue/PostgREST, the seven source-original functions, reduced helper dependencies, editor-only RLS and two **test-only** timing functions. `scripts/test_p1_3_levelup_v5_real_jwt_local.mjs` registers/signs in three **real GoTrue accounts** (owner, coeditor, outsider), verifies user identity and signed token claims, and uses Supabase authenticated PostgREST RPCs for both sides.

- **F06 PASS:** exact original sources install, runtime hashes match deployed definitions; local RLS/role grants and scoped helpers are installed.
- **F07 PASS:** outsider's signed-in v5 call and signed-in sheet-edit RPC reject with `42501`; no authorization via unrelated user.
- **F08 PASS:** owner JWT completes original **Fighter 1→2** chain: expected fixed HP increase, max HP 12→19, both CS/CP reach level 2, exactly one completed level-up session and event. A repeated v5 call does **not** complete another level.
- **F09 PASS:** current `can_edit` revocation blocks a signed-in original v5 call with `42501`, with CP unchanged.
- **F10 PASS:** an authenticated **test-only CP prelock wrapper** acquires CP `FOR UPDATE`, takes an observable `pg_advisory_xact_lock(9313,1)` and pauses before executing the **original full v5→v4→v3 chain**. After the advisory marker is actually seen in `pg_locks`, a *different genuinely signed-in coeditor* begins an original CS UPDATE, held briefly by a **test-only AFTER UPDATE pause** before the unchanged original `sync_character_progression_from_sheet_v1` locks CP. Both transactions therefore need the other's held row: PostgreSQL produces a real **SQLSTATE `40P01` deadlock**, aborting exactly one. The surviving operation and a permissible retry leave **one** completed level-up, **one** event, a completed session, and matching CS/CP level 2.

**Normal timing counterexample:** An earlier experiment invoking the same two business operations **without a verified prelock** completed successfully for both requests; that is not evidence that no inversion exists. The correct F10 uses a deliberately controlled interleaving and records the timing instrumentation honestly. Before correction, the test had also mistakenly treated Supabase PostgREST lazy RPC builders as already-started requests; the final harness explicitly invokes `.then()` to start each HTTP call before polling locks. This was a **test harness scheduling error**, not a database remediation. Earlier CI failures are historical attempts; **42055043840 is the tested successful executable checkpoint**.

## Relationship to PR #324 and existing P1.3 research

The held [PR #324 creator-attribution seed](https://github.com/bob8675309/DNDNEXT/pull/324) is a **new CP BEFORE INSERT-only** trigger proven on a separate Auth fixture (J49–J62). It does **not** alter existing-row CP UPDATE locking and **was not installed in F06–F10**. It does not fix the source-original v5→CS and sheet-edit→CP inversion.

The prior [Admin CP→CS vs CS→CP F04 source result](P1_3_Admin_Progression_Sheet_CP_CS_Race_2026-11-05.md) and the new F10 together show **two independent original progression writers can participate in opposing row-lock paths**, under test-controlled timing. They are not proof of production deadlock frequency, complete multi-class acceptance, or a safe global lock order. Tests do not reproduce actor AI, encounter participant P, G (canonical grant rows), inventory I, existing deferred equipment, all original 19 CP triggers or all privilege/visibility policies together. Distinguish **CP (character_progression)** from the encounter **P (participant)** in wider P1.3.

## Next one bounded task

**Add canonical feat-grant G and inventory I interactions to the genuine signed-in CP/CS schedule**, using the **original source grant materializer + original deferred equipment trigger** and their actual grant tables in the free PG17/GoTrue fixture. Audit the original G/I source dependencies and missing 24 creation-adjacent handlers first, and choose a bounded valid Fighter character with a source-backed feat/gear setup; don't stub authorization or grant persistence to claim a universal resolution. Test two-session retries, deferred `COMMIT` materialization, rollback, grant attribution, and consistent lock precedence under actor revocation. In parallel review #317/#321/#324 release sequencing, global P1.3 row-lock rules and original production RLS. There is **no owner-approved universal CP-first migration**.

**Production effects: NONE.** No live schema, SQL function, trigger, permissions, character sheet, feat, currency, inventory or secrets changed; no `main` merge, deployment or world/town map changes. Both PR #317 and #324 remain draft.
