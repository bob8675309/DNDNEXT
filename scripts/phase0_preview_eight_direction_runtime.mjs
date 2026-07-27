import fs from "node:fs";
import path from "node:path";

// Temporary preview-only harness. It validates the bounded source bake inside
// Vercel's disposable branch checkout and publishes the generated source for
// review. Remove this harness and its build-runner entry before merge.
await import("./source_bake_map_eight_direction_runtime.mjs");

const sourcePath = path.resolve("components/MapPageClient.js");
const exportDir = path.resolve("public/__phase0");
fs.mkdirSync(exportDir, { recursive: true });
fs.copyFileSync(sourcePath, path.join(exportDir, "MapPageClient.eightdir.source.txt"));

console.log("Phase 0 8-direction renderer source exported for preview review");
