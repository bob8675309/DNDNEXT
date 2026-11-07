# C3.3 — Secure NPC Profile integrated candidate (not deployed)
 
**Status: Draft on new main-based branch.** Based on `997902aafe2facd8a492b005f8da4acb8342aeb2` and sourced from secure integrated [#323](https://github.com/bob8675309/DNDNEXT/pull/323) exact `07ff6a4f68418a37d89527be79925922cb1a6775`. This unifies [#321](https://github.com/bob8675309/DNDNEXT/pull/321) original safe reader/GM dossier research, **revised** [#322](https://github.com/bob8675309/DNDNEXT/pull/322) creator-only secret protections, and the centered Profile-first interaction that supersedes standalone [#320](https://github.com/bob8675309/DNDNEXT/pull/320).

The [exact file-level manifest](C3_3_NPC_PROFILE_SOURCE_PROVENANCE_2026-11-07.json) records every copied Git blob. Source SQL **remains under `sql/candidates/`**; no production migration or database writes. Original historical documents are archived verbatim under `docs/archive/npc_secure_profile_2026-11-04/` to avoid conflicting next-task instructions. No modification to live world-map movement, sprites, simulated routes, town roster, encounter mechanics or paid services is authorized.

## Why this is one coordinated release

- Stage 1 changes character sheet SELECT RLS, creates the allowlisted `get_npc_profile_visible_v1` server projection, and restricts the preexisting `get_my_player_characters_v2` SECURITY DEFINER serializer for inventory/convert-only grants.
- Stage 2 revokes direct authenticated GM-private narrative column SELECT and adds explicitly Admin-authenticated `get_npc_dossier_admin_v1`. Column ACL is role-wide and affects Admin users' direct reads too: server-authorized callers and all consumers need compatibility review.
- Stage 3 preserves seven historical GM secrets untouched, separates GM-only `characters.secret` and explicitly published GM clues from creator-authored backstory, captures immutable creator provenance at original `public.characters` INSERT, and gates private backstory on **original creator + current can_edit** or GM. Another can_edit co-editor is not a creator. Includes tagged-PC serializer and legacy secret RPC changes.
- Profile UI must switch only with those server APIs: `NpcPanel.js` uses allowlisted player reader or GM dossier, `CreatorBackstoryPanel.js` checks true server capability, `/npcs` stays GM management, centered map/town/inventory overlays preserve Profile-first, merchant wares and Drawer behavior.

## Independent live source verification — READ ONLY

PostgreSQL 17.4 still has the original character and sheet RLS. Original function source MD5s match the guarded historical stage 1/3 candidate preflight, and the three new read/capability APIs and two new secret tables have **not** been installed. Current `character_sheets_select_visible_or_assigned` SELECT policy allows a visible row-based sheet read. Authenticated SELECT of ordinary narrative columns remains granted; SELECT/UPDATE of `characters.secret` is denied directly, although legacy RPC authorization was shown unsafe in the signed local fixture. **This is a policy exposure, not a claim of a production data breach.** No user record values were fetched and no live SQL/DML/DDL executed.

## Acceptance evidence and limitations

The transferred signed real local GoTrue/PostgREST research fixture V00–V24 compares the unsafe original source with stages 1→3, including hidden NPCs, anonymous, Admin, creator, editor, second can_edit co-editor, inventory-only, revoke and rollback. It exercises some **reduced** character-creation helper bodies; it does not establish full original Forge `v2/v3` creation acceptance. Existing source validators and Next.js production-build gates must pass at this new head. No real end-to-end Profile browser test with signed GM/outsider sessions is supplied by these original branches; that is an outstanding *release* gate, not something to invent or silently claim.

**Do not merge or deploy this draft until** original-source current-role integration, all raw reader/SECURITY DEFINER call sites, required column ACL compatibility, coordinated migration (Supabase CLI), post-migration signing & real browser acceptance and rollback are reviewed and separately owner-approved. In particular, the current `character_sheets.sheet` may contain arbitrary free-form confidential narrative; UI policy must not store GM-only secrets there where valid `can_edit` readers can see them.

**Next bounded work after exact-head source CI:** review any failing checks, audit original full Forge/GM/other profile consumer compatibility and build the signed browser/release/rollback matrix. Report exact CI without claiming release acceptance. Keep old #320–#323 PRs open until explicit retirement approval and unique evidence preservation.
