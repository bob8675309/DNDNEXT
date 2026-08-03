import fs from "node:fs";
import { spawnSync } from "node:child_process";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Blender sprite export kit: ${message}`);
}

const exporter = read("tools/blender/dndnext_sprite_export.py");
const setup = read("tools/blender/dndnext_sprite_scene_setup.py");
const builder = read("tools/blender/dndnext_dawn_model_builder.py");
const prepare = read("tools/blender/dndnext_dawn_prepare_scene.py");
const windowsBuild = read("tools/blender/build_dawn_whiteflame.ps1");
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
assert(JSON.stringify(manifest.pose_frames) === JSON.stringify([1, 7, 13, 19]), "Dawn pose frames changed");
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
  'COLLECTION_NAME = "DawnWhiteflame_Sprite"',
  'ROOT_NAME = "DNDNext_SpriteRoot"',
  'ARMATURE_NAME = "Dawn_Rig"',
  'ACTION_NAME = "Dawn_Walk"',
  "def create_armature(",
  "def build_materials(",
  "def build_character(",
  "def create_walk_action(",
  "def verify_contract(",
  'bone("root"',
  'bone("pelvis"',
  'bone("spine"',
  'bone("chest"',
  'bone("neck"',
  'bone("head"',
  'bone("upper_arm.L"',
  'bone("forearm.L"',
  'bone("hand.L"',
  'bone("upper_arm.R"',
  'bone("forearm.R"',
  'bone("hand.R"',
  'bone("thigh.L"',
  'bone("shin.L"',
  'bone("foot.L"',
  'bone("thigh.R"',
  'bone("shin.R"',
  'bone("foot.R"',
  '"Dawn_Robe"',
  '"Dawn_Head"',
  '"Dawn_SilverHair"',
  '"Dawn_StaffShaft"',
  '"Dawn_FlameCore"',
  '"Dawn_DivineFlame"',
  "1: (",
  "7: (",
  "13: (",
  "19: (",
  'parent_to_bone(obj, arm, bone_name)',
  'add(cylinder_between(collection, "Dawn_StaffShaft"',
  '), "hand.R")',
  'bpy.ops.wm.save_as_mainfile',
]) {
  assert(builder.includes(token), `Dawn model builder is missing ${token}`);
}

assert((builder.match(/bone\("/g) || []).length >= 18, "Dawn rig must define at least 18 named bones");
assert(builder.includes("5.5") === false, "Dawn model builder must use explicit geometry rather than prose-only proportions");

for (const token of [
  "def ensure_camera(",
  "def ensure_area_light(",
  "def ensure_root(",
  "def configure_scene(",
  "def validate_hierarchy(",
  'camera.data.type = "ORTHO"',
  'scene.render.film_transparent = True',
  'scene.render.image_settings.color_mode = "RGBA"',
  'bpy.ops.wm.save_as_mainfile',
  '"DNDNext_Key"',
  '"DNDNext_Fill"',
  '"DNDNext_Rim"',
]) {
  assert(prepare.includes(token), `Dawn scene preparation is missing ${token}`);
}

for (const token of [
  "Resolve-BlenderPath",
  "Build rigged Dawn prototype",
  "Prepare orthographic sprite scene",
  "Validate exporter hierarchy",
  "Render 32 frames and assemble atlas",
  "dndnext_dawn_model_builder.py",
  "dndnext_dawn_prepare_scene.py",
  "dndnext_sprite_export.py",
  "dawn_whiteflame_model.blend",
  "dawn-whiteflame.qa.html",
  "--dry-run",
  "--keep-frames",
  "/admin/sprite-lab",
]) {
  assert(windowsBuild.includes(token), `Windows Dawn build pipeline is missing ${token}`);
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

for (const source of [exporter, setup, builder, prepare]) {
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
    assert(!source.includes(forbidden), `offline Blender tooling crossed a protected or network boundary: ${forbidden}`);
  }
}

const python = process.platform === "win32" ? "python" : "python3";
const syntax = spawnSync(python, [
  "-m",
  "py_compile",
  "tools/blender/dndnext_dawn_model_builder.py",
  "tools/blender/dndnext_dawn_prepare_scene.py",
  "tools/blender/dndnext_sprite_scene_setup.py",
  "tools/blender/dndnext_sprite_export.py",
], { encoding: "utf8" });
if (!syntax.error) {
  assert(syntax.status === 0, `Python syntax validation failed: ${syntax.stderr || syntax.stdout}`);
} else if (syntax.error.code !== "ENOENT") {
  throw syntax.error;
}

console.log("Blender sprite export and procedural Dawn model kit validation passed.");
