import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {createNpcInteractionResearchAdapter} from "./candidates/t46_p3_p4b_c2b14_p9_npc_interaction_client.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const a=id(1),b=id(2),itemId=id(3);
const flags=(npc,extra={})=>({npc_id:npc,can_view_public_profile:true,
 can_view_worn_gear:true,worn_gear:[{name:"Sword",id:id(99),card_payload:{secret:"GM"}}],
 can_view_backpack:false,can_manage_equipment:false,can_withdraw_items:false,
 can_auto_accept_items:false,can_issue_encounter_commands:true,...extra});
const item={id:itemId,name:"Sword",type:"Weapon",rarity:"Common",
 is_equipped:false,equip_slot:null,card_payload:{private:true},user_id:id(7)};
const context="c34_b14_p9_npc_slim_context_v1";
const page="c34_b14_p7_npc_backpack_page_v1";
const equip="c34_b14_p7_set_npc_equipment_v1";
const blob=data=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+data.length+"\0"),data])).digest("hex");
test("Original NpcPanel, inventory, Forge/Trade SQL and private Profile remain untouched",()=>{
 const pins=[
  ["components/NpcPanel.js","e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db"],
  ["pages/inventory.js","02d52821d0f22aa82ad92263c5014712906ee385"],
  ["sql/20260624_01_inventory_item_send_rpc.sql","2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6"],
  ["sql/20260802_01_player_character_inventory_and_sheet_actions.sql","e5117b7fda6b42d92fcbef850e65eeaeb92389f8"]
 ];
 for(const [name,pin] of pins)
  assert.equal(blob(fs.readFileSync(path.join(root,name))),pin,name+" drift");
});
test("profile choice calls no inventory; slim context omits full backpack and private worn fields",async()=>{
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push([name,args]);
  return {data:flags(a)};}};
 const adapter=createNpcInteractionResearchAdapter(client);
 adapter.selectNpc(a);
 assert.equal(calls.length,0);
 const snap=await adapter.refreshContext();
 assert.deepEqual(calls,[[context,{p_npc_id:a}]]);
 assert.deepEqual(snap.context.worn_gear,[{name:"Sword"}]);
 assert.equal("backpack" in snap.context,false);
 assert.equal("card_payload" in snap.context.worn_gear[0],false);
 assert.equal(snap.context.can_manage_equipment,false);
 assert.deepEqual(snap.items,[]);
 await assert.rejects(adapter.loadNext(),/Backpack not authorized/);
 await assert.rejects(adapter.setEquipment({
  itemId,isEquipped:true,slot:"weapon_1",expectedEquipped:false
 }),/not authorized/);
 assert.equal(calls.length,1);
});
test("hired read-only pages through P7 only; no raw SELECT/UPDATE or old equip fallback",async()=>{
 const calls=[],client={rpc:async(name,args)=>{
  calls.push([name,args]);
  if(name===context)return {data:flags(a,{can_view_backpack:true})};
  if(name===page)return {data:{npc_id:a,items:[item],has_more:false,next_cursor:null}};
  throw new Error("unexpected mutation: "+name);
 }};
 const adapter=createNpcInteractionResearchAdapter(client);
 adapter.selectNpc(a);await adapter.refreshContext();
 const snap=await adapter.loadNext();
 assert.equal(snap.items.length,1);
 assert.deepEqual(Object.keys(snap.items[0]).sort(),[
  "id","name","type","rarity","is_equipped","equip_slot"].sort());
 await assert.rejects(adapter.setEquipment({itemId,isEquipped:true,
  slot:"weapon_1",expectedEquipped:false}),/not authorized/);
 assert.deepEqual(calls.map(([name])=>name),[context,page]);
});
test("explicit equipment grant calls versioned CAS RPC, nothing else",async()=>{
 const calls=[],client={rpc:async(name,args)=>{
  calls.push([name,args]);
  if(name===context)return {data:flags(a,{can_view_backpack:true,can_manage_equipment:true})};
  if(name===page)return {data:{npc_id:a,items:[item],has_more:false,next_cursor:null}};
  if(name===equip)return {data:{npc_id:a,id:itemId,is_equipped:true,equip_slot:"weapon_1"}};
 }};
 const adapter=createNpcInteractionResearchAdapter(client);
 adapter.selectNpc(a);await adapter.refreshContext();await adapter.loadNext();
 let result=await adapter.setEquipment({itemId,isEquipped:true,
  slot:"weapon_1",expectedEquipped:false});
 assert.equal(result.items[0].is_equipped,true);
 assert.equal(result.items[0].equip_slot,"weapon_1");
 assert.deepEqual(calls[2],[equip,{p_npc_id:a,p_item_id:itemId,
  p_is_equipped:true,p_equip_slot:"weapon_1",p_expected_equipped:false}]);
});
test("same-JWT revocation refresh clears private rows; combat control stays separate",async()=>{
 let enabled=true;const calls=[],client={rpc:async(name,args)=>{
  calls.push(name);
  if(name===context)return {data:flags(a,{can_view_backpack:enabled,
   can_manage_equipment:enabled})};
  if(name===page)return {data:{npc_id:a,items:[item],has_more:false,next_cursor:null}};
 }};
 const adapter=createNpcInteractionResearchAdapter(client);
 adapter.selectNpc(a);await adapter.refreshContext();await adapter.loadNext();
 enabled=false;
 const revoked=await adapter.refreshContext();
 assert.equal(revoked.context.can_issue_encounter_commands,true);
 assert.equal(revoked.context.can_view_backpack,false);
 assert.equal(revoked.context.can_manage_equipment,false);
 assert.deepEqual(revoked.items,[]);
 await assert.rejects(adapter.loadNext(),/not authorized/);
 assert.deepEqual(calls,[context,page,context]);
});
test("selection/auth reset discards old context, old pages and pending equip",async()=>{
 let resolveContext;const pending=new Promise(r=>resolveContext=r);
 const client={rpc:(name,args)=>{
  if(name===context&&args.p_npc_id===a)return pending;
  return Promise.resolve({data:flags(b)});
 }};
 const adapter=createNpcInteractionResearchAdapter(client);
 adapter.selectNpc(a);
 const old=adapter.refreshContext();
 adapter.selectNpc(b);await adapter.refreshContext();
 resolveContext({data:flags(a,{can_view_backpack:true,
  worn_gear:[{name:"Previous user's item"}]})});
 assert.equal((await old).discarded,true);
 assert.equal(adapter.snapshot().npcId,b);
 assert.equal(adapter.snapshot().context.can_view_backpack,false);
 adapter.clear();
 assert.equal(adapter.snapshot().context,null);
 assert.equal(adapter.snapshot().npcId,null);
 assert.deepEqual(adapter.snapshot().items,[]);
});
test("profile/context request rejects injected full backpack, mismatched NPC and malformed flags",async()=>{
 for(const fake of [flags(b),flags(a,{backpack:[item]}),
  flags(a,{can_manage_equipment:"true"}),flags(a,{worn_gear:new Array(13).fill({name:"X"})})]){
  const adapter=createNpcInteractionResearchAdapter({rpc:async()=>({data:fake})});
  adapter.selectNpc(a);
  await assert.rejects(adapter.refreshContext(),/Invalid slim NPC context/);
 }
});
test("server denial never falls back to old read/equip or direct-table update",async()=>{
 const calls=[],adapter=createNpcInteractionResearchAdapter({rpc:async name=>{
  calls.push(name);return {error:{code:"42501",message:"Permission revoked"}};
 }});
 adapter.selectNpc(a);
 await assert.rejects(adapter.refreshContext(),/Permission revoked/);
 assert.deepEqual(adapter.snapshot().items,[]);
 assert.deepEqual(calls,[context]);
});
