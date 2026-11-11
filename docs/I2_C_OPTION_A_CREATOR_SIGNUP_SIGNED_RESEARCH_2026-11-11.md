# I2-C — Original v1/v2 creation and signup: Option A frozen legacy-sheet compatibility

**Research only, November 11, 2026.** Stack on owner-approved Option A [I2-A #365](https://github.com/bob8675309/DNDNEXT/pull/365) and signed first slice [I2-B #366](https://github.com/bob8675309/DNDNEXT/pull/366). The account-wide `public.players.sheet` is a **preserved historical snapshot**, never an active character mirror; canonical character information remains in `public.character_sheets`. All existing legacy rows must survive byte-for-byte. This is not permission to deploy, migrate, edit live player data, change live ACL/RLS, merge branches or touch world/town/tactical maps.

> **2026-11-11 source-original RED and disposable Option A GREEN VERIFIED:** [I2-C local PG17/GoTrue CI #43100658939](https://github.com/bob8675309/DNDNEXT/actions/runs/43100658939), job `130790932595`, **SUCCESS**, code/test SHA `be23ebc26a9715f4d2cabf0f6b3536072e691120`. The complete unchanged signed I1-B–O Forge/Story/nonce/Artificer/HP/Admin suite passed first, followed by **I2C-01–10 PASS**. I2C-02 and I2C-03 preserve original source **expected RED** v1 account name+sheet and v2 sheet overwrite. Only after those REDs do scratch v1/v2 source-reversible identity-only candidates pass same/cross-user, multi-character, nonce, source-grounded starting equipment, signup, missing-profile fallback, historical no-marker preservation and signed profile-only ACL tests. [#43099344681](https://github.com/bob8675309/DNDNEXT/actions/runs/43099344681) captured v1 RED before the *new test input* omitted the original Forge source-backed starting equipment option; [#43100167242](https://github.com/bob8675309/DNDNEXT/actions/runs/43100167242) captured both original REDs and stopped at a missing `\\echo` psql test-fixture terminator, corrected without changing original source or any RED/permission checks. Both failed runs remain preserved as traceable research. **The private #324 v2 source copy still writes the legacy sheet; do not claim v3/Story acceptance.** Final documentation-inclusive exact-head CI requires separate verification.

## Source-original creation contract

Live DnDWeb PG17.4 introspection was **SELECT-only**, retrieving original function definitions and MD5s, not private player information:

| Original | MD5 source fingerprint | Important behavior |
|---|---|---|
| `public.create_player_character_v1(jsonb,jsonb)` | `e2db5802f1f51b93f5b9d374a835e4b9` | Creates canonical character/permissions/progression/spells, but then **updates both account name and legacy sheet**. Its `IF NOT FOUND THEN INSERT` depends on that UPDATE result. One linked player character per user remains enforced. |
| `public.create_player_character_v2(jsonb,jsonb)` | `0351f0a00acae023278e1b8b065b00c9` | Creates canonical character including creation nonce, then **INSERT/UPSERTs legacy sheet**. On an existing account it does not update name, but replaces historical sheet. Supports idempotent same-nonce replay and multiple distinct character creations. |
| `public.sync_user_profile()` | `dd7113eec05655a661309838acce6030` | Auth signup trigger inserts `user_profiles` role and `players(user_id,name)` `ON CONFLICT DO NOTHING`. It does **not** write the sheet and must remain source-identical. |
| `private.starting_spell_requirements_v2(uuid)` | `878650d06e4b984ae7968359dda4d187` | Original v1 spell-required-count helper, used for a zero-spell Fighter test. |
| `public.character_source_priority_v1(text)` | `fdcc080cd95e6ce282631191869893c1` | Original v1 class-source priority. |

The exact five original function bodies are staged only inside `scripts/fixtures/i2c_original_creation_signup_shared_forge_pg17.sql`, **after** the complete unmodified historical I1-B–O signed Forge/Story/nonce/Artificer research has passed in the same disposable PG17+GoTrue+PostgREST database. All five original source fingerprints are checked again following staging. The original signup trigger is installed on disposable `auth.users`; the reduced schema adds only needed v1 spell-level columns and the `user_profiles` role table.

### Why the v1 `IF NOT FOUND` branch matters

Blindly deleting v1's legacy account UPDATE would leave `IF NOT FOUND THEN ...` operating on the result of a different statement. It may insert an unintended second account or break character creation. The scratch candidate therefore **replaces the entire original account UPDATE + dependent IF/INSERT block** with a single identity-only `INSERT ... ON CONFLICT(user_id) DO NOTHING`. It uses the same sanitized signup metadata fallback as the original signup helper, preserving the existing account's profile name. The Fighter's own canonical sheet, progression, spells and permissions are left intact, and v1's one-linked-character limit remains.

The v2 scratch candidate replaces its one `INSERT ... ON CONFLICT DO UPDATE sheet` with the **same identity-only INSERT-if-missing**, never updating an existing account sheet, name, or timestamp. Both candidate source bodies must be reversible by one exact string replacement to the original live function MD5. The original `sync_user_profile()` is not modified. Neither candidate is a hosted migration.

## Signed acceptance matrix — exact-head CI required

After preserving source-original signed Forge/Story/Artificer tests, execute the following with new genuine local GoTrue-authenticated users and only synthetic historical snapshot data:

| ID | Acceptance |
|---|---|
| I2C-01 | All five original functions installed exactly with matching live MD5s |
| I2C-02 — ORIGINAL RED | Original signed v1 creates a canonical Fighter but overwrites the existing populated legacy account sheet **and account display name** |
| I2C-03 — ORIGINAL RED | Original signed v2 creates canonical Fighter with nonce but overwrites populated historical legacy sheet, leaving existing account name |
| I2C-04 | Stage scratch-only reversible v1/v2 identity-only account candidate after both REDs; original signup stays intact; historical missing-nonce rows created in scratch |
| I2C-05 | Signed v1 canonical Fighter succeeds, legacy sheet/name/updated_at unchanged; original second-linked-character rejection still works |
| I2C-06 | Signed v2 creates two separate canonical characters, identical nonce replay remains idempotent, cross-account nonce replay denied; historical account sheet/name unchanged |
| I2C-07 | Signed v1 with a missing account row creates an identity-only profile from authenticated signup metadata; old sheet stays `{}` |
| I2C-08 | Original signup trigger inserts account and role without sheet writes; unchanged original trigger/function source |
| I2C-09 | Disposable profile-column RLS/ACL denies signed direct sheet edits and anonymous reads; signed profile name update/UPSERT works, including a historical unmarked snapshot |
| I2C-10 | Canonical v2 creation continues under restricted profile permissions; v1 remains one-character-limited; source original signup persists |

This is a **source-faithful regression test**, not source-original full production signup or whole Forge trigger acceptance. A failed test is retained as evidence and fixed on the held research branch only.

## Blocking integration gaps

- **Modern v3 Forge is not fixed by patching public v2.** The previously signed #324/#361 Forge integration wraps a separate `private.create_player_character_v2_source_20261105(jsonb,jsonb)` original-source copy. That private copy has its own account-sheet UPSERT, so Option A remains incomplete even if this public v1/v2/sign-up study turns GREEN. This is an explicit next engineering dependency, not a hidden pass.
- The full census counts **34 source-original `UPDATE public.players` functions plus three source-observed `INSERT/UPSERT` functions**, but mirrored/copied private creation functions and additional indirect call-graph edges must also be inventoried. The count is not a proof that only those 37 executable writes exist.
- The original v1 endpoint still restricts an account to one linked player character; this research intentionally does not alter that constraint. The canonical v2/v3 pathway supports multiple characters.
- Using auth signup `raw_user_meta_data` for a *cosmetic profile display name* is not authorization. No permission decision may use this user-controlled field. Admin/RLS/source and browser name/profile flows need full role-backed integration tests.
- The current reduced signed Forge test has only a subset of the original 31 creation triggers. It does not establish full signed creator/v3/private Story/nonce/merchant/inventory/world-map co-residency or real production Admin/service role parity, post-cutover browser behavior, concurrency/rollback, offsite encrypted backup and independent DB+Storage restore.
- No production SQL, user profile rows, snapshot contents, permissions, app files, or deployment changed. **I2-C is a draft research stack.**

**Signed code/test acceptance I2C-01–10 VERIFIED; final documentation-inclusive head must still pass.**

**Next one bounded task after exact-head signed verification:** inspect the private #324 v2 source copy, v3 and private-Story/nonce wrapper and add a new source-locked signed Option A no-legacy-write acceptance fixture that preserves immutable nonce, Story and all original creation trigger witnesses. Then expand across the remaining writer families before proposing a single coordinated production migration to the owner.
