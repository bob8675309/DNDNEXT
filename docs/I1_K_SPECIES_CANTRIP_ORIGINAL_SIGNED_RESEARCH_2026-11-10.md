# I1-K — Source-original Species Replaceable Cantrip: signed High Elf/Khoravar first-creation acceptance

**November 10, 2026 · Research-only [draft PR #359](https://github.com/bob8675309/DNDNEXT/pull/359), stacked directly on held [#358 I1-J](https://github.com/bob8675309/DNDNEXT/pull/358).** Owner's November 9 I0–I6 all-original-PR preservation/integration direction controls. **No hosted SQL, runtime or map changes, production deployment, PR merge, paid agent, or release authorization.**

## Original authority confirmed against live metadata (SELECT-only)

The non-map original `character_progression_materialize_species_cantrip_v1` is an **AFTER INSERT, DEFERRABLE INITIALLY DEFERRED** PostgreSQL constraint trigger calling `private.materialize_player_forge_species_replaceable_cantrip_v1()`. It was absent from the I1-J combined local PG17 fixture. Its existing production behavior is documented in [Species Replaceable Cantrip Runtime Status](Species_Replaceable_Cantrip_Runtime_Status.md):

- XPHB **High Elf** begins with the source-fixed **Prestidigitation**, with a **permanent** INT/WIS/CHA Elven Lineage spellcasting ability.
- EFA **Khoravar** begins with the source-fixed **Friends**, with a **permanent** INT/WIS/CHA Fey Gift ability, *in addition to* its separate initial Skill Versatility proficiency.
- The initial cantrip is **not an extra selectable starting spell**. Original deferred source authority assigns the `character_spells` Species row, `character_runtime_feature_choices` `long_rest` row, and `sheet.runtimeFeatures.speciesReplaceableCantrip` projection. Later Long Rest spell replacement is a separate guarded RPC, not tested here.

**Four unchanged full `pg_get_functiondef` bodies, verified against read-only live MD5 fingerprints:**

| Live original function | MD5 |
| --- | --- |
| `private.materialize_player_forge_species_replaceable_cantrip_v1()` | `a09198d8e12df12371647fccd8479489` |
| `private.species_replaceable_cantrip_feature_v1(uuid)` | `560088a5e3ad85866b6aa9b10ccfd2db` |
| `private.species_replaceable_cantrip_options_v1(text)` | `f8bf8cdf45cf57953dca333e5f856a84` |
| `private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb)` | `7af5408f062f786aa633254a0d5d6365` |

Previously installed original species-source check `private.character_has_species_source_v1(uuid,text,text)` (`d1264573b17e7569ba75371aa7e912eb`) and name normalizer `private.normalize_player_choice_name_v1(text)` (`dd8cdd5b47efe99b1cfff9c2bf7635dd`) are **reused** without rewriting.

Two XPHB source-grounded spell IDs were checked via read-only `public.spells_catalog_preferred`: **Friends** `c667b8ab-a44e-4c23-a8ea-b03f8953fc18` and **Prestidigitation** `5f62b543-f6ac-405f-baa8-1f196190ff35`. The original catalog supplies their source, level, school and class lists; full copyrighted descriptions were not duplicated.

## Bounded isolated implementation

- `scripts/fixtures/i1k_species_cantrip_original_materializer_pg17.sql`: explicit local PG17/GoTrue plus completed I1-J guard; four source-original functions; exact deferred trigger timing; two source-grounded spell fixtures; *reduced* `spells_catalog_preferred` `security_invoker` view with matching local `spells_catalog` column sequence/types; source hash, role ACL and six-trigger subset checks. This deliberately **does not** reproduce production's complete 47-column preferred spell precedence logic, 31-trigger ecosystem, or permissions.
- `scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs`: append-only I1-K signed test block gated by `DNDNEXT_I1K_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY`, executed **after** all unchanged I1C–I1J tests. No previous positive or historical negative test removed.
- `.github/workflows/validate-i1k-species-cantrip-original-local-auth.yml`: dedicated signed loopback PostgreSQL17 / GoTrue / PostgREST workflow with pinned Supabase CLI 2.120.0 and disposable services. Earlier I1-G/I1-H/I1-I/I1-J signed workflows remain independent required regression controls.

## Signed acceptance matrix

| Test | Verified behavior |
| --- | --- |
| **I1K-01** | Four exact original source hash functions; both source-fixed real XPHB cantrips; local preferred rowtype compatibility |
| **I1K-02** | Real signed High Elf creates **Prestidigitation** Species spell, runtime feature state and sheet projection with permanent INT and atomic private Story/nonce |
| **I1K-03** | Exact nonce replay leaves spell/runtime/timestamps/Story unchanged; changed private Story and outsider replay denied |
| **I1K-04** | Real signed Khoravar creates **Friends** with permanent CHA **and** original Skill Versatility proficiency, player mirror and Story/nonce in one COMMIT |
| **I1K-05** | Signed **Khoravar Warlock** creates **three source-original materializations together** — Fey Gift Friends + Skill Versatility + Pact Invocation — with Story/nonce; retry inert |
| **I1K-06** | High Elf missing permanent casting ability denied by unchanged original function with full rollback |
| **I1K-07** | Khoravar illegal `str` Fey Gift casting ability denied with full rollback |
| **I1K-08** | Missing source-fixed preferred Prestidigitation rejects atomically; reduced catalog's temporarily renamed scratch row is restored; existing source spell intact |
| **I1K-09** | Wood Elf does not receive High Elf cantrip; six cumulative source-original trigger subset present, original I1G/H/I/J/Wizard/Battle Master/Stage4 checks preserved |

**Verified original code/test commit `6b7cc5eaecce47f18205a5d80ac71698d20e046d`:** [I1-K signed local PG17/GoTrue/PostgREST run #42884170434](https://github.com/bob8675309/DNDNEXT/actions/runs/42884170434), job `130068004561`, **SUCCESS**. Decoded GitHub Actions logs contain every marker **PASS I1K-01 through I1K-09** and **I1K RESULT**, as well as prior I1G/H/I/J acceptance markers; original I1G-14 RED remains the **intentional historical pre-acquisition negative control**. Separate unchanged I1-G, I1-H, I1-I, I1-J signed regression workflows, `validate`, and `docs-only` also succeeded at this code SHA. Supabase Preview was intentionally skipped.

**Final documentation-inclusive exact-head verification:** Required again after this document and updated `ACTIVE_WORK.md` / append-only `HANDOFF_LOG.md` commits; earlier green commits do **not** automatically certify a later SHA.

## Strict release hold and next task

**Not proven:** complete 31/31 original trigger coexistence, real 47-column production preferred spell source precedence, full 18-skill/74-weapon-tool source priority, full authenticated runtime RPC permissions/RLS, browser-controlled Forge, Long Rest cantrip replacements, cross-nonce CP/CS/G/I lock ordering, encrypted secondary backup and isolated full database+Storage restoration, production release. No authorization to merge draft PRs or run live DDL/DML. Original world-map movement/resting triggers stay untouched and optional paid agent #325 remains LAST/OFF.

**One next engineering task:** verify #359 at its final exact head; then source-inventory one other genuinely absent non-world-map original trigger for I1-L (Artificer plan materialization is a possible candidate, but requires the original full class/plan/item dependencies and must not be assumed ready), retaining all prior source-authentic positive, negative and rollback gates.
