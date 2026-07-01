# Source Patch Pipeline Audit

Purpose: maintainer reference for the current build-script unwind: what still mutates source for Vercel, what has been source-baked, what has been deleted, and what should be cleaned up next.

## Current build shape

Local npm commands are now clean:

```text
npm run dev   -> next dev
npm run build -> next build
```

Vercel still uses the transitional runner:

```text
vercel.json -> npm run build:vercel -> scripts/vercel_build_v2.mjs
```

That means local dev/build no longer silently mutate tracked source. The remaining mutation risk is isolated to the explicit Vercel runner until the remaining patch outputs are baked into source.

## Why this audit exists

Build-time source mutation was useful as a phased bridge, but it makes deployed output equal to:

```text
committed source files + generated build mutations + patch order side effects
```

That is risky because a later patch can miss an anchor or partially apply after another patch changes a nearby line. The cleanup approach remains staged:

1. Bake a narrow feature area into real source.
2. Prove deployment still succeeds.
3. Remove the baked mutator from the Vercel runner.
4. Leave or strengthen validators for the baked behavior.
5. Delete obsolete scripts only after the runner no longer calls them and deploy passes.

## Current active Vercel runner

As of the current green line, `scripts/vercel_build_v2.mjs` is the only active transform runner. Its meaningful order is:

```text
scripts/generate_npc_portrait_pack.mjs
scripts/patch_town_merchant_storefront.mjs
scripts/patch_town_merchant_portraits_v1.mjs
scripts/patch_merchant_market_ui.mjs
scripts/patch_merchant_market_polish.mjs
scripts/patch_crafter_shop_presentation.mjs
scripts/patch_town_profile_crafter_ui_v1.mjs
scripts/patch_town_crafter_native_polish_v1.mjs
scripts/validate_town_profile_parent_panel.mjs
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
scripts/patch_town_crafter_shared_craft_panel_v1.mjs
scripts/validate_town_crafter_shared_craft_panel.mjs
scripts/patch_town_route_loading_guard_v3.mjs
scripts/validate_npc_page_panel_surface.mjs
scripts/patch_npc_page_panel_wrapper_import_v1.mjs
scripts/validate_npc_page_panel_wrapper_adoption.mjs
scripts/patch_route_loading_guards_v1.mjs
scripts/patch_map_nonblocking_boot_v1.mjs
scripts/patch_enchanting_bounds_v1.mjs
npx next build
```

The old alternate Vercel runners have been deleted:

- `scripts/vercel_build_active_transforms.mjs`
- `scripts/vercel_build_stable_transforms.mjs`
- `scripts/vercel_build_portrait_transforms.mjs`
- `scripts/vercel_build_portrait_enchant_transforms.mjs`

## Completed source bakes

### Character / NPC interaction panel

- `components/character/CharacterInteractionPanel.js`
  - Dynamically imports `CraftingWorkspace` directly.
  - Owns real Craft-tab rendering for crafter profiles.
  - Owns crafter portrait URL resolution and portrait-frame Craft layout.
  - Passes `mode="panel"`, `disciplineLock`, `crafterId`, `crafter`, `isAdmin`, `startView="recipes"`, and `showDisciplineSwitcher={false}` into `CraftingWorkspace`.

- `components/NpcPanel.js`
  - Accepts wrapper-owned interaction props.
  - Normalizes `craft` as a valid panel view.
  - Bridges internal tab changes through `setPanelView` so wrapper and inner panel state stay synchronized.
  - Renders `renderCraftView()` when the active view is `craft`.
  - Keeps `MerchantPanel` client-side via `next/dynamic({ ssr: false })`.

- `pages/_app.js`
  - Imports `styles/profile-craft-crafter-frame.css` directly.

### Prior NPC/equipment work still source-owned

- `components/CharacterSheetPanel.js`
  - Owns `onOpenStore` directly.
  - Store/Shop can open an in-panel store view just like Profile can open an in-panel profile view.

