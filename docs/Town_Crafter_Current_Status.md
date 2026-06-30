# Town Crafter / Character Panel Current Status

Last verified green source commit before this documentation update: `52dd16d5b33b4d9a953db2d4d3559b65c293fe27`.

This document is the current handoff point for the town crafter/profile-panel redesign. Older sections that said the town crafter path still used `CrafterWorkshopModal` are obsolete.

## Current green behavior

- The shared profile panel is now the familiar right-side interaction shell across:
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

## Town crafter path

- Town `Open Workshop` now dispatches directly to the shared profile panel on the `Craft` tab.
- `TownSheet` stays dispatcher-only and does **not** import `CharacterInteractionPanel` or `CraftingWorkspace`.
- The town route owns the profile panel and dynamically imports `CharacterInteractionPanel`.
- `CharacterInteractionPanel` owns real Craft rendering and passes the locked crafter profession into `CraftingWorkspace`.
- The active legacy `CrafterWorkshopModal` fallback render path has been retired.
- Build validation enforces that town crafter Craft routing goes through the shared panel and not through an iframe or legacy modal fallback.

## Crafting workspace state

- `/items` extraction remains active through `scripts/extract_crafting_workspace_phase1.mjs`.
- `components/CraftingWorkspace.js` is produced during the build from the real `/items` workflow.
- Discipline-lock support remains active through `scripts/patch_crafting_workspace_lock_v1.mjs`.
- In panel Craft mode, `CraftingWorkspace` receives:
  - `mode="panel"`
  - `disciplineLock={craftProfession}`
  - `crafterId={panelCharacterId}`
  - `crafter={panelCharacter}`
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
- See `docs/Loading_Root_Cause_Backlog.md` for the remaining loading audit notes.

## Active runner order

```text
scripts/generate_npc_portrait_pack.mjs
scripts/patch_town_merchant_storefront.mjs
scripts/patch_town_merchant_portraits_v1.mjs
scripts/patch_merchant_market_ui.mjs
scripts/patch_merchant_market_polish.mjs
scripts/patch_crafter_shop_presentation.mjs
scripts/patch_town_profile_crafter_ui_v1.mjs
scripts/patch_town_crafter_native_polish_v1.mjs
scripts/validate_townsheet_patch_anchors.mjs
scripts/validate_town_crafter_panel_surface.mjs
scripts/validate_town_crafter_interaction_component.mjs
scripts/validate_craft_profession.mjs
scripts/extract_crafting_workspace_phase1.mjs
scripts/patch_crafting_workspace_lock_v1.mjs
scripts/validate_npc_panel_craft_surface.mjs
scripts/patch_npc_panel_wrapper_props_v1.mjs
scripts/validate_npc_panel_wrapper_props.mjs
scripts/patch_npc_panel_wrapper_tabs_v1.mjs
scripts/validate_npc_panel_wrapper_tabs.mjs
scripts/patch_npc_panel_craft_placeholder_body_v1.mjs
scripts/validate_npc_panel_craft_placeholder_body.mjs
scripts/patch_npc_panel_enable_craft_placeholder_tab_v1.mjs
scripts/validate_npc_panel_craft_placeholder_tab.mjs
scripts/patch_npc_panel_view_state_bridge_v1.mjs
scripts/validate_npc_panel_view_state_bridge.mjs
scripts/patch_character_craft_workspace_renderer_v1.mjs
scripts/patch_profile_craft_portrait_frame_v1.mjs
scripts/validate_character_interaction_panel.mjs
scripts/validate_character_craft_handoff.mjs
scripts/patch_town_crafter_shared_craft_panel_v1.mjs
scripts/validate_town_crafter_shared_craft_panel.mjs
scripts/validate_npc_page_panel_surface.mjs
scripts/patch_npc_page_panel_wrapper_import_v1.mjs
scripts/validate_npc_page_panel_wrapper_adoption.mjs
scripts/patch_route_loading_guards_v1.mjs
scripts/patch_enchanting_bounds_v1.mjs
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

## Future cleanup recommended

The build still uses many patch scripts that mutate source before `next build`. This was useful for safe phased deployment, but the long-term healthier state is to source-bake the stable patch outputs and retire obsolete patch scripts in a dedicated cleanup phase. Do that separately from gameplay/crafting changes so regressions are easier to isolate.
