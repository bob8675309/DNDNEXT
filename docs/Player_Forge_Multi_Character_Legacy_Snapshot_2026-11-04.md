# Multi-Character Forge: Protect Legacy `players.sheet` (2026-11-04)

> **NEWER 2026-11-07 STATUS:** [#319](https://github.com/bob8675309/DNDNEXT/pull/319) **MERGED research-only** to main `537b570083b3f18faad6d3038c131bee61af273c` after exact-head 3 CI passes and unchanged current main application source dependencies. The earlier “UNMERGED” refers to the old November 4 snapshot. **The guarded SQL candidate itself is NOT DEPLOYED:** the production `public.create_player_character_v2` function and existing `players.sheet` values were not changed by this merge.

> **UNMERGED / NOT DEPLOYED.** Exact live SQL source inspected by SELECT-only introspection on 2026-11-04, original `public.create_player_character_v2(jsonb,jsonb)` definition MD5 `0351f0a00acae023278e1b8b065b00c9`. `create_player_character_v3` delegates to v2. This is a candidate, not a production permission migration, Character Forge rewrite, or consent to alter live data.

## Verified original behavior

Canonical character creation already supports multiple independently owned `public.characters` rows, `public.character_sheets`, `public.character_permissions` grants, `public.character_progression`, starting equipment, and one `player_character_created` event per successful request. The unified player profile displays `get_my_player_characters_v2` results and an explicit character dropdown. Live SELECT-only aggregate showed at least one user with multiple edit-authorized tagged player characters, without inspecting any private sheet.

The **last** source statement of `create_player_character_v2` upserts `public.players.sheet` **unconditionally** on `user_id` conflict. This account-wide legacy snapshot is distinct from a canonical sheet. Creating an alternate character silently replaces its previous value; existing account `players.name` is not updated, making the legacy name/sheet pair inconsistent. This is not a loss of existing `character_sheets` records or proofs that any player exploited/observed it.

The production `players` table is RLS-protected and has a unique index on `user_id`. It defaults `sheet='{}'::jsonb`. The current production v2 function is not changed by this research.

## Bounded proposed correction

[Unapplied source-faithful candidate](../sql/candidates/20261104_player_forge_preserve_legacy_sheet.sql) changes **only** the original conflict UPDATE:
```sql
ON CONFLICT (user_id) DO UPDATE
SET sheet = EXCLUDED.sheet, updated_at = now()
WHERE public.players.sheet = '{}'::jsonb;
```

The first creation can still populate a missing or genuinely blank `players.sheet`, while further creations preserve a populated legacy value. `ON CONFLICT` serializes updates of the same legacy account row. **Never** overwrite nonempty legacy account data automatically; do not infer which character is the primary from `players.sheet`, do not migrate existing snapshots, and do not repurpose it as a live active-character selector.

The candidate retains the original function signature, `SECURITY DEFINER` settings, class and spell validation, canonical permission grants, event creation, idempotency and error behavior. The source MD5 guard **stops** if the deployed v2 definition has drifted; reevaluate and rebuild from actual source instead of bypassing the guard. Original source is stored separately under `scripts/fixtures/player_character_v2_live_source_pg17.sql`.

## Tests

[Disposable PG17 fixture](../scripts/fixtures/player_character_multi_legacy_sheet_pg17.sql) installs the exact original body first and reproduces the previous overwrite (**M01 expected unsafe**). It then installs the one-clause candidate, tests first-time empty/missing-row initialization, preservation of populated legacy sheet, independent canonical character grants/sheets/events, and creation-request idempotency (**M02–M06**). `scripts/validate_player_forge_multi_legacy_sheet_candidate.mjs` enforces exact single-clause source diff and checks existing multi-character UI / Forge v3 calling contract. A focused GitHub Actions workflow runs these in **ephemeral** PostgreSQL 17.

Tests simulate `auth.uid()` using per-session settings, **not real GoTrue**; post-patch genuine JWT, concurrency and GM account tests remain future gates. The fixture does not model all live progression/deferred starting-equipment triggers. PR #317 addresses those separately. A passing isolated test does not authorize merging or applying the candidate to Supabase.

## Compatibility and release gates

Preserve the existing account/character selector, legacy player profile, starting equipment and merchant/inventory ownership semantics. Do not change `get_my_player_characters_v2`'s existing full-sheet behavior in this branch; its private-data visibility must be reviewed as part of the coordinated delegated-control/RLS redesign on #317. This candidate is **not** a fix for that separate security issue.

Before any live installation, recheck source hashes, obtain migration plan and coordinated review with P1.3 resource/lock gates, true signed-in user test, admin review of legacy character notes/permissions, and an explicit rollback. It changes one function definition but **does not delete, truncate, backfill or update any existing player row as part of the migration**. No live data or production deployment has been changed.
