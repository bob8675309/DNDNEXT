# P1.3 — Original signed player Fighter Lv4 advancement G / GI vs original Admin G (F17–F21)

**2026-11-05 research-only candidate on held draft PR #317. Not production and no release authorization.** This extends source-original signed GoTrue F06–F16; F17–F21 **are pending new exact-head GitHub Actions validation** at this writing.

## Source-verified target, NOT synthetic direct feat-grant RPC

The publicly accessible `complete_character_level_up_v5(uuid,jsonb)` delegates unchanged through v4→v3; when the next level offers the **Ability Score Improvement** feature, unchanged v3 calls **`private.level_up_advancement_option_id_v1`** then **`private.apply_character_level_advancement_v1`**. The latter acquires the character sheet (CS) for update, performs canonical sheet/stat and spell effects and **actually INSERTs**:

- `character_option_grant_instances` (source/level/choices/effects/provenance GI)
- `character_option_grants` (the aggregate G row, with conflict prevention)

The original v5/v4/v3/base chain starts by locking progression (CP), then CS; Admin `grant_character_option_v1` performs **G→CS**, and the original CS AFTER UPDATE trigger can attempt CP. This yields a source-derived potential cycle between an Admin and a player earning a feat at the same time. Earlier F15 was actual Admin G concurrent with a *featureless* level-up. F17–F21 ensures the **player level-up itself executes original GI and G inserts**.

## Exact read-only live source and catalogue evidence

Live DnDWeb PostgreSQL17 function definitions, unchanged in `scripts/fixtures/p1_3_level4_advancement_original_pg17.sql`, require runtime `md5(pg_get_functiondef)` parity:

| Live function | MD5 |
| --- | --- |
| `private.apply_character_level_advancement_v1` | `46dd0af4f6ca816422a75e91a292c634` |
| `private.level_up_advancement_option_id_v1` | `ee7e6204a499abfe69aaa0c7f304aed2` |
| `private.level_up_ability_increases_v1` | `6ac310ae1358a3e827e6b15446d3d5f0` |
| `private.materialize_level_up_advancement_spells_v1` | `805b8ea43cdc2b9e4f88f7adb637f0fb` |
| `private.character_option_prerequisites_met_v1` | `21f370cac373521d64a55eebbd61d1bd` |
| `private.level_has_feature_v1` | `7616660880fb69db21c4d9b2416c1694` |
| `private.resolve_subclass_choice_v1` | `df25069121f0889de0574e0a28151301` |
| `private.materialize_boon_energy_resistance_instance_v1` | `35cb3d6560ffde5a94b019a9f373f65d` |
| `private.materialize_cartomancer_instance_v1` | `30939673464de80a0791a89017d48065` |
| `private.materialize_feat_runtime_expertise_instance_v1` | `c56af0b4f49f024a18baf396eeb2d1e2` |

Additional source-original support: normalization, sheet skill key, Cartomancer family and expertise family helpers. All 14 loaded definitions are source-original; the source files are not numbered Supabase migrations and explicitly fail closed when installed outside disposable local Auth/PostgreSQL17.

SELECT-only canonical catalogue specimen: `Ability Score Improvement`, `option_id=7fea59fa-064e-40dd-8f25-dcebe28f1e9d`, `option_key=feat:ability-score-improvement|XPHB`, `source=XPHB`, General category `G`, repeatable `true`, prerequisite level 4. Valid selection `asi-mode=plus-two`, `asi-plus-two=str` yields +2 Strength. The source-backed Fighter subclass is XPHB `Champion` at level 3 (actual published row read from live catalogue).

## Fixture fidelity and explicit reductions

Added `scripts/fixtures/p1_3_level4_advancement_extension_pg17.sql` to the existing real GoTrue/PostgREST fixture **after F06–F16 complete**, preserving their tests and original v5/v4/v3/base. It adds a valid pre-existing XPHB Champion 3→4 class progression specimen with XP 2700, an opened level-up review, a real original source option, a source-shaped GI table with real unique `(character_id,instance_key)` key and source-exact existing direct-authority guard plus three original feat-instance AFTER INSERT triggers.

The **reduced** parts are explicitly scoped:
- Earlier Fighter-only **test helper functions** are narrowly extended from 1→2 to also permit 3→4; these are not production helpers.
- A reduced local `class_feature_catalog` row and **reduced preferred-option view** replace the full live source catalogue/visibility graph.
- GI is source-shaped with canonical key/columns but does not reproduce all original constraints, timestamp triggers, RLS/policies or additional source families.
- Only ASI is selected; specialty runtime-feat trigger functions are installed from originals but their special-feature branches are **not exercised**.
- None of the full 31 creation-adjacent trigger graph, equipment I or currency/deferred materializer, multisource spells, full role/visibility policy, source browser flow or historical backfill is accepted here.
- The original Admin source from F11–F16 remains unchanged. The only deliberately timed code is a **TEST-ONLY CP prelock advisory marker (9316,1)** and the earlier separate Admin CS probe (9314,1); neither represents natural production scheduling.

## Expected real-JWT acceptance, subject to exact-head CI logs

- **F17:** strict empty disposable setup, original source runtime fingerprints, guard and three original instance triggers installed.
- **F18:** independent signed owner v5 Fighter Champion 3→4 earns actual GI + G, one source-owned ASI feat summary, Strength 12→14, one level-up event/session, correct `granted_by`; repeated level-up rejected.
- **F19:** anonymous/unrelated/revoked account does not gain an unauthorized earned grant; client direct GI table INSERT forbidden.
- **F20:** signed owner earns GI+G through unchanged original v5 in competition with a separate signed-in Admin’s original G → CS grant on the same character. Under **explicit test-only timing**, expect PostgreSQL genuine `40P01` and a single victim; losing transaction does not leave G/GI/progression/level event partial changes.
- **F21:** retry only aborted operation; final exactly one owner GI, one owner aggregate ASI G, one Admin Lucky G, one completed level-up event/session, correct feat projection and attribute, and no cross-user attribution.

Check [the exact changed-head workflow](../.github/workflows/validate-p1-3-levelup-v5-auth-locks.yml) and actual log before calling any of these PASS. Static source assertions are **not** runtime proof.

## Next bounded task if green

Combine this source-authenticated *actual G + GI mutation* evidence with the separate #324 **real merchant I inserts** and prior original Forge equipment materializer without falsely claiming simultaneous G/I writes. Map the **same-character equipment/inventory I versus earned G and level-up CP/CS** lock interactions, full guard/RLS and deferred COMMIT paths in a new disposable test scope. Do not merge draft #317/#321/#324 or choose a production-wide lock protocol without a coordinated authorization, trigger and release plan.

**Production effects: none.** `main`, DnDWeb SQL/permissions/rows, Vercel production, world/town maps, Actor AI and app runtime untouched.
