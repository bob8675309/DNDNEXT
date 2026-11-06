# Review-only release design — character-owned inventory CHECK + RLS (J85–J93)

**2026-11-05 · DNDNext held research PR #324 (stacked on unmerged #321). NOT APPROVED FOR DEPLOYMENT.** This report is based on the read-only *live* PG17 schema/RLS/function inspection and previously verified [J78–J84 exact-head JWT source tests](https://github.com/bob8675309/DNDNEXT/actions/runs/42101294746) (all 3/3 workflow results green at `293986cc88d328e9d2dda8d4bcd4f8c5be3a5558`). J85–J93 **are candidate tests, NOT ACCEPTED until the new exact-head CI logs pass**. No writes to live Supabase, merges to `main`, or production deployments were made.

## Executive decision

**Do not deploy a standalone `DROP CONSTRAINT inventory_items_owner_type_chk`.** The old `NOT VALID` check excludes new `owner_type='character'` inventory. Removing it unblocks original deferred Forge creation, but also exposes a gap in the *current direct table authorization*: authenticated clients have `INSERT`, `UPDATE`, `DELETE`, `SELECT` on `inventory_items`; the original policy tests `user_id = auth.uid()` or Admin status, without asserting that a forged `owner_type='character',owner_id=<unrelated-character>` pair is source-owned or currently permitted. UPDATE enables changing an already-owned user item to another owner type; the issue is not confined to INSERT. Direct character-owned SELECT can also outlive a creator's `character_permissions` if it checks only `user_id`.

The **combined design** stages a *single transaction* changing all four inventory RLS policies and dropping the obsolete CHECK only after passing strict source/role/constraint preflights. It retains the **newer validated** `inventory_items_owner_type_check` and never changes table grants, triggers, source Forge RPCs, item row data or the world/town map. `sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql` is **not a numbered migration**; after acceptance, a separately approved production migration must be created using the applicable Supabase CLI version.

## Read-only production evidence, PG 17.4

| Live fact | Verified |
| --- | --- |
| `inventory_items` | 23 rows: **19 npc, 4 player, 0 character** at read time; RLS enabled, FORCE RLS disabled |
| `inventory_items_owner_type_check` | `convalidated=true`; allows player, npc, merchant, **character** |
| `inventory_items_owner_type_chk` | `convalidated=false`; allows player, npc, merchant; **NOT VALID still checks new rows** |
| `authenticated` table privileges | SELECT / INSERT / UPDATE / DELETE true; `anon` direct DML false |
| `inventory_items_insert_owner_or_admin` | `WITH CHECK user_id=auth.uid() OR private.current_user_is_admin()` |
| `inventory_items_update_owner_or_admin` | matching `USING` and `WITH CHECK`; no character ownership condition |
| `inventory_items_delete_owner_or_admin` | matching `USING`; no character ownership condition |
| `inventory_items_select_owner_or_admin` | matching `USING`; does not recheck current `can_inventory/can_edit` |
| Original Admin function | `private.current_user_is_admin()` MD5 `1fc5fbcb121b2862eeab869edfb3a209`; reads `user_profiles.role='admin'` |
| Original current access helper | `private.can_access_character_v1(uuid,text)` MD5 **`97b5e6b059e6467e24c4283fe420c83e`**; `'inventory'` accepts current `can_inventory OR can_edit` or Admin |
| Original deferred equipment source | `private.materialize_player_forge_starting_equipment_v1(uuid)` MD5 `653e1b9d7cc47dcff2cef33a674b97f4` |
| Original inventory BEFORE trigger functions | Crafting traits `108bfc2599d75e7298f65ce326f16173`, smithing polish `5d51cf335ff880939ae0df4c4152bdbd` |

Exact live `pg_policy`, `pg_constraint`, `information_schema.role_table_grants`, `pg_proc` and `pg_trigger` were queried SELECT-only. The production source has **four permissive authenticated inventory policies**, no extra inventory table policy in the current snapshot. Full schema and all 31 creation-adjacent triggers were **not** reproduced in the existing local Forge fixture, so browser/production acceptance remains a separate gate.

