# Source Patch Pipeline Audit

Purpose: maintainer reference for the current build-script unwind: what still mutates source for Vercel, what has been source-baked, what has been deleted, and what should be cleaned up next.

## Current build shape

Local commands stay clean:

```text
npm run dev   -> next dev
npm run build -> next build
```

Vercel uses the explicit validation runner:

```text
vercel.json -> npm run build:vercel -> scripts/vercel_build_v2.mjs
```

The former source-mutating patch steps have been removed from the runner. The remaining runner is validator/build orchestration plus the line-ending normalizer.

## Active Vercel runner order

```text
scripts/validate_source_patch_pipeline_cleanup.mjs
scripts/validate_large_file_source_bake_readiness.mjs
scripts/validate_handoff_docs_runner_alignment.mjs
scripts/validate_security_hardening_roadmap.mjs
scripts/validate_town_crafter_handoff_pipeline.mjs
scripts/normalize_build_patch_line_endings.mjs
scripts/validate_town_merchant_storefront_handoff.mjs
scripts/validate_town_merchant_portrait_fields.mjs
scripts/validate_merchant_market_ui_handoff.mjs
scripts/validate_crafter_shop_presentation_handoff.mjs
scripts/validate_map_profile_offcanvas_handoff.mjs
scripts/validate_townsheet_patch_anchors.mjs
scripts/validate_town_crafter_panel_surface.mjs
scripts/validate_town_crafter_interaction_component.mjs
scripts/validate_craft_profession.mjs
scripts/validate_npc_panel_craft_surface.mjs
scripts/validate_npc_panel_wrapper_props.mjs
scripts/validate_npc_panel_wrapper_tabs.mjs
scripts/validate_npc_panel_craft_placeholder_body.mjs
scripts/validate_npc_panel_craft_placeholder_tab.mjs
scripts/validate_npc_panel_view_state_bridge.mjs
scripts/validate_npc_crafter_panel_recipe_ui.mjs
scripts/validate_character_interaction_panel.mjs
scripts/validate_character_spellbook_profile.mjs
scripts/validate_player_sheet_actions.mjs
scripts/test_background_mechanics.mjs
scripts/validate_npc_forge_v2.mjs
scripts/validate_character_class_progression.mjs
scripts/test_player_facing_text.mjs
scripts/validate_character_craft_handoff.mjs
scripts/validate_town_crafter_shared_craft_panel.mjs
scripts/validate_npc_page_panel_wrapper_adoption.mjs
scripts/validate_map_profile_character_interaction.mjs
scripts/validate_enchanting_bounds_handoff.mjs
npx next build
```

## Cleanup guards

`scripts/validate_source_patch_pipeline_cleanup.mjs` is active first in the Vercel runner and exposed as `npm run check:source-patch-cleanup`.

`scripts/validate_large_file_source_bake_readiness.mjs` is active second in the runner. It reports which large-file patch groups are still unbaked and ensures every unbaked group still has its required runner patch/validator coverage.

`scripts/validate_handoff_docs_runner_alignment.mjs` is active third in the runner and exposed as `npm run check:handoff-docs`. It ensures this audit and `docs/Town_Crafter_Current_Status.md` still list every active runner script and do not drift behind the build pipeline.

`scripts/validate_security_hardening_roadmap.mjs` guards the wallet boundary, spell RLS migration, administrator-only world debug RPC authorization, legacy merchant overload removal, and the existing background feat/spell persistence contract. It also rejects accidental replacement of world movement, route progression, or simulation functions in the security migration.

## Completed source bakes and cleanups

### Security hardening roadmap

