// C34 B14-P15 source-only expected-RED crosswalk. No SQL, network,
// application startup or production grant changes. Source ≠ installed policy.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const hashBlob=p=>{
 const bytes=fs.readFileSync(path.join(root,p));
 return createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+bytes.length+"\0"),bytes])).digest("hex");
};
const mainControl="sql/20260727_04_authoritative_encounter_turn_movement.sql";
const legacy="sql/20260624_01_inventory_item_send_rpc.sql";
const originalNpc="components/NpcPanel.js";
const originalInventory="pages/inventory.js";
const plan=read("docs/research/C34_B14_P15_CONTROL_AUTHORITY_AND_LEGACY_CONSENT_CUTOVER_2026-11-22.md");

test("P15 live-main source controller is encounter-local controller_user_id OR edit, not nonexistent can_control",()=>{
 assert.equal(hashBlob(mainControl),"26307f721a53bd569cacc9f3479a2f771e15e611");
 const source=read(mainControl);
 const fn=source.split("create or replace function public.encounter_can_control_participant_v1(")[1]
  ?.split("create or replace function public.encounter_canonical_speed_ft_v1(")[0];
 assert.ok(fn,"Original encounter control function absent");
 assert.match(fn,/v_participant\.controller_user_id\s*=\s*v_uid/);
 assert.match(fn,/coalesce\(cp\.can_edit,false\)/);
 assert.doesNotMatch(fn,/cp\.can_control/);
 assert.match(read("pages/encounters/play.js"),/rpc\("encounter_can_control_participant_v1"/);
 assert.match(plan,/not automatically a durable all-town NPC companion\/inventory grant/i);
 console.log("PASS P15-ENCOUNTER: checked source-current combat authority is NOT an installed global NPC inventory grant");
});

test("P15 held PR #312 control grant is independent, unmerged, and must never be backfilled from edit",()=>{
 const dossier=read("docs/pr-integration/PR-312.md");
 assert.match(dossier,/26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254/);
 assert.match(dossier,/20261101_npc_delegated_control_candidate\.sql/);
 assert.match(dossier,/can_control/);
 assert.match(dossier,/controller_user_id/);
 assert.match(plan,/29e700c8bf2008c1b46abc5dc74a266547473cf7/);
 assert.match(plan,/DO NOT BACKFILL can_edit into can_control/);
 assert.match(plan,/stacked on held PR #309/);
 assert.match(plan,/No .*private P6\/P8\/P14 scratch offer\/link tables/i);
 console.log("PASS P15-PR312: original stacked controller source kept independent of editor, GM and inventory capability");
});

test("P15 expected RED: legacy direct NPC and scratch bypass functions remain in exact preserved sources",()=>{
 assert.equal(hashBlob(legacy),"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6");
 const june=read(legacy);
 assert.match(june,/CREATE OR REPLACE FUNCTION public\.list_item_send_targets_v1\(\)/);
 assert.match(june,/RETURNS public\.inventory_items/);
 assert.match(june,/GRANT EXECUTE ON FUNCTION public\.transfer_inventory_item_v1\(uuid, text, text\) TO authenticated/);
 const p2=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p2_inventory_authority_pg17.sql");
 const p4=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p4_controlled_npc_gear_pg17.sql");
 const p6=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p6_npc_capabilities_and_offers_pg17.sql");
 const p8=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_intent_dispatch_pg17.sql");
 const gm=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_gm_offer_settlement_pg17.sql");
 const p14=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p14_offer_status_and_links_pg17.sql");
 assert.match(p2,/CREATE OR REPLACE FUNCTION public\.c34_b14_p2_transfer_inventory_item_v1/);
 assert.match(p2,/GRANT EXECUTE ON FUNCTION public\.c34_b14_p2_transfer_inventory_item_v1/);
 assert.match(p4,/CREATE OR REPLACE FUNCTION public\.c34_b14_p4_send_character_gear_to_controlled_npc_v1/);
 assert.match(p6,/CREATE OR REPLACE FUNCTION public\.c34_b14_p6_decide_item_offer_v1/);
 assert.match(p8,/coalesce\(cp\.can_control,false\) OR coalesce\(cp\.can_edit,false\)/);
 assert.match(gm,/coalesce\(cp\.can_control,false\) OR coalesce\(cp\.can_edit,false\)/);
 assert.match(p14,/CREATE OR REPLACE FUNCTION public\.c34_b14_p14_my_intent_status_v1/);
 assert.doesNotMatch(p14,/REVOKE ALL ON FUNCTION public\.transfer_inventory_item_v1/);
 assert.match(plan,/No hosted SQL/i);
 console.log("PASS P15-SERVER-RED: original immediate NPC paths remain uncut; disposable P14 does not imply live consent enforcement");
});

test("P15 expected RED: all original mounted and two opt-in Town NPC/profile/inventory readers must be retired together",()=>{
 assert.equal(hashBlob(originalNpc),"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db");
 assert.equal(hashBlob(originalInventory),"02d52821d0f22aa82ad92263c5014712906ee385");
 const npcFiles=[
  originalNpc,
  "components/NpcPanelTownT28P2Research.jsx",
  "components/NpcPanelTownT33Research.jsx"
 ];
 for(const file of npcFiles){
  const s=read(file);
  for(const rpc of [
    "get_character_inventory_v1","list_item_send_targets_v1",
    "set_character_inventory_equipment_v1","transfer_inventory_item_v1"
  ]) assert.ok(s.includes('rpc("'+rpc+'"'),"original NPC caller vanished: "+file+" "+rpc);
 }
 const hook=read("hooks/useNpcSheetActionData.js");
 assert.match(hook,/rpc\("get_character_inventory_v1"/);
 assert.match(read("pages/npcs.js"),/useNpcSheetActionData\(/);
 const inv=read(originalInventory);
 assert.match(inv,/rpc\("transfer_inventory_item_v1"/);
 assert.match(inv,/\.from\("inventory_items"\)\.update\(patch\)\.in\("id", selectedIds\)/);
 assert.match(inv,/fallback = await supabase\.from\("inventory_items"\)\.update\(patch\)/);
 const town=read("pages/town/[id].js");
 assert.match(town,/NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP/);
 assert.match(town,/NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE/);
 console.log("PASS P15-CLIENT-RED: manager hook, original panel, both flagged Town clones and inventory fallback require coordinated retirement");
});

test("P15 non-transfer writers stay independent: no blanket inventory DML revoke",()=>{
 assert.match(read("components/TradeRequestsPanel.js"),/rpc\("accept_trade"/);
 assert.match(read("components/TradeRequestsPanel.js"),/\.from\("trade_requests"\)/);
 assert.match(read("components/MerchantPanel.js"),/rpc\("buy_from_merchant"/);
 assert.match(read("components/MerchantPanel.js"),/\.from\("character_stock"\)/);
 assert.match(read("components/AssignItemButton.js"),/\.from\("inventory_items"\)/);
 assert.match(read("pages/town/[id].js"),/rollbackRows/);
 assert.match(read("pages/town/[id].js"),/\.from\("inventory_items"\)\s*\.delete\(\)/);
 assert.match(read("docs/research/OWNER_RELEASE_AND_INTEGRATION_DECISIONS_2026-11-13.md"),/22\/34/);
 assert.match(read("docs/research/OWNER_RELEASE_AND_INTEGRATION_DECISIONS_2026-11-13.md"),/340 Storage objects/);
 assert.match(plan,/do not blanket-revoke inventory_items INSERT\/DELETE/i);
 assert.match(plan,/No merge of whole #379/);
 console.log("PASS P15-PRESERVE: merchant buyer, account trades, item grants, Town craft rollback, Forge writer and 340-object restore barriers kept explicit");
});
