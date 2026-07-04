import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const runner = read("scripts/vercel_build_v2.mjs");
const sourceAudit = read("docs/Source_Patch_Pipeline_Audit.md");
const townStatus = read("docs/Town_Crafter_Current_Status.md");

function fail(message) {
  throw new Error(`Handoff docs runner alignment: ${message}`);
}

const runnerScripts = [...runner.matchAll(/"(scripts\/[^"]+\.mjs)"/g)].map((match) => match[1]);
const uniqueRunnerScripts = [...new Set(runnerScripts)];

for (const token of [
  "## Active Vercel runner order",
  "scripts/validate_source_patch_pipeline_cleanup.mjs",
  "scripts/validate_large_file_source_bake_readiness.mjs",
  "scripts/validate_enchanting_bounds_handoff.mjs",
]) {
  if (!sourceAudit.includes(token)) fail(`Source_Patch_Pipeline_Audit.md is missing ${token}`);
  if (!townStatus.includes(token)) fail(`Town_Crafter_Current_Status.md is missing ${token}`);
}

for (const script of uniqueRunnerScripts) {
  if (!sourceAudit.includes(script)) fail(`Source_Patch_Pipeline_Audit.md does not mention active runner script ${script}`);
  if (!townStatus.includes(script)) fail(`Town_Crafter_Current_Status.md does not mention active runner script ${script}`);
}

for (const stale of [
  "scripts/validate_npc_page_panel_surface.mjs",
  "scripts/patch_npc_page_panel_wrapper_import_v1.mjs",
  "scripts/diagnose_town_profile_patch_targets.mjs",
  "scripts/patch_town_route_loading_guard_v3.mjs",
  "scripts/patch_route_loading_guards_v1.mjs",
  "scripts/patch_map_nonblocking_boot_v1.mjs",
  "scripts/extract_crafting_workspace_phase1.mjs",
  "scripts/patch_crafting_workspace_lock_v1.mjs",
  "scripts/patch_npc_crafter_panel_recipe_ui_v4.mjs",
  "scripts/patch_crafting_load_timeouts_v1.mjs",
  "scripts/patch_enchanting_bounds_v1.mjs",
]) {
  if (runner.includes(stale)) fail(`Vercel runner still references deleted script ${stale}`);
}

console.log("Handoff docs match the active Vercel runner script list.");
