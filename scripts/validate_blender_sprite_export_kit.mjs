import fs from "node:fs";
import { spawnSync } from "node:child_process";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Blender sprite export kit: ${message}`);
}

const exporter = read("tools/blender/dndnext_sprite_export.py");
const exporterRunner = read("tools/blender/dndnext_sprite_export_runner.py");
const setup = read("tools/blender/dndnext_sprite_scene_setup.py");
const builder = read("tools/blender/dndnext_dawn_model_builder.py");
const refinement = read("tools/blender/dndnext_dawn_visual_refinement_v2.py");
const baselineCorrection = read("tools/blender/dndnext_dawn_baseline_correction_v2_1.py");
const prepare = read("tools/blender/dndnext_dawn_prepare_scene.py");
const windowsBuild = read("tools/blender/build_dawn_whiteflame.ps1");
const manifest = JSON.parse(read("tools/blender/manifests/dawn_whiteflame.sprite.json"));
const guide = read("tools/blender/README.md");
const dawnGuide = read("tools/blender/DAWN_PROCEDURAL_MODEL.md");
const artBible = read("docs/Sprite_Production_Art_Bible.md");
const workMap = read("docs/Sprite_Production_Work_Map.md");

const directionOrder = ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"];
const directionYaws = [0, -45, -90, -135, 180, 135, 90, 45];

assert(manifest.character_name === "Dawn Whiteflame", "Dawn manifest identity changed");
assert(manifest.sprite_format === "eight_direction_idle_walk_v1", "sprite format changed");
assert(manifest.frame_width === 64 && manifest.frame_height === 64, "cell dimensions must remain 64x64");
assert(manifest.columns === 4 && manifest.rows === 8, "atlas must remain 4 columns by 8 rows");
assert(JSON.stringify(manifest.direction_order) === JSON.stringify(directionOrder), "direction order is not canonical South-first");
assert(JSON.stringify(manifest.direction_yaws_degrees) === JSON.stringify(directionYaws), "direction yaw table changed");
assert(JSON.stringify(manifest.frame_labels) === JSON.stringify(["idle", "walk-a", "walk-b", "walk-c"]), "frame labels changed");
assert(JSON.stringify(manifest.pose_frames) === JSON.stringify([1, 7, 13, 19]), "Dawn pose frames changed");
assert(JSON.stringify(manifest.walk_sequence) === JSON.stringify([0, 1, 2, 3, 2, 1]), "walk sequence changed");
assert(manifest.render_engine === "CYCLES" && manifest.cycles?.device === "CPU", "Windows-safe Cycles CPU contract changed");
assert(manifest.cycles?.samples === 32 && manifest.cycles?.use_denoising === false, "deterministic Cycles settings changed");
assert(manifest.qa?.minimum_unique_rendered_frames_per_row === 3, "static-row rejection threshold must remain three frames");
assert(manifest.qa?.max_baseline_delta_px === 2, "strict two-pixel baseline QA must remain enabled");
assert(manifest.render_collection === "DawnWhiteflame_Sprite", "render collection changed");
assert(manifest.rotation_root === "DNDNext_SpriteRoot", "rotation root changed");
assert(manifest.camera_object === "DNDNext_OrthoCamera", "camera name changed");
assert(manifest.armature_object === "Dawn_Rig", "armature name changed");
assert(manifest.action_name === "Dawn_Walk", "action name changed");
assert(manifest.atlas_filename === "dawn-whiteflame.png", "atlas filename changed");

for (const token of [
  'POSE_LIBRARY_PROPERTY = "dndnext_pose_library_json"',
  "def _read_pose_library(",
  "def _apply_pose_snapshot(",
  "def _validate_distinct_pose_frames(",
  "def _rendered_pixel_hash(",
  "def _validate_non_static_rows(",
  "hashlib.sha256",
  "minimum_unique_rendered_frames_per_row",
  "bpy.ops.render.render(write_still=True)",
  "destination_y = (7 - row_index) * 64",
  "atlas_width, atlas_height = 256, 512",
  "DNDNext sprite export passed automatic QA.",
]) {
  assert(exporter.includes(token), `exporter is missing ${token}`);
}

for (const token of [
  'Path(__file__).with_name("dndnext_sprite_export.py")',
  "core._assign_action = assign_action_without_render_override",
  "armature.animation_data.action = None",
  "skip_duplicate_pose_preflight",
  "Detached Blender Action for deterministic pose rendering.",
]) {
  assert(exporterRunner.includes(token), `deterministic exporter runner is missing ${token}`);
}

for (const [key, label] of [
  ["down", "South"], ["down-left", "Southwest"], ["left", "West"], ["up-left", "Northwest"],
  ["up", "North"], ["up-right", "Northeast"], ["right", "East"], ["down-right", "Southeast"],
]) {
  assert(exporter.includes(`("${key}", "${label}")`), `exporter direction is missing ${label}`);
}

for (const token of [
  'COLLECTION_NAME = "DawnWhiteflame_Sprite"',
  'ROOT_NAME = "DNDNext_SpriteRoot"',
  'ARMATURE_NAME = "Dawn_Rig"',
  'ACTION_NAME = "Dawn_Walk"',
  'POSE_LIBRARY_PROPERTY = "dndnext_pose_library_json"',
  "POSE_FRAMES = (1, 7, 13, 19)",
  "DAWN_POSES = {",
  "def create_armature(",
  "def build_materials(",
  "def build_character(",
  "def store_pose_library(",
  "def create_walk_action(",
  "def verify_contract(",
  '"Dawn_Robe"',
  '"Dawn_Head"',
  '"Dawn_StaffShaft"',
  '"Dawn_FlameCore"',
  '"hand.R"',
  "action.use_fake_user=True",
  "bpy.ops.wm.save_as_mainfile",
]) {
  assert(builder.includes(token), `Dawn model builder is missing ${token}`);
}

for (const bone of [
  "root", "pelvis", "spine", "chest", "neck", "head",
  "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R", "forearm.R", "hand.R",
  "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R",
]) {
  assert(builder.includes(`bone("${bone}"`), `Dawn rig is missing bone ${bone}`);
}

for (const token of [
  'REFINEMENT_VERSION = "dawn_grounded_walk_v2"',
  "REFINED_POSES = {",
  '"root_location": (0.0, 0.0, -0.060)',
  "_apply_geometry_refinement",
]) {
  assert(refinement.includes(token), `Dawn visual refinement is missing ${token}`);
}

for (const token of [
  'CORRECTION_VERSION = "dawn_grounded_walk_v2_1_baseline"',
  "ROOT_HEIGHTS = {",
  "7: -0.020",
  "13: 0.018",
  "19: -0.020",
  "diagonal baseline QA drift",
  "root.keyframe_insert",
  "maxAllowedPixels",
]) {
  assert(baselineCorrection.includes(token), `Dawn baseline correction is missing ${token}`);
}

for (const token of [
  "def ensure_camera(", "def ensure_area_light(", "def ensure_root(", "def configure_scene(",
  'camera.data.type = "ORTHO"', 'scene.render.film_transparent = True',
  'scene.render.image_settings.color_mode = "RGBA"', 'scene.cycles.device = str(config.get("device", "CPU")).upper()',
  'bpy.ops.wm.save_as_mainfile', '"DNDNext_Key"', '"DNDNext_Fill"', '"DNDNext_Rim"',
]) {
  assert(prepare.includes(token), `Dawn scene preparation is missing ${token}`);
}

for (const token of [
  "Resolve-BlenderPath", "Build rigged Dawn prototype", "Apply Dawn visual refinement v2",
  "Normalize Dawn diagonal baseline v2.1", "Prepare Cycles CPU sprite scene",
  "Validate exporter hierarchy", "Probe first Cycles CPU frame", "Render 32 frames and assemble atlas",
  "dndnext_dawn_model_builder.py", "dndnext_dawn_visual_refinement_v2.py",
  "dndnext_dawn_baseline_correction_v2_1.py", "dndnext_dawn_prepare_scene.py", "dndnext_sprite_export.py",
  "dndnext_sprite_export_runner.py", "-MaxAttempts 2", "-RetryExitCodes @(11)",
  "dawn_whiteflame_model.blend", "dawn-whiteflame.qa.html", "--dry-run", "--keep-frames",
  "--gpu-backend", "opengl", "--debug-gpu-force-workarounds", "blender-last-crash.txt", "/admin/sprite-lab",
]) {
  assert(windowsBuild.includes(token), `Windows Dawn build pipeline is missing ${token}`);
}

for (const token of [
  "256 × 512 pixels", "S, SW, W, NW, N, NE, E, SE", "dndnext_sprite_export.py",
  "--dry-run", "dawn-whiteflame.qa.html", "/admin/sprite-lab",
]) {
  assert(guide.includes(token), `Blender operator guide is missing ${token}`);
}

for (const [source, token] of [
  [artBible, "Deterministic pose library"],
  [artBible, "Static rows are a build failure"],
  [dawnGuide, "first complete local Blender render"],
  [dawnGuide, "minimum of three unique rendered frames"],
  [workMap, "Completed work"],
  [workMap, "Current blocking work"],
  [workMap, "Remaining work"],
  [workMap, "Acceptance gates"],
  [workMap, "baseline correction v2.1"],
]) {
  assert(source.includes(token), `documentation is missing ${token}`);
}

for (const source of [exporter, exporterRunner, setup, builder, refinement, baselineCorrection, prepare]) {
  for (const forbidden of ["MapPageClient", "map_routes", "encounter_", "supabase", "requests.", "urllib.request", "subprocess.run", "os.system"]) {
    assert(!source.includes(forbidden), `offline Blender tooling crossed a protected/network boundary: ${forbidden}`);
  }
}

const python = process.platform === "win32" ? "python" : "python3";
const syntax = spawnSync(python, ["-m", "py_compile",
  "tools/blender/dndnext_dawn_model_builder.py",
  "tools/blender/dndnext_dawn_visual_refinement_v2.py",
  "tools/blender/dndnext_dawn_baseline_correction_v2_1.py",
  "tools/blender/dndnext_dawn_prepare_scene.py",
  "tools/blender/dndnext_sprite_scene_setup.py",
  "tools/blender/dndnext_sprite_export.py",
  "tools/blender/dndnext_sprite_export_runner.py",
], { encoding: "utf8" });
if (!syntax.error) assert(syntax.status === 0, `Python syntax validation failed: ${syntax.stderr || syntax.stdout}`);
else if (syntax.error.code !== "ENOENT") throw syntax.error;

console.log("Blender sprite export and deterministic Dawn animation validation passed.");
