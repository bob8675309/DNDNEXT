import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const contract = read("utils/spriteProductionContract.js");
const lab = read("pages/admin/sprite-lab.js");
const styles = read("styles/SpriteProductionLab.module.css");
const docs = read("docs/Sprite_Production_Art_Bible.md");
const runtime = read("utils/spriteAnimation.js");
const mapSprite = read("components/MapSprite.js");

for (const token of [
  '"down"',
  '"down-left"',
  '"left"',
  '"up-left"',
  '"up"',
  '"up-right"',
  '"right"',
  '"down-right"',
  "SPRITE_FRAME_WIDTH = 64",
  "SPRITE_FRAME_HEIGHT = 64",
  "SPRITE_COLUMNS = 4",
  "SPRITE_ROWS = 8",
  "SPRITE_WALK_SEQUENCE = Object.freeze([0, 1, 2, 3, 2, 1])",
]) {
  assert(contract.includes(token), `Sprite production contract missing: ${token}`);
}

assert(contract.includes('sprite_format: "eight_direction_idle_walk_v1"'), "Runtime sprite format must remain canonical");
assert(contract.includes("walk_frames: [1, 2, 3]"), "Runtime walk frames must remain 1,2,3");

for (const token of [
  "Sprite Production Lab",
  "256×512",
  "South, Southwest",
  "Column 1 directional spin test",
  "Eight-row animation test",
  "Manual approval gate",
  "validateSpriteDimensions",
  "validateSpriteTransparency",
  "SPRITE_WALK_SEQUENCE",
  "Download approved metadata",
  'supabase.rpc("is_admin")',
]) {
  assert(lab.includes(token), `Sprite lab missing required contract: ${token}`);
}

assert(!lab.includes("MapPageClient"), "Sprite lab must not import or alter world-map behavior");
assert(!lab.includes("encounter_"), "Sprite lab must not mutate encounter state");
assert(styles.includes(".directionGrid") && styles.includes(".firstColumn") && styles.includes("image-rendering: pixelated"), "Sprite lab QA styles are incomplete");

for (const token of [
  "256 × 512 pixels",
  "4 columns × 8 rows",
  "South",
  "Southwest",
  "West",
  "Northwest",
  "North",
  "Northeast",
  "East",
  "Southeast",
  "No row conversion",
  "/admin/sprite-lab",
  "3D-assisted production workflow",
]) {
  assert(docs.includes(token), `Sprite art bible missing: ${token}`);
}

assert(runtime.includes('"down",\n  "down-left",\n  "left",\n  "up-left",\n  "up",\n  "up-right",\n  "right",\n  "down-right"'), "Production and runtime direction order must match exactly");
assert(mapSprite.includes("visual-only sprite renderer"), "MapSprite must remain visual-only");
assert(!mapSprite.includes("setLocs") && !mapSprite.includes("map_routes"), "MapSprite must not own map movement or route state");

console.log("Sprite production lab validation passed.");