Original `public.get_character_inventory_v1(uuid)` MD5 `d958dc1b685836117421fea5b8749478` and `public.set_character_inventory_equipment_v1(uuid,uuid,boolean,text)` MD5 `84331beab3ab8a19883b2b8747a24bea` are SECURITY DEFINER RPCs with `private.can_access_character_v1(...,'inventory')` checks and recognize `owner_type='character'`. `public.transfer_inventory_item_v1` MD5 `8c373a9d6438cb12baabeb375fd35305` checks actor/target, but currently lists only player, npc or merchant target types. The Forge materializer inserts character-owned items with owner_id the character UUID and user_id the verified creator; client-initiated freeform character inserts must not be treated as equivalent.

## Proposed exact mutation set (combined, one transaction)

Read `sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql` together with this document. It requires **PostgreSQL 17**, exactly two expected owner CHECKs with correct validation states, the four expected authenticated RLS policy names/commands/roles, RLS enabled, existing DML privileges, original `private.can_access_character_v1` source fingerprint, and original source equipment-materializer fingerprint. It uses `SET LOCAL lock_timeout='2s'`, `statement_timeout='20s'` and explicit pre-/postflight validation so a mismatch causes the transaction to fail closed. It does **not** add grants, alter triggers or recreate the validated CHECK.

| Existing policy | Change proposed for non-Admin users |
| --- | --- |
| INSERT | Require source owner's own `user_id` **and** prohibit a direct destination `owner_type='character'`. Admin DML preserved |
| UPDATE | Apply that condition to **both existing (USING) and updated (WITH CHECK)** ownership so a client cannot mint character-owned gear or launder character-owned gear into player inventory |
| DELETE | Prevent non-Admin direct deletion of character-owned rows; original privileged inventory-management RPCs remain separate |
| SELECT | Keep non-character reads intact, but require **current** source-original `private.can_access_character_v1(owner_id::uuid,'inventory')` for own-user character-owned rows; a `CASE` validates `owner_id` as UUID before casting; Admin SELECT preserved |
| CHECK | Drop only obsolete `inventory_items_owner_type_chk` (no CASCADE). Retain newer validated `inventory_items_owner_type_check` |

**Important scope decision:** The candidate retains the prior direct player/npc/merchant ownership semantics for non-Admin JWT clients. Existing permissive user→NPC/merchant inventory movement may deserve a separate security review, but expanding this migration to unrelated inventory behavior without its own browser tests would violate the minimal-change goal.

### Live app dependency review

- `pages/inventory.js`: direct client SELECT, equipped-item UPDATE, bulk transfer UPDATE, DELETE, plus source `transfer_inventory_item_v1` with an Admin-oriented fallback. **Review direct character-owner actions** against revised policy and use source-authorized RPC for non-Admin character changes.
- `components/AssignItemButton.js`: direct INSERT for item assignment; Admin authority must continue to allow GM character-owned assignment, even with `user_id=NULL`. Player items continue to use `user_id` matching logged-in account.
- `pages/town/[id].js`: direct player-owned crafting INSERT and restore/DELETE flows; the proposed non-character policy must preserve them.
- `public.buy_from_merchant`: original stock→wallet→**player-owned** I, not affected by character-only restriction.
- `private.materialize_player_forge_starting_equipment_v1`: original SECURITY DEFINER character-owned I + currency, must succeed while direct browser minting remains denied.
- Original `private.complete_craft_plan_v1_impl` and `private.complete_enchanting_craft_plan_v1_impl` plus trading/equipment and encounter inventory readers need full release verification under the new rules; source presence was inspected, not all executed.

## New free authentic JWT J85–J93 test contract (PENDING)

