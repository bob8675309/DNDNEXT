import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts || {};
const workflow = read(".github/workflows/validate-npc-forge.yml");
const runner = read("scripts/vercel_build_v2.mjs");
const app = read("pages/_app.js");
const crafterShopPatch = read("scripts/patch_crafter_shop_presentation.mjs");
const crafterCounterCss = exists("styles/crafter-counter-shop.css") ? read("styles/crafter-counter-shop.css") : "";
const globals = read("styles/globals.scss");

function fail(message) {
  throw new Error(`Source patch pipeline cleanup: ${message}`);
}

for (const rel of [
  "components/cleanup-input.zip",
  "components/needed files",
]) {
  if (exists(rel)) fail(`${rel} is an accidental cleanup helper artifact and must not be committed`);
}

for (const scriptName of ["bake:merchant-market-ui", "bake:town-merchant-storefront", "diagnose:town-profile"]) {
  if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) fail(`package.json still exposes obsolete ${scriptName}`);
}

if (Object.prototype.hasOwnProperty.call(scripts, "check:merchant-market-ui")) {
  fail("package.json exposes check:merchant-market-ui before merchant market UI is source-baked");
}

if (scripts["check:town-merchant-storefront"] !== "node scripts/validate_town_merchant_storefront_handoff.mjs") {
  fail("package.json is missing validator-only town merchant storefront script");
}

for (const rel of [
  "scripts/patch_town_merchant_storefront.mjs",
  "scripts/patch_town_merchant_portraits_v1.mjs",
  "scripts/validate_npc_page_panel_surface.mjs",
  "scripts/patch_npc_page_panel_wrapper_import_v1.mjs",
  "scripts/diagnose_town_profile_patch_targets.mjs",
]) {
  if (exists(rel)) fail(`${rel} should be deleted after source bake/validator replacement`);
}

if (!app.includes('import "../styles/crafter-counter-shop.css";')) {
  fail("pages/_app.js must import the source-baked crafter counter stylesheet");
}
if (!crafterCounterCss.includes("/* ===== NPC crafter counter shop skin v2 ===== */")) {
  fail("styles/crafter-counter-shop.css is missing the crafter counter skin marker");
}
if (!crafterCounterCss.includes(".craft-provider-card")) {
  fail("styles/crafter-counter-shop.css is missing the crafter provider card skin");
}
if (globals.includes("/* ===== NPC crafter counter shop skin v2 ===== */")) {
  fail("styles/globals.scss still owns the crafter counter skin; keep it in styles/crafter-counter-shop.css");
}
for (const token of [
  "const globalsPath = path.join(process.cwd(), \"styles\", \"globals.scss\");",
  "fs.writeFileSync(globalsPath, globals, \"utf8\");",
]) {
  if (crafterShopPatch.includes(token)) fail("patch_crafter_shop_presentation.mjs must not append the source-baked counter skin to globals.scss");
}

for (const token of [
  "scripts/patch_town_merchant_storefront.mjs",
  "scripts/patch_town_merchant_portraits_v1.mjs",
  "scripts/validate_npc_page_panel_surface.mjs",
  "scripts/patch_npc_page_panel_wrapper_import_v1.mjs",
  "scripts/diagnose_town_profile_patch_targets.mjs",
]) {
  if (workflow.includes(token)) fail(`validate-npc-forge workflow still references deleted script ${token}`);
  if (runner.includes(token)) fail(`Vercel runner still references deleted script ${token}`);
}
if (!workflow.includes("scripts/validate_town_merchant_storefront_handoff.mjs")) {
  fail("validate-npc-forge workflow does not reference storefront validator");
}

for (const token of [
  "scripts/validate_town_merchant_storefront_handoff.mjs",
  "scripts/validate_town_merchant_portrait_fields.mjs",
  "scripts/validate_npc_page_panel_wrapper_adoption.mjs",
]) {
  if (!runner.includes(token)) fail(`Vercel runner is missing ${token}`);
}

console.log("Source patch pipeline cleanup validated.");
