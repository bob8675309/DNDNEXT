# Original merchant inventory writes — signed-in race J70–J77

**Research only; draft PR #324. No production changes or merge.**

## Exact executable evidence

[GitHub Actions 42060615672](https://github.com/bob8675309/DNDNEXT/actions/runs/42060615672), tested SHA `2addc96496d399458ff6992b953b528e5384f03d`, **SUCCESS** both disposable original PostgreSQL17 and genuine local GoTrue/PostgREST with J00–J77. The original `public.buy_from_merchant(uuid,uuid,integer)` function is preserved byte-for-byte in `scripts/fixtures/forge_original_merchant_buy_source_pg17.sql` and matches live `md5(pg_get_functiondef)=1dbe8c24c4c718396d7256f6f7465354`.

The original function requires signed-in `auth.uid()`, locks a merchant `character_stock` row using `FOR UPDATE`, locks and debits `player_wallets`, decrements/deletes stock, and **inserts `inventory_items`** for each purchased non-recipe unit. The supplemental local-only `scripts/fixtures/forge_merchant_inventory_live_writer_local_auth_pg17.sql` supplies reduced wallet/recipe schemas and stock timestamp, revokes direct browser writes to stock/wallet/inventory, and restricts source RPC EXECUTE to authenticated users. These scratch grants and schemas **are not production RLS or a recommended migration**.

## Cases (two genuine independent JWT users)

- **J70:** Source MD5 gate, three scratch stock rows (one dagger, two rope, one lantern) and two wallets of 20 GP each.
- **J71:** Anonymous buy refused (`42501`), inventory and stock unchanged.
- **J72:** Insufficient wallet funds refuses sale and rolls back stock and inventory changes.
- **J73:** **Two truly concurrent buyers for one dagger**: one success, one `Stock not found`/insufficient stock; exactly one actual inventory INSERT and 5 GP total debit; stock depleted.
- **J74:** Repeated purchase from deleted stock refuses without extra item or debit.
- **J75:** **Two concurrent purchases against two-unit rope stock** both succeed; one actual inventory INSERT per signed-in buyer, total 10 GP debited, stock depleted.
- **J76:** Request for 2 when only one lantern remains fails without stock/wallet/item mutation; subsequent 1-unit purchase succeeds.
- **J77:** Four actual player inventory items sold in total, zero seller stock remains, exactly 20 GP combined debit. Existing Forge Lucky **G** instance, aggregate grant, starting-equipment **I**, and currency rows retain unchanged complete row hashes.

**Scope limitation:** J73 and J75 prove real original inventory **INSERT** contention and correct serializing **stock (S)** locks; neither is a deadlock, and there is **no simultaneous original grant G UPDATE/INSERT**. The separate J63–J69 [G/I integrity and CP→CS / CS→CP 40P01](Forge_GI_JWT_Source_Concurrency_2026-11-05.md) proved unchanged G/I across a test-timed deadlock, but those I/G records were materialized *before* the contested transaction. Do not infer a global CP/CS/G/I/S/W lock-order protocol.

## Next bounded step

Study source-original **grant G writers** with actual authority checks: `public.grant_character_option_v1` (live MD5 `aa0f6a0c6c6a6f2b9aacf57bd40e434c`) and `private.apply_character_level_advancement_v1` (live MD5 `46dd0af4f6ca816422a75e91a292c634`). Verify original grant authority guards, independent signed-in coeditor/GM permissions, grant-row and sheet locks, rollback, and replay under disposable PG17/GoTrue. Production RLS and full 31 creation-trigger graph remain unverified.

**Production effects: NONE:** no live DB/permissions/character/stock/inventory/feat grant, no historical backfill, no `main` merge, Vercel deploy, world/town map or AI change.
