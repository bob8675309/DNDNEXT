# Town Crafter / Character Panel Current Status

This is the current handoff for the town crafter/profile-panel redesign and the build-script unwind. It intentionally tracks the active Vercel runner and the remaining patch-owned surfaces. It does not describe world-map movement, town travel, crafting formulas, merchant stock, or inventory behavior changes.

## Current green behavior

- The shared right-side interaction shell is used for map NPC/merchant clicks, the `/npcs` profile overlay, and town merchant/crafter entries.
- The common tab pattern is `Profile`, `Sheet & Rolls`, `Inventory`, optional `Shop`, optional `Craft`, and close.
- `components/character/CharacterInteractionPanel.js` owns the real Craft tab rendering.
- `components/NpcPanel.js` accepts wrapper interaction props, supports `craft` as a valid view, and delegates Craft rendering through the wrapper boundary.
- Town `Open Workshop` routes through the shared profile Craft tab.
- The old iframe path is not used.
- The legacy `CrafterWorkshopModal` fallback is retired from the current town flow.

## Source-owned work already completed

- `styles/crafter-counter-shop.css` owns the NPC crafter counter/shop skin.
- `pages/_app.js` imports `styles/crafter-counter-shop.css` directly.
- `components/TownSheet.js` owns the merchant/crafter storefront handoff markers that replaced the deleted town merchant storefront mutator.
- `pages/town/[id].js` owns merchant portrait projection fields directly.
- `/npcs` wrapper adoption is source-baked and validated by `scripts/validate_npc_page_panel_wrapper_adoption.mjs`.
- Town profile/crafter shared Craft handoff is source-baked and validated by the remaining validator scripts.
- Town route loading guard is source-baked in `pages/town/[id].js` and no longer runs as a Vercel patch.
- Map/page boot loading consolidation is source-baked in `components/MapPageClient.js`, `pages/npcs.js`, and `components/NpcPanel.js` and no longer runs as a Vercel patch.
- CraftingWorkspace extraction and discipline-lock support are source-baked in `pages/items.js` and `components/CraftingWorkspace.js` and no longer run as Vercel patches.
- The following stale scripts have been deleted and are guarded against returning:
  - `scripts/patch_town_merchant_storefront.mjs`
  - `scripts/patch_town_merchant_portraits_v1.mjs`
  - `scripts/validate_npc_page_panel_surface.mjs`
  - `scripts/patch_npc_page_panel_wrapper_import_v1.mjs`
  - `scripts/diagnose_town_profile_patch_targets.mjs`
  - `scripts/patch_town_route_loading_guard_v3.mjs`
  - `scripts/patch_route_loading_guards_v1.mjs`
  - `scripts/patch_map_nonblocking_boot_v1.mjs`
  - `scripts/extract_crafting_workspace_phase1.mjs`
  - `scripts/patch_crafting_workspace_lock_v1.mjs`

## Active Vercel runner order

```text
scripts/validate_source_patch_pipeline_cleanup.mjs
scripts/validate_large_file_source_bake_readiness.mjs
scripts/validate_handoff_docs_runner_alignment.mjs
scripts/validate_town_crafter_handoff_pipeline.mjs
scripts/normalize_build_patch_line_endings.mjs
scripts/validate_town_merchant_storefront_handoff.mjs
scripts/validate_town_merchant_portrait_fields.mjs
scripts/patch_merchant_market_ui.mjs
scripts/validate_merchant_market_ui_handoff.mjs
scripts/patch_merchant_market_polish.mjs
scripts/patch_crafter_shop_presentation.mjs
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
scripts/patch_npc_crafter_panel_recipe_ui_v4.mjs
scripts/patch_crafting_load_timeouts_v1.mjs
scripts/validate_npc_crafter_panel_recipe_ui.mjs
scripts/validate_character_interaction_panel.mjs
scripts/validate_character_craft_handoff.mjs
scripts/validate_town_crafter_shared_craft_panel.mjs
scripts/validate_npc_page_panel_wrapper_adoption.mjs
scripts/validate_map_profile_character_interaction.mjs
scripts/patch_enchanting_bounds_v1.mjs
scripts/validate_enchanting_bounds_handoff.mjs
npx next build
```

## Active package commands

- `npm run dev` = `next dev`
- `npm run build` = `next build`
- `npm run build:vercel` = transitional patched Vercel build runner
- `npm run check:source-patch-cleanup` = source-patch cleanup guard
- `npm run check:large-file-source-bake-readiness` = large-file bake readiness guard
- `npm run check:handoff-docs` = handoff docs / active runner alignment guard
- `npm run check:town-crafter-handoff-pipeline` = town crafter handoff runner-order guard
- `npm run check:town-merchant-storefront` = validator-only storefront handoff check
- `npm run check:town-merchant-portraits` = validator-only portrait field check
- `npm run check:crafter-shop-presentation` = crafter shop presentation handoff check
- `npm run check:enchanting-bounds` = advisory enchanting bounds handoff check

## Remaining high-value source-bake targets

1. CraftingWorkspace/NPC crafter recipe-flow cleanup: bake known-recipes UI, load timeouts, and enchanting bounds directly into source.
2. Merchant/crafter storefront polish cleanup: source-bake or delete the remaining merchant/crafter storefront mutators after confirming the current patched output is stable.

## Known minor follow-up

- Town map briefly shows the default/fallback image before the stored town map resolves. This should be handled later as a focused UI/loading polish pass, not mixed into the current patch-runner cleanup.
- NPC profile portrait placement should be moved back into the Description/profile-content section later; keep the tab behavior unchanged when fixing it.

## Guardrails still unchanged

- No iframe.
- No world-map behavior changes.
- No town movement, route, camp, or travel-time changes.
- No crafting formula, DC, material, or rule changes.
- No merchant stock changes.
- No inventory consumption changes.
- Do not direct-write large source files through the connector. Use local patch scripts or narrow verified source-bake steps for `pages/npcs.js`, `pages/items.js`, `pages/town/[id].js`, `components/TownSheet.js`, and `components/MapPageClient.js`.
