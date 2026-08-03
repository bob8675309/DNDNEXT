import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanImportedText(value) {
  return String(value ?? "")
    .replace(/\|[A-Z][A-Z0-9]{1,15}\b/g, "")
    .replace(/\[[A-Z][A-Z0-9]{1,15}\]/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeActionCostText(value) {
  return cleanImportedText(value)
    .replace(/\b1 bonus(?: action)?\b/gi, "Bonus Action")
    .replace(/\b1 action\b/gi, "Action")
    .replace(/\b1 reaction(?:,[^•]*)?/gi, "Reaction")
    .replace(/\s*•\s*/g, " • ");
}

function isTrackedSlotDetail(value) {
  return /^\d+(?:\/\d+)?\s+level-\d+\s+(?:pact\s+)?slots$/i.test(String(value || "").trim());
}

const page = read("pages/npcs.js");
const app = read("pages/_app.js");
const panel = read("components/NpcPanel.js");
const sheet = read("components/CharacterSheet5e.js");
const hook = read("hooks/useNpcSheetActionData.js");
const roll = read("components/CharacterSheetRollResult.js");
const spellDetailsBridge = read("components/CharacterSheetSpellDetailsBridge.js");
const enhancementSource = read("components/CharacterSheetEnhancements.js");
const resourceTracker = read("components/CharacterSheetResourceTracker.js");
const resourceStyles = read("styles/CharacterSheetResourceTracker.module.css");
const resourceMigration = read("sql/20260802_03_character_sheet_spell_resources.sql");
const css = read("styles/character-sheet-actions.css");
const profileCss = read("styles/npc-profile-panel.css");
const enhancementStyles = read("styles/character-sheet-enhancements.css");
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
assert(panel.includes("npc-profile-description-with-portrait") && panel.includes("npc-profile-description-thumb"), "Shared Profile view must keep the portrait inside the Description card");
assert(!panel.includes('<div className="npc-card-title">About</div>'), "Shared Profile view must not retain the duplicate About card");
assert(panel.includes('visibleLoreFields.filter((entry) => entry.key !== "description")'), "Description must not be duplicated in the supplemental lore grid");
assert(profileCss.includes("Inline profile Description portrait v1") && profileCss.includes("object-position: center top"), "Shared Profile portrait layout styles are missing");
assert(enhancementStyles.includes("align-content: start") && enhancementStyles.includes("font-size: 0.82rem"), "Pinned Description must stay top-aligned with readable body text");

assert(cleanImportedText("Hit Points|XPHB and Bonus Action[XPHB].") === "Hit Points and Bonus Action.", "Spell details must remove inline and bracketed source markers");
assert(normalizeActionCostText("Resolve effect • 90 feet • 1 bonus • 2 pact slots").includes("Bonus Action"), "Spell summaries must normalize bonus-action costs");
assert(normalizeActionCostText("Resolve effect • Self • 1 reaction, which you take when hit • long rest").includes("Reaction • long rest"), "Spell summaries must normalize reaction costs");
assert(normalizeActionCostText("Resolve effect • 30 feet • 1 action").endsWith("Action"), "Spell summaries must normalize action costs");
assert(isTrackedSlotDetail("2 level-3 pact slots"), "legacy pact-slot detail line must be recognized for removal");
assert(isTrackedSlotDetail("1/3 level-1 slots"), "tracked standard-slot detail line must be recognized for removal");
assert(!isTrackedSlotDetail("1/1 uses • long rest"), "limited spell-use details must remain visible");
for (const token of [
  'new Set(["cantrips", "prepared spells"])',
  'data-sheet-spell-action',
  'Cost: ${cost}',
  'Full spell description pinned in Description.',
  'removeTrackedSlotLines(details)',
  '.csheet-pinned-description',
  'MutationObserver',
  'cleanTextNodes(sheet)',
]) {
  assert(spellDetailsBridge.includes(token), `Spell details bridge is missing required contract: ${token}`);
}
assert(app.includes('import CharacterSheetSpellDetailsBridge from "../components/CharacterSheetSpellDetailsBridge";'), "App shell must import the spell details bridge");
assert(app.includes("<CharacterSheetSpellDetailsBridge />"), "App shell must mount the spell details bridge");
assert(!spellDetailsBridge.includes("MapPageClient"), "Spell details bridge must not introduce world-map behavior");

for (const token of [
  'CharacterSheetResourceTracker',
  'character_sheet_resource_profile_v1',
  'update_character_spell_slot_v1',
  'update_character_spell_use_v1',
  'complete_character_rest_v1',
  'ensureResourceTarget(root)',
  'updateSpellResourceSummaries(root, resourceProfile)',
  'sheet.meta?.characterId',
  'async function loadResourceProfile()',
  'await supabase.rpc("character_sheet_resource_profile_v1"',
]) {
  assert(enhancementSource.includes(token), `Character sheet enhancements are missing resource contract: ${token}`);
}
assert(!enhancementSource.includes('supabase.rpc("character_sheet_resource_profile_v1", { p_character_id: resolvedCharacterId }).then'), "Resource profile loading must not chain Promise-only methods directly from the Supabase query builder");
for (const token of [
  'Spell Resources &amp; Rest',
  'Persistent in-person tracking',
  'Short Rest',
  'Long Rest',
  'onSlotOperation',
  'onSpellUseOperation',
  'Last Short Rest:',
  'Last Long Rest:',
]) {
  assert(resourceTracker.includes(token), `Character sheet resource tracker is missing: ${token}`);
}
assert(resourceStyles.includes(".resourceRow") && resourceStyles.includes(".pipReady") && resourceStyles.includes(".restButtons"), "Character sheet resource tracker styles are incomplete");

for (const token of [
  'create table if not exists public.character_spell_slots',
  'create table if not exists public.character_rest_log',
  'private.sync_character_spell_slots_v1',
  'public.character_sheet_resource_profile_v1',
  'public.update_character_spell_slot_v1',
  'public.update_character_spell_use_v1',
  'public.complete_character_rest_v1',
  'private.can_manage_character_progression_v1',
  "'encounterStateChanged',false",
  "'{meta,characterId}'",
]) {
  assert(resourceMigration.includes(token), `Character spell-resource migration is missing: ${token}`);
}
assert(!resourceMigration.includes("update public.encounter_spell_slots"), "Standalone rest tracking must not mutate encounter spell slots");
assert(!resourceMigration.includes("MapPageClient"), "Resource migration must not introduce world-map behavior");

assert(runner.includes('validate_npc_sheet_action_parity.mjs'), "Production build runner must include the NPC action parity validator");
assert(!page.includes("MapPageClient"), "NPC parity patch must not introduce world-map code");

console.log("NPC sheet action and character resource parity validation passed.");
