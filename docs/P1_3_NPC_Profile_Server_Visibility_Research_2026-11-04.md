# P1.3 — Server-safe NPC Profile, full-sheet RLS and limited character reader (2026-11-04)

> **Unmerged research candidate, NOT a shippable security fix. No live Supabase writes, grants or policies.** The GM wants a centered Profile-first experience across the app, while the NPC Admin page remains separate. Unrevealed lore must not reach unauthorized clients.

## Verified live evidence

Read-only DnDWeb SQL confirms that current `character_sheets_select_visible_or_assigned` grants authenticated full sheet JSON whenever the character row is visible. Also, most `characters` lore columns (`background`, `motivation`, `quirk`, `mannerism`, `voice`) are SELECT-granted to authenticated, despite `characters.secret` being column-denied. In the live snapshot 0/15 character rows were currently visible: this is a dangerous policy conditional, **not** proof a player actually accessed a production NPC secret.

An independent bypass is the deployed SECURITY DEFINER `public.get_my_player_characters_v2()`, MD5 `deca87aaad0dce214743c87cdca03f36`: any user with `can_inventory` or `can_convert` on a tagged player-character receives `to_jsonb(c)` (including `secret`) and the full `character_sheets.sheet`. The deployed `private.can_access_character_v1` MD5 is `97b5e6b059e6467e24c4283fe420c83e`.

## Bounded candidate

The source-drift-guarded, unapplied SQL in `sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql` would:

1. Restrict raw `character_sheets` SELECT to existing Admin or `can_edit` authorities, leaving current INSERT/UPDATE/DELETE policies alone.
2. Provide `get_npc_profile_visible_v1(uuid)`, a server-filtered allowlist for authenticated users: basic identity, portrait and first-impression description, plus lore fields only when their `sheet.profileReveal` or `npcProfileReveal` boolean is exactly true. A hidden character without assigned access produces null. The existing explicit secret reveal remains a GM-controlled choice; private `character_notes` are never included.
3. Keep `get_my_player_characters_v2` account roster rows and permission metadata but return full character serialization/sheet **only** when `can_edit=true`. Inventory-only and convert-only grants retain only minimal public identifying metadata and an empty sheet payload.

The candidate contains no destructive DDL or data writes. The existing API SQL definitions and authorization function hashes are checked before any replacement. **Neither the candidate nor a passing scratch test authorizes applying this live.**

## Planned real local JWT acceptance

Five isolated GoTrue user identities (Admin, Editor, Inventory-only, Convert-only, outsider). Source-authentic starting policies and original definer functions are installed in a disposable PostgreSQL 17 Supabase stack. V00 deliberately reproduces both baseline leaks; V01 tests restricted raw sheet reads; V02 preserves Admin/editor full sheet; V03 verifies allowlisted revealed lore and hidden/anonymous denial; V04 verifies restricted grant shape and editor compatibility; V05 checks a subsequent GM reveal; V06 **intentionally confirms the remaining direct characters lore column leak**. Passing V06 is evidence of a release blocker, not a security success.

Test artifacts: `scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql`, `scripts/fixtures/p1_3_npc_safe_profile_local_auth_pg17.sql`, `scripts/test_p1_3_npc_profile_safe_local_auth.mjs`, `scripts/validate_p1_3_npc_profile_rls_source.mjs`, and isolated free GitHub workflow.

## Critical unrepaired release blocker

PostgreSQL row-level security cannot selectively hide ordinary columns from one authenticated user while exposing them to an Admin via the **same** table grants. The existing `characters` SELECT grants directly expose unrevealed lore even if a new Profile RPC would filter it. Revoking those column grants changes existing NPC Admin, Forge, town, and map readers. Before any production cutover we need to inventory all consumers, provide an authorized GM-private dossier API, migrate the relevant clients (including `NpcPanel`) and demonstrate genuine JWT browser parity. Check other SECURITY DEFINER readers and `character_notes` audiences too. The centered Profile UI PR #320 and this security research should not be released independently as a completed privacy solution.

P1.3 concurrency/lock-order, TC1, R1/R2 and masking policies are separate unresolved release gates. Full client/server rollback and source drift review are required. **Production effects: NONE.**
