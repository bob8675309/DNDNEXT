import { spawnSync } from "node:child_process";

process.env.NEXT_PUBLIC_APP_VERSION = String(
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  "local"
).slice(0, 12);

const steps = [
  ["node", ["scripts/generate_npc_portrait_pack.mjs"]],
  ["node", ["scripts/patch_town_merchant_storefront.mjs"]],
  ["node", ["scripts/patch_town_merchant_portraits_v1.mjs"]],
  ["node", ["scripts/patch_merchant_market_ui.mjs"]],
  ["node", ["scripts/patch_merchant_market_polish.mjs"]],
  ["node", ["scripts/patch_crafter_shop_presentation.mjs"]],
  ["node", ["scripts/patch_town_profile_crafter_ui_v1.mjs"]],
  ["node", ["scripts/patch_town_crafter_native_polish_v1.mjs"]],
  ["node", ["scripts/validate_townsheet_patch_anchors.mjs"]],
  ["node", ["scripts/validate_town_crafter_panel_surface.mjs"]],
  ["node", ["scripts/validate_town_crafter_interaction_component.mjs"]],
  ["node", ["scripts/validate_craft_profession.mjs"]],
  ["node", ["scripts/extract_crafting_workspace_phase1.mjs"]],
  ["node", ["scripts/patch_crafting_workspace_lock_v1.mjs"]],
  ["node", ["scripts/validate_npc_panel_craft_surface.mjs"]],
  ["node", ["scripts/patch_npc_panel_wrapper_props_v1.mjs"]],
  ["node", ["scripts/validate_npc_panel_wrapper_props.mjs"]],
  ["node", ["scripts/patch_npc_panel_wrapper_tabs_v1.mjs"]],
  ["node", ["scripts/validate_npc_panel_wrapper_tabs.mjs"]],
  ["node", ["scripts/patch_npc_panel_craft_placeholder_body_v1.mjs"]],
  ["node", ["scripts/validate_npc_panel_craft_placeholder_body.mjs"]],
  ["node", ["scripts/patch_npc_panel_enable_craft_placeholder_tab_v1.mjs"]],
  ["node", ["scripts/validate_npc_panel_craft_placeholder_tab.mjs"]],
  ["node", ["scripts/patch_npc_panel_view_state_bridge_v1.mjs"]],
  ["node", ["scripts/validate_npc_panel_view_state_bridge.mjs"]],
  ["node", ["scripts/patch_character_craft_workspace_renderer_v1.mjs"]],
  ["node", ["scripts/patch_profile_craft_portrait_frame_v1.mjs"]],
  ["node", ["scripts/validate_character_interaction_panel.mjs"]],
  ["node", ["scripts/validate_character_craft_handoff.mjs"]],
  ["node", ["scripts/patch_town_crafter_shared_craft_panel_v1.mjs"]],
  ["node", ["scripts/validate_town_crafter_shared_craft_panel.mjs"]],
  ["node", ["scripts/patch_retire_legacy_town_crafter_modal_v1.mjs"]],
  ["node", ["scripts/validate_town_crafter_legacy_retired.mjs"]],
  ["node", ["scripts/validate_npc_page_panel_surface.mjs"]],
  ["node", ["scripts/patch_npc_page_panel_wrapper_import_v1.mjs"]],
  ["node", ["scripts/validate_npc_page_panel_wrapper_adoption.mjs"]],
  ["node", ["scripts/patch_route_loading_guards_v1.mjs"]],
  ["node", ["scripts/patch_enchanting_bounds_v1.mjs"]],
  ["npx", ["next", "build"]],
];

for (const [command, args] of steps) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
