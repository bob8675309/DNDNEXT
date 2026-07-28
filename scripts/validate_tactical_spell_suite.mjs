import { spawnSync } from "node:child_process";

const validators = [
  "scripts/validate_tactical_false_life.mjs",
  "scripts/validate_tactical_false_life_ui.mjs",
  "scripts/validate_tactical_inflict_wounds.mjs",
  "scripts/validate_tactical_inflict_wounds_ui.mjs",
];

for (const validator of validators) {
  console.log(`\n> node ${validator}`);
  const result = spawnSync(process.execPath, [validator], { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\nPhase 1M/1N tactical validator diagnostic passed.");
