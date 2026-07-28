import { spawnSync } from "node:child_process";

const validators = [
  "scripts/validate_tactical_chill_touch.mjs",
];

for (const validator of validators) {
  console.log(`\n> node ${validator}`);
  const result = spawnSync(process.execPath, [validator], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\nPhase 1Q diagnostic validator passed.");
