import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts || {};
const workflow = read(".github/workflows/validate-npc-forge.yml");
const runner = read("scripts/vercel_build_v2.mjs");

function fail(message) {
  throw new Error(`Source patch pipeline cleanup: ${message}`);
}

for (const scriptName of ["bake:merchant-market-ui", "bake:town-merchant-storefront"]) {
  if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) fail(`package.json still exposes unsafe ${scriptName}`);
}

if (scripts["check:town-merchant-storefront"] !== "node scripts/validate_town_merchant_storefront_handoff.mjs") {
  fail("package.json is missing validator-only town merchant storefront script");
}

for (const rel of [
  "scripts/patch_town_merchant_storefront.mjs",
  "scripts/patch_town_merchant_portraits_v1.mjs",
]) {
  if (exists(rel)) fail(`${rel} should be deleted after source bake`);
}

if (workflow.includes("scripts/patch_town_merchant_storefront.mjs")) {
  fail("validate-npc-forge workflow still references the deleted storefront mutator");
}
if (!workflow.includes("scripts/validate_town_merchant_storefront_handoff.mjs")) {
  fail("validate-npc-forge workflow does not reference storefront validator");
}

if (runner.includes("scripts/patch_town_merchant_storefront.mjs")) {
  fail("Vercel runner still calls deleted storefront mutator");
}
if (runner.includes("scripts/patch_town_merchant_portraits_v1.mjs")) {
  fail("Vercel runner still calls deleted merchant portrait mutator");
}
for (const token of [
  "scripts/validate_town_merchant_storefront_handoff.mjs",
  "scripts/validate_town_merchant_portrait_fields.mjs",
]) {
  if (!runner.includes(token)) fail(`Vercel runner is missing ${token}`);
}

console.log("Source patch pipeline cleanup validated.");