- `components/EquipmentDiagram.js`
  - Owns current slot layout.
  - Empty equipment slots show the slot label only.
  - Backpack column owns the `Send selected item` controls.
  - Selected item preview is display-only and uses `ItemCard`.

- `styles/card-compact.css`
  - Shared `ItemCard` visual standard.
  - Rarity-colored border is consistent around all sides of the card.
  - Header keeps rarity wash/underline treatment.

- `styles/equipment-send-controls.css`
  - Equipment preview gutters are neutral/transparent.
  - The item card itself owns the visual frame.

- `styles/npc-profile-panel.css`
  - NPC page/profile-panel readability and equipment layout parity CSS are source-owned.

- `styles/npc-page-controls.css`
  - NPC page description portrait flow, sheet sprite thumb, and sprite picker modal CSS are source-owned.

- `styles/npc-shop-embedded.css`
  - Embedded merchant shop layout inside `NpcPanel` is source-owned.

## Deleted baked scripts and obsolete handoff files

These scripts are no longer present because their behavior was source-baked or consolidated and no active runner calls them:

- `scripts/patch_npc_profile_shop_tab_v1.mjs`
- `scripts/patch_npc_panel_portrait_state_hotfix_v1.mjs`
- `scripts/patch_npc_profile_readability_dedupe_v1.mjs`
- `scripts/patch_npc_equipment_profile_finish_v1.mjs`
- `scripts/patch_npc_page_sheet_header_polish_v1.mjs`
- `scripts/patch_npc_page_profile_layout_v1.mjs`
- `scripts/patch_npc_panel_wrapper_props_v1.mjs`
- `scripts/patch_npc_panel_wrapper_tabs_v1.mjs`
- `scripts/patch_npc_panel_craft_placeholder_body_v1.mjs`
- `scripts/patch_npc_panel_enable_craft_placeholder_tab_v1.mjs`
- `scripts/patch_npc_panel_view_state_bridge_v1.mjs`
- `scripts/patch_character_craft_workspace_renderer_v1.mjs`
- `scripts/patch_profile_craft_portrait_frame_v1.mjs`

The corresponding validators for the most recent `NpcPanel` / `CharacterInteractionPanel` bake remain active in `vercel_build_v2.mjs`.

Obsolete town-crafter planning files removed after the current status documents superseded them:

- `docs/Town_Crafter_Remaining_Brief.md`
- `docs/Town_Crafter_UI_Source_Map.md`
- `docs/TownSheet_Trace_and_Migration_Worklog.md`

## Remaining active patch groups

### Asset/default generation

- `generate_npc_portrait_pack.mjs`
  - Generates default SVG portraits under `public/npc-portraits`.
  - Candidate cleanup: commit generated assets permanently, move this to a manual script, remove from the Vercel runner.

### Town merchant / market / crafter storefront UI

- `patch_town_merchant_storefront.mjs`
- `patch_town_merchant_portraits_v1.mjs`
- `patch_merchant_market_ui.mjs`
- `patch_merchant_market_polish.mjs`
- `patch_crafter_shop_presentation.mjs`
- `patch_town_profile_crafter_ui_v1.mjs`
- `patch_town_crafter_native_polish_v1.mjs`
- `validate_town_profile_parent_panel.mjs`
- `patch_town_crafter_shared_craft_panel_v1.mjs`

This group mutates `TownSheet`, town route data/profile ownership, merchant/crafter storefront surfaces, and related CSS. Bake it carefully in dependency order. Do not remove the shared-craft-panel patch until the earlier town profile patch output is also source-baked, because the shared-craft-panel patch currently assumes that earlier generated output exists.

Important trace note: an attempted hardening of `patch_town_profile_crafter_ui_v1.mjs` that made every `replaceOnce` miss fatal caused Vercel to fail. The patch intentionally contains tolerant compatibility replacements. Do not harden or remove those soft branches before source-baking the confirmed post-patch output. Keep the validator as the source of truth for the required intermediate boundary, not the optional replacement list.

### Town / route loading guards

