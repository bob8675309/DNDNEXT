// C34 B14-P11 source-graph evidence, no gameplay edits.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const sha=b=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
test("original full-row-reader sources remain byte-pinned, none accidentally rewritten",()=>{
 for(const [p,pin] of [
  ["components/NpcPanel.js","e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db"],
  ["hooks/useNpcSheetActionData.js","61e3acb114c032cd275eb77d4d4c6f245da5ad20"],
  ["pages/npcs.js","7fc00b9b3ace6233d1648a3d017f8a05e072d722"],
  ["components/character/CharacterInteractionPanel.js","28a2dde5696376ee39c01a498b76a146f30aaffa"],
  ["components/PlayerCharacterProfilePanelUnified.js","8a561e51eafd9e8507db7a4d3f15fd4699d6d1b8"],
  ["pages/inventory.js","02d52821d0f22aa82ad92263c5014712906ee385"],
  ["sql/20260624_01_inventory_item_send_rpc.sql","2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6"]
 ])assert.equal(sha(fs.readFileSync(path.join(root,p))),pin,p+" changed");
});
test("persistent hidden global player profile truly mounts original NPC panel on unrelated routes",()=>{
 const app=read("pages/_app.js");
 const player=read("components/PlayerCharacterProfilePanelUnified.js");
 const shared=read("components/character/CharacterInteractionPanel.js");
 const npc=read("components/NpcPanel.js");
 assert.match(app,/import PlayerCharacterProfilePanel from/);
 assert.match(app,/<PlayerCharacterProfilePanel \/>/);
 assert.match(player,/const keepCreatorMounted = isLoggedIn/);
 assert.match(player,/if \(!keepCreatorMounted\) return null/);
 assert.match(player,/npc-page-profile-panel-backdrop/);
 assert.match(player,/is-forge-suspended/);
 assert.match(player,/character \? <>/);
 assert.match(player,/<CharacterInteractionPanel/);
 assert.match(shared,/import NpcPanel from "\.\.\/NpcPanel"/);
 assert.match(shared,/React\.createElement\(NpcPanel/);
 assert.match(npc,/supabase\.rpc\("get_character_inventory_v1"/);
 assert.match(npc,/loadInventoryRows\(\)/);
 assert.match(npc,/const canInventory = !!data\?\.can_inventory \|\| !!data\?\.can_edit/);
});
test("separate /npcs hook eagerly reads old inventory and spells, independent from global panel",()=>{
 const page=read("pages/npcs.js");
 const hook=read("hooks/useNpcSheetActionData.js");
 assert.match(page,/import useNpcSheetActionData from/);
 assert.match(page,/const npcSheetActions = useNpcSheetActionData\(/);
 assert.match(hook,/supabase\.rpc\("get_character_inventory_v1"/);
 assert.match(hook,/from\("character_spells"\)/);
 assert.match(hook,/get_character_progression_v1/);
});
test("send and trade cutover routes still require preserving both transfer and item creation",()=>{
 const inv=read("pages/inventory.js");
 const npc=read("components/NpcPanel.js");
 const june=read("sql/20260624_01_inventory_item_send_rpc.sql");
 const assign=read("components/AssignItemButton.js");
 const offer=read("components/OfferTradeButton.js");
 const requests=read("components/TradeRequestsPanel.js");
 assert.match(inv,/rpc\("transfer_inventory_item_v1"/);
 assert.match(inv,/const fallback = await supabase\.from\("inventory_items"\)\.update/);
 assert.match(inv,/\.update\(patch\)\.in\("id", selectedIds\)/);
 assert.match(npc,/rpc\("transfer_inventory_item_v1"/);
 assert.match(june,/list_item_send_targets_v1/);
 assert.match(june,/SECURITY DEFINER/);
 assert.match(assign,/from\("inventory_items"\)\.insert/);
 assert.match(offer,/from\("trade_requests"\)\.insert/);
 assert.match(requests,/rpc\("accept_trade"/);
});
test("P11 signed JS call stack is temporary, excludes actor/item identifiers and preserves P10 scope",()=>{
 const runner=read("scripts/integration/c34/run_t46_p3_p4b_c2b14_p10_npc_inventory_browser_signed.mjs");
 assert.match(runner,/DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY/);
 assert.match(runner,/P11-LEGACY-READER-SOURCE-FRAMES/);
 assert.match(runner,/P11-TRACE/);
 assert.match(runner,/__p11LegacyReaderSites/);
 assert.match(runner,/NpcPanel\|useNpcSheetActionData/);
 assert.match(runner,/is-forge-suspended/);
 assert.match(runner,/fs\.rmSync\(dest\)/);
 assert.doesNotMatch(runner,/localStorage|window\.fetch\s*=|\.from\("inventory_items"\)\.update/);
 const shell=read("components/c34/NonMapNpcInventoryP10ResearchShell.jsx");
 assert.doesNotMatch(shell,/get_character_inventory_v1|useNpcSheetActionData|NpcPanel/);
});
