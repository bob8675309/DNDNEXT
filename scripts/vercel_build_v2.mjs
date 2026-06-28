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
  ["node", ["scripts/patch_crafting_workspace_lock_v1.mjs"]],
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
