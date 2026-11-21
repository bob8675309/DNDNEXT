# C34 T46-P3-P4B-C2-B14-P3 — one-RPC inventory context and hidden-recipient privacy

**Date:** November 21, 2026 CST. **Status: versioned research candidate committed; signed P3 acceptance PENDING.** Held draft [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379); no production SQL, migration, rollout, world-map, `pages/inventory.js`, merchant/storefront, Forge, Town, or deployed frontend change.

## Why this is worth considering

Original `pages/inventory.js` resolves `public.is_admin(uid)` then optionally falls back to a raw `user_profiles` role check that considers *any non-player string* an admin. It separately fetches players and characters, tries original `list_item_send_targets_v1()` for players, fetches per-NPC `character_permissions`, then loads inventory rows and registers realtime. Several requests and fallback branches can disagree with the server's currently authorized role and owner scope. Original single-item transfer contains any-error RPC→raw owner UPDATE fallback; original bulk uses direct raw UPDATE. These originals are untouched and must remain pinned until an owner-approved, fully signed cutover.

In checked-in `sql/20260624_01_inventory_item_send_rpc.sql`, the original SECURITY DEFINER `list_item_send_targets_v1()` selects every `characters.kind='npc'` without `is_hidden` or `state='hidden'` predicates. That is a **source-level privacy RED** for hidden NPC identifiers/names; not a verified hosted installed-function disclosure. Original merchant enumeration depends on broad `public.is_admin(caller)`, which is already proven to treat unexpected `observer` as elevated in exact historical signed local B14-P1.

## New P3 candidate: smaller, server-derived context

Versioned disposable-only SQL `scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p3_inventory_context_pg17.sql` provides `public.c34_b14_p3_inventory_context_v1(p_owner_type text,p_owner_id text)` returning `{ owner_type, owner_id, can_view, can_manage, is_manager, targets[] }`. Each request recomputes authority from the database, using B14-P2's canonical exact `admin/gm/dm` role predicate; no `user_metadata`, client fallback, or original broad `public.is_admin` rewrite.

- **player:** account owner or canonical manager may view; independent owner account UUID, not Forge character UUID.
- **npc:** manager or signed `character_permissions.can_inventory/can_edit` owner-scope check. Re-check on each RPC after permission revocation.
- **merchant:** canonical managers only. Explicit `observer` is not a manager.
- **character:** **fail closed `42501`**; defer to original separate `private.can_access_character_v1(uuid,'inventory')` ACL and combined CHECK/RLS test. Never reinterpret `inventory_items.user_id` as character-level permission.
- **Targets:** other players; NPCs to ordinary players only if neither `is_hidden=true` nor `state='hidden'`; merchant targets only for canonical managers. Manager-visible hidden NPCs/merchants are intentionally permitted in this *research candidate*, requiring owner confirmation before runtime use.
- **Data minimization:** Return target names, UUIDs, types and capability booleans, not full inventory rows, wallet balances, secrets, NPC dossier or character Sheet. Keep inventory row paging/subscription independent; context is one backend round trip per owner/auth change, and write RPCs remain authoritative and atomic.
- **Security:** `SECURITY DEFINER`, explicit `auth.uid()` guard, fixed search path, `anon`/PUBLIC EXECUTE revoked, authenticated only. No dynamic SQL. Existing merchant buyer/stock, Town, Forge, map, role overloads, transfer RPCs and inventory RLS unchanged.

Signed extension is appended to `scripts/integration/c34/run_t46_p3_p4b_c2b14_p2_inventory_signed.mjs` and inherits its disposable local GoTrue/PostgREST PG17 gates, six signed role actors, source/body MD5 preservation and full B2–B14-C2 acceptance suite. P3 expected markers: `CONTEXT-PRIVACY`, `CONTEXT-REVOKE`, `CONTEXT-ROLE-REVOKE`. **Do not label PASS until exact-head GitHub Actions run and full decoded log verified.**

## Already verified without duplicating Forge

- Exact [C34 joint Forge/Auth Actions #44932279895](https://github.com/bob8675309/DNDNEXT/actions/runs/44932279895), job **136931297537 SUCCESS**; complete **265,863-character / 3,214-line log** inspected. `PASS C34-GREEN04` confirms a genuine signed original `create_player_character_v3` nonce + deferred Forge equipment in a disposable **DIFFERENT** combined review-only RLS/CHECK fixture, preserving nonempty legacy sheet and merchant stock. All T1–T21 nonmap parity and 29/31 source-original nonmap trigger checks in the joint job remain historically distinct from P2.
- New read-only source [Actions #44933494393](https://github.com/bob8675309/DNDNEXT/actions/runs/44933494393), job **136935014206 SUCCESS**; entire **20,685-character** decoded log, seven of seven `test_t46_p3_p4b_c2b14_p2_forge_town_bridge_source.mjs` assertions pass; original Forge character scope, Town craft output owner alignment, signed Forge source lock and historical recipient-list RED are preserved. This is a source-only gate, NOT an execution of `complete_craft_plan_v1`.
- B14-P2-C1 exact source-local signed concurrency acceptance remains `c2568e16524afd6e9337bad18509c528f1c3c362`, [#44932279525](https://github.com/bob8675309/DNDNEXT/actions/runs/44932279525), 96,412-character logs verified. Later B14-P2-C2 source-shaped `character` owner domain negative and P3 context await signed result.

## Owner-facing proposed front-end integration — NOT executed

Keep the inventory *items* query separate (paging, filter and realtime). Replace the scattered client role/owner/target requests with a single cached per-owner context call after sign-in or owner change; refetch after a revoked write, permissions or user role change. Render `can_view/can_manage/targets` but **never trust those booleans for write authorization**: all actual transfers go through one versioned single-item or atomic bulk RPC that rechecks fresh DB permissions and expected owner under row locks. Failure displays a server error and refetches; no direct-table fallback.

This would improve request count, owner/target consistency and hidden-character privacy without touching the world map, tactical mechanics, existing crafting output, currency/buyer, or immutable Forge create pathway. Actual production release would need a separate owner-reviewed migration/GRANT plan and complete browser source/negative parity.

**Owner decision requested before runtime use:** Should hidden NPCs be send-item destinations for game managers only (research default), and should a player be able to transfer already-created `owner_type='character'` Forge gear between *their own* characters? These affect privacy and character ownership, so no default extension is silently implemented.

## Release hold

Original inventory self-minting RLS RED, broadly elevated historical `is_admin(uid)`/transfer entrypoint and page bulk fallback remain. The original Forge combined policy is separate and unapplied. No hosted installed SQL body/ACL proof, production SQL, world map, gameplay merge or deploy; 22/34 legacy `players.sheet` writers, 29/31 nonmap and two protected map triggers, full original PR source preservation and encrypted PG17/340 Storage restoration remain release blockers. Independent CI-efficiency issue #389 remains separate; automations OFF.