The existing [PR #324 local real JWT suite](https://github.com/bob8675309/DNDNEXT/pull/324) already passed J00–J84 with the original creation+feat G/GI+deferred equipment/currency source. We attach source-original `can_access_character_v1` and **live-shape four inventory policies** to its local PG17 (the local Admin helper remains a documented reduced GoTrue fixture, not a copy of production `user_profiles`).

- **J85**: four production-equivalent policy expressions plus actual authenticated table DML grants, disposable PG17 only.
- **J86–J87**: with old CHECK intact, direct forge insert fails `23514`; after removing old CHECK **only in disposable PG17**, a legitimate signed JWT can create character-owned I for someone else's character and reassign its own player item to that character under the *original* policies. Clean both test rows and restore the old CHECK.
- **J88**: apply the complete **review-only candidate** to the disposable database; only obsolete CHECK absent; newer CHECK validated, policy count/names intact.
- **J89**: same non-Admin direct insert and player→character update are blocked under new policy; player item not corrupted.
- **J90**: source-exact signed player Forge v2 creation still materializes a legitimate character-owned item, original source Lucky G/GI, one currency record, one event, correct creator and inert retry.
- **J91**: non-Admin cannot launder character item to player or delete it; direct SELECT respects current inventory permission, including revocation and regrant, using unchanged original `can_access_character_v1`.
- **J92**: original legitimate player-owned direct INSERT/UPDATE/DELETE still works and anonymous user denied.
- **J93**: Admin client can still assign character-owned I; invariants/source hashes remain stable.

**All tests are local PG17/GoTrue/PostgREST with disposable JWTs. No production role or SQL change. Exact-head CI and job logs, not static assertions, determine PASS.**

## Release gates, sequencing and rollback

1. **Hard preflight:** refresh `main`, #317/#321/#324 and RLS/constraint/function fingerprints; review owners/table grants and full original inventory triggers. Have a tested backup/restore and write-block strategy.
2. **Integration acceptance:** original Player Forge v2 and v3; package and starting-market modes; Soldier/other Background; one or more genuine feats G/GI; approved character currency, one-time materializer, immutable nonce and failed deferred COMMIT rollback; **all 31 original creation-adjacent triggers** and downstream specialist/crafting handlers; GM/NPC and alternate-character paths, historical `players.sheet` preservation.
3. **Authorization and UI:** normal owner, unrelated player, current editor/coeditor, revoked editor and Admin tests; direct client INSERT/UPDATE/DELETE/SELECT; `get_character_inventory_v1`, `set_character_inventory_equipment_v1`, transfer, merchant buy/sell, equip/drop, admin assignment, town crafting, inventory bulk operations; no unauthorized item creation, ownership laundering or private inventory exposure.
4. **Concurrency and release:** coordinate #317 global CP/CS/G/I lock design; verify no unexpected 40P01 or order regression with source writers; run repository/CI and targeted browser tests without trivial Vercel deployments; prefer a single reviewed release batch and owner-authorized staging. **Draft research branches remain held.**

**Rollback design:** BEFORE COMMIT, any error in the combined transaction should revert all four policy edits and the constraint change. AFTER COMMIT, **do not blindly re-add the obsolete `NOT VALID` constraint**: existing character-owned rows are retained, but future UPDATEs would again fail its check. A safe response to post-release failure is **pause new Forge equipment operations, preserve character-owned data, diagnose, and roll forward with a reviewed correction**. Restoring the old restriction can be considered only with confirmed no new character rows or a separately authorized data migration and proven non-corruption; do not delete player gear to make rollback convenient.

**Operational lock:** PostgreSQL 17 `ALTER TABLE ... DROP CONSTRAINT` defaults to `ACCESS EXCLUSIVE`; local `lock_timeout` deliberately aborts instead of blocking extended traffic. Reference: https://www.postgresql.org/docs/17/sql-altertable.html. `ALTER POLICY` replaces its expression atomically inside the transaction: https://www.postgresql.org/docs/17/sql-alterpolicy.html. Supabase CLI **v3.0.0 (2026-11-04) changes local/remote command defaults and confirmation behavior**; the pinned `supabase@2.120.0` research CI is intentional. For a real migration, use the correct CLI help/flags, a separately named migration, staging review, backup and explicit owner approval.

**Final status when this note was prepared:** candidate and tests staged, not production ready; do not cite the prior J78–J84 passing run as verification of J85–J93. No production SQL, project secrets, role grants, app runtime changes, Vercel production deployment, merge or protected world/town-map edits.
