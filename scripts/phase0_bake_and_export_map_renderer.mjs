import fs from "node:fs";
import path from "node:path";

// Temporary Phase 0 preview-only bridge. It executes the one-time source bake in
// the Vercel branch sandbox, then exposes the generated source as a static text
// artifact so it can be reviewed and committed as real source. Delete this file
// and the build-runner entry before merging Phase 0 to main.
await import("./source_bake_map_8dir_renderer.mjs");

const sourcePath = path.resolve("components/MapPageClient.js");
const exportDir = path.resolve("public/__phase0");
const exportPath = path.join(exportDir, "MapPageClient.source.txt");

fs.mkdirSync(exportDir, { recursive: true });
fs.copyFileSync(sourcePath, exportPath);

console.log(`Phase 0 generated renderer exported to ${exportPath}`);
