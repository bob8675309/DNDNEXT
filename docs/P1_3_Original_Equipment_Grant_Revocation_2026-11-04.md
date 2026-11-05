# P1.3 — Original Equipment RPC vs In-Flight Admin Grant Revocation (2026-11-04)

> **Disposable regression extension / NO PRODUCTION FIX.** Exact live function MD5s were rechecked by SELECT-only Supabase introspection before writing this fixture: `public.set_character_inventory_equipment_v1` `84331beab3ab8a19883b2b8747a24bea`, `public.transfer_inventory_item_v1` `8c373a9d6438cb12baabeb375fd35305`, and `private.can_access_character_v1` `97b5e6b059e6467e24c4283fe420c83e`. The original definitions remain unchanged in `scripts/fixtures/p1_3_equipment_mutation_live_pg17.sql`.

## Purpose and exact scope

The previous case 143 verified the research-only *combat* guard could authorize during an in-flight signed-in Admin UPDATE of an ownership grant, while case 145 demonstrated that an isolated I→G `FOR UPDATE` guard waited for that change before rejecting equipment. This checkpoint extends the probe to **the original deployed equipment RPCs themselves**; the earlier experiment must not be misrepresented as a source-original equip or transfer test.

In the existing genuine GoTrue + PostgREST disposable PostgreSQL 17 test, the GM and equipment manager are different signed-in users. The GM modifies `character_permissions.can_inventory` under the source-like Admin-only policy. A test-only trigger on two additional grant rows holds the uncommitted UPDATE for 1.1 seconds, and an advisory-lock marker makes the schedule observable. During that interval an authenticated owner invokes the **exact source** `set_character_inventory_equipment_v1` or `transfer_inventory_item_v1`. No client or test invokes any production endpoint.

| Case | Required result (proposed until green exact-head run) |
| --- | --- |
| 157 | Original signed-in equip completes while Admin G revocation is still in progress. G is checked by normal SELECT; it is not acquired `FOR UPDATE` by this source RPC. Confirm item unequipped and eventual grant revoked. |
| 158 | Original signed-in transfer first takes I `FOR UPDATE`, then reads G under normal committed visibility. It completes while Admin G UPDATE remains uncommitted, transfers item to an existing synthetic NPC, and the Admin grant later revokes. |
| 159 | After committed grant revocation, new equip and transfer calls are **denied**. Verify no unexpected I owner/equipped mutation from the denied actions. |

**Interpretation:** A reader seeing a previously committed grant during an uncommitted revocation is ordinary PostgreSQL MVCC behavior; the original equipment update might legitimately linearize before revocation. These observations identify transaction dependencies; **they do not prove an exploit, a lost-update, a true G↔I deadlock, or a universally safe lock order**. Triggers, FK/index conflicts and cross-family character/encounter/spell resources remain separate release gates.

## Exact source and test protections

- `scripts/fixtures/p1_3_permission_controller_rls_parity_pg17.sql`: add only synthetic character rows 54/55 to an existing **test-only** G-revocation timing trigger.
- `scripts/test_p1_3_permission_controller_rls_local_jwt.mjs`: append original equip/transfer JWT race cases 157–159 after cases 142–156. Source writers and rejection checks are compared using current production MD5s, but the test database is reduced/fixture-defined.
- GitHub Actions workflow `.github/workflows/validate-p1-3-legacy-real-auth.yml` already executes these files in the free isolated GoTrue/PostgreSQL job; the existing baseline 1–156 must remain green.
- No SQL migration, RLS policy, role grant, NPC UI, real player/GM records, AI, world/town maps, or `main` changes. Work is held on draft #317 only.

## Remaining engineering objective

Continue the source-derived full **G/I/E/P/L/W/X/S/C** graph, including deferred Forge materialization and Admin permission mutation, and prove exact shared-row blocking/FK/trigger waits. Then coordinate proposed capability grants with the newly approved immediate Forge creation + Admin notification + post-creation GM-notes direction. **Do not release the current standalone I→G candidate** without whole-graph acceptance.