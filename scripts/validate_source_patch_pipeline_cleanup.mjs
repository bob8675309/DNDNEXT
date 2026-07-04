import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts || {};
const runner = read("scripts/vercel_build_v2.mjs");
const app = read("pages/_app.js");
const crafterCounterCss = exists("styles/crafter-counter-shop.css") ? read("styles/crafter-counter-shop.css") : "";
const globals = read("styles/globals.scss");

function fail(message) {
  throw new Error("Source patch pipeline cleanup: " + message);
}

for (const rel of ["components/cleanup-input.zip", "components/needed files"]) {
  if (exists(rel)) fail(rel + " is an accidental cleanup helper artifact and must not be committed");
}

for (const scriptName of ["predev", "prebuild", "bake:merchant-market-ui", "bake:town-merchant-storefront", "diagnose:town-profile", "check:merchant-market-ui"]) {
  if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) fail("package.json still exposes obsolete hook " + scriptName);
}

if (scripts.dev !== "next dev") fail("package.json dev script must remain plain next dev");
if (scripts.build !== "next build") fail("package.json build script must remain plain next build");
if (scripts["build:vercel"] !== "node scripts/vercel_build_v2.mjs") fail("package.json build:vercel must point to the validation-backed Vercel runner");
if (scripts["check:town-merchant-storefront"] !== "node scripts/validate_town_merchant_storefront_handoff.mjs") fail("package.json is missing validator-only town merchant storefront script");

const retiredRunnerScripts = [
  "scripts/vercel_build_active_transforms.mjs",
  "scripts/vercel_build_stable_transforms.mjs",
  "scripts/vercel_build_portrait_transforms.mjs",
  "scripts/vercel_build_portrait_enchant_transforms.mjs",
  "scripts/patch_town_merchant_storefront.mjs",
  "scripts/patch_town_merchant_portraits_v1.mjs",
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
  "scripts/patch_merchant_market_ui.mjs",
  "scripts/patch_merchant_market_polish.mjs",
  "scripts/patch_crafter_shop_presentation.mjs",
];

for (const rel of retiredRunnerScripts) {
  if (exists(rel)) fail(rel + " should remain removed after source bake/validator replacement");
  if (runner.includes(rel)) fail("Vercel runner still references retired script " + rel);
}

if (!app.includes('import "../styles/crafter-counter-shop.css";')) fail("pages/_app.js must import the source-baked crafter counter stylesheet");
if (!crafterCounterCss.includes("/* ===== NPC crafter counter shop skin v2 ===== */")) fail("styles/crafter-counter-shop.css is missing the crafter counter skin marker");
if (!crafterCounterCss.includes(".craft-provider-card")) fail("styles/crafter-counter-shop.css is missing the crafter provider card skin");
if (globals.includes("/* ===== NPC crafter counter shop skin v2 ===== */")) fail("styles/globals.scss still owns the crafter counter skin; keep it in styles/crafter-counter-shop.css");

for (const token of [
  "scripts/validate_town_merchant_storefront_handoff.mjs",
  "scripts/validate_town_merchant_portrait_fields.mjs",
  "scripts/validate_npc_page_panel_wrapper_adoption.mjs",
]) {
  if (!runner.includes(token)) fail("Vercel runner is missing " + token);
}

console.log("Source patch pipeline cleanup validated.");