- `sql/20260724_01_security_hardening_roadmap.sql` owns the reviewed database hardening migration.
- `utils/useWallet.js` no longer exposes generic add/spend helpers; purchases continue through `buy_from_merchant`, while administrator balance editing continues through `wallet_set`.
- Spell catalogs remain publicly readable but are protected from direct client writes through RLS and least-privilege grants.
- Manual administrator world-debug RPCs retain their existing state updates and tick behavior but now require an authenticated administrator.
- Proven-dead merchant reroll overloads that reference removed legacy tables are retired; `reroll_merchant_inventory_v2` remains the active contract.
- `scripts/validate_security_hardening_roadmap.mjs` remains active validator coverage.

### Town merchant storefront handoff

- `components/TownSheet.js` owns the merchant/crafter storefront handoff directly.
- `scripts/validate_town_merchant_storefront_handoff.mjs` remains active as the source of truth.
- Deleted after green deploy: `scripts/patch_town_merchant_storefront.mjs`.

### Town merchant portrait fields

- `pages/town/[id].js` owns merchant portrait projection fields directly.
- `scripts/validate_town_merchant_portrait_fields.mjs` remains active.
- Deleted after green deploy: `scripts/patch_town_merchant_portraits_v1.mjs`.

### NPC page wrapper adoption

- `/npcs` imports `CharacterInteractionPanel` through the `NpcPanel` alias boundary.
- `scripts/validate_npc_page_panel_wrapper_adoption.mjs` remains active.
- Deleted after green deploy:
  - `scripts/validate_npc_page_panel_surface.mjs`
  - `scripts/patch_npc_page_panel_wrapper_import_v1.mjs`

### Town profile diagnostic cleanup

- The old profile diagnostic package hook is gone.
- Deleted after green deploy:
  - `diagnose:town-profile`
  - `scripts/diagnose_town_profile_patch_targets.mjs`

### Crafter counter shop skin

- `styles/crafter-counter-shop.css` owns the NPC crafter counter/shop skin directly.
- `pages/_app.js` imports that stylesheet directly.
- `scripts/validate_crafter_shop_presentation_handoff.mjs` strictly validates the source-baked stylesheet and `_app.js` import.

### Character / NPC interaction panel

- `components/character/CharacterInteractionPanel.js` owns the shared Profile, Class, Sheet & Rolls, Inventory, Spellbook, optional Shop, and optional Craft tabs.
- `components/NpcPanel.js` accepts wrapper-owned interaction props, supports `craft` as a valid view, and delegates Craft rendering through `renderCraftView()`.
- `components/CharacterClassPanel.js` owns source-specific class, XP, and level-progression display and admin setup; `scripts/validate_character_class_progression.mjs` guards the file and database contracts.
- `components/CharacterSpellbookPanel.js` owns profile-panel spell display and admin assignment; `scripts/validate_character_spellbook_profile.mjs` guards the handoff.
- `components/CharacterSheet5e.js` owns the standalone clickable weapon/cantrip/prepared-spell surface; `scripts/validate_player_sheet_actions.mjs` guards inventory permission RPCs, action math, profile auto-open, and the boundary that leaves encounter execution server-authoritative.
- `components/NewNpcModalV2.js` owns the split Species/Background flow; `scripts/test_background_mechanics.mjs`, `scripts/validate_npc_forge_v2.mjs`, and `scripts/test_player_facing_text.mjs` guard background feat/spell rules, the visual catalog, artwork fallbacks, the creation contract, and player-facing text cleanup.
- The previous `NpcPanel` / `CharacterInteractionPanel` wrapper and craft renderer patch scripts have already been deleted. Their validators remain active.

### Town profile / crafter shared Craft handoff

- `pages/town/[id].js` owns the shared `CharacterInteractionPanel` profile side panel for town merchant and crafter entries.
- `components/TownSheet.js` dispatches `Open Workshop` into the shared profile Craft tab instead of rendering the legacy `CrafterWorkshopModal` fallback.
- `scripts/validate_town_crafter_handoff_pipeline.mjs`, `scripts/validate_townsheet_patch_anchors.mjs`, `scripts/validate_town_crafter_panel_surface.mjs`, and `scripts/validate_town_crafter_shared_craft_panel.mjs` remain active as validators.

