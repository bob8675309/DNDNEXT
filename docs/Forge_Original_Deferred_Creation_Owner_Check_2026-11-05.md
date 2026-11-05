# J78–J84 — Original Forge creation / deferred COMMIT under conflicting inventory owner CHECKs

**2026-11-05 research-only, held draft PR #324 stacked on #321.** This document was prepared before the new branch-head GoTrue/PostgreSQL 17 run. **J78–J84 are CANDIDATE, NOT PASS until exact-head CI logs confirm them.** These tests must never run on the live DnDWeb instance. No release permission is implied.

## Production facts verified read-only

The live PostgreSQL `public.inventory_items` table has **both**:

| constraint | `convalidated` | allowed `owner_type` values |
| --- | --- | --- |
| `inventory_items_owner_type_check` | `true` | `player`, `npc`, `merchant`, `character` |
| `inventory_items_owner_type_chk` | **`false`** | **`player`, `npc`, `merchant` only** |

The older `NOT VALID` CHECK is **still enforced on new inserts and updates**; it simply did not check historical table rows when introduced. The two CHECKs conflict over new `owner_type='character'` records. Live read-only inspection found 23 inventory rows and zero character-owned rows, but that fact alone does not establish the occurrence or frequency of a Forge UI error.

Original deployed `private.materialize_player_forge_starting_equipment_v1(uuid)` (`md5(pg_get_functiondef)=653e1b9d7cc47dcff2cef33a674b97f4`) inserts `owner_type='character'`, `owner_id=p_character_id::text` into `inventory_items`, creates corresponding `character_currency` records and updates canonical sheets. Original `private.materialize_player_forge_starting_equipment_trigger_v1()` (`23fa54dd0a6d7b42b802d613f39ea27c`) is attached as `AFTER INSERT` on `character_progression` with **`DEFERRABLE INITIALLY DEFERRED`**. Failure at COMMIT should roll back *all* original source creation work, including creator attribution, request reservation, feat instance/aggregate, item and currency. Do not confuse successful earlier J12 creation in a **reduced fixture without this old CHECK** with production schema parity.

The source-original inventory BEFORE triggers now also copied for local acceptance are:

| original handler | MD5 |
| --- | --- |
| `private.apply_structured_crafting_traits_v1()` | `108bfc2599d75e7298f65ce326f16173` |
| `private.apply_smithing_affinity_polish_v4()` | `5d51cf335ff880939ae0df4c4152bdbd` |

Those handlers are unchanged. The selected uncrafted training dagger takes their fast no-material branches; specialty crafted-material branches are **not** exercised.

**PostgreSQL documentation:** https://www.postgresql.org/docs/current/sql-altertable.html — `NOT VALID` means prior rows are not verified, **not** that new inserts are exempt from the constraint.

## Exact original authenticated creation path under test

The PR #324 disposable source fixtures already have successful J12–J77 genuine GoTrue/PostgREST tests for:

- `public.create_player_character_v2` with the separate held **immutable request intent wrapper**, original source v2 body, same-transaction verified creator attribution, original progression and feat-grant instance/aggregate materialization, original deferred equipment trigger, one currency record and replay gating.
- Reduced source-catalogued XPHB Fighter / Soldier background / Lucky feat, package `A` (a test training dagger); verified actor is the actual JWT owner and remains stable in `granted_by`.
- The original source `character_progression` deferred trigger and sheet-to-progression sync. Original supporting functions are source exact; **six equipment-choice helpers and additional catalogue/RLS/trigger pieces remain reduced or absent**. Earlier J77 original merchant-stock writer is distinct.

New `scripts/fixtures/forge_owner_constraint_deferred_creation_local_auth_pg17.sql` is installed only **after J00–J77**. It fails closed without disposable PG17 `postgres`, real local `auth.users`, the private test-authority and immutable reservation fixtures, existing character-owned items, the matching unchanged deferred equipment MD5s, and an untouched reduced `inventory_items` CHECK setup. It adds the two production CHECK definitions (the obsolete one `NOT VALID`), imports the two unchanged original inventory trigger bodies, attaches the two source-original BEFORE triggers, checks hashes and correct `tgdeferrable/tginitdeferred` trigger state, and checks both `convalidated` flags.

