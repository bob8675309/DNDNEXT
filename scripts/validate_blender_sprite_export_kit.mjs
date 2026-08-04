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
const cellPreparer = read("tools/blender/dndnext_sprite_prepare_isolated_cell.py");
const frameAssembler = read("tools/blender/dndnext_sprite_assemble_isolated_frames.py");
const setup = read("tools/blender/dndnext_sprite_scene_setup.py");
const builder = read("tools/blender/dndnext_dawn_model_builder.py");
const refinement = read("tools/blender/dndnext_dawn_visual_refinement_v3.py");
const prepare = read("tools/blender/dndnext_dawn_prepare_scene.py");
const windowsBuild = read("tools/blender/build_dawn_whiteflame.ps1");
const manifest = JSON.parse(read("tools/blender/manifests/dawn_whiteflame.sprite.json"));
const guide = read("tools/blender/README.md");
const dawnGuide = read("tools/blender/DAWN_PROCEDURAL_MODEL.md");
const artBible = read("docs/Sprite_Production_Art_Bible.md");
const workMap = read("docs/Sprite_Production_Work_Map.md");
const runLog = read("docs/Sprite_Production_Run_Log.md");

const directionOrder = ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"];
const directionYaws = [0, -45, -90, -135, 180, 135, 90, 45];

assert(manifest.character_name === "Dawn Whiteflame", "Dawn manifest identity changed");
assert(manifest.sprite_format === "eight_direction_idle_walk_v1", "sprite format changed");
assert(manifest.visual_refinement_version === "dawn_humanoid_walk_v3", "Dawn refinement version changed");
assert(manifest.render_strategy === "isolated_prepared_blend_per_cell_v1", "isolated render strategy changed");
assert(manifest.frame_width === 64 && manifest.frame_height === 64, "cell dimensions must remain 64x64");
assert(manifest.columns === 4 && manifest.rows === 8, "atlas must remain 4 columns by 8 rows");
assert(JSON.stringify(manifest.direction_order) === JSON.stringify(directionOrder), "direction order is not canonical South-first");
assert(JSON.stringify(manifest.direction_yaws_degrees) === JSON.stringify(directionYaws), "direction yaw table changed");
assert(JSON.stringify(manifest.frame_labels) === JSON.stringify(["idle", "walk-a", "walk-b", "walk-c"]), "frame labels changed");
assert(JSON.stringify(manifest.pose_frames) === JSON.stringify([1, 7, 13, 19]), "Dawn pose frames changed");
assert(JSON.stringify(manifest.walk_sequence) === JSON.stringify([0, 1, 2, 3, 2, 1]), "walk sequence changed");
assert(manifest.fps === 6, "Dawn v3 preview/runtime speed must remain six FPS");
assert(manifest.render_engine === "CYCLES" && manifest.cycles?.device === "CPU", "Windows-safe Cycles CPU contract changed");
assert(manifest.cycles?.samples === 32 && manifest.cycles?.use_denoising === false, "deterministic Cycles settings changed");
assert(manifest.qa?.minimum_unique_rendered_frames_per_row === 3, "static-row rejection threshold must remain three frames");
assert(manifest.qa?.max_baseline_delta_px === 2, "strict two-pixel baseline QA must remain enabled");
assert(manifest.qa?.auto_normalize_baseline === false, "Dawn final candidates must not shift rendered frames");
assert(manifest.qa?.max_auto_baseline_shift_px === 0, "Dawn final candidates must have zero post-render shift allowance");

for (const token of [
  'POSE_LIBRARY_PROPERTY = "dndnext_pose_library_json"',
  "def _read_pose_library(",
  "def _apply_pose_snapshot(",
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
  "armature.animation_data.action = None",
  "skip_duplicate_pose_preflight",
  "Detached Blender Action for deterministic pose rendering.",
]) {
  assert(exporterRunner.includes(token), `deterministic exporter runner is missing ${token}`);
}

for (const token of [
  "Prepare one deterministic DNDNext sprite cell as a pose-frozen blend",
  "preserves intentional render visibility",
  "Isolated cell preparation requires a deterministic pose library.",
  "obj.name not in renderable_names",
  "not obj.hide_render",
  "Render collection has no intentionally visible geometry.",
  "armature.animation_data.action = None",
  "core._apply_pose_snapshot",
  'scene["dndnext_isolated_sprite_cell"]',
  '"renderStrategy"',
  '"visibleRenderableCount"',
  "scene.frame_start = 1",
  "scene.frame_end = 1",
  "bpy.ops.wm.save_as_mainfile",
  "Prepared isolated sprite cell",
]) {
  assert(cellPreparer.includes(token), `isolated cell preparer is missing ${token}`);
}
assert(!cellPreparer.includes("bpy.ops.render.render"), "cell preparation must not render inside the pose-freezing process");

