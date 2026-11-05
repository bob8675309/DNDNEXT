# P1.3 — Real merchant inventory I vs earned advancement G/GI; contradictory Forge I ownership checks (F22–F28)

**Research-only PR #317, 2026-11-05. F22–F28 are a source-derived disposable PostgreSQL17/GoTrue candidate, not accepted until new exact-head CI logs. No production data, SQL, RLS or deployment touched.**

## 1. Read-only production source: two different inventory ownership domains

- Original `public.buy_from_merchant(uuid,uuid,integer)` (`md5(pg_get_functiondef)=1dbe8c24c4c718396d7256f6f7465354`) checks current `auth.uid()`, locks the merchant `character_stock` row **S FOR UPDATE**, locks the purchasing user's `player_wallets` row **W FOR UPDATE**, decreases stock/wallet, and inserts **real** `inventory_items` **I** with `owner_type='player'`, `owner_id=buyer::text`, `user_id=buyer`. It **does not** directly acquire CP, CS, G or GI locks.
- Original `private.materialize_player_forge_starting_equipment_v1(uuid)` (`md5(pg_get_functiondef)=653e1b9d7cc47dcff2cef33a674b97f4`) obtains **CP→CS**, checks Forge source state and one-time character currency C, then can lock market **S** and insert **character-owned I** (`owner_type='character'`, `owner_id=character_id::text`), materialize C and update CS. Its actual `AFTER INSERT` deferred creation trigger (`private.materialize_player_forge_starting_equipment_trigger_v1`) invokes it at the creation COMMIT boundary.
- A new character's still-uncommitted creation is not automatically visible to another signed-in level-up session. **Do not simulate an impossible same-character level-up during another transaction's initial creation and then call it real production concurrency.** Character-owned Forge equipment and user-owned merchant purchases are different flows. A merchant purchase concurrently with earned level-4 G can test independent S/W/I versus CP/CS/G/GI consistency, but cannot prove a shared character inventory-row lock cycle.

## 2. New likely production bug — contradictory owner_type CHECKs

**SELECT-only pg_constraint on live DnDWeb, November 5:**

| Live constraint | convalidated | Character-owned I allowed? |
| --- | --- | --- |
| `inventory_items_owner_type_check` | true | yes: player, npc, merchant, character |
| `inventory_items_owner_type_chk` | **false (`NOT VALID`)** | **no: player, npc, merchant** |

`NOT VALID` avoids validating historical rows but **does not disable enforcement for new inserted or updated rows**. This is PostgreSQL semantics, not an inference from the label. Thus original Forge materializer statements inserting `owner_type='character'` appear to violate `inventory_items_owner_type_chk` even though the newer validated check permits it. A live **read-only aggregate** found 23 inventory rows, **zero with `owner_type='character'`**; that is consistent with the issue but does not independently show which Forge UI flow or earlier data failed.

References: PostgreSQL ALTER TABLE `NOT VALID` enforcement: https://www.postgresql.org/docs/current/sql-altertable.html ; PostgreSQL wiki https://wiki.postgresql.org/wiki/What's_new_in_PostgreSQL_9.2 .

**F22** adds both real CHECK expressions to an isolated scratch `inventory_items`, attempts an original-shaped new character-owned insert inside a caught `23514` subtransaction, and checks the returned constraint name is specifically `inventory_items_owner_type_chk`. **F28** demonstrates causality inside a transaction that temporarily drops only this *scratch* legacy constraint: the same insert is then legal, followed immediately by `ROLLBACK`, proving constraints and rows are unchanged afterward. Neither statement is executed on the live project.

**Proposed follow-up (requires separate authorization):** inventory all consumers/schema migrations of both checks; examine accepted character-owner inventory readers and historical records, verify full Forge create+COMMIT under exact source with authentic Browser/JWT/RLS, draft a deliberate migration removing/replacing the obsolete overlapping check only after independent review, and retest player/merchant/character inventory ownership and rollback. **Do not run an unreviewed `DROP CONSTRAINT` on production.**

## 3. What F22–F28 actually test

