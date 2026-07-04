# Source Patch Pipeline Audit

Purpose: maintainer reference for the current build-script unwind: what still mutates source for Vercel, what has been source-baked, what has been deleted, and what should be cleaned up next.

## Current build shape

Local commands stay clean:

```text
npm run dev   -> next dev
npm run build -> next build
```

Vercel still uses the transitional runner:

```text
vercel.json -> npm run build:vercel -> scripts/vercel_build_v2.mjs
```

The remaining mutation risk is isolated to the explicit Vercel runner until the remaining patch outputs are baked into source.

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
scripts/extract_crafting_workspace_phase1.mjs
scripts/patch_crafting_workspace_lock_v1.mjs
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
scripts/patch_route_loading_guards_v1.mjs
scripts/patch_map_nonblocking_boot_v1.mjs
scripts/validate_map_profile_character_interaction.mjs
scripts/patch_enchanting_bounds_v1.mjs
scripts/validate_enchanting_bounds_handoff.mjs
npx next build
```

## Cleanup guards

`scripts/validate_source_patch_pipeline_cleanup.mjs` is active first in the Vercel runner and exposed as `npm run check:source-patch-cleanup`.

It currently prevents regressions where these deleted or unsafe artifacts return:

```text
components/cleanup-input.zip
components/needed files
cleanup helper/drop-in artifacts via .gitignore
bake:merchant-market-ui
bake:town-merchant-storefront
diagnose:town-profile
check:merchant-market-ui
predev
prebuild
scripts/vercel_build_active_transforms.mjs
scripts/vercel_build_stable_transforms.mjs
scripts/vercel_build_portrait_transforms.mjs
scripts/vercel_build_portrait_enchant_transforms.mjs
scripts/patch_town_merchant_storefront.mjs
scripts/patch_town_merchant_portraits_v1.mjs
scripts/validate_npc_page_panel_surface.mjs
scripts/patch_npc_page_panel_wrapper_import_v1.mjs
scripts/diagnose_town_profile_patch_targets.mjs
scripts/patch_town_route_loading_guard_v3.mjs
```

It also validates that local `dev` and `build` remain plain Next commands, the source-baked crafter counter stylesheet remains in `styles/crafter-counter-shop.css`, not in `styles/globals.scss`, and the runner still includes required storefront, portrait, and NPC wrapper validators.

`scripts/validate_large_file_source_bake_readiness.mjs` is active second in the runner. It reports which large-file patch groups are still unbaked and ensures every unbaked group still has its required runner patch/validator coverage.

`scripts/validate_handoff_docs_runner_alignment.mjs` is active third in the runner and exposed as `npm run check:handoff-docs`. It ensures this audit and `docs/Town_Crafter_Current_Status.md` still list every active runner script and do not drift behind the build pipeline.

## Completed source bakes and cleanups

### Town merchant storefront handoff

- `components/TownSheet.js` owns the merchant/crafter storefront handoff directly.
- `scripts/validate_town_merchant_storefront_handoff.mjs` remains active as the source of truth.
- Deleted after green deploy:
  - `scripts/patch_town_merchant_storefront.mjs`

### Town merchant portrait fields

- `pages/town/[id].js` owns merchant portrait projection fields directly.
- `scripts/validate_town_merchant_portrait_fields.mjs` remains active.
- Deleted after green deploy:
  - `scripts/patch_town_merchant_portraits_v1.mjs`

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
- `scripts/patch_crafter_shop_presentation.mjs` no longer appends that CSS into `styles/globals.scss`.
- `scripts/validate_crafter_shop_presentation_handoff.mjs` strictly validates the source-baked stylesheet and `_app.js` import.

### Character / NPC interaction panel

- `components/character/CharacterInteractionPanel.js` owns real Craft-tab rendering for crafter profiles.
- `components/NpcPanel.js` accepts wrapper-owned interaction props, supports `craft` as a valid panel view, and delegates Craft rendering through `renderCraftView()`.
- The previous `NpcPanel` / `CharacterInteractionPanel` wrapper and craft renderer patch scripts have already been deleted. Their validators remain active.

### Town profile / crafter shared Craft handoff

- `pages/town/[id].js` owns the shared `CharacterInteractionPanel` profile side panel for town merchant and crafter entries.
- `components/TownSheet.js` dispatches `Open Workshop` into the shared profile Craft tab instead of rendering the legacy `CrafterWorkshopModal` fallback.
- `scripts/validate_town_crafter_handoff_pipeline.mjs`, `scripts/validate_townsheet_patch_anchors.mjs`, `scripts/validate_town_crafter_panel_surface.mjs`, and `scripts/validate_town_crafter_shared_craft_panel.mjs` remain active as validators.
- The old mutators are no longer in the Vercel runner and are pending a later deletion pass.

### Town route loading guard

- `pages/town/[id].js` owns the minimal town-route loading guard directly.
- The town route waits for router readiness, clears impossible loading state when no id is available, renders the TownSheet shell immediately after the critical location row loads, and times out the player plants cache so the town page is not blocked by secondary data.
- Deleted after green deploy:
  - `scripts/patch_town_route_loading_guard_v3.mjs`

## Remaining active patch groups

### Town merchant / market / crafter storefront UI

Still runner-owned:

```text
scripts/patch_merchant_market_ui.mjs
scripts/patch_merchant_market_polish.mjs
scripts/patch_crafter_shop_presentation.mjs
```

### Map/page boot loading consolidation

Still runner-owned:

```text
scripts/patch_route_loading_guards_v1.mjs
scripts/patch_map_nonblocking_boot_v1.mjs
```

Do not touch world route advancement, camps, weather, travel windows, or movement logic while baking these. The goal is loading behavior only.

### CraftingWorkspace / items flow

Still runner-owned:

```text
scripts/extract_crafting_workspace_phase1.mjs
scripts/patch_crafting_workspace_lock_v1.mjs
scripts/patch_npc_crafter_panel_recipe_ui_v4.mjs
scripts/patch_crafting_load_timeouts_v1.mjs
scripts/patch_enchanting_bounds_v1.mjs
```

This remains the largest blast radius. Keep it after smaller town/panel/loading bakes unless a crafting bug forces it earlier.

## Cleanup order recommendation

1. Map/page boot loading consolidation: bake `patch_route_loading_guards_v1.mjs` and `patch_map_nonblocking_boot_v1.mjs` into one final source-owned loading shape.
2. CraftingWorkspace extraction cleanup: make `components/CraftingWorkspace.js` authoritative source, then bake lock mode, known recipes, load timeouts, and enchanting bounds directly.
3. Merchant/crafter storefront polish cleanup: source-bake or delete the remaining merchant/crafter storefront mutators after confirming the current patched output is stable.

## Safety rules

Before removing any remaining source-mutating build script:

1. Read the script and list every target file it modifies.
2. Confirm the target files already contain the final intended code.
3. Bake source first; do not remove the mutator first unless it is provably unused.
4. Leave or add validators for fragile baked behavior.
5. Check Vercel status after each bounded cleanup batch.
6. Do not remove unrelated patch scripts in a bulk commit.
7. Do not direct-write large source files through the connector. Use local patch scripts or narrow verified source-bake steps for `pages/npcs.js`, `pages/items.js`, `pages/town/[id].js`, `components/TownSheet.js`, and `components/MapPageClient.js`.

## Guardrails still unchanged

- No iframe.
- No world-map behavior changes.
- No town movement, route, camp, or travel-time changes.
- No crafting formula, DC, material, or rule changes.
- No merchant stock changes.
- No inventory consumption changes.
