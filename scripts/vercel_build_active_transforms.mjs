import { spawnSync } from "node:child_process";

const steps = [
  ["node", ["scripts/generate_npc_portrait_pack.mjs"]],
  ["node", ["scripts/patch_town_merchant_storefront.mjs"]],
  ["node", ["scripts/patch_merchant_market_ui.mjs"]],
  ["node", ["scripts/patch_merchant_market_polish.mjs"]],
  ["node", ["scripts/patch_crafter_shop_presentation.mjs"]],
  ["node", ["scripts/patch_town_profile_crafter_ui_v1.mjs"]],
  ["node", ["scripts/patch_town_crafter_full_workshop_frame.mjs"]],
  ["npx", ["next", "build"]],
];

for (const [command, args] of steps) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
