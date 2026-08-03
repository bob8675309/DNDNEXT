import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Blender sprite export kit: ${message}`);
}

const exporter = read("tools/blender/dndnext_sprite_export.py");
const setup = read("tools/blender/dndnext_sprite_scene_setup.py");
const manifestText = read("tools/blender/manifests/dawn_whiteflame.sprite.json");
const guide = read("tools/blender/README.md");
const artBible = read("docs/Sprite_Production_Art_Bible.md");
const manifest = JSON.parse(manifestText);

const directionOrder = [
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
  "right",
  "down-right",
];
const directionYaws = [0, -45, -90, -135, 180, 135, 90, 45];

assert(manifest.character_name === "Dawn Whiteflame", "Dawn manifest character identity changed");
assert(manifest.sprite_format === "eight_direction_idle_walk_v1", "sprite format changed");
assert(manifest.frame_width === 64 && manifest.frame_height === 64, "cell dimensions must remain 64x64");
assert(manifest.columns === 4 && manifest.rows === 8, "atlas must remain 4 columns by 8 rows");
assert(JSON.stringify(manifest.direction_order) === JSON.stringify(directionOrder), "manifest direction order is not canonical South-first order");
assert(JSON.stringify(manifest.direction_yaws_degrees) === JSON.stringify(directionYaws), "Dawn direction yaw table changed");
assert(JSON.stringify(manifest.frame_labels) === JSON.stringify(["idle", "walk-a", "walk-b", "walk-c"]), "frame labels changed");
assert(JSON.stringify(manifest.walk_sequence) === JSON.stringify([0, 1, 2, 3, 2, 1]), "walk playback sequence changed");
assert(Array.isArray(manifest.pose_frames) && manifest.pose_frames.length === 4, "manifest must identify four source poses");
assert(manifest.render_collection === "DawnWhiteflame_Sprite", "Dawn render collection changed");
assert(manifest.rotation_root === "DNDNext_SpriteRoot", "rotation root changed");
assert(manifest.camera_object === "DNDNext_OrthoCamera", "orthographic camera name changed");
assert(manifest.armature_object === "Dawn_Rig", "Dawn armature name changed");
assert(manifest.action_name === "Dawn_Walk", "Dawn walk action name changed");
assert(manifest.atlas_filename === "dawn-whiteflame.png", "Dawn atlas filename changed");

for (const token of [
  'DIRECTIONS = (',
  '("down", "South")',
  '("down-left", "Southwest")',
  '("left", "West")',
  '("up-left", "Northwest")',
  '("up", "North")',
  '("up-right", "Northeast")',
  '("right", "East")',
  '("down-right", "Southeast")',
  'FRAME_LABELS = ("idle", "walk-a", "walk-b", "walk-c")',
  'WALK_SEQUENCE = (0, 1, 2, 3, 2, 1)',
  "def _validate_manifest(",
  "def _validate_hierarchy(",
  "def _alpha_metrics(",
  "def _validate_metrics(",
  "def _assemble_atlas(",
  "def _write_metadata(",
  "def _write_preview(",
  "def _write_report(",
  "bpy.ops.render.render(write_still=True)",
  "destination_y = (7 - row_index) * 64",
  "atlas_width, atlas_height = 256, 512",
  'background-size: 256px 512px',
  "DNDNext sprite export passed automatic QA.",
]) {
  assert(exporter.includes(token), `exporter is missing ${token}`);
}

for (const token of [
  "--dry-run",
  "--keep-frames",
  "minimum_edge_margin_px",
  "max_baseline_delta_px",
  "max_center_x_delta_px",
  "max_bbox_height_delta_px",
  "max_bbox_width_delta_px",
  "Rendered {direction_label} / {frame_label}",
]) {
  assert(exporter.includes(token), `exporter QA contract is missing ${token}`);
}

for (const token of [
  "def _ensure_collection(",
  "def _ensure_camera(",
  "def _ensure_area_light(",
  "def _parent_keep_transform(",
  'camera.data.type = "ORTHO"',
  'scene.render.image_settings.color_mode = "RGBA"',
  "The setup script does not create or modify the armature action.",
]) {
  assert(setup.includes(token), `scene setup helper is missing ${token}`);
}

for (const token of [
  "256 × 512 pixels",
  "S, SW, W, NW, N, NE, E, SE",
  "dndnext_sprite_scene_setup.py",
  "dndnext_sprite_export.py",
  "--dry-run",
  "dawn-whiteflame.qa.html",
  "/admin/sprite-lab",
  "If East and West are reversed, do not mirror the atlas.",
]) {
  assert(guide.includes(token), `Blender operator guide is missing ${token}`);
}

for (const token of [
  "Blender export kit",
  "tools/blender/dndnext_sprite_export.py",
  "tools/blender/manifests/dawn_whiteflame.sprite.json",
]) {
  assert(artBible.includes(token), `sprite art bible is missing ${token}`);
}

for (const forbidden of [
  "MapPageClient",
  "map_routes",
  "encounter_",
  "supabase",
  "requests.",
  "urllib.request",
  "subprocess.run",
  "os.system",
]) {
  assert(!exporter.includes(forbidden), `exporter crossed a protected or network boundary: ${forbidden}`);
  assert(!setup.includes(forbidden), `setup helper crossed a protected or network boundary: ${forbidden}`);
}

console.log("Blender sprite export kit validation passed.");
