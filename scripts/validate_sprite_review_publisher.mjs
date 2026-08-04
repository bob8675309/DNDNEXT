import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Sprite review publisher: ${message}`);
}

const publisher = read("tools/blender/build_and_publish_dawn_whiteflame.ps1");
const ignore = read(".gitignore");
const workMap = read("docs/Sprite_Production_Work_Map.md");
const runLog = read("docs/Sprite_Production_Run_Log.md");

for (const token of [
  'ArtifactBranch = "sprite-review/dawn-whiteflame"',
  'ReviewRelative = "sprite-review/dawn-whiteflame/current"',
  'build_dawn_whiteflame.ps1',
  '$Qa.passed -ne $true',
  'dawn_whiteflame_model.blend',
  'dawn-whiteflame.png',
  'dawn-whiteflame.metadata.json',
  'dawn-whiteflame.qa.json',
  'dawn-whiteflame.qa.html',
  '"frames"',
  'status --porcelain --untracked-files=no',
  'worktree", "add"',
  'worktree", "remove"',
  'worktree", "prune"',
  'publish.json',
  'sourceCommit = $SourceCommit',
  'automaticQaPassed = $true',
  'push", "--force-with-lease"',
]) {
  assert(publisher.includes(token), `publisher is missing ${token}`);
}

for (const token of ["build/", ".sprite-review-worktree/", "dawn-whiteflame-review*.zip"]) {
  assert(ignore.includes(token), `.gitignore is missing ${token}`);
}

for (const token of [
  "Review automation",
  "build_and_publish_dawn_whiteflame.ps1",
  "sprite-review/dawn-whiteflame",
  "Requested UI quick fix",
]) {
  assert(workMap.includes(token), `work map is missing ${token}`);
}

for (const token of [
  "Automated iteration path",
  "build_and_publish_dawn_whiteflame.ps1",
  "no manual per-frame editing",
]) {
  assert(runLog.includes(token), `run log is missing ${token}`);
}

for (const forbidden of ["MapPageClient", "map_routes", "encounter_", "supabase", "Invoke-WebRequest", "Start-Process"] ) {
  assert(!publisher.includes(forbidden), `publisher crossed a protected boundary: ${forbidden}`);
}

console.log("Automated Dawn review publishing validation passed.");
