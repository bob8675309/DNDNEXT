import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

const runner = read("scripts/vercel_build_v2.mjs");
const townPage = read("pages/town/[id].js");
const townSheet = read("components/TownSheet.js");
const npcPage = read("pages/npcs.js");
const mapClient = exists("components/MapPageClient.js") ? read("components/MapPageClient.js") : "";
const itemsPage = read("pages/items.js");
const craftingWorkspace = exists("components/CraftingWorkspace.js") ? read("components/CraftingWorkspace.js") : "";

function fail(message) {
  throw new Error(`Large-file source-bake readiness: ${message}`);
}

function hasAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

const checks = [
  {
    name: "NPC page profile panel wrapper adoption",
    files: ["pages/npcs.js"],
    sourceBaked: hasAll(npcPage, [
      'import NpcPanel from "../components/character/CharacterInteractionPanel";',
      '{profilePanelOpen && selected ? (',
      '<div className="npc-page-profile-panel-shell">',
      'initialView={profilePanelInitialView}',
    ]) && !npcPage.includes('import NpcPanel from "../components/NpcPanel";'),
    requiredWhileUnbaked: [
      "scripts/validate_npc_page_panel_wrapper_adoption.mjs",
    ],
  },
  {
    name: "Town route loading guard",
    files: ["pages/town/[id].js"],
    sourceBaked: hasAll(townPage, [
      "if (!router.isReady) return;",
      "setLocation(loc);\n        setLoading(false);",
      "player plants load timed out; rendering town sheet without plant cache",
      "}, [router.isReady, id]);",
    ]),
    requiredWhileUnbaked: ["scripts/patch_town_route_loading_guard_v3.mjs"],
  },
  {
    name: "Town crafter shared profile-panel handoff",
    files: ["pages/town/[id].js", "components/TownSheet.js"],
    sourceBaked: hasAll(townPage, [
      'const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });',
      "function townCrafterDisciplineFor(character) {",
      "<CharacterInteractionPanel",
      "initialView={activeTownProfileView}",
    ]) && hasAll(townSheet, [
      'onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")}',
      "Legacy CrafterWorkshopModal retired",
    ]) && !townSheet.includes("activeWorkshopCrafter ? <CrafterWorkshopModal"),
    requiredWhileUnbaked: [
      "scripts/patch_town_profile_crafter_ui_v1.mjs",
      "scripts/patch_town_crafter_native_polish_v1.mjs",
      "scripts/patch_town_crafter_shared_craft_panel_v1.mjs",
      "scripts/validate_town_crafter_shared_craft_panel.mjs",
    ],
  },
  {
    name: "CraftingWorkspace generated extraction cleanup",
    files: ["pages/items.js", "components/CraftingWorkspace.js"],
    sourceBaked: !runner.includes("scripts/extract_crafting_workspace_phase1.mjs")
      && craftingWorkspace.includes("export default function CraftingWorkspace")
      && !itemsPage.includes("function ItemsPage"),
    requiredWhileUnbaked: [
      "scripts/extract_crafting_workspace_phase1.mjs",
      "scripts/patch_crafting_workspace_lock_v1.mjs",
      "scripts/patch_npc_crafter_panel_recipe_ui_v4.mjs",
      "scripts/patch_crafting_load_timeouts_v1.mjs",
    ],
  },
  {
    name: "Map/page boot loading consolidation",
    files: ["components/MapPageClient.js", "pages/npcs.js"],
    sourceBaked: !runner.includes("scripts/patch_route_loading_guards_v1.mjs")
      && !runner.includes("scripts/patch_map_nonblocking_boot_v1.mjs"),
    requiredWhileUnbaked: [
      "scripts/patch_route_loading_guards_v1.mjs",
      "scripts/patch_map_nonblocking_boot_v1.mjs",
      "scripts/validate_map_profile_character_interaction.mjs",
    ],
  },
];

let unbakedCount = 0;
for (const check of checks) {
  if (check.sourceBaked) {
    console.log(`READY/BAKED: ${check.name} (${check.files.join(", ")})`);
    for (const token of check.requiredWhileUnbaked || []) {
      if (runner.includes(token) && token.includes("patch_")) {
        console.warn(`- Candidate cleanup: ${token} still runs although source markers look baked.`);
      }
    }
    continue;
  }

  unbakedCount += 1;
  console.log(`UNBAKED: ${check.name} (${check.files.join(", ")})`);
  for (const token of check.requiredWhileUnbaked || []) {
    if (!runner.includes(token)) fail(`${check.name} is not source-baked but runner is missing ${token}`);
  }
}

const requiredEightDirectionMapTokens = [
  'import MapSprite from "./MapSprite";',
  'import { EIGHT_DIRECTION_ORDER, spriteDirectionFromVelocity } from "../utils/spriteAnimation";',
  'sprite_format: "eight_direction_idle_walk_v1"',
  'frame_width: 64',
  'frame_height: 64',
  'walk_frames: [1, 2, 3]',
  'fps: 7',
  'const hasSprite = !!m.visual_asset_id && !!m.sprite_path;',
  'const hasSprite = !!n.visual_asset_id && !!n.sprite_path;',
  'asset={MAP_SPRITE_ASSET}',
  'mapSpriteDirFromVelocity',
];
for (const token of requiredEightDirectionMapTokens) {
  if (!mapClient.includes(token)) fail(`unified 8-direction MapPageClient is missing ${token}`);
}

for (const forbidden of [
  "SPRITE_FRAME_W",
  "SPRITE_FRAME_H",
  "SPRITE_FRAMES_PER_DIR",
  "SPRITE_DIR_ORDER",
  "function spriteDirFromVelocity(",
  "legacy_4dir",
  "LEGACY_MAP_SPRITE_ASSET",
]) {
  if (mapClient.includes(forbidden)) fail(`legacy sprite renderer token survived in MapPageClient: ${forbidden}`);
}

if (!mapClient.includes('import { useInterpolatedPoses } from "../hooks/useInterpolatedPoses";')) {
  fail("world movement interpolation hook disappeared during sprite renderer cutover");
}

console.log("Unified 8-direction MapPageClient runtime validated.");
console.log(`Large-file source-bake readiness validated. Unbaked large targets: ${unbakedCount}.`);
