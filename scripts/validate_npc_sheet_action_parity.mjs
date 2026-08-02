import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = read("pages/npcs.js");
const panel = read("components/NpcPanel.js");
const sheet = read("components/CharacterSheet5e.js");
const hook = read("hooks/useNpcSheetActionData.js");
const roll = read("components/CharacterSheetRollResult.js");
const css = read("styles/character-sheet-actions.css");
const runner = read("scripts/vercel_build_v2.mjs");

assert(page.includes('useNpcSheetActionData'), "NPC page must use the guarded supplemental action-data hook");
for (const prop of ["inventoryItems={npcSheetActions.inventoryRows}", "spellActions={npcSheetActions.spellActions}", "featureRows={npcSheetActions.featureRows}", "actionsLoading={npcSheetActions.loading}", "onActionCommand={npcSheetActions.canCommand ? npcSheetActions.handleActionCommand : null}", "actionBusyKey={npcSheetActions.busyKey}"]) {
  assert(page.includes(prop), `NPC page is missing CharacterSheetPanel action prop: ${prop}`);
}
assert(page.includes('<CharacterSheetRollResult roll={lastRoll}'), "NPC page must use the shared roll-result presentation");
assert(panel.includes('<CharacterSheetRollResult roll={lastRoll}'), "NPC profile panel must use the shared roll-result presentation");
assert(roll.includes("formatCharacterSheetDamage") && roll.includes("sheet-last-roll__damage"), "Shared roll result must render damage");
assert(hook.includes("requestRef.current === requestId") && hook.includes("activeIdRef.current === id"), "Action hook must guard by request id and character identity");
assert(hook.includes('get_character_inventory_v1') && hook.includes('character_spells') && hook.includes('buildCharacterSheetFeatures'), "Action hook must load inventory, spells, and resolved features");
assert(hook.includes('update_character_sheet_action_state_v1'), "Action hook must use the guarded standalone feature RPC");
assert(sheet.includes("function CollapsibleActionGroup") && sheet.includes('<CollapsibleActionGroup key={group} title={group}>'), "Action subsections must be independently collapsible");
assert(css.includes(".csheet-action-group__body") && css.includes(".csheet-action-group__chevron"), "Action subsection styles are missing");
assert(runner.includes('validate_npc_sheet_action_parity.mjs'), "Production build runner must include the NPC action parity validator");
assert(!page.includes("MapPageClient"), "NPC parity patch must not introduce world-map code");

console.log("NPC sheet action parity validation passed.");
