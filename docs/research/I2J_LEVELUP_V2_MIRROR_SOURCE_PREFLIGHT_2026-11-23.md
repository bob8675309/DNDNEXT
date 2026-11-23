# I2J — Legacy level-up v2 double-mirror source preflight

**2026-11-23 CST. SOURCE-ONLY RESEARCH, NOT SIGNED RED/GREEN OR RELEASE.**
Independent branch **research/i2j-levelup-v2-source-preflight-20261123**, derived from held #371 exact head **6db27e720d0c2788774cc37d2f85d14244e61b95**. Separate from overnight Agent A (#379), B (#389), C (spell/combat). No original PRs, main, game/maps, DB, grants, clients or protected workflows changed.

## Evidence source pins and precise conclusion

| Inherited immutable file | Git blob SHA | Finding |
| --- | --- | --- |
| sql/20260720_01_subclass_compatibility_and_selection.sql | 4e938bc3217f11b8a4ef589da83af00aaca51782 | Historical public.complete_character_level_up_v2 calls public v1; when a source-valid subclass is supplied it writes canonical character_sheets, then writes legacy players.sheet for **every permitted account user**, not only a matching character's historical sheet |
| sql/20260808_11_character_level_up_v3.sql | 1e1df113b95b1579b086a2d95f7acd34f427bc6e | Earlier historical public v3 source calls v2 |
| sql/20260808_19_source_aware_level_up_spell_access.sql | ba4443302d37bb99532695e438bd1c0d0f1e4e5c | Later checked-in public v3 source calls private.complete_character_level_up_base_v3 instead, NOT v2 |
| docs/I2_I_ADMIN_FEATURE_OPTION_A_WRITER_COVERAGE_2026-11-12.json | 772af5e05ec494f9526445a5ad9eb05bad0f5d78 | Recorded original deployed v2 MD5 **28a227a1dfb9a3cc5516c5b7afb874b0**, classification **not_option_a_tested**; 34 original UPDATE signatures, 12 bounded tested, **22 untested** |

This is an important **two-writer** risk: even without subclass, original v2 delegates v1, whose own mirrored account update already had genuine signed RED evidence in I2-G. On source-backed subclass, **a second, distinct v2 account update** can overwrite unrelated editor account snapshots after v1. Suppressing v1 alone is not a sufficient proof that v2 preserves legacy snapshots. Historical v2 uses SECURITY DEFINER, a management permission predicate and explicit historical authenticated EXECUTE grant; no current live PostgREST exposure or ACL has been tested.

These Git blobs are **checked-in historical source**; they have NOT been independently compared to the full original restored PG17 function definition that yielded the ledger's source MD5. The old and newer historical v3 implementations are different; do not assert the old v3 call graph is currently deployed.

## Source-only executable gate

Run **node --test scripts/audits/test_i2j_levelup_v2_source_preflight.mjs**. Eleven test cases pin four exact Git blobs, historical authorization and source qualification, separate v1 delegation, direct v2 canonical and account fanout, earlier-versus-later v3 lineage, 34/12/22 ledger identity, and two **synthetic negative source mutations**. Synthetic mutation assertions demonstrate fail-closed detection; they are **NOT** authenticated transactional RED tests and must not be relabeled as such. Workflow validate-i2j-levelup-v2-source-preflight.yml runs pure Node 22 only on this independent branch; no PG17, secrets, npm install, DB or application changes.

## Next genuine signed PG17 matrix — NOT YET RUN

1. Obtain authorized independent **offline** exact original v2 function definition with pg_get_functiondef MD5 **28a227a1dfb9a3cc5516c5b7afb874b0**, original v1 definition, subclass resolver, schema and tested EXECUTE/role contracts. Reject mismatch rather than invent live function or use hosted SELECT.
2. Genuine signed owner and coeditor, no subclass: original v1 account snapshot overwrite RED; after exact-source local-only v1 mirror suppression, canonical HP/level/event/review and historical accounts unchanged.
3. Genuine valid subclass: with v1 *locally* patched but v2 still original, isolate **second v2 direct mirror RED**, including unrelated and same-character historical account sheets and timestamps; invalid subclass/source must roll back with no side effects.
4. With both independent source-hashed account updates separately patched **only in disposable scratch PG17**, confirm canonical subclass/progression/HP/event, permissions, auth-revoked/outsider negatives, nonce/replay/race and all historical player-account sheets frozen.
5. Test current actual v3/base-v3 as a **different source lineage** and run all inherited I2-C–I original signed regressions; preserve all original RED fixtures. Count exactly one newly validated v2 writer, not two for its v1 delegation.
6. Original full 31-trigger nonworld-map Forge/browser/roles, **22/34 legacy writers**, encrypted independent full DB+340 Storage object restore and separate owner approval still gate any production release.

**ONE NEXT BOUNDED TASK:** authenticated offline original v2 body retrieval and signed local v2 no-subclass/subclass RED→scratch GREEN with two distinct source-preserving account-write patches. If reliable original source absent, HOLD and do not modify gameplay or SQL.

No hosted SQL even SELECT, no original PR closure or merge, no world map, no main deployment, no production or paid agent changes.
