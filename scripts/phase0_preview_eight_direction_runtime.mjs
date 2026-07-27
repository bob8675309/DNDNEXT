import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Temporary preview-only harness. Transform a disposable copy of MapPageClient,
// publish the exact result for review, and leave the real source untouched so
// the normal Vercel build can complete even when an anchor check fails.
const sourcePath = path.resolve("components/MapPageClient.js");
const tempPath = path.join(os.tmpdir(), `dndnext-map-eightdir-${process.pid}.js`);
const exportDir = path.resolve("public/__phase0");
const exportSource = path.join(exportDir, "MapPageClient.eightdir.source.txt");
const exportResult = path.join(exportDir, "eightdir-bake-result.json");

fs.mkdirSync(exportDir, { recursive: true });
fs.copyFileSync(sourcePath, tempPath);

const result = spawnSync(process.execPath, ["scripts/source_bake_map_eight_direction_runtime.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, SPRITE_BAKE_TARGET: tempPath },
  encoding: "utf8",
});

const payload = {
  ok: result.status === 0,
  status: result.status,
  signal: result.signal || null,
  stdout: result.stdout || "",
  stderr: result.stderr || "",
};

fs.writeFileSync(exportResult, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
if (payload.ok) fs.copyFileSync(tempPath, exportSource);
else if (fs.existsSync(exportSource)) fs.rmSync(exportSource);

try { fs.rmSync(tempPath); } catch {}
console.log(`Phase 0 isolated sprite bake: ${payload.ok ? "passed" : "failed"}; result exported to ${exportResult}`);
