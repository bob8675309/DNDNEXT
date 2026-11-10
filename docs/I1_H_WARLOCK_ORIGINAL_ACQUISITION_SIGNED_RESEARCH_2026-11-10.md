# I1-H — Source-original Warlock Invocation acquisition at first signed creation

**November 10, 2026. Research-only draft [PR #356](https://github.com/bob8675309/DNDNEXT/pull/356), stacked directly on I1-G #355. NOT a Supabase migration, production rollout, or merge authorization.**

## Why I1-H exists

I1-G proved both original deferred Warlock safeguards (legacy rejection and normalized UPDATE validator) with true local PG17/GoTrue/PostgREST. Its I1G-14 RED test correctly demonstrated that **fresh signed Warlock creation cannot commit** with safeguards active while the source-owned AFTER INSERT acquisition materializer is absent. I1-G's successful normalized grant specimens were privileged scratch inserts into characters created *before* the safeguards; they are not fresh creation acceptance.

I1-H composes all three original deferred triggers in one disposable database and tests real source-owned acquisition on first signed request, with no privileged per-character grant writes. It retains the earlier I1C–I1G suite unchanged as the prerequisite acceptance and adds I1-H only under `DNDNEXT_I1H_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY`.

## Original live-source authority, verified read-only November 10

- `private.validate_and_materialize_player_forge_class_options_v1()`: **6df5aee6f0519c9c77758d6e887ed8e4**.
- `private.xphb_warlock_invocation_slot_level_v1(integer)`: **942dd3a4e08b8874f3e42cbbb8323038**.
- `private.reject_unmarked_legacy_warlock_invocations_v1()`: **631fbb585f47e71a619ca8ac8e212407**.
- `private.validate_existing_normalized_warlock_invocations_v2()`: **4f1752db655b6ba490113f604c7583ef**.

The live `character_progression_validate_player_forge_class_options_v1` is an **AFTER INSERT, DEFERRABLE INITIALLY DEFERRED** constraint trigger. It coexists with the original legacy guard (`AFTER INSERT OR UPDATE OF class_id,class_level,level_choices`) and normalized validator (`AFTER UPDATE OF class_id,class_level,level_choices`). These are **read-only metadata observations**, not a change to the hosted project.

## Bounded new artifacts

- `scripts/fixtures/i1h_warlock_acquisition_with_guards_pg17.sql`: aborts outside the expected isolated PG17 fixture, verifies both original I1-G guards are enabled, installs *unchanged* full acquisition function bodies from the previously source-captured I1-G fixture, installs the exact original deferred AFTER INSERT trigger, asserts original function hashes and trigger semantics, and denies anonymous/authenticated direct EXECUTE.
- `scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs`: retains I1C–I1G source-positive and negative cases, appends opt-in I1-H actual signed first-create level1/level2, Story and immutable nonce, Agonizing Blast/Warlock cantrip dependent choice, exact stored grant count and child, replay no-op, outsider/changed Story denial, and invalid/duplicate/legacy/missing-child rollback with before/after canonical table counts.
- `.github/workflows/validate-i1h-warlock-original-local-auth.yml`: a distinct research workflow using pinned local Supabase CLI 2.120.0, Docker PostgreSQL 17, GoTrue, PostgREST and loopback API. It runs source validation, then the complete original signed fixture chain. Scratch services are discarded after the run.

## Evidence status and expected acceptance

**VERIFIED at exact code-bearing commit `c1b7fd5a21c8599d296b138d7bf51e2496e27542`:** the [dedicated I1-H signed local PostgreSQL 17/GoTrue/PostgREST job](https://github.com/bob8675309/DNDNEXT/actions/runs/42863361394/job/129995084717) completed **SUCCESS**. Its decoded Actions log explicitly records **PASS I1H-01 through I1H-08**, including both signed first-creation COMMITs and all five negative/rollback cases; source-original **I1G-01 through I1G-14** (including the prior intentionally failing RED control) and preceding I1C–I1F remained green, with I1C-06 final revoked-editor check also passing. The separate [I1-G unchanged baseline job](https://github.com/bob8675309/DNDNEXT/actions/runs/42863361452/job/129995080991) also completed **SUCCESS** at that code head. Static `validate` and `docs-only` checks passed; Supabase Preview intentionally skipped. This is **real local signed disposable acceptance**, not production release, full browser or 31/31 trigger acceptance.

**Important timing:** this source/code head predates the later documentation receipt commit; refresh the final PR head's CI before using its status as exact-head acceptance.

Expected checks:

1. I1H-01: signed Warlock level1 with Pact of the Blade gains one source-original normalized Invocation plus creator-only Story and nonce at first COMMIT, immutable retry inert.
2. I1H-02: signed level2 with three source-owned Invocation slots including Agonizing Blast/Eldritch Blast child obtains three grants and complete Story/nonce in the same COMMIT.
3. I1H-03–07: missing child, illegal-level, nonrepeatable duplicate, unqualified cantrip, and unmarked legacy choices fail atomically, leaving no character, Story, nonce, inventory, grants or currency.
4. I1H-08: all three source-original triggers enabled, original hashes unchanged, previous Wizard and Battle Master grants plus Stage4 inventory RLS intact.
5. All earlier I1C–I1G cases must pass unchanged in the same disposable environment; no earlier negative-control records may be discarded.

## Release boundaries

- **Not 31/31 original trigger coexistence**: only a subset of original character/progression/feat/inventory triggers and reduced source-qualified fixture catalog rows are present. The production preferred spell/option views and complete rights/RLS/grants remain unproven in combination.
- No claim of full authenticated ten-step Forge/Chromium selection, all class spells/feat downstream grants, mixed-version clients, CP/CS/G/I transaction races, complete archived PR integration, or owner-reviewed world-map interaction.
- Recovery remains blocked on encrypted second backup copy and isolated full PostgreSQL plus Storage-byte restoration. No direct live SQL, DB DDL/DML, Storage operation, PR merge/closure, production Vercel deployment, paid API activation, or world-map edit.

**One next executable task after exact CI:** diagnose any authentic failing SQL and fix only the disposable composition or test fixture without changing original hash-pinned functions; if green, preserve exact source SHA and run receipt and continue the next one original non-map trigger/dependency gate. Any promotion into I2 still requires separately approved all-system release checks.
