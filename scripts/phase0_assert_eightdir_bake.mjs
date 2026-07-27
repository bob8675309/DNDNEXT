import fs from "node:fs";

const path = "public/__phase0/eightdir-bake-result.json";
if (!fs.existsSync(path)) {
  console.error("Phase 0 bake result was not produced.");
  process.exit(1);
}

const result = JSON.parse(fs.readFileSync(path, "utf8"));
if (!result?.ok) {
  console.error("Phase 0 8-direction source bake failed.");
  if (result?.stdout) console.error(result.stdout);
  if (result?.stderr) console.error(result.stderr);
  process.exit(1);
}

console.log("Phase 0 8-direction source bake anchor/postcondition probe passed.");