### Town route loading guard

- `pages/town/[id].js` owns the minimal town-route loading guard directly.
- Deleted after green deploy: `scripts/patch_town_route_loading_guard_v3.mjs`.

### Map/page boot loading consolidation

- `components/MapPageClient.js` owns the nonblocking map boot sequence directly, loading admin/location data first and deferring secondary map data.
- `pages/npcs.js` owns its nonblocking NPC page shell load directly.
- `components/NpcPanel.js` owns the profile detail timeout/fallback directly.
- Deleted after green deploy:
  - `scripts/patch_route_loading_guards_v1.mjs`
  - `scripts/patch_map_nonblocking_boot_v1.mjs`

### CraftingWorkspace extraction and discipline lock

- `pages/items.js` is now a thin wrapper around `components/CraftingWorkspace.js`.
- `components/CraftingWorkspace.js` owns the extracted workflow and discipline-lock support directly.
- Deleted after green deploy:
  - `scripts/extract_crafting_workspace_phase1.mjs`
  - `scripts/patch_crafting_workspace_lock_v1.mjs`

### NPC crafter recipe access and load timeouts

- `components/CraftingWorkspace.js` owns the DB-backed NPC crafter known-recipe controls, sortable known-recipes table, panel-mode tab filtering, and per-source crafting load timeouts directly.
- `scripts/validate_npc_crafter_panel_recipe_ui.mjs` remains active as validator coverage.
- Deleted after green deploy:
  - `scripts/patch_npc_crafter_panel_recipe_ui_v4.mjs`
  - `scripts/patch_crafting_load_timeouts_v1.mjs`

### CraftingWorkspace enchanting bounds

- `components/CraftingWorkspace.js` owns enchanting slot-profile helpers, item-kind applies-to filtering, catalyst-only enchanting slots, and enchanting material category bounds directly.
- `scripts/validate_enchanting_bounds_handoff.mjs` remains active as validator coverage.
- Deleted after green deploy: `scripts/patch_enchanting_bounds_v1.mjs`.

### Merchant market and crafter storefront presentation

- `components/MerchantPanel.js` owns the modern merchant market UI, presentation mode, portrait-first storefront art fallback, stock filtering, item preview pane, inline purchase notices, and rarity-class stock rows directly.
- `components/TownSheet.js` owns the town presentation handoff for `MerchantPanel` and the town merchant modal class directly.
- `styles/globals.scss` owns the merchant market workspace and rarity/polish CSS directly.
- `components/TownSheet.module.scss` owns `.merchantMarketModal` sizing directly.
- `styles/crafter-counter-shop.css` owns the crafter counter shop skin directly.
- `scripts/validate_merchant_market_ui_handoff.mjs` and `scripts/validate_crafter_shop_presentation_handoff.mjs` remain active as validator coverage.
- Deleted after green deploy:
  - `scripts/patch_merchant_market_ui.mjs`
  - `scripts/patch_merchant_market_polish.mjs`
  - `scripts/patch_crafter_shop_presentation.mjs`

## Remaining active patch groups

None currently remain in the Vercel runner.

## Cleanup order recommendation

1. Continue with focused feature/polish work from `docs/Deferred_UI_Polish_Backlog.md`.
2. Keep deferred UI/polish fixes separate from cleanup unless they become blocking.

## Safety rules

Before removing any remaining source-mutating build script:

1. Read the script and list every target file it modifies.
2. Confirm the target files already contain the final intended code.
3. Bake source first; do not remove the mutator first unless it is provably unused.
4. Leave or add validators for fragile baked behavior.
5. Check Vercel status after each bounded cleanup batch.
6. Do not remove unrelated patch scripts in a bulk commit.
7. Do not direct-write large source files through the connector. Use local patch scripts or narrow verified source-bake steps for `pages/npcs.js`, `pages/items.js`, `pages/town/[id].js`, `components/TownSheet.js`, and `components/MapPageClient.js`.
