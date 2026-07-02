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

function requireOrder(source, tokens, label) {
  let last = -1;
  for (const token of tokens) {
    const index = source.indexOf(token);
    if (index < 0) fail(`${label}: missing ${token}`);
    if (index <= last) fail(`${label}: ${token} is out of order`);
    last = index;
  }
}

const runner = read("scripts/vercel_build_v2.mjs");
const profilePatch = read("scripts/patch_town_profile_crafter_ui_v1.mjs");
const sharedPatch = read("scripts/patch_town_crafter_shared_craft_panel_v1.mjs");
const parentValidator = read("scripts/validate_town_profile_parent_panel.mjs");
const sharedValidator = read("scripts/validate_town_crafter_shared_craft_panel.mjs");
const townPage = read("pages/town/[id].js");
const townSheet = read("components/TownSheet.js");

requireOrder(
  runner,
  [
    "scripts/patch_town_profile_crafter_ui_v1.mjs",
    "scripts/patch_town_crafter_native_polish_v1.mjs",
    "scripts/validate_town_profile_parent_panel.mjs",
    "scripts/diagnose_town_shared_craft_patch_targets.mjs",
    "scripts/patch_town_crafter_shared_craft_panel_v1.mjs",
    "scripts/validate_town_crafter_shared_craft_panel.mjs",
  ],
  "Vercel runner town crafter handoff sequence"
);

for (const token of [
  "pages/town/[id].js",
  "components/TownSheet.js",
  "components/MapPageClient.js",
  "components/LocationSideBar.js",
  "styles/npc-profile-panel.css",
  "function replaceOnce(source, before, after, label)",
  "console.warn(`${label}: expected one match, found ${count}; leaving source unchanged.`)",
  "const NpcPanel = dynamic(() => import(\"../../components/NpcPanel\"), { ssr: false });",
  "function MerchantLinkRow({ merchant, onBrowseWares, onOpenProfile, onOpenShop })",
  "function CrafterRow({ crafter, onOpenWorkshop, onOpenProfile })",
  "{activeWorkshopCrafter ? <CrafterWorkshopModal",
]) {
  requireToken(profilePatch, token, "profile-side town crafter patch target map");
}

for (const token of [
  "pages/town/[id].js",
  "components/TownSheet.js",
  "const CharacterInteractionPanel = dynamic(() => import(\"../../components/character/CharacterInteractionPanel\"), { ssr: false });",
  "function townCrafterDisciplineFor(character) {",
  "onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, \"craft\")}",
  "Legacy CrafterWorkshopModal retired",
]) {
  requireToken(sharedPatch, token, "shared Craft panel patch target map");
}

for (const token of [
  "const NpcPanel = dynamic(() => import(\"../../components/NpcPanel\"), { ssr: false });",
  "<NpcPanel",
  "const CharacterInteractionPanel = dynamic(() => import(\"../../components/character/CharacterInteractionPanel\"), { ssr: false });",
  "<CharacterInteractionPanel",
  "{activeWorkshopCrafter ? <CrafterWorkshopModal",
]) {
  requireToken(parentValidator, token, "parent boundary validator");
}

for (const token of [
  "const CharacterInteractionPanel = dynamic(() => import(\"../../components/character/CharacterInteractionPanel\"), { ssr: false });",
  "function townCrafterDisciplineFor(character) {",
  "onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, \"craft\")}",
  "activeWorkshopCrafter ? <CrafterWorkshopModal",
  "const NpcPanel = dynamic(() => import(\"../../components/NpcPanel\"), { ssr: false });",
  "TownSheet must remain dispatcher-only",
]) {
  requireToken(sharedValidator, token, "shared Craft boundary validator");
}

const finalTownPageSourceBaked = townPage.includes("const CharacterInteractionPanel = dynamic(() => import(\"../../components/character/CharacterInteractionPanel\"), { ssr: false });")
  && townPage.includes("function townCrafterDisciplineFor(character) {")
  && townPage.includes("<CharacterInteractionPanel")
  && townPage.includes("initialView={activeTownProfileView}");

const finalTownSheetSourceBaked = townSheet.includes("onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, \"craft\")}")
  && townSheet.includes("Legacy CrafterWorkshopModal retired")
  && !townSheet.includes("activeWorkshopCrafter ? <CrafterWorkshopModal");

if (!finalTownPageSourceBaked || !finalTownSheetSourceBaked) {
  for (const token of [
    "scripts/patch_town_profile_crafter_ui_v1.mjs",
    "scripts/patch_town_crafter_native_polish_v1.mjs",
    "scripts/patch_town_crafter_shared_craft_panel_v1.mjs",
  ]) requireToken(runner, token, "runner must keep town crafter mutators until source bake exists");
} else {
  requireAbsent(runner, "scripts/patch_town_profile_crafter_ui_v1.mjs", "source-baked runner cleanup");
  requireAbsent(runner, "scripts/patch_town_crafter_shared_craft_panel_v1.mjs", "source-baked runner cleanup");
}

for (const forbidden of [
  "scripts/patch_town_crafter_shared_craft_panel_v1.mjs\"],\n  [\"node\", [\"scripts/validate_town_profile_parent_panel.mjs",
]) {
  if (runner.includes(forbidden)) fail(`runner validates the wrong boundary ordering near ${forbidden}`);
}

console.log("Town crafter handoff pipeline validated.");
