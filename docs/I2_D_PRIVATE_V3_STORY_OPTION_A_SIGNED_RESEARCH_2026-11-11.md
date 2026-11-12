# I2-D — Modern Forge private v2/v3 + Story/nonce, Option A frozen legacy-sheet source research

**No automatic legacy-sheet writes of any kind are authorized under Option A, including empty account-wide snapshots and same-character actions.**

**Owner-approved architecture:** Option A, per-character `public.character_sheets` authoritative; every pre-existing `public.players.sheet` snapshot preserved byte-for-byte, including empty `{}` rows. This remains research only, stacked after [I2-C #367](https://github.com/bob8675309/DNDNEXT/pull/367) and preserving source-original I1-B–O and I2C-01–10 acceptance unchanged. **No production SQL or application runtime edits. No merges or deployment.**

## Source audit: why this is distinct from public v2

The source checked in as `sql/candidates/20261105_player_creation_immutable_intent_v1.sql` under the held original #324 Forge research defines `private.create_player_character_v2_source_20261105(jsonb,jsonb)`. Both modern `public.create_player_character_v3` and the private-Story/immutable nonce pathway ultimately use this **private source copy**, *not* the public `create_player_character_v2` already studied in I2-C.

The original private copied source contains this account UPSERT:

```sql
insert into public.players(user_id, name, sheet, updated_at)
values(v_user, v_name, v_sheet, now())
on conflict (user_id) do update
  set sheet = excluded.sheet, updated_at = now()
  where public.players.sheet = '{}'::jsonb;
```

**Crucial distinction:** Unlike original public v2, this private source already *protects populated legacy account sheets*. However, it **still replaces an existing empty `{}` snapshot with the new canonical character's sheet**, violating Option A's no-automatic-legacy-writes contract. Original RED must therefore show an empty account row being overwritten. A separate original-source control must show that a populated historical row was already protected. Do not misleadingly report that v3 overwrites all nonempty snapshots.

The private source is a `SECURITY DEFINER` function. Authenticated table/column privilege restrictions alone cannot prevent its own privileged UPSERT. The source-preserving candidate must retire that statement while preserving the original character creation and nonce/Story wrappers. Do not rely on the previous public-v2 candidate to protect this additional private pathway.

## Signed, isolated original RED then scratch GREEN

The new dedicated workflow must run the unchanged full original signed I1-B–O Forge tests, then unchanged I2C-01–10 signed original v1/v2/signup RED/GREEN, **before** running I2D-01–11. It uses the previously pinned disposable PostgreSQL 17, GoTrue and PostgREST test environment. No real customer records or Story content enter the fixture.

| Case | Expected evidence |
|---|---|
| I2D-01 | Original private copied v2 source still contains its exact WHERE-empty UPSERT, with source fingerprint of public/private v3, public private-Story RPC and private Story-intent wrapper captured |
| I2D-02 — SOURCE RED | Signed v3 with private Story + nonce creates canonical Fighter with equipment but **overwrites an existing empty `players.sheet`** |
| I2D-03 — ORIGINAL CONTROL | Signed original v3 with an existing populated historical sheet **does not** overwrite it, demonstrating the original WHERE-empty guard's precise limit |
| I2D-04 | Only after both original controls, install the source-reversible **scratch** private-v2 identity-only account insert; original public v3, private v3 source, Story RPC, Story-intent wrapper and signup hashes unchanged |
| I2D-05 | Signed v3 + private Story, full canonical sheet, nonce reservation, character permission and starting equipment still commit with the old empty account sheet/name/timestamp untouched |
| I2D-06 | Same-nonce retry idempotent; user-edited private Story preserved; changed-only Story intent and cross-account nonce replay denied |
| I2D-07 | Two distinct canonical characters, private Story and nonce for a single account; old account sheet remains empty |
| I2D-08 | An unrelated already populated historical snapshot without creation marker stays byte-identical while signed v3 Story creates canonical character |
| I2D-09 | Direct original public v3 (without private Story) also uses the repaired private copy; no legacy-sheet update |
| I2D-10 | Signed v3 can insert a missing account identity row with its original signup display name, leaving default `{}` sheet |
| I2D-11 | Invalid oversized Story rolls back character/nonce; private Story cross-account isolation and direct-client sheet write denial persist; original wrappers unchanged |

The scratch fixture replaces **one** exact original private source UPSERT with the identity-only insert used by the bounded I2-C research: `INSERT INTO players(user_id,name) ... ON CONFLICT DO NOTHING`. It checks the old statement occurs *once*, stores its original private source MD5 before the edit, and verifies that replacing only the new insert with the old statement reconstructs the complete original MD5. It checks the original public v3, private v3, Story RPC, Story-intent wrapper and original signup function have unchanged hashes. No canonical source or permission logic is intentionally modified.

The signed suite independently tests the edited function and all those wrappers after the candidate, including the **newly empty profile** case not covered by a previous "only overwrite empty sheet" guard. It also retains the original nonempty behavior as evidence.

## Coverage and release limitations

The [source coverage ledger](I2_D_OPTION_A_CREATION_SOURCE_COVERAGE_2026-11-11.json) carries forward the I2-B/I2-C baseline: **4/34 original `UPDATE public.players` writers tested for Option A, 30 original UPDATE writers still untested**, plus 3/3 original named INSERT/UPSERT functions with bounded I2-C acceptance. I2-D adds a **separate private copied v2 INSERT/UPSERT** source path not captured by the original name-based `UPDATE` census. This is a source graph addition, not another original public v2 test.

**Cannot claim from this fixture:** all 31 original Forge triggers co-resident; unrestricted live class, species and item catalogs; full 34+ indirect writer retirement; all Admin/RLS/service-role profiles; browser-level character switching; cross-family concurrency under real load; rollback after a coordinated cutover; second encrypted backup and verified isolated restore of full database plus Storage. Prior I1-M/O/P conditional same-character snapshot updates remain valid historical evidence only, **not** Option A release behavior.

**Acceptance initially pending exact signed CI; do not mark GREEN until test logs show I2D-01–11.** The next bounded engineering task is to expand the remaining source-exact writer-family audit and actual signed Option A no-mirror acceptance tests, preserving the original audit/Story and public-v3 call graph. Production release still requires separate explicit owner approval.
