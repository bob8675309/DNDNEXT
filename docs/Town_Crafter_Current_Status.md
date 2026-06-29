# Town Crafter / Character Panel Current Status

Last confirmed green deployment: `67e7baf7e1bc1fca205f799691761c1971071442`.

The earlier import-probe cleanup commit `d22e631b7244a3f512a80df5a1131221ae6ec62b` was initially blocked by Vercel build-rate-limit, but descendant commits have now received real successful Vercel builds. The cleanup state is therefore considered validated through `67e7baf7e1bc1fca205f799691761c1971071442`. The last non-documentation cleanup/source baseline remains `dedddb73c156a346b3ca349f7f86fcbfe1c8fc01`.

## Green active state

- `/items` extraction remains active and green through `scripts/extract_crafting_workspace_phase1.mjs`.
- `components/CraftingWorkspace.js` is produced during the build from the real `/items` workflow.
- Discipline-lock support remains active and green through `scripts/patch_crafting_workspace_lock_v1.mjs`.
- The shared profession resolver remains active and validated:
  - `utils/craftProfession.js`
  - `scripts/validate_craft_profession.mjs`
- `NpcPanel` still does not import `CraftingWorkspace` directly.
- `NpcPanel` surface validation remains active and green:
  - `scripts/validate_npc_panel_craft_surface.mjs`
- `NpcPanel` accepts wrapper-owned props during the build:
  - `scripts/patch_npc_panel_wrapper_props_v1.mjs`
  - `scripts/validate_npc_panel_wrapper_props.mjs`
- `NpcPanel` uses the wrapper-hosted tab renderer while preserving the hardcoded fallback tabs:
  - `scripts/patch_npc_panel_wrapper_tabs_v1.mjs`
  - `scripts/validate_npc_panel_wrapper_tabs.mjs`
- `NpcPanel` has a guarded Craft body branch that calls `renderCraftView()` only when `activeView === "craft"`, `hasCraftCapability` is true, and the wrapper supplied a renderer:
  - `scripts/patch_npc_panel_craft_placeholder_body_v1.mjs`
  - `scripts/validate_npc_panel_craft_placeholder_body.mjs`
- `NpcPanel` allows the wrapper Craft tab path by accepting `craft` as a normalized panel view:
  - `scripts/patch_npc_panel_enable_craft_placeholder_tab_v1.mjs`
  - `scripts/validate_npc_panel_craft_placeholder_tab.mjs`
- `NpcPanel` bridges local view changes back to the wrapper state so internal buttons such as Shop stay aligned with the wrapper-hosted tabs:
  - `scripts/patch_npc_panel_view_state_bridge_v1.mjs`
  - `scripts/validate_npc_panel_view_state_bridge.mjs`
- The character wrapper renders the real extracted `CraftingWorkspace` in Craft view, dynamically imported and locked by profession:
  - `scripts/patch_character_craft_workspace_renderer_v1.mjs`
  - `scripts/validate_character_interaction_panel.mjs`
  - `scripts/validate_character_craft_handoff.mjs`
- The workspace is passed:
  - `mode="panel"`
  - `disciplineLock={craftProfession}`
  - `crafterId={panelCharacterId}`
  - `crafter={panelCharacter}`
  - `startView="recipes"`
  - `showDisciplineSwitcher={false}`
- NPC page profile panel caller is routed through the wrapper during the build, with both pre-patch and post-patch validations active:
  - `scripts/validate_npc_page_panel_surface.mjs`
  - `scripts/patch_npc_page_panel_wrapper_import_v1.mjs`
  - `scripts/validate_npc_page_panel_wrapper_adoption.mjs`
- TownSheet patch anchors are explicitly validated before town-crafter surface validation:
  - `scripts/validate_townsheet_patch_anchors.mjs`
- Town crafter panel surface validation is active and green:
  - `scripts/validate_town_crafter_panel_surface.mjs`
- A new isolated town crafter interaction component is active and validated but not wired into `TownSheet` yet:
  - `components/town/TownCrafterInteractionPanel.js`
  - `scripts/validate_town_crafter_interaction_component.mjs`
- Town crafter clicks still use the legacy `CrafterWorkshopModal` path.
- The shared visual profile shell has built green through `dedddb73c156a346b3ca349f7f86fcbfe1c8fc01`; this is a CSS/shell sizing pass and does not change town-crafter routing.
- Route/loading guards have built green through `67e7baf7e1bc1fca205f799691761c1971071442`; this is startup/loading stabilization and does not change town-crafter routing or crafting rules.

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
scripts/validate_character_interaction_panel.mjs
scripts/validate_character_craft_handoff.mjs
scripts/validate_npc_page_panel_surface.mjs
scripts/patch_npc_page_panel_wrapper_import_v1.mjs
scripts/validate_npc_page_panel_wrapper_adoption.mjs
scripts/patch_route_loading_guards_v1.mjs
scripts/patch_enchanting_bounds_v1.mjs
npx next build
```

## Current risk boundary

The failed area was broad direct `NpcPanel` real workspace wiring. The current path avoids that by keeping the real workspace renderer in `CharacterInteractionPanel` and keeping `NpcPanel` as a shell/branch host.

The first attempt to move the town crafter entry directly to the shared interaction panel failed Vercel. The active runner was restored, the inactive town-migration patch files were removed, and the town surface is now guarded by validation before another attempt.

The isolated `TownCrafterInteractionPanel` component validates on its own, but importing it from `TownSheet` failed. A later inert import-probe test also failed. The probe files have been removed so they do not become dormant patch clutter. The cleanup state has now been validated by real green Vercel builds on descendant commits `dedddb73c156a346b3ca349f7f86fcbfe1c8fc01` and `67e7baf7e1bc1fca205f799691761c1971071442`; the town import boundary is still not proven safe.

Do not reactivate these old transforms as-is:

- `scripts/patch_npc_panel_craft_tab_v1.mjs`
- `scripts/patch_npc_panel_craft_capability_v1.mjs`
- `scripts/patch_town_crafter_full_workshop_frame.mjs`
- `scripts/patch_items_embed_mode_v1.mjs`

## Next safest step

Continue the wrapper path:

1. Treat `67e7baf7e1bc1fca205f799691761c1971071442` as the current green cleanup deployment and `dedddb73c156a346b3ca349f7f86fcbfe1c8fc01` as the last non-documentation cleanup/source baseline.
2. Verify the NPC page profile overlay can open a crafter and switch to the Craft tab.
3. Confirm the Craft tab is locked to the detected profession.
4. Diagnose `TownSheet` import boundaries with validation-only or inert probes before render-path changes.
5. Move the town crafter entry path only after the town import boundary is confirmed.
6. Only after the town path is stable should the legacy town `CrafterWorkshopModal` be retired.

## Still unchanged

- No iframe.
- No world-map behavior changes.
- No town movement, route, camp, or label changes.
- No crafting formula/DC/material/rule changes.
- No merchant stock changes.
- Legacy town `CrafterWorkshopModal` remains active until the replacement path is fully green.
