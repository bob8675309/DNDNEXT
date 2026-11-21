# C34 T46-P3-P4B-C2-B14-P0 — Original inventory authorization helpers and browser transfer fallback: source-verified RED

**Date:** November 21, 2026 CST. **Status: SOURCE-ONLY PASS; SIGNED ROLE MATRIX NOT YET ACCEPTED.** Active draft PR [#379](https://github.com/bob8675309/DNDNEXT/pull/379), `research/c34-clean-main-privacy-forge-joint-source-20261112`. No production SQL, source retirement, Vercel deployment, map edit or merge.

## Exact executable and limits

- **Tested executable commit:** `902a85f401e4f6badedba91552911c66050e93fc`.
- **Read-only GitHub Actions:** [#44925439534](https://github.com/bob8675309/DNDNEXT/actions/runs/44925439534), job **136910368924 SUCCESS**. Complete **16,953-character decoded log** independently read. PASS markers `C34-C2B14-P0-ORIGINAL-BLOBS`, `ROLE-MISMATCH-RED`, `TRANSFER-FALLBACK-RED`, `REUSED-SIGNED-EVIDENCE`, `STATIC-ONLY`.
- **Source test:** `scripts/integration/c34/test_t46_p3_p4b_c2b14_inventory_roles_source.mjs`, pinned **nine** original Git blob SHAs; scans all **274** checked-in SQL files under `sql/` including candidates and `supabase/`; locates actual function and inventory RLS policy definitions by source. `.github/workflows/validate-c34-c2b14-inventory-source.yml` is Node 22 **read-only**, no database execution, Supabase project, npm install, external agent or paid API. This scan does **not** prove installed hosted `pg_get_functiondef`, grants, existing RLS, service tokens or runtime SQL migration history.
- **Former research already exists:** `scripts/fixtures/p1_3_equipment_mutation_live_pg17.sql` preserves a historically captured Nov 3 installed `public.transfer_inventory_item_v1` body (MD5 `8c373a9d6438cb12baabeb375fd35305`). `scripts/test_p1_3_permission_controller_rls_local_jwt.mjs` already contains authentic signed cases 157–159 for original inventory/equipment calls across permission revocation. **This C2-B14 job checked those source pins but did NOT rerun the signed fixture.** Reuse it instead of duplicating the entire original PostgreSQL/GoTrue schema.

## Checkpointed source definitions, in their original terminology

| Original location | Actual source rule | Verified impact / limitation |
| --- | --- | --- |
| `sql/20260612_90_patch0_crafting_authorization_hardening.sql:15` `private.current_user_is_admin()` | `auth.uid() IS NOT NULL` AND `user_profiles.role = 'admin'` | Only exact `admin`, not GM/DM, within this historical helper |
| Same `:37` `public.is_admin()` | Calls the strict private helper | Different from UUID overload |
| Same `:47` `public.is_admin(uid uuid)` | Permits own role check; for a different user's role requires strict private admin; returns `COALESCE(role,'player') <> 'player'` | GM/DM **and any unexpected non-player string** are treated elevated when checking own identity |
| `sql/20260614_02_phase_a_non_map_security_hardening.sql:98–137` | Owner-or-private-admin SELECT, INSERT, UPDATE, DELETE RLS; UPDATE `USING` AND `WITH CHECK` require `user_id = auth.uid()` OR strict private admin | An ordinary owner's raw UPDATE cannot change `user_id` to a different account under this historical policy |
| `sql/20260624_01_inventory_item_send_rpc.sql:60–170` | SECURITY DEFINER `transfer_inventory_item_v1` checks `public.is_admin(caller)`, source NPC `can_inventory OR can_edit`, validates target and locks item `FOR UPDATE` | Differing GM/DM/unknown role privileges versus strict table RLS; server checks genuine source owner rights separately |
| `pages/inventory.js:125–148` | Uses `supabase.rpc("is_admin",{uid:sess.user.id})`; when failing falls back to `(prof?.role || "player") !== "player"` | UI might treat an unknown role as manager. A UI boolean is not an authorization boundary |
| Same `:518–536` | Calls `transfer_inventory_item_v1` then, **on ANY RPC error** and if `canTransferOut`, tries raw `inventory_items.update(patch)` | Failure is not equivalent to a missing RPC. A denied/failed server operation must not become a raw mutation fallback; retain as historical RED |
| Same `:564` | Raw bulk `inventory_items.update(patch).in("id",selectedIds)` | Bypasses single-transfer RPC validation for every selected row; needs genuine signed owner/revocation/mixed-target tests |
| `components/AssignItemButton.js:69` | Direct insert `inventory_items`; no explicit role check in the component | Must preserve actual roles and RLS; do not infer an exploit from UI code alone |
| `sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql` | Later **candidate-only** `ALTER POLICY` restricts raw character-owned writes and refines reads | Explicitly marked **NOT A MIGRATION**; do not claim it is installed or change production without separate approval |

The checked-in SQL scan found **one** definition each of the private admin helper, zero-argument public admin helper, public UUID admin helper, and transfer RPC in the targeted versioned SQL source. The four original `inventory_items_*_owner_or_admin` policies appear once each in the June file; a separate November **candidate-only** overrides them (four `ALTER POLICY` statements), but has no authority as an applied migration. This establishes *checked-in source status*, not that hosted Supabase runs exactly those bodies.

### Minimal role matrix (source semantics, NOT signed DB observations)

| user_profiles.role | Historical private helper | Historical UUID helper (own identity) | Owner's intended manager tier |
| --- | --- | --- | --- |
| admin | true | true | manager |
| gm | false | true | manager |
| dm | false | true | manager |
| player | false | false | player |
| observer (unexpected role example) | false | true | NOT authorized manager |

Do not change original role behavior until exact signed admin/GM/DM/player/observer/anon/RLS tests show the accepted compatibility tradeoff and owner-approved authorization tiers. The historical transfer RPC is a different authority from merchant `character_stock` managers or Forge starting equipment materializers; preserve NPC Profile and player-owned item transfer separately.

## Risk, reuse and next bounded test

The source confirms a **real role-helper inconsistency** and a client fallback that can mis-handle denial. It does NOT establish that a player can escalate privileges in production or that a particular installed hosted RLS is vulnerable. The separate historical P1.3 signed fixture shows permission revocation/timing under its own precisely scoped fixture; it is a useful component to **reuse**, not evidence of a newly executed B14 role matrix.

**ONE NEXT C2-B14-P1:** source-locked scratch-only signed PostgreSQL 17 + local GoTrue/PostgREST matrix of `public.is_admin(uuid)` vs `private.current_user_is_admin()`, `inventory_items` owner/RLS direct UPDATE and original `transfer_inventory_item_v1` across genuine admin, gm, dm, player, unexpected role, outsider/anon, NPC delegated can_inventory/can_edit and revocation. Reuse original `scripts/fixtures/p1_3_equipment_mutation_live_pg17.sql` and previous jwt harness where possible. Start with original expected RED; then optionally test a **separate** versioned fail-closed/explicit-role candidate without rewriting checked-in runtime. Enforce item/ownership/wallet/crafting invariants and real-server negative code; no hosted SQL or protected world-map changes. If source graphs incomplete, document blockers rather than fabricate a SQL function or policy installation.

**Release HOLD:** all original PR source/privacy/Forge/Spell & negative parity, 22/34 legacy players.sheet writers, 29/31 nonmap triggers + two protected map triggers, independent encrypted PG17 restore + all 340 Storage bytes, owner approval for source retirement, production SQL/merge/deploy. No paid Codex PR325 or automated credit purchase.
