# I1-F — Source-original Battle Master normalized maneuver grants and deferred validator

**Status: UNMERGED RESEARCH — no hosted SQL, production data modification, world-map behavior change, or release authorization.** Integrates original Battle Master materializer/validator research into the held [I1-E Wizard PR #353](https://github.com/bob8675309/DNDNEXT/pull/353) research ancestry (#352→#351→#350→#345) under owner-approved [November 9 I0–I6 original PR integration](PR_INTEGRATION_PRIORITIZED_PHASED_PLAN_2026-11-09.md). Original #349 census remains source authority for all 31 historic trigger names.

## Original source and canonical data provenance

Five full functions were retrieved by **read-only** SELECT `pg_get_functiondef` from live DnDWeb PostgreSQL 17, copied **without editing** into `scripts/fixtures/i1f_battle_master_original_functions_pg17.sql`, and checked at runtime using the exact original executable function MD5s:

| Original private function | Original source MD5 |
|---|---|
| `battle_master_maneuver_count_v1(integer)` | `32cbfe62f855affe40443da2fc9d20eb` |
| `battle_master_maneuver_slot_level_v1(integer)` | `70b3639eb4b6535aab3efbfc80828a0e` |
| `is_xphb_battle_master_v1(uuid,text,text)` | `17688ec8bceac3c06d58415de20a544b` |
| `materialize_player_forge_battle_master_maneuvers_v1()` | `daf3fc12e7c30165dca50ca650f9d308` |
| `validate_existing_battle_master_maneuvers_v1()` | `8bc8a467e95b07e93df833bcfc585e80` |

The original noninternal trigger declarations were independently verified read-only from `pg_get_triggerdef`:
- `character_progression_materialize_battle_master_maneuvers_v1`: AFTER INSERT, CONSTRAINT, DEFERRABLE INITIALLY DEFERRED, same original materializer
- `character_progression_validate_battle_master_maneuvers_v1`: AFTER UPDATE OF `class_id,subclass_name,subclass_source,class_level,level_choices`, CONSTRAINT, DEFERRABLE INITIALLY DEFERRED, same original validator

`scripts/fixtures/i1f_battle_master_joint_setup_pg17.sql` is deliberately disposable-only, source-hashed, and requires already passing I1-E Wizard and I1-D Stage4/Story/nonce original-source setup. It adds a grounded XPHB Fighter Battle Master subclass specimen and **twelve actual source-owned option IDs, keys, names, class and XPHB source qualifiers**, read SELECT-only from the production `class_feature_option_catalog`. Their *catalog identity fields* match live sources. The full production catalog fields, permissions, content and duplicate-source resolution are **not** claimed.

The original handlers require `public.class_feature_option_catalog` and `public.character_class_option_grant_instances`. The test creates local reduced table shapes with the production-relevant uniqueness, FK, acquired-level CHECK, and JSONB choice/metadata fields. These reduced public test tables have RLS enabled and direct `anon`/`authenticated` DML revoked; original SECURITY DEFINER trigger functions can populate grants. **This is NOT full production table schema/RLS acceptance.** Original I1-E Wizard finalizer/source and original I1-C/Stage4 system remain intact.

## Signed test matrix (exact run receipt appended after execution)

The GitHub Actions workflow `.github/workflows/validate-i1f-battle-master-original-local-auth.yml` pins Supabase CLI 2.120.0, local PostgreSQL17, true GoTrue-issued JWT and PostgREST, Node22, repository source validators and a disposable local DB. All signed applications use `127.0.0.1:54321`; no remote Supabase connection or unguarded SQL is allowed. The previous I1C-01–11, I1D-01–11 and I1E-01–06 source tests run first in that SAME local database, prior to the new Battle Master tests.

| Case | Expected original-source behavior |
|---|---|
| I1F-01 | Signed Fighter Battle Master level3, original subclass BEFORE INSERT, 3 distinct canonical XPHB maneuvers acquired at level3, one character/Story/nonce; replay inert and changed Story rejected |
| I1F-02 | Two maneuvers at level3 fails original deferred materializer required count; no character/Story/nonce survives |
| I1F-03 | Duplicate canonical maneuver selections rejected with whole transaction rollback |
| I1F-04 | Unknown/non-XPHB maneuver rejected and no nonce retained |
| I1F-05 | Signed level10 creates 7 distinct canonical options (3 at level3, 2 at level7, 2 at level10), identical nonce inert |
| I1F-06 | Original AFTER UPDATE deferred validator accepts consistent progression and rejects missing normalized grant on COMMIT, rolling back grant deletion plus update |
| I1F-07 | Original deferred validator rejects changing subclass while retaining its normalized Battle Master grants |
| I1F-08 | Original validator rejects unsupported level15 update with insufficient canonical grants, rolling back level-up |
| I1F-09 | Another signed user cannot reuse creator's nonce; direct forged normalized grant insertion privilege remains denied |
| I1F-10 | Previously accepted Wizard Signature spells and Stage4 four-policy/owner CHECK are unchanged, and original Battle Master handler hashes remain equal |

**Nuanced authority:** The first creations and failed Forge requests execute through **genuine signed GoTrue + PostgREST**. Post-creation stress/validator tests I1F-06–08 deliberately use a **local privileged psql transaction** to simulate tampered/corrupted grant/progression state and prove original deferred COMMIT rollback. They do **not** constitute proof that a real player can make those SQL updates; separate production-shaped RLS/revocation and CP/CS/G/I lock-order tests remain necessary.

## Verified exact-head signed result — November 9 local / November 10 UTC

**PASS: [Actions run 42765480453](https://github.com/bob8675309/DNDNEXT/actions/runs/42765480453) on tested commit `95d7c97da8062b933ef77bc9d06fe9e69935a695`.** Four successful checks (`battle-master-original-grants-joint-signed`, `validate`, `handoff-registry`, `docs-only`), one intentionally skipped Supabase Preview. All **I1F-01 through I1F-10 passed**, and the previous I1C-01–11, I1D-01–11 and I1E-01–06 source-subset regressions passed again in the same disposable PG17/GoTrue database.

- **I1F-01 / I1F-05:** Source-original deferred grants created **three** distinct, canonical source-ID XPHB maneuvers at level3 and **seven** at level10 with exact acquired-level slots (3/3/3/7/7/10/10), signed Story/nonce, and no duplicate grants on identical replay.
- **I1F-02–04:** Too few, duplicate, or unknown maneuver choices raised the actual original deferred function errors and fully rolled back character, grant, private Story, and nonce reservation.
- **I1F-06–08:** The original paired AFTER UPDATE deferred validator accepted consistent progression, rejected deleted grant instances, rejected subclass switches retaining maneuver grants, and rejected unsupported level15 upgrades; its local psql transaction COMMIT failures rolled back original state.
- **I1F-09 / I1F-10:** Cross-user nonce replay denied; authenticated role cannot directly insert reduced canonical grant table rows; prior Wizard Signature and Stage4 four-policy owner CHECK remained intact and both original Battle Master handler MD5s matched the production read-only values.

**Two failed exact-head runs are deliberately retained** and should not be misclassified as product contract failures. The first run `42762226969` never reached SQL: the isolated GitHub runner already bound localhost port `54322`. We changed only the draft's local DB/API/shadow ports to **55422/55421/55420**, preserving fail-closed localhost guards, and reran. The second attempt reached the signed tests, passed I1C/I1D/I1E, then exposed a *reduced Fighter specimen omission*: source-original Fighter equipment requires an explicit source-backed starting equipment package. Adding the same legitimate Fighter package `classOption A` already proven in I1-D, with deterministic wealth-roll specimen, fixed the fixture without changing original functions or relaxing original Battle Master assertions. The third run passed.

**Exact limits:** The original production Battle Master functions and twelve XPHB maneuver IDs/source keys are unchanged and source-grounded, but the test's `class_feature_option_catalog`, `character_class_option_grant_instances`, Fighter class metadata and remaining source data are reduced scratch subsets, not complete production shape. Creation is genuine signed PostgREST; post-create adversarial validator mutation is local privileged psql. Original full RLS/feat grants and deadlock-order proof remain open. All hosted DnDWeb queries were SELECT-only; all writes were disposable local.

**Original 31-trigger accounting now:** historical `17` DDL in dispersed `forge_*.sql` fixtures, `14` not staged there; 3 separately source-tested in I1-D + Wizard finalizer in I1-E + 2 Battle Master triggers in I1-F = **six of the 14 with additional bounded signed evidence**, not one 23-trigger runtime. Two missing originals are world-map travel/rest protections and are not changed. **Six other non-map original source/dependency paths** remain.

**ONE NEXT ENGINEERING TASK — I1-G:** source-pin the two remaining original **XPHB Warlock** progression safeguards together: `character_progression_reject_unmarked_legacy_warlock_invocation` → `private.reject_unmarked_legacy_warlock_invocations_v1()` (MD5 `631fbb585f47e71a619ca8ac8e212407`) and `character_progression_validate_player_forge_class_options_v2` → `private.validate_existing_normalized_warlock_invocations_v2()` (MD5 `4f1752db655b6ba490113f604c7583ef`). Source-original trigger DDL is deferred AFTER INSERT/UPDATE of class/progression keys, and deferred AFTER UPDATE of class/level/choices respectively. Preserve original `private.player_forge_source_choice_legacy_v1`, `private.xphb_warlock_invocation_count_v1`, normalized grants, canonical options/choice child schema and source-qualified spell/feat catalogs. Build a bounded genuine signed local PG17 positive/negative/deferred rollback + Story nonce test; **do not** install live SQL, modify the world map or treat reduced catalogs as full acceptance.

## Historical 31-trigger accounting and boundaries

Original November 5 `forge_*.sql` scans: **17 matching historical DDL across separate fixtures, 14 historically unstaged**. Of the 14, three other C3.3 source-original paths have now been joined-tested in I1-D, Wizard finalizer joined in I1-E, and **two** further Battle Master triggers are targeted in I1-F. Assuming successful exact-head signed CI, six of the 14 have individual joined tests; **two** original map movement/resting triggers stay protected and **six** remaining non-map trigger families still need source-original executable coverage. This is **not** a combined 23/31 trigger database or a 31/31 release gate, and the milestone count must be adjusted if any new test fails.

The other open gates include the full original option/feat/grant trigger network, source-preferred PHB/XPHB duplicate rules, full true production RLS/grants, global CP/CS/G/I deadlock and cross-nonce race, browser ten-step Forge, encrypted second backup and isolated full Postgres plus 340 Storage-object restore, and owner release approval. Original game world movement and map rendering stay untouched.

**Next bounded engineering action after exact-head CI:** If this positive/negative paired-trigger suite passes, select the next single remaining **non-map** original trigger family with complete live source and dependencies, preserving all original PR tests and existing joined regression cases. Do not invent function bodies or bulk-install the source in production.