- `patch_town_route_loading_guard_v3.mjs`
  - Hardens `/town/[id]` loading and prevents a stuck loading state while preserving town behavior.

- `patch_route_loading_guards_v1.mjs`
  - Hardens `/npcs`, `NpcPanel`, and part of map boot loading.

- `patch_map_nonblocking_boot_v1.mjs`
  - Further hardens `MapPageClient` boot by loading critical location/admin state first and deferring slower map extras.

`patch_route_loading_guards_v1.mjs` and `patch_map_nonblocking_boot_v1.mjs` overlap conceptually. Bake the final desired map boot state once rather than preserving patch-on-patch behavior long term. Do not touch world route advancement, camps, weather, travel windows, or movement logic while doing this.

### CraftingWorkspace / items flow

- `extract_crafting_workspace_phase1.mjs`
  - Generates `components/CraftingWorkspace.js` from `pages/items.js`.

- `patch_crafting_workspace_lock_v1.mjs`
  - Adds panel mode / discipline lock behavior.

- `patch_npc_crafter_panel_recipe_ui_v4.mjs`
  - Adds NPC known recipe UI, sortable recipe headers, and recipe gating.

- `patch_crafting_load_timeouts_v1.mjs`
  - Adds per-source timeouts/fallbacks around heavy crafting data loads.

- `patch_enchanting_bounds_v1.mjs`
  - Applies enchanting slot bounds/material category safety. This is fragile because the extraction script can rewrite its target from `pages/items.js` to `components/CraftingWorkspace.js` during build.

This is the largest remaining blast radius. Keep it after smaller town/panel/loading bakes unless a crafting bug forces it earlier.

### NPC page wrapper adoption

- `patch_npc_page_panel_wrapper_import_v1.mjs`
- `validate_npc_page_panel_wrapper_adoption.mjs`

This should be baked once the `/npcs` page is audited against the already-baked `NpcPanel`/`CharacterInteractionPanel` wrapper support.

## Cleanup order recommendation

1. **Town profile/crafter handoff bake**
   - Bake `patch_town_profile_crafter_ui_v1.mjs` output and then `patch_town_crafter_shared_craft_panel_v1.mjs` output into source.
   - Convert their patch scripts to validators or remove them from the runner only after Vercel passes.
   - Do not first convert soft optional replacements into hard failures; one hardening attempt already failed Vercel. Bake from confirmed output instead.

2. **Town route loading guard bake**
   - Bake `patch_town_route_loading_guard_v3.mjs` into `pages/town/[id].js` after town profile ownership is stable.

3. **NPC page wrapper adoption bake**
   - Bake `/npcs` wrapper import/adoption so the NPC page no longer relies on generated imports or wrapper path changes.

4. **Map/page boot loading consolidation**
   - Bake `patch_route_loading_guards_v1.mjs` and `patch_map_nonblocking_boot_v1.mjs` into one final source-owned loading shape.

5. **CraftingWorkspace extraction cleanup**
   - Make `components/CraftingWorkspace.js` authoritative source instead of a generated file.
   - Then bake lock mode, known recipes, load timeouts, and enchanting bounds directly.

6. **Asset generation cleanup**
   - Commit/generated portrait defaults as static assets or move generation to a manual script, then remove from the Vercel runner.

## Safety rules for future work

Before removing any remaining source-mutating build script:

1. Read the script and list every target file it modifies.
2. Confirm the target files already contain the final intended code.
3. Bake source first; do not remove the mutator first unless it is provably unused.
4. Leave or add validators for the baked behavior where the feature is fragile.
5. Check Vercel status after each bounded removal.
6. Do not remove unrelated patch scripts in a bulk commit.

## Guardrails still unchanged

- No iframe.
- No world-map behavior changes.
- No town movement, route, camp, or travel-time changes.
- No crafting formula/DC/material/rule changes.
- No merchant stock changes.
- No inventory consumption changes.
- Do not mix future loading/performance work with world movement or crafting-rule changes.
