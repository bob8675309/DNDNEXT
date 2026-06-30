import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}
function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}
function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

const workspace = read("components/CraftingWorkspace.js");
const characterPanel = read("components/character/CharacterInteractionPanel.js");
const app = read("pages/_app.js");
const css = read("styles/npc-crafter-panel-recipe-ui.css");

for (const token of [
  'isAdmin = false',
  'function recipeIdForKnownSave',
  'function normalizeKnownRecipeRow',
  'function RecipeSortHeader',
  'canEditKnown={isAdmin && isNpcCrafterPanel}',
  'onToggleKnown={toggleCrafterKnownRecipe}',
  'npc_known_recipes',
  '.select("recipe_id")',
  '.upsert({ character_id: crafterId, recipe_id: recipeId }, { onConflict: "character_id,recipe_id" })',
  '.delete()',
  'crafterGate',
  'craft-page-panel-mode',
  'panelCraftTabs',
  '["recipes", "forage", "mastery"]',
  'Assisting Crafter',
]) requireToken(workspace, token, "NPC crafter panel recipe UI workspace");

for (const token of [
  'isAdmin: !!props?.isAdmin',
  'React.createElement(CraftingWorkspace, {',
  'showDisciplineSwitcher: false',
]) requireToken(characterPanel, token, "CharacterInteractionPanel passes admin to CraftingWorkspace");

for (const token of [
  'npc-crafter-panel-recipe-ui.css',
]) requireToken(app, token, "App imports NPC crafter panel styles");

for (const token of [
  '.craft-page-panel-mode .craft-controls',
  '.craft-page-panel-mode .craft-pills',
  '.craft-known-check',
  '.craft-sort-header',
]) requireToken(css, token, "NPC crafter panel recipe UI CSS");

for (const token of [
  'TABS.map(([id, icon, label]) => <button key={id} type="button" className={cls("craft-tab", activeTab === id && "craft-tab-active")} onClick={() => setActiveTab(id)}',
  'known_recipe:',
  'function crafterKnownKeysFrom',
  'crafterTagsKey',
  'supabase.from("characters").update({ tags:',
]) requireAbsent(workspace, token, "CraftingWorkspace should use DB-backed known recipe access and panel-filtered tabs");

console.log("NPC crafter panel recipe UI validated.");
