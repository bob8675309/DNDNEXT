# Town Crafter / Character Panel Current Status

Last verified green source commit before this documentation update: `c1428ee7df987d010900caf4f54ede2f879ec8b7`.

This document is the current handoff point for the town crafter/profile-panel redesign and the build-script unwind. Older sections that said the town crafter path still used an iframe, that `NpcPanel` / `CharacterInteractionPanel` Craft support was injected by patch scripts, that local `predev` / `prebuild` commands mutate source, that the town merchant storefront still relies on `patch_town_merchant_storefront.mjs`, or that Vercel was blocked by build-rate-limit are obsolete.

## Current green behavior

- The shared profile panel is the familiar right-side interaction shell across:
  - map NPC/merchant clicks;
  - `/npcs` profile overlay;
  - town merchant/crafter entries.
- The profile panel uses the same core tab pattern everywhere:
  - `Profile`
  - `Sheet & Rolls`
  - `Inventory`
  - `Shop` when a storefront exists
  - `Craft` when a crafter profession exists
  - close button
- Duplicate header navigation buttons such as `Open NPC page` and `Drawer` are hidden from the shared panel header.
- The shared panel is intentionally wide and tall enough for shop/craft work. It covers the page content while open; players are expected to close it when they need to return to the map/town/NPC list.
- Merchant/shop portraits are blended into the shop panel with soft bleed/fade treatment instead of a hard divider.
- Crafter Craft-tab portraits use direct portrait URLs first and fall back to Supabase storage paths when needed.

## Source-baked panel work

The following behavior is now native source, not build-time mutation:

- `components/character/CharacterInteractionPanel.js` dynamically imports `CraftingWorkspace` and renders the real locked Craft tab.
- `CharacterInteractionPanel` owns the crafter portrait helper and portrait-frame Craft layout.
- `pages/_app.js` imports `styles/profile-craft-crafter-frame.css` directly.
- `components/NpcPanel.js` accepts wrapper interaction props, normalizes `craft` as a valid view, bridges view changes through `setPanelView`, and renders `renderCraftView()` for the Craft panel body.
- The old baked mutation scripts were removed from the active runner and then deleted from the repo:
  - `scripts/patch_npc_panel_wrapper_props_v1.mjs`
  - `scripts/patch_npc_panel_wrapper_tabs_v1.mjs`
  - `scripts/patch_npc_panel_craft_placeholder_body_v1.mjs`
  - `scripts/patch_npc_panel_enable_craft_placeholder_tab_v1.mjs`
  - `scripts/patch_npc_panel_view_state_bridge_v1.mjs`
  - `scripts/patch_character_craft_workspace_renderer_v1.mjs`
  - `scripts/patch_profile_craft_portrait_frame_v1.mjs`
- Their validator scripts remain active so the build still catches regressions in the baked source.

## Town merchant/storefront source-baked work

The following town merchant/storefront behavior is now source-owned:

- `components/TownSheet.js` owns the merchant/crafter storefront handoff directly.
- `TownSheet` imports `availableProfessionsForCharacter` from `utils/craftingProfessions`.
- Explicit crafter professions are mapped through `PROFESSION_TO_CRAFT_TYPE`.
- The storefront handoff no longer depends on the deleted mutator `scripts/patch_town_merchant_storefront.mjs`.
- `scripts/validate_town_merchant_storefront_handoff.mjs` remains active in the Vercel runner and is the package/workflow source of truth.
- `pages/town/[id].js` owns the merchant portrait projection fields directly:
  - `portrait_url`
  - `portrait_storage_path`
  - `portrait_thumb_url`
  - `portrait_shop_url`
  - `image_url`
- `scripts/validate_town_merchant_portrait_fields.mjs` remains active in the Vercel runner.
- Deleted after green deploy:
  - `scripts/patch_town_merchant_storefront.mjs`
  - `scripts/patch_town_merchant_portraits_v1.mjs`

## Town crafter path