The new unchanged live-source functions are saved in `scripts/fixtures/p1_3_original_merchant_inventory_source_pg17.sql` with runtime MD5 gates:

| Source function | Live MD5 |
| --- | --- |
| `public.buy_from_merchant` | `1dbe8c24c4c718396d7256f6f7465354` |
| `private.apply_structured_crafting_traits_v1` | `108bfc2599d75e7298f65ce326f16173` |
| `private.apply_smithing_affinity_polish_v4` | `5d51cf335ff880939ae0df4c4152bdbd` |
| `public.set_wallet_updated_at` | `979427428c72842b842b35db11334a3d` |

`scripts/fixtures/p1_3_original_merchant_inventory_extension_pg17.sql` fails closed unless the original **F06–F21** auth fixture already exists in disposable `postgres` on PG17; provides *reduced*, source-shaped stock/wallet/recipe/inventory tables and live owner-type CHECK expressions; installs the two exact original I BEFORE INSERT/UPDATE crafting triggers and wallet timestamp trigger. The merchant purchase function and three triggers are unchanged; the uncrafted item specimen follows the **fast no-material** branches, not full crafted-material parity. Direct table DML is revoked in this fixture; live production uses distinct owner policies and is **not** fully reproduced.

The signed-in JavaScript suite extends the exact same full-v5 source from F06–F21:

- **F22 (pending):** source hash gates and source-exact inventory trigger installation, scratch-only legacy `23514` check reproduction.
- **F23 (pending):** genuine owner JWT buys a source merchant dagger; verifies one real I record `owner_type='player'`, original buyer ownership, 5 GP wallet charge and one stock unit consumed.
- **F24 (pending):** anonymous, insufficient-funds and direct-client write attempts fail without phantom stock/wallet/I mutations under this reduced ACL fixture.
- **F25 (pending):** owner signed JWT executes original v5 level-4 ASI G+GI through unchanged production-derived progression helpers **concurrently** with an original merchant buy by that same owner; checks both commits, one G+GI, one I, exact wallet debit and level-up event. CP test-only advisory marker `(9316,1)` coordinates overlapping requests. **No actual G/I shared-row contention is assumed.**
- **F26 (pending):** two independent signed buyers concurrently attempt a one-unit stock purchase; one succeeds, one fails; exact 4 GP debit once, G/GI original rows unchanged.
- **F27 (pending):** post-exhaustion repeated buy and oversell fail; no extra inventory.
- **F28 (pending):** rollback-only legacy-CHECK drop and control INSERT in scratch shows old `NOT VALID` check is the sole reproduced cause of character-owner `23514`; original constraints restored by ROLLBACK, no rows persist.

This work builds on the independently **verified** F17–F21 result: exact-head [GitHub Actions run 42091679535](https://github.com/bob8675309/DNDNEXT/actions/runs/42091679535), commit `503dcbd2ef0547cfe34447b386c9716159277b8e`, all F06–F21 logs PASS and 10/10 workflows successful.

## 4. Critical omissions and next task

F22–F28 do **not** simulate the original full deferred Forge starting-equipment function in this branch; they do not reproduce its entire catalog, all 31 creation-adjacent triggers, real RLS, `character_currency`, real production body source for stock pricing trigger, actual browser UI, custom crafting-material transforms or a simultaneous **character-owned** I + player-earned G write. The merchant sale source writes user-owned I, and is logically distinct from character-owned Forge creation I. Never claim a universal CP→CS→G→I→S→W lock hierarchy from these tests.

**Next bounded investigation after green CI:** prioritize a truly disposable, source-original *Forge creation+deferred COMMIT* acceptance and control schema with both live owner-type CHECKs; establish which creation mode fails, its exact SQLSTATE, and whether repairing the constraint in disposable scratch suffices to reach I/C persistence. Coordinate stacked #324 fixture instead of duplicating its whole creation graph on #317. Separately, map any legitimate cross-system character-owned inventory operation that can overlap post-creation level-up and obtain actual locks.

**Production effects: none.** `main`, existing data/permissions/triggers, deployment, maps, AI and releases unchanged.
