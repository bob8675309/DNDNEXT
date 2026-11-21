# C34 T46-P3-P4B-C2-B14-P2-C1 — real signed competing inventory transfers, accepted research only

**Date:** November 21, 2026 CST. **Status: signed disposable-CI ACCEPTED, runtime/production RELEASE HOLD.** PR [#379](https://github.com/bob8675309/DNDNEXT/pull/379) remains draft/unmerged, research branch `research/c34-clean-main-privacy-forge-joint-source-20261112`. No production Supabase SQL/Storage, no original gameplay-page modification, no map changes, paid agents or deploy.

## Acceptance identity and primary evidence

- **Exact tested executable commit:** `c2568e16524afd6e9337bad18509c528f1c3c362`. Initial B14-P2 baseline `b33e88166bc0f86973598a8865ff3a451fbc1650` was already independently signed green.
- **Completed Actions:** [#44932279525](https://github.com/bob8675309/DNDNEXT/actions/runs/44932279525), job **136931297264**, **SUCCESS**. The **entire 96,412-character decoded job log, 1,189 lines**, was read, not just an Actions success badge. Local disposable PostgreSQL 17 + signed GoTrue/PostgREST + original Next browser are source-pinned; no hosted data.
- **Node unit:** five out of five fail-closed client adapter tests PASS, no failures. Error handling makes exactly one single/bulk RPC, never tries the original `inventory_items.update` fallback. This adapter is **NOT imported by any gameplay page**.
- **Nine P2 PASS markers** in exact log: `LOCAL-SOURCE`, `ROLE`, `OWNER`, `DELEGATION`, `BULK`, `CONCURRENCY-SINGLE`, `CONCURRENCY-BULK`, `TOWN-INSERT`, `SIGNED`.
- All **nine earlier B14-P1** signed original role-mismatch RED/ordinary transfer positives and inherited **B2–B12** positive/expected RED, original buyer/stock/quantity and original `public.transfer_inventory_item_v1`/`public.is_admin(uuid)` body MD5 preservation PASS in same job. Inherited historical RED remains documented and is **not** claimed fixed.

## Genuinely signed observations

1. Canonical database profile roles `admin/gm/dm` can transfer outsider-owned items under the **new versioned** manager predicate. `observer` (unexpected nonplayer role) and a different player receive `42501`, no item changed. Raw original broad helper remains available but unchanged.
2. Owner sends own item to NPC and unequips; obsolete expected-owner fields produce `40001`. Normal player cannot send directly to merchant (`42501`).
3. Delegated `character_permissions.can_inventory` permits NPC source item transfer; same valid user's next RPC is denied immediately after revocation.
4. Two matching items move and unequip in one bulk RPC. Mixed source owners, duplicate IDs or missing IDs reject and preserve all inventory rows.
5. **Two independently and concurrently submitted real PostgREST single RPCs** target the same row. Exactly **one commits**; other returns `40001`, with no duplicate ownership.
6. **Two concurrently submitted overlapping bulk RPCs** share one item but each contains a separate second item. Exactly **one commits**; loser returns `40001` and its distinct item is unchanged. This is a bounded signed collision observation, **not** a comprehensive arbitrary load/deadlock proof.
7. A signed player can insert a legitimate own-account inventory row with owner fields, item payload and unequipped flag preserved, under source-original June RLS. This does **not** repair the historical unrestricted arbitrary self-owned item minting RED.
8. Original `components/AssignItemButton.js`, `sql/20260808_51_player_forge_character_scoped_equipment_projection.sql`, and `sql/20261010_01_player_forge_starting_market.sql` pass exact Git blob checks. They are unchanged. The tests **did not** call full Town crafting completion or actual Forge deferred starting-equipment materialization in this B14-P2 runner.
9. Original buyer/quantity/stock role/transfer function definition MD5s unchanged after P2; no existing helper/RLS migration replaced. Unsigned caller receives denied execution/authorization.

## Open original source and runtime contract risks

- **Forge scopes differ:** Original materializer writes `owner_type='character', owner_id=p_character_id::text, user_id=v_user`, while P2 versioned transfer presently accepts expected source `player/npc/merchant` only. Do **not** conflate character-scoped inventory with account-owned inventory; independently specify and test manager/player/permission access before any integration, and retain original Forge creation.
- **Legacy bypass still exists in unmodified application:** `pages/inventory.js` resolves broad `is_admin(uid)` and on any single-transfer RPC error can attempt direct owner UPDATE for `canTransferOut`; bulk moves use direct raw UPDATE. Unmodified `public.transfer_inventory_item_v1` and UUID helper remain available; a separate versioned candidate does **not** automatically close a legacy path. The new client adapter is not mounted.
- **Item provenance:** The original June owner INSERT RLS permits arbitrary signed self-owned inventory creation. A full anti-minting policy requires a separately accepted, source-preserving materialization provenance design; do not silently revoke current Town/crafting/Forge legitimate writes.
- **Hosted parity:** The Supabase metadata-only `list_tables` confirmed `public.inventory_items`, `user_profiles`, `character_permissions`, `characters`, `players`, `character_stock` all have RLS enabled. It did not verify hosted `pg_get_functiondef`, grants, policies, triggers, or constraints. No production SQL was executed.
- **Separate Forge/Auth joint action:** [#44932279895](https://github.com/bob8675309/DNDNEXT/actions/runs/44932279895) was still running when this dossier was authored; do not substitute it for completed source and actual deferred Forge E2E acceptance.
- All parent PR source preservation, 22/34 historical `players.sheet` writers, 29/31 nonmap plus two protected world-map triggers, independent encrypted PG17 restore and all 340 Storage object bytes, owner gate on merges/production SQL/deploy remain release HOLD. Independent CI efficiency issue #389 and hourly automations OFF remain untouched.

**Next bounded research:** Owner-approved compatibility decision on `character` source gear / authentic Town and Forge materialization, then versioned source-preserved signed-positive crafting, inventory AssignItemButton, NPC delegation, browser role/target list, trade and negative authorization. After actual installed hosted ACL/function parity is separately authorized, propose narrow runtime inventory-page cutover for review; do not patch `public.is_admin` shared with protected world map.