for (const token of [
  "Required isolated frame is missing",
  "Unexpected PNG files remain in the isolated frames directory",
  "core._alpha_metrics",
  "core._validate_metrics",
  "core._validate_non_static_rows",
  "core._assemble_atlas",
  "core._write_metadata",
  "core._write_preview",
  "core._write_report",
  '"render_strategy"',
  '"renderStrategy"',
  "DNDNext isolated frame assembly passed automatic QA.",
]) {
  assert(frameAssembler.includes(token), `isolated frame assembler is missing ${token}`);
}
assert(!frameAssembler.includes("bpy.ops.render.render"), "frame assembler must not rerender or alter model poses");

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
  '"Dawn_Head"',
  '"Dawn_StaffShaft"',
  '"Dawn_FlameCore"',
  '"hand.R"',
  "action.use_fake_user=True",
  "bpy.ops.wm.save_as_mainfile",
]) {
  assert(builder.includes(token), `Dawn model builder is missing ${token}`);
}

for (const token of [
  'REFINEMENT_VERSION = "dawn_humanoid_walk_v3"',
  "REFINED_POSES = {",
  '"root_location": (0.0, 0.0, 0.0)',
  "_hide_legacy_cone_silhouette",
  "_rebuild_humanoid_silhouette",
  '"DawnV3_Tunic"',
  '"DawnV3_FrontPanel.L"',
  '"DawnV3_Thigh.L"',
  "staff pose remains fixed",
]) {
  assert(refinement.includes(token), `Dawn v3 refinement is missing ${token}`);
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
  "Resolve-BlenderPath", "Build rigged Dawn prototype", "Apply Dawn humanoid refinement v3",
  "Prepare Cycles CPU sprite scene", "Validate exporter hierarchy", "Probe first Cycles CPU frame",
  "Prepare isolated cell $cellNumber of 32", "Render isolated cell $cellNumber of 32",
  "Assemble isolated frames and run QA", "dndnext_sprite_prepare_isolated_cell.py",
  "dndnext_sprite_assemble_isolated_frames.py", "isolated-cell-blends",
  "--render-output", "--render-frame", "Move-Item $nativeFrame $finalFrame -Force",
  "-MaxAttempts 2", "-RetryExitCodes @(11)", "if ($exitCode -eq 11)",
  "retrying only this isolated cell", "finally", "Remove-Item $CellBlendDir -Recurse -Force",
  "dawn_whiteflame_model.blend", "dawn-whiteflame.qa.html", "--dry-run",
  "--gpu-backend", "opengl", "--debug-gpu-force-workarounds", "blender-last-crash.txt", "/admin/sprite-lab",
]) {
  assert(windowsBuild.includes(token), `Windows isolated Dawn pipeline is missing ${token}`);
}
assert(!windowsBuild.includes("Render 32 frames and assemble atlas"), "monolithic 32-frame batch must not remain active");
assert(!windowsBuild.includes("--keep-frames"), "isolated pipeline must not invoke the monolithic exporter render path");
assert(!windowsBuild.includes("Normalize bounded rendered baseline"), "Dawn final candidates must not shift rendered PNG frames");

for (const token of [
  "256 × 512 pixels", "S, SW, W, NW, N, NE, E, SE", "dndnext_sprite_export.py",
  "--dry-run", "dawn-whiteflame.qa.html", "/admin/sprite-lab",
]) {
  assert(guide.includes(token), `Blender operator guide is missing ${token}`);
}

for (const [source, token] of [
  [artBible, "Deterministic pose library"],
  [artBible, "Static rows are a build failure"],
  [artBible, "Visual approval is separate from automatic QA"],
  [artBible, "Isolated cell rendering"],
  [dawnGuide, "first complete local Blender render"],
  [workMap, "Completed work"],
  [workMap, "Current blocking work"],
  [workMap, "Remaining work"],
  [workMap, "Acceptance gates"],
  [workMap, "Isolated cell rendering"],
  [runLog, "Run 8"],
  [runLog, "isolated prepared-blend rendering"],
]) {
  assert(source.includes(token), `documentation is missing ${token}`);
}

for (const source of [exporter, exporterRunner, cellPreparer, frameAssembler, setup, builder, refinement, prepare]) {
  for (const forbidden of ["MapPageClient", "map_routes", "encounter_", "supabase", "requests.", "urllib.request", "subprocess.run", "os.system"]) {
    assert(!source.includes(forbidden), `offline Blender tooling crossed a protected/network boundary: ${forbidden}`);
  }
}

const python = process.platform === "win32" ? "python" : "python3";
const syntax = spawnSync(python, ["-m", "py_compile",
  "tools/blender/dndnext_dawn_model_builder.py",
  "tools/blender/dndnext_dawn_visual_refinement_v3.py",
  "tools/blender/dndnext_dawn_prepare_scene.py",
  "tools/blender/dndnext_sprite_scene_setup.py",
  "tools/blender/dndnext_sprite_export.py",
  "tools/blender/dndnext_sprite_export_runner.py",
  "tools/blender/dndnext_sprite_prepare_isolated_cell.py",
  "tools/blender/dndnext_sprite_assemble_isolated_frames.py",
], { encoding: "utf8" });
if (!syntax.error) assert(syntax.status === 0, `Python syntax validation failed: ${syntax.stderr || syntax.stdout}`);
else if (syntax.error.code !== "ENOENT") throw syntax.error;

console.log("Blender sprite export and isolated Dawn cell rendering validation passed.");
