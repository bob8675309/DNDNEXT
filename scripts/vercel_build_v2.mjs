import { spawnSync } from "node:child_process";

process.env.NEXT_PUBLIC_APP_VERSION = String(process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local").slice(0, 12);
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "validation-placeholder";

const steps = [
  ["node", ["scripts/validate_source_patch_pipeline_cleanup.mjs"]],
  ["node", ["scripts/validate_large_file_source_bake_readiness.mjs"]],
  ["node", ["scripts/validate_handoff_docs_runner_alignment.mjs"]],
  ["node", ["scripts/validate_town_crafter_handoff_pipeline.mjs"]],
  ["node", ["scripts/normalize_build_patch_line_endings.mjs"]],
  ["node", ["scripts/validate_town_merchant_storefront_handoff.mjs"]],
  ["node", ["scripts/validate_town_merchant_portrait_fields.mjs"]],
  ["node", ["scripts/validate_merchant_market_ui_handoff.mjs"]],
  ["node", ["scripts/validate_crafter_shop_presentation_handoff.mjs"]],
  ["node", ["scripts/validate_map_profile_offcanvas_handoff.mjs"]],
  ["node", ["scripts/validate_townsheet_patch_anchors.mjs"]],
  ["node", ["scripts/validate_town_crafter_panel_surface.mjs"]],
  ["node", ["scripts/validate_town_crafter_interaction_component.mjs"]],
  ["node", ["scripts/validate_craft_profession.mjs"]],
  ["node", ["scripts/validate_npc_panel_craft_surface.mjs"]],
  ["node", ["scripts/validate_npc_panel_wrapper_props.mjs"]],
  ["node", ["scripts/validate_npc_panel_wrapper_tabs.mjs"]],
  ["node", ["scripts/validate_npc_panel_craft_placeholder_body.mjs"]],
  ["node", ["scripts/validate_npc_panel_craft_placeholder_tab.mjs"]],
  ["node", ["scripts/validate_npc_panel_view_state_bridge.mjs"]],
  ["node", ["scripts/validate_npc_crafter_panel_recipe_ui.mjs"]],
  ["node", ["scripts/validate_character_interaction_panel.mjs"]],
  ["node", ["scripts/validate_character_spellbook_profile.mjs"]],
  ["node", ["scripts/validate_npc_forge_v2.mjs"]],
  ["node", ["scripts/validate_character_class_progression.mjs"]],
  ["node", ["scripts/test_player_facing_text.mjs"]],
  ["node", ["scripts/validate_character_craft_handoff.mjs"]],
  ["node", ["scripts/validate_town_crafter_shared_craft_panel.mjs"]],
  ["node", ["scripts/validate_npc_page_panel_wrapper_adoption.mjs"]],
  ["node", ["scripts/validate_map_profile_character_interaction.mjs"]],
  ["node", ["scripts/validate_enchanting_bounds_handoff.mjs"]],
  ["npx", ["next", "build"]],
];

for (const [command, args] of steps) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
}