- Town `Open Workshop` dispatches directly to the shared profile panel on the `Craft` tab after the Vercel runner applies the remaining town handoff patches.
- `TownSheet` stays dispatcher-only and does **not** import `CharacterInteractionPanel` or `CraftingWorkspace`.
- The town route owns the profile panel and dynamically imports `CharacterInteractionPanel`.
- `CharacterInteractionPanel` owns real Craft rendering and passes the locked crafter profession into `CraftingWorkspace`.
- The active legacy `CrafterWorkshopModal` fallback render path has been retired in the patched Vercel output, but the full town-crafter source-bake is not complete yet.
- Build validation enforces that town crafter Craft routing goes through the shared panel and not through an iframe or legacy modal fallback.

## Town handoff trace note

- `validate_town_profile_parent_panel.mjs` now validates the intermediate state after `patch_town_profile_crafter_ui_v1.mjs` and before `patch_town_crafter_shared_craft_panel_v1.mjs`.
- An attempted hardening that converted every soft `replaceOnce` miss in `patch_town_profile_crafter_ui_v1.mjs` into a fatal error failed Vercel.
- That means at least one compatibility replacement in that patch is intentionally tolerant in the current patch order.
- Do **not** harden the optional replacement list before baking. The safer path is to bake the confirmed post-patch output and keep validators as the required boundary.

## Crafting workspace state

- `/items` extraction remains active through `scripts/extract_crafting_workspace_phase1.mjs`.
- `components/CraftingWorkspace.js` is produced during the Vercel build from the real `/items` workflow.
- Discipline-lock support remains active through `scripts/patch_crafting_workspace_lock_v1.mjs`.
- NPC crafter known-recipe UI remains active through `scripts/patch_npc_crafter_panel_recipe_ui_v4.mjs`.
- Crafting data timeout hardening remains active through `scripts/patch_crafting_load_timeouts_v1.mjs`.
- In panel Craft mode, `CraftingWorkspace` receives:
  - `mode="panel"`
  - `disciplineLock={craftProfession}`
  - `crafterId={panelCharacterId}`
  - `crafter={panelCharacter}`
  - `isAdmin={...}`
  - `startView="recipes"`
  - `showDisciplineSwitcher={false}`
- The Craft tab has panel-specific styling:
  - compact Crafting Hub header;
  - larger crafter portrait presence;
  - recipe spreadsheet tuned for the panel;
  - redundant `Owned` and `Slot` columns hidden in panel mode;
  - recipe names allowed to wrap;
  - preview/table proportions adjusted for the right-side panel.

## Loading / hang state

- `/npcs` previously still had a full-page `Loading NPCs...` guard tied to one large startup request bundle.
- That has been changed so `/npcs` releases the shell after critical roster data loads:
  - critical: auth, NPCs, merchants;
  - secondary: players, locations, map icons, merchant profiles.
- Secondary data hydrates after the route is already usable.
- `NpcPanel` still falls back to supplied row data if full detail loading is slow.
- Map initial loading guards remain active, but world movement/pathing/travel logic was not changed.
- Town route loading guard remains active through `scripts/patch_town_route_loading_guard_v3.mjs`.
- See `docs/Loading_Root_Cause_Backlog.md` for the remaining loading audit notes.

## Build command state

- `package.json` keeps local commands clean:
  - `npm run dev` = `next dev`
  - `npm run build` = `next build`
  - `npm run build:vercel` = transitional patched Vercel build runner
  - `npm run check:source-patch-cleanup` = source-patch cleanup guard
  - `npm run check:town-merchant-storefront` = validator-only storefront handoff check
  - `npm run check:town-merchant-portraits` = validator-only portrait field check
  - `npm run check:crafter-shop-presentation` = advisory crafter shop presentation handoff check
  - `npm run check:enchanting-bounds` = advisory enchanting bounds handoff check
- `check:merchant-market-ui` is intentionally not exposed yet because merchant market UI is still runner-owned by `patch_merchant_market_ui.mjs`.
- The unsafe `bake:merchant-market-ui` command has been removed because that helper is still brittle.
- `vercel.json` runs `npm run build:vercel` for now.
- The final target remains: remove the transitional runner once all remaining patch outputs are source-baked, then switch Vercel to plain `npm run build`.

## Workflow and docs cleanup state

