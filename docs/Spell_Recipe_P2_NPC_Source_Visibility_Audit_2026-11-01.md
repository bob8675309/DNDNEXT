# P2 — NPC Combat-Only Permission versus Character Source Visibility

_2026-11-01. Read-only live DnDWeb source/grant/RLS review. This is evidence and a new disposable regression test, NOT a production migration, runtime profile change, or owner-approved GM disclosure policy._

## Current research question

A user may control their own PC plus specifically assigned familiars, pets, sidekicks, henchmen and NPCs. The Admin grants **battle control** separately from full character-sheet editing, inventory or unrelated GM-only content. The held `can_control` SQL/UI in PR #312 implements the assignment, but we cannot say “no secrets are exposed” without also reviewing current table grants and authorizing profile RPCs.

## Actual live production contracts (SELECT-only)

| Surface | Live authenticated privileges / RLS | Delegation implication |
| --- | --- | --- |
| `character_permissions` | SELECT plus RLS self-or-Admin; Admin-write; existing bits `can_edit`, `can_inventory`, `can_convert` | Future `can_control` should **not** imply any source permission. Admin RPC may modify only that bit |
| `characters` | RLS enabled; **no authenticated SELECT table privilege** at this checkpoint, despite a visible-or-assigned SELECT policy | Never assume a browser direct `.from("characters").select()` is a viable or safe source read; policies do **not** replace SQL GRANT |
| `character_sheets` | Authenticated SELECT grant, RLS SELECT via EXISTS matching character row in `characters` | It is **not** a direct `can_control` authorization; the dependent characters privilege/policy must be tested end-to-end |
| `character_spells` | Authenticated SELECT grant; RLS SELECT through the same character visibility check | A delegated controller should not automatically gain direct source spell-assignment SELECT |
| `inventory_items` | Authenticated SELECT/UPDATE plus owner-or-Admin RLS on `user_id` | Controlling an NPC in combat does not assign ownership of an item or authorize sheet inventory actions |
| `encounter_participants` | Authenticated SELECT, hidden token requires direct controller or Admin in production | Held candidate deliberately extends token read only to its delegated controller, not full source sheet |
| `private.can_access_character_v1` | SECURITY DEFINER; production MD5 `97b5e6b059e6467e24c4283fe420c83e` | “read” checks inventory/edit/convert; edit/inventory/convert have their respective existing flags; **no can_control**. Must preserve this isolation |
| `public.encounter_can_control_participant_v1` | SECURITY DEFINER, auth-executable; production MD5 `b91d975f399efb2ed2db8519f633fae7` | Server combat controller check accepts Admin, direct encounter controller, legacy can_edit; held candidate adds can_control |
| `public.encounter_spellcasting_profile_v1` | SECURITY DEFINER; authenticated-executable; production MD5 `e4d6eac7759720b05af0de9dc6c6fc4e` | **Important disclosure boundary:** returns class/proficiency, slot snapshots, and an array of **all character spell assignments** with preparation, uses and source metadata once battle-control check succeeds. The SQL does not have a `known` or `prepared` predicate on the spell assignment aggregate |

The last item is a real source-level behavior, **not a proven unauthorized access exploit**. It creates a GM policy decision: does controlling a creature entitle a player to see every spell assigned to it, including unavailable/unprepared ones, or only a “combat-ready capabilities” projection? Do not silently rewrite the public RPC, break existing spellcasting UI, or hide necessary legal action information. This needs explicit design review with a different visibility projection if the GM wants to hide NPC secrets.

## Current isolated true-JWT negative-test addition

`scripts/fixtures/npc_control_source_visibility_pg17.sql` extends ONLY the existing free local CI fixture with:
- The production-sourced `private.can_access_character_v1` predicate, which does **not** include `can_control`, plus a **local-only authenticated boolean probe**; the probe is not a deployable public function.
- Explicit production-shaped `characters` SELECT revoke (RLS policy alone is not a grant).
- Production-like character-sheet and spell-assignment SELECT policies using character visibility, a confidential `sheet` JSON field, and source spells.
- Simplified inventory-items owner/GM policy and a confidential test item owned by neither player.
- Source-backed SQL grant/RLS assertions to ensure fixture policy is actually enabled.

`scripts/test_npc_delegated_control_local_auth.mjs` now uses real separate GoTrue JWTs to verify **before grant**, **after two grants**, and **after one revocation**: the actor can receive control/token visibility when authorized, but `private.can_access_character_v1` denies read/edit/inventory/convert and direct table reads never disclose the NPC's character, full sheet, source spell assignment, or GM-owned inventory. The test permits a specific SQL permission-denied error (`42501`) when production-shaped policies depend on the ungranted `characters` table, and otherwise requires zero rows. It does not treat other SQL errors as authorized success.

A local fixture has reduced schemas and source tables: even a passing test is **not** proof of production user/browser access patterns or exhaustive `SECURITY DEFINER` RPC secret leakage.

Repeat live read-only metadata check: `scripts/audits/npc_delegated_visibility_readonly_p2.sql`.

## Release gates / single next task

1. Verify **exact-head free local real-JWT CI** after source visibility fixture changes. Do not count a currently in-progress/failed run as passed.
2. Decide whether a delegated NPC controller can see the NPC's complete spell list through `encounter_spellcasting_profile_v1`. This must distinguish tactical legal actions from GM-only notes and hidden spell capabilities. Any change must preserve source/grant/slot/casting functionality and be server-enforced.
3. Audit other `SECURITY DEFINER` character read/profile RPCs for overbroad `can_control` access and add distinct genuine JWT denial/allowed tests before production readiness.
4. Separately close the prior full public replay/lock contract and shared-character overlapping-active-encounters resource issue.
5. Require owner-approved promotion of SQL + Admin UI in one transaction with rollback and browser acceptance. **No live production SQL, migrations, grants, RLS policies, player assignments or deployment changed in this milestone.**
