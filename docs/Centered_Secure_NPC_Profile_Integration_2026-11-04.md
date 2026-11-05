# Centered Profile-first + safe NPC reader integration (draft, 2026-11-04)

**Stacking:** Source `feature/centered-secure-npc-profile-20261104` is based on [draft PR #322](https://github.com/bob8675309/DNDNEXT/pull/322), which is based on [research #321](https://github.com/bob8675309/DNDNEXT/pull/321); this integration incorporates the presentation-only changes from [draft PR #320](https://github.com/bob8675309/DNDNEXT/pull/320). None of these are merged into production main, and no live SQL, grants, records, maps or deployments are changed.

## Integrated scope

- **Centered Profile-first presentation:** map NPC offcanvas receives the centered/backdrop CSS class; town NPC, merchant and crafter interactions start on Profile in a centered focus-trapped dialog; inventory NPC/merchant links open a global centered Profile overlay, while the dedicated `/npcs` management page remains separate.
- **Existing map boundaries:** the only change in `MapPageClient.js` is a Profile offcanvas CSS class and Bootstrap backdrop attribute, not route movement, sprites, town roster, simulation, or tactical geometry.
- **Safe content:** the nested shared `NpcPanel` retains PR #322's `get_npc_profile_visible_v1` server-filtered player Profile and independently privileged `get_npc_dossier_admin_v1` GM content. Non-GM raw sheet reads require an explicitly authorized editor and remain DB RLS-gated; separate private creator backstory panel appears only with signed-in GM/creator authorization. GM `characters.secret` is not published via a sheet flag and is only editable/printable in the GM NPC page.
- **One conflict resolved:** PR #320 and PR #322 both touched `components/NpcPanel.js`. This integration takes PR #322's secured component and applies only PR #320's conditional Character Drawer button, avoiding the regression that replaces server-safe reads with old raw column fetches.
- **Existing PR #320 global overlay** fetches identity/portrait metadata only from `characters`, not secret or raw sheet. All character lore/details continue through nested server-projected Profile; Admin role is looked up from current session, never event metadata.
- **No Tailwind:** Bootstrap/SCSS and existing CSS only.

## Verified source contract and remaining blocks

Both existing validator suites should run at the integration branch head: `scripts/validate_centered_npc_profile_entrypoints.mjs`, `scripts/validate_npc_private_profile_cutover.mjs`, `scripts/validate_printable_character_sheet.mjs`, `scripts/validate_map_profile_offcanvas_handoff.mjs`, `scripts/validate_town_crafter_handoff_pipeline.mjs`, along with full Next.js build and synthetic six-identity local GoTrue tests V00–V24. Workflow green does not replace browser interaction tests.

**NOT READY TO MERGE OR DEPLOY.** The four SQL/creator APIs in PR #321 are not installed live. All staged source SQL must be reviewed and released atomically with client changes, including explicit original v1/v2/v3 Forge creation RPC testing, Admin creation notification, GM notes/permission editing, player-character Profile fallback and other SECURITY DEFINER serializers, nested sheet GM-private content, creator-authorized backstory save, safe curated clue authoring, prior P1.3 source-global CP/CS/I/G/E/P/L lock-order proof and rollback. Real browser click, keyboard, mobile and merchant Shop→Profile regressions have not been executed here. Preserve existing seven legacy GM secret texts in place; no automatic backfill.

**Recovery rules:** Record exact tested integration source SHA, CI run IDs, any failed checks, and production effects in central [PR #317](https://github.com/bob8675309/DNDNEXT/pull/317) before leaving the task. Do not claim research proves production permissions or all original Forge routes.