- Removed obsolete one-shot write-capable workflows:
  - `.github/workflows/fix-merchant-market-transform.yml`
  - `.github/workflows/diag-itemcard-transform.yml`
  - `.github/workflows/extract-crafting-workspace-phase1.yml`
- Removed stale diagnostic artifact:
  - `docs/itemcard-transform-diagnostic.txt`
- Removed obsolete town-crafter planning files that were superseded by this document and `docs/Source_Patch_Pipeline_Audit.md`:
  - `docs/Town_Crafter_Remaining_Brief.md`
  - `docs/Town_Crafter_UI_Source_Map.md`
  - `docs/TownSheet_Trace_and_Migration_Worklog.md`
- Updated remaining validation workflows so they no longer run the deleted `prebuild` chain:
  - `.github/workflows/validate-professions.yml`
  - `.github/workflows/validate-enchanting.yml`
  - `.github/workflows/validate-npc-forge.yml`
- `validate-npc-forge.yml` now checks `scripts/validate_source_patch_pipeline_cleanup.mjs`, `scripts/validate_town_merchant_storefront_handoff.mjs`, and source-owned `components/TownSheet.js` markers instead of the deleted storefront mutator.
- The remaining workflows validate source markers, model tests, migration markers, and plain `npm run build`.

## Active Vercel runner order

```text
scripts/validate_source_patch_pipeline_cleanup.mjs
scripts/validate_town_merchant_storefront_handoff.mjs
scripts/validate_town_merchant_portrait_fields.mjs
scripts/patch_merchant_market_ui.mjs
scripts/validate_merchant_market_ui_handoff.mjs
scripts/patch_merchant_market_polish.mjs
scripts/patch_crafter_shop_presentation.mjs
scripts/validate_crafter_shop_presentation_handoff.mjs
scripts/diagnose_town_profile_patch_targets.mjs
scripts/patch_town_profile_crafter_ui_v1.mjs
scripts/patch_town_crafter_native_polish_v1.mjs
scripts/validate_town_profile_parent_panel.mjs
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
scripts/diagnose_town_shared_craft_patch_targets.mjs
scripts/patch_town_crafter_shared_craft_panel_v1.mjs
scripts/validate_town_crafter_shared_craft_panel.mjs
scripts/patch_town_route_loading_guard_v3.mjs
scripts/validate_npc_page_panel_surface.mjs
scripts/patch_npc_page_panel_wrapper_import_v1.mjs
scripts/validate_npc_page_panel_wrapper_adoption.mjs
scripts/patch_route_loading_guards_v1.mjs
scripts/patch_map_nonblocking_boot_v1.mjs
scripts/validate_map_profile_character_interaction.mjs
scripts/patch_enchanting_bounds_v1.mjs
scripts/validate_enchanting_bounds_handoff.mjs
npx next build
```

## Important guardrails still unchanged

- No iframe.
- No world-map behavior changes.
- No town movement, route, camp, or travel-time changes.
- No crafting formula/DC/material/rule changes.
- No merchant stock changes.
- No inventory consumption changes.
- Do not mix future loading/performance work with world movement or crafting-rule changes.
- Do not direct-write large source files through the connector. Use local patch scripts or verified source-bake steps for `pages/npcs.js`, `pages/items.js`, `pages/town/[id].js`, `components/TownSheet.js`, and `components/MapPageClient.js`.

## Recommended next cleanup

The highest-value remaining source-bake targets are:

1. `patch_town_profile_crafter_ui_v1.mjs` followed by `patch_town_crafter_shared_craft_panel_v1.mjs`. These are a dependency chain and should be baked together or in clearly ordered commits. Bake from confirmed post-patch output, not from a hardened optional replacement list.
2. `patch_town_route_loading_guard_v3.mjs` so `/town/[id]` no longer relies on build-time loading guard mutation.
3. `patch_route_loading_guards_v1.mjs` and `patch_map_nonblocking_boot_v1.mjs`, which overlap conceptually and should be baked into one final map/page boot shape.
4. CraftingWorkspace extraction and panel-mode patches. This is the largest blast radius and should stay after the smaller route/panel bakes.

Keep doing this separately from gameplay/crafting changes so regressions are easier to isolate.