## Expected J78–J84 acceptance (must be verified against logs)

- **J78:** verified original inventory handlers and both contradictory live CHECK definitions loaded in disposable PostgreSQL; existing character-owned rows survive `NOT VALID` introduction.
- **J79:** same independently signed-in Player's known-good original feat+equipment Forge v2 creation fails with **SQLSTATE `23514` naming `inventory_items_owner_type_chk`** at deferred COMMIT. Full counts (characters, creator attribution, nonce reservations, CS, CP, level events, G, GI, I, C) remain identical; failed request ID is unreserved.
- **J80:** an original signed player creation **without starting-equipment selections** still succeeds while the old CHECK is present; this is a character-owned item blocker, **not proof all Forge creation fails**.
- **J81:** in **disposable PG17 only**, remove **only** `inventory_items_owner_type_chk`; retry the **same previously rejected genuine JWT nonce**. The unchanged original creation, immediate Lucky G/GI and deferred item/currency materializer now commit exactly once, with correct `granted_by`, inventory buyer ID, `updated_by` and sheet source summary.
- **J82:** identical nonce replays inert; changing the creation intent raises `22023`, preserving original G/GI/I/C fingerprints.
- **J83:** restore the old CHECK as `NOT VALID` in **disposable PG17 only**, retaining pre-existing character-owned items; an independent signed user's new identical source route fails again with exact `23514`, without any new character, reservation, feat, item, currency or event.
- **J84:** source unchanged; both CHECKs, both original inventory triggers and old materialized rows remain in the disposable DB; demonstrate causality without touching production.

**Important:** J81/J83 are temporary, explicit research-only schema changes to a disposable container, not an approved DnDNext migration. The `DROP CONSTRAINT` is not used on production, and **the scratch correction is restored before the test ends**. No "full production parity" or browser acceptance may be claimed.

## Architectural implications

The original data model expects character-owned Forge equipment: verified live `public.get_character_inventory_v1` and other inventory readers recognize `owner_type='character'`; source SQL for package and starting-market equipment inserts that value. The old constraint therefore appears to be stale schema, not an intentional restriction for new Forge equipment. Nevertheless, **do not remove any live constraint without checking all migration history, existing data, transfer/crafting/send RPCs, security policies, old consumers, and rollback strategy**.

### Release blockers and one next task

After exact-head CI success, **prepare a review-only migration and acceptance plan** for the obsolete inventory CHECK (its replacement is already the newer validated CHECK), including no-expansion of direct inventory permissions; rollback/restore behavior with already-created `character` rows; source-exact authenticated Forge v2/v3 package/starting-market; feat and deferred gear/stock/currency atomicity; all 31 original creation-adjacent trigger families (this reduced fixture adds two original inventory triggers but remains short of full parity); legacy populated `players.sheet` preservation and creator-private/GM-only authorization. Coordinate #317 and stacked #321/#324. Do **not** automatically deploy the database correction, merge research branches or consume Vercel previews for fixture-only edits.

**Verified distinction:** prior PR #317 source-authenticated F22–F28 run [42095751266](https://github.com/bob8675309/DNDNEXT/actions/runs/42095751266) was PASS at head `69e741d7c7d8874c22467e2d30791e30c009ff6e`; it established real merchant buyer inventory and a scratch constraint control, but **not the full signed-in original Forge creation/COMMIT failure path** now being tested.

**Main and production unchanged** at audit: `main` `51c351a142d03378dff8e47e05182afe21a15622`. Live DnDWeb was only queried via SELECT/metadata APIs; no SQL migration, RLS, grants, deployment, gameplay, map, AI or user rows changed.
