# I1-I — Source-original Eladrin season acquisition with combined Warlock/Story, genuine signed PG17

**2026-11-10 · isolated draft [PR #357](https://github.com/bob8675309/DNDNEXT/pull/357) stacked on #356 I1-H. Research only. DO NOT MERGE, DEPLOY, OR APPLY TO HOSTED SUPABASE.**

## Exact source authority and why this stage matters

The source-original `character_progression_materialize_eladrin_season_v1` was one of the historical original 31 creation-adjacent triggers not installed in the integrated I1-H local fixture. It is a PostgreSQL 17 **AFTER INSERT, DEFERRABLE INITIALLY DEFERRED** constraint trigger on `public.character_progression`. The server materializes the initial MPMM Eladrin `species-runtime-eladrin-season` choice into `public.character_runtime_feature_choices` and `character_sheets.sheet.runtimeFeatures.eladrinSeason`.

Original source bodies were fetched from **live DnDWeb metadata SELECT-only**, copied byte-for-byte as PostgreSQL `pg_get_functiondef` text, and have the following immutable MD5s:

| Original function | Live source MD5 |
| --- | --- |
| `private.materialize_player_forge_eladrin_season_v1()` | `b866a8dff88bbfe6fb2c4f6d4c102fee` |
| `private.character_has_species_source_v1(uuid,text,text)` | `d1264573b17e7569ba75371aa7e912eb` |
| `private.eladrin_season_options_v1()` | `a142c557fa028eb1b7a087c7802a7afb` |
| `private.resolve_eladrin_season_v1(text)` | `5f351b120410855845d72586dc66c62b` |
| `private.set_eladrin_season_projection_v1(uuid,jsonb)` | `eb1da99fed6f0785266eb061ce8bad39` |

The approved option keys are **autumn, winter, spring, summer**; they are not invented in this test. Existing `utils/playerForgeSpeciesRuntimeChoices.js` defines the same `species-runtime-eladrin-season` source-owned group, owned by species-runtime `eladrin-season`, selecting exactly one `season` field. This test keeps the server's original source semantics rather than replacing it with a mock.

## Isolated implementation

- `scripts/fixtures/i1i_eladrin_original_materializer_pg17.sql`: requires the completed I1-H disposable PG17/GoTrue environment with all three Warlock deferred triggers enabled, refuses existing conflicting runtime state table or original helper functions, installs original source `pg_get_functiondef` bodies, exact Eladrin deferred trigger, minimal real-shaped `character_runtime_feature_choices` with primary key, foreign key and **original runtime cadence and state-object CHECKs**; enables RLS/revokes client direct table DML; asserts all five fingerprints, original trigger timing and four option keys. Not a production-equivalent RLS or Long Rest fixture.
- `scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs`: appends new gated tests after the entire existing I1C–I1H signed original-source sequence, triggered only by `DNDNEXT_I1I_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY`. No earlier I1C–I1H case or historic negative-control error is removed.
- `.github/workflows/validate-i1i-eladrin-original-local-auth.yml`: dedicated pinned Supabase CLI 2.120.0 local GoTrue/PostgREST/PostgreSQL17 test workflow; loopback-only, confirms isolated DB; local services stopped/discarded afterward.

## Acceptance: eight genuine signed cases

| Case | What the test must prove |
| --- | --- |
| **I1I-01** | Real signed Eladrin MPMM level1 Fighter receives exactly one Winter season runtime row, projected sheet state, private Story, immutable nonce, source equipment/currency |
| **I1I-02** | Same-nonce retry leaves original runtime row/timestamps unchanged; changed Story `22023` and cross-account `42501` are refused |
| **I1I-03** | One signed **Eladrin XPHB Warlock** creation commits original Autumn season *and* Pact of the Blade original normalized Invocation alongside Story and immutable nonce; retry inert |
| **I1I-04** | Missing sourceChoices season fails atomically without character, runtime, Story, equipment, currency or nonce residue |
| **I1I-05** | Empty selections array fails original "requires exactly one season" branch |
| **I1I-06** | Two seasons in one selection group fail that same original cardinality check |
| **I1I-07** | Invented season key is rejected by the unchanged source option resolver |
| **I1I-08** | Non-Eladrin creates with no Eladrin runtime feature; four original Warlock triggers+Eladrin remain correctly enabled; Wizard, Battle Master, Stage4 inventory and earlier season states preserved |

**Precise original error nuance:** In `materialize_player_forge_eladrin_season_v1()`, a *missing* JSON path yields SQL NULL for `jsonb_typeof`, which does not satisfy a PL/pgSQL `IF ... <> 'array'` condition. The next unchanged resolver rejects it with **"Eladrin Player Forge references an invalid season."** An *empty* array instead raises **"Eladrin requires exactly one current season during Player Forge creation."** An early CI version expected the latter string for a missing path and failed at the error assertion **after I1I-01–03 had already passed**; the test was corrected to match original behavior, never by altering the deployed source. Both negative cases still verify complete rollback. The source's error-message inconsistency is recorded, not silently rewritten.

## Verified evidence and current boundary

**Source/test commit `adfc6da74470a39d1cf9ec898eb0c12603a666e6`** passed [dedicated signed local PG17/GoTrue CI run #42867191279](https://github.com/bob8675309/DNDNEXT/actions/runs/42867191279), job `130008570496`, conclusion **SUCCESS**, decoded logs containing each **PASS I1I-01 through I1I-08**, plus all **I1H-01–08**, and the preceding original I1G and I1C–I1F checks. Independent I1-G and I1-H regression workflows also passed at that SHA. Earlier failing exact candidate `e4afe2e2a22e0f18ca935a50996ece49c788536a` is preserved as a **test-expected-error mismatch**, not a live app failure.

A subsequent fixture-only improvement restored the live runtime table's two original CHECK definitions; **recheck the final PR head after this and documentation updates** before claiming complete final-head CI acceptance.

**Release boundaries:** the local runtime table is **reduced** even with exact columns/constraints; it does **not** copy full live RLS, source catalog priority, whole character permissions/rest ledger, or all 31 original creation-adjacent triggers. No genuine browser Eladrin UI flow, GM role matrix, cross-nonce CP/CS/G/I lock concurrency, isolated full production database restore, or Storage-byte restoration is proven by this test. Two original world-map departure/resting triggers remain **untouched by design**. Original archived and open PRs remain preserved; optional paid agent #325 LAST/OFF.

**One next engineering task:** after final-head CI, choose another genuinely absent non-map original handler (e.g., Khoravar Skill Versatility or species replaceable-cantrip) with full source/dependency inventory and one genuine signed positive plus negative/rollback path; do not close original PRs or promote isolated test evidence to a production release claim.
