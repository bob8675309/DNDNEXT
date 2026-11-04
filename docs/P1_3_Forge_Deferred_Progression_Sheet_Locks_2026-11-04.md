# P1.3 — Deferred Forge Materializer vs Character-Sheet Progression Sync (2026-11-04)

> **RESEARCH ONLY / NO LIVE DB WRITES / NO PRODUCT FIX.** This report compares original, deployed SQL via SELECT-only Supabase introspection on 2026-11-04 and proposes a two-session PostgreSQL 17 race fixture. An intentionally created deadlock in a reduced, isolated fixture **does not demonstrate that arbitrary players or current production Forge can drive one**. Source evidence and CI execution status must be kept separate.

## 1. New concrete lock-class inversion found in live definitions

| Path | Live function / trigger | Exact observed order |
| --- | --- | --- |
| Deferred Forge starting equipment | `private.materialize_player_forge_starting_equipment_v1(uuid)` — MD5 `653e1b9d7cc47dcff2cef33a674b97f4` | Locks **character_progression P** `FOR UPDATE`, then **character_sheets S** `FOR UPDATE`, reads grant association G without locking its row, may lock merchant stock or insert inventory I and character currency, then **UPDATE S** |
| Deferred progress trigger | `private.materialize_player_forge_starting_equipment_trigger_v1()` — MD5 `23fa54dd0a6d7b42b802d613f39ea27c` | `AFTER INSERT ON character_progression DEFERRABLE INITIALLY DEFERRED`; invokes original materializer at transaction end |
| Sheet-to-progress synchronization | `private.sync_character_progression_from_sheet_v1()` — MD5 `bb1a3a2d1600ce33cd4fcadac5e0f3a9` | `AFTER INSERT OR UPDATE OF sheet ON character_sheets`; a sheet UPDATE already owns **S**, then SQL `INSERT INTO character_progression ... ON CONFLICT(character_id) DO UPDATE` can lock/wait on **P** |
| Source sheet guard and validation | `guard_direct_character_authority_mutation_v1` (MD5 `04596b0a...`) and `validate_player_forge_starting_equipment_sheet_v1` (MD5 `41cb1758...`) | Also present on real sheet; **not loaded in the reduced two-trigger fixture**. Could alter reachability, but not the observed P/S direction of original functions |
| Forge creation | `public.create_player_character_v3` calls `create_player_character_v2` | New characters and their sheet/progression are created in one transaction, with constraints and FK visibility. A second session generally cannot update another transaction's newly created sheet before commit; **do not claim a live creation-time deadlock based solely on the synthetic inversion** |

Source snapshots were copied **unchanged** into [exact original functions](../scripts/fixtures/p1_3_forge_materializer_original_functions_pg17.sql) from the live definitions. The exact original trigger names were checked with `pg_get_triggerdef`: `character_progression_materialize_player_forge_starting_equipme` and `sync_character_progression_from_sheet_v1`.

**Important:** These P/S classes are **character progression and character sheet**, not the combat participant P and slot S classes from [the tactical lock graph](P1_3_Global_Lock_Order_Research_2026-11-01.md). Label the resource **CP** (character progression) and **CS** (character sheet) in future combined graphs to avoid collision with existing encounter P / encounter slot S vocabulary.

## 2. Test plan (until exact-head workflow is green)

A deliberately small, fresh PG17 schema models only the relevant tables and uses **three verbatim deployed functions**. Other production progression and sheet triggers are omitted. The option/wealth/format helpers used by materialization are explicitly **test stubs**, and a single synthetic source-like starting item is used. This is a *lock-domain parity slice*, not whole Forge or XPHB item rules acceptance.

| Case | Expected result |
| --- | --- |
| F01 | Original `AFTER INSERT ... INITIALLY DEFERRED` trigger creates one `inventory_items` and `character_currency` row and updates the sheet **only after COMMIT**, not at the INSERT statement |
| F02 | T1 takes a test-timed **CP** prelock, then invokes the **original materializer** (**CP → CS**); T2 UPDATEs CS and fires the **original sheet sync** (**CS → CP**). Observe T2's real PostgreSQL row-lock wait and one PostgreSQL `40P01` deadlock victim. This is a **source-function inversion under manufactured same-character contention**, not a proven production caller/race |
| F03 | Two sessions taking CP then CS in the **same order** both complete in the small model. This is a control and **not** a recommendation to impose that order on all tactical/resource writers |

Files: [schema, deferred trigger and F01](../scripts/fixtures/p1_3_forge_materializer_lock_setup_pg17.sql), [two-session F02/F03 runner](../scripts/test_p1_3_forge_materializer_lock_pg17.mjs), [static source-boundary checks](../scripts/validate_p1_3_forge_materializer_source.mjs), [isolated CI](../.github/workflows/validate-p1-3-forge-materializer-locks.yml). The run uses **free disposable PostgreSQL 17** and no Supabase service/project secrets.

## 3. Risk and acceptance limits

- The live `character_progression` table has **19 user triggers**, including deferred source authority, feat, species, subclass, magic and starting item validators. The test loads only the one materializer trigger and one sheet-sync trigger, not the remaining triggers, full RLS, actual GoTrue roles, market-purchase inventory locks or source catalogue. Releasing a lock-order protocol requires a source-complete graph, not this reduced model.
- `character_permissions` is *read* during materialization if `created_by` is null; the read is not a G row-lock. Source `created_by` is often present for Forge-created characters. Do not introduce a G `FOR UPDATE` without checking all CP/CS/I/G triggers and cross-family transaction waits.
- A sheet update and character progression update may indirectly touch the same canonical row, but the **exact public caller, transaction boundary and privilege model** have not been proven to expose the F02 sequence to distinct authenticated users in production. The known original character-creation path inserts both in the same transaction; that matters for reachability.
- Production `main`, RLS, grants, auth, current character sheets/progression, equipment, world/town maps, effects and AI are unchanged.

## 4. Next single research action after executable result

Trace **production-reachable CP↔CS/stock/I write entry points** (existing level-up, character sheet editor, Admin changes, legacy creation and rest) using exact source, triggers and genuine signed-in roles, then add a real two-session fixture on the first reachable schedule. Only afterward reconcile the combined E/P/L/I/G/W/X/S/C lock policy and consider permission-capability rollout.

**Owner approval gate:** Large destructive DB changes must be reviewed in advance; this research contains no such operation. No live SQL migrations or grant modifications and no merge/deployment are authorized by a green scratch test.

## 2026-11-04 first isolated run and fixture correction

The first new-workflow run [41934716777](https://github.com/bob8675309/DNDNEXT/actions/runs/41934716777) **failed before F02**, but **F01 passed** with source-exact deferred inventory and currency writes. The second scratch character had no `startingEquipmentSelections` field. Deployed materializer source checks `IF jsonb_typeof(v_sheet->'startingEquipmentSelections') <> 'object' THEN RETURN ...`; when the key is absent, `jsonb_typeof(NULL) <> 'object'` is `NULL`, so PL/pgSQL does **not** enter the IF branch. The helper later raises `Choose a valid source-backed class starting equipment package` against a class with a nonempty starting-equipment catalogue. This is a **confirmed source semantics observation**, not proof that the normal Forge submits an invalid sheet; no deployed code changed.

The corrected scratch character now has a **valid package selection**, and its original deferred helper materializes exactly one inventory/currency record before the concurrency test. The F02 re-invocation still locks CP then CS, but should return `already materialized` after that prefix. Check no duplicate item or currency when one race transaction aborts. **F02/F03 remain pending retest until exact-head CI passes.**
