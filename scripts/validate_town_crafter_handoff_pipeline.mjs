import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function fail(message) {
  throw new Error(`Town crafter handoff pipeline: ${message}`);
}

function requireToken(source, token, label) {
  if (!source.includes(token)) fail(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) fail(`${label}: forbidden ${token}`);
}

const runner = read("scripts/vercel_build_v2.mjs");
const townPage = read("pages/town/[id].js");
const townSheet = read("components/TownSheet.js");
const css = read("styles/npc-profile-panel.css");
const characterPanel = read("components/character/CharacterInteractionPanel.js");

for (const token of [
  "scripts/patch_town_profile_crafter_ui_v1.mjs",
  "scripts/patch_town_crafter_native_polish_v1.mjs",
  "scripts/validate_town_profile_parent_panel.mjs",
  "scripts/diagnose_town_shared_craft_patch_targets.mjs",
  "scripts/patch_town_crafter_shared_craft_panel_v1.mjs",
]) requireAbsent(runner, token, "source-baked runner cleanup");

requireToken(runner, "scripts/validate_town_crafter_shared_craft_panel.mjs", "runner keeps final shared Craft validator");

for (const token of [
  "const CharacterInteractionPanel = dynamic(() => import(\"../../components/character/CharacterInteractionPanel\"), { ssr: false });",
  "function townCrafterDisciplineFor(character) {",
  "if (types.includes(\"blacksmith\")) return \"Smithing\";",
  "if (types.includes(\"alchemist\")) return \"Alchemy\";",
  "if (types.includes(\"enchanter\")) return \"Enchanting\";",
  "craft_profession: craftProfession",
  "<CharacterInteractionPanel",
  "character={activeTownProfileCharacter}",
  "initialView={activeTownProfileView}",
]) requireToken(townPage, token, "final town route shared Craft handoff");

for (const token of [
  "const NpcPanel = dynamic(() => import(\"../../components/NpcPanel\"), { ssr: false });",
  "<NpcPanel",
  "router.push(\`/npcs",
  "router.replace(\`/npcs",
  "<iframe",
]) requireAbsent(townPage, token, "final town route shared Craft handoff");

requireToken(townSheet, "onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, \"craft\")}", "final TownSheet shared Craft dispatch");
requireToken(townSheet, "Legacy CrafterWorkshopModal retired", "final TownSheet legacy modal retirement");

for (const token of [
  "activeWorkshopCrafter ? <CrafterWorkshopModal",
  "typeof onOpenCharacterProfile === \"function\" ? onOpenCharacterProfile(crafter, \"craft\") : setActiveWorkshopCrafter(crafter)",
  "import CharacterInteractionPanel",
  "import CraftingWorkspace",
  "<CharacterInteractionPanel",
  "<iframe",
]) requireAbsent(townSheet, token, "TownSheet dispatcher-only boundary");

for (const token of [
  "const CraftingWorkspace = dynamic(() => import(\"../CraftingWorkspace\"), { ssr: false });",
  "React.createElement(CraftingWorkspace, {",
  "disciplineLock: craftProfession",
  "showDisciplineSwitcher: false",
]) requireToken(characterPanel, token, "CharacterInteractionPanel real Craft workspace handoff");

for (const token of [
  "/* ===== Town NPC profile and crafter storefront v1 ===== */",
  "/* ===== Town route profile side panel v1 ===== */",
  "/* ===== Town native crafter storefront polish v1 ===== */",
]) requireToken(css, token, "town profile/crafter CSS source bake");

console.log("Town crafter handoff pipeline final source-bake validated.");
