import fs from "node:fs";

function replaceExact(path, from, to, label) {
  const source = fs.readFileSync(path, "utf8");
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceExact(
  "components/NewNpcModalV3.js",
  ".unified-player-character-forge .npc-forge-backdrop{position:static!important;inset:auto!important;display:block!important;width:100%!important;height:auto!important;min-height:0!important;padding:0!important;background:none!important;backdrop-filter:none!important}.unified-player-character-forge .npc-forge-modal-v2{width:100%!important;max-width:none!important}",
  ".player-character-forge-host .unified-player-character-forge .npc-forge-backdrop{position:static!important;inset:auto!important;display:block!important;width:100%!important;height:auto!important;min-height:0!important;padding:0!important;background:none!important;backdrop-filter:none!important}.player-character-forge-host .unified-player-character-forge .npc-forge-modal-v2{width:100%!important;max-width:none!important}",
  "scope embedded Forge layout to profile host"
);

replaceExact(
  "components/PlayerCharacterCreatorV2.js",
  "  onCancel = null,\n}) {",
  "  onCancel = null,\n  show = true,\n}) {",
  "add player creator visibility prop"
);
replaceExact(
  "components/PlayerCharacterCreatorV2.js",
  "    <NewNpcModalV3\n      show\n",
  "    <NewNpcModalV3\n      show={show}\n",
  "route visibility prop into shared Forge"
);

replaceExact(
  "components/PlayerCharacterProfilePanelUnified.js",
  '<PlayerCharacterCreator key={sessionUser.id} defaultName={character ? "" : playerName} onCreated={handleCharacterCreated} onCancel={cancelCreator} />',
  '<PlayerCharacterCreator key={sessionUser.id} show={open && showCreator && !showLoading} defaultName={character ? "" : playerName} onCreated={handleCharacterCreated} onCancel={cancelCreator} />',
  "bind portalled Forge visibility to profile lifecycle"
);

replaceExact(
  "scripts/validate_npc_page_panel_wrapper_adoption.mjs",
  'const forgeSource = read("components", "NewNpcModalV3Refined.js");\nconst portraitPickerSource',
  'const forgeSource = read("components", "NewNpcModalV3Refined.js");\nconst forgeWrapperSource = read("components", "NewNpcModalV3.js");\nconst playerCreatorSource = read("components", "PlayerCharacterCreatorV2.js");\nconst portraitPickerSource',
  "load Forge wrapper lifecycle sources"
);
replaceExact(
  "scripts/validate_npc_page_panel_wrapper_adoption.mjs",
  'requireContains(playerProfileSource, "accountContent={accountContent}", "Account view content routing");',
  'requireContains(playerProfileSource, "accountContent={accountContent}", "Account view content routing");\nrequireContains(playerProfileSource, "show={open && showCreator && !showLoading}", "portalled Forge profile visibility gate");\nrequireContains(playerCreatorSource, "show = true", "player creator visibility prop");\nrequireContains(playerCreatorSource, "show={show}", "player creator shared Forge visibility routing");\nrequireContains(forgeWrapperSource, ".player-character-forge-host .unified-player-character-forge .npc-forge-backdrop{position:static!important", "embedded-only Forge static backdrop scope");\nrequireContains(forgeWrapperSource, ".player-character-forge-host .unified-player-character-forge .npc-forge-modal-v2{width:100%!important", "embedded-only Forge width scope");',
  "guard portal host compatibility"
);

const docPath = "docs/CHARACTER_FORGE_VIEWPORT_PORTAL_FIX.md";
let doc = fs.readFileSync(docPath, "utf8");
const note = `\n## Portal host compatibility correction\n\nVideo review immediately after the viewport portal change exposed two compatibility assumptions that were still tied to the old embedded DOM hierarchy. The legacy player-host CSS was matching the new portal wrapper and forcing its backdrop back to static flow plus a 100% embedded width, and the persistent creator stayed mounted even when its parent profile host was hidden. Because a React portal is no longer a DOM descendant of that hidden host, the Forge could remain visible behind the character profile or after navigation.\n\nThe embedded-layout selectors are now scoped specifically through \`.player-character-forge-host\`, so the body-level portal uses the normal fixed application-window backdrop and centered modal sizing. The persistent creator also receives an explicit \`show\` signal from \`PlayerCharacterProfilePanelUnified\`, tied to \`open && showCreator && !showLoading\`. This hides/unmounts only the portal surface while leaving the creator component mounted, preserving the existing in-memory Forge draft state across panel close/reopen.\n\nNo character rules, Class/subclass authority, Supabase data, world/town map behavior, crafting, travel, inventory, merchant, tactical, or encounter runtime is changed by this correction.\n`;
if (!doc.includes("## Portal host compatibility correction")) {
  doc += note;
  fs.writeFileSync(docPath, doc);
}

console.log("Forge portal host compatibility patch materialized.");
