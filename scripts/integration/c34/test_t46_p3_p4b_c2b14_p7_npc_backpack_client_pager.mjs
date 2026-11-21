import test from "node:test";
import assert from "node:assert/strict";
import {createNpcBackpackPager}
 from "./candidates/t46_p3_p4b_c2b14_p7_npc_backpack_client_pager.mjs";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const uuid=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const one=uuid(1),two=uuid(2),a=uuid(3),b=uuid(4);
const item=(id,name)=>({id,name,type:"Misc",rarity:"Common",is_equipped:false,equip_slot:null,
 card_payload:{secret:"GM"},user_id:uuid(80),internalNotes:"private"});
const gitBlob=bytes=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+bytes.length+"\0"),bytes])).digest("hex");
test("original live NPC panel and shared old read/equip SQL preserved exactly",()=>{
 for(const [name,pin] of [
  ["components/NpcPanel.js","e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db"],
  ["sql/20260802_01_player_character_inventory_and_sheet_actions.sql",
   "e5117b7fda6b42d92fcbef850e65eeaeb92389f8"]
 ]){
  const bytes=fs.readFileSync(path.join(root,name));
  assert.equal(gitBlob(bytes),pin,"Original "+name+" drift; audit before runtime cutover");
 }
 const panel=fs.readFileSync(path.join(root,"components/NpcPanel.js"),"utf8");
 const sql=fs.readFileSync(path.join(root,
  "sql/20260802_01_player_character_inventory_and_sheet_actions.sql"),"utf8");
 assert.ok(panel.includes("canView: canInventory, canManage: canInventory"));
 assert.ok(panel.includes('supabase.rpc("get_character_inventory_v1"'));
 assert.ok(panel.includes('.from("character_spells")'));
 assert.ok(sql.includes("returns setof public.inventory_items"));
 assert.ok((sql.match(/private\.can_access_character_v1\(p_character_id, 'inventory'\)/g)||[]).length>=2);
});
test("selected NPC does not cause eager fetch; explicit first page uses one versioned RPC",async()=>{
 const calls=[];
 const client={rpc:async(name,args)=>{
  calls.push({name,args});
  return {data:{npc_id:one,items:[item(a,"Backpack A")],has_more:false,next_cursor:null}};
 }};
 const pager=createNpcBackpackPager(client,{pageSize:10});
 assert.equal(calls.length,0);
 pager.selectNpc(one);
 assert.equal(calls.length,0,"Profile selection must not read private backpack");
 const page=await pager.loadNext();
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{
  name:"c34_b14_p7_npc_backpack_page_v1",
  args:{p_npc_id:one,p_page_size:10,p_after_created_at:null,p_after_item_id:null}
 });
 assert.deepEqual(page.items,[{
  id:a,name:"Backpack A",type:"Misc",rarity:"Common",is_equipped:false,equip_slot:null
 }]);
 assert.equal("card_payload" in page.items[0],false);
 assert.equal("user_id" in page.items[0],false);
 const exhausted=await pager.loadNext();
 assert.equal(exhausted.exhausted,true);
 assert.equal(calls.length,1);
});
test("two pages use exact pair cursor without offset or unrelated API calls",async()=>{
 const calls=[],cursor={created_at:"2026-11-21T12:00:00+00:00",item_id:a};
 const client={rpc:async(name,args)=>{
  calls.push([name,args]);
  return calls.length===1?
   {data:{npc_id:one,items:[item(a,"First")],has_more:true,next_cursor:cursor}}:
   {data:{npc_id:one,items:[item(b,"Second")],has_more:false,next_cursor:null}};
 }};
 const pager=createNpcBackpackPager(client);
 pager.selectNpc(one);
 assert.equal((await pager.loadNext()).hasMore,true);
 assert.equal((await pager.loadNext()).hasMore,false);
 assert.deepEqual(calls[1][1],{
  p_npc_id:one,p_page_size:20,
  p_after_created_at:cursor.created_at,p_after_item_id:cursor.item_id
 });
 assert.ok(calls.every(([name])=>name==="c34_b14_p7_npc_backpack_page_v1"));
});
test("stale NPC request cannot populate newly selected NPC inventory or page cursor",async()=>{
 let resolve;
 const pending=new Promise(r=>{resolve=r;});
 const calls=[];
 const client={rpc:(name,args)=>{
  calls.push(args.p_npc_id);
  if(args.p_npc_id===one)return pending;
  return Promise.resolve({data:{npc_id:two,items:[item(b,"Two")],has_more:false,next_cursor:null}});
 }};
 const pager=createNpcBackpackPager(client);
 pager.selectNpc(one);
 const oldRequest=pager.loadNext();
 pager.selectNpc(two);
 const current=await pager.loadNext();
 resolve({data:{npc_id:one,items:[item(a,"Old secret")],has_more:true,
  next_cursor:{created_at:"2026-11-21T12:00:00Z",item_id:a}}});
 const stale=await oldRequest;
 assert.deepEqual(calls,[one,two]);
 assert.equal(stale.discarded,true);
 assert.deepEqual(stale.items,[]);
 assert.equal(current.items[0].name,"Two");
 assert.equal(pager.state().npcId,two);
 assert.equal(pager.state().nextCursor,null);
});
test("authorization failures do not fall back to old full-row RPC, raw SELECT or UPDATE",async()=>{
 const calls=[];
 const pager=createNpcBackpackPager({rpc:async(name,args)=>{
  calls.push({name,args});return {error:{code:"42501",message:"NPC backpack permission required"}};
 }});
 pager.selectNpc(one);
 await assert.rejects(pager.loadNext(),/NPC backpack permission required/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,"c34_b14_p7_npc_backpack_page_v1");
});
test("invalid response, cursor, wrong NPC and page size are rejected",async()=>{
 assert.throws(()=>createNpcBackpackPager(null),/Supabase/);
 assert.throws(()=>createNpcBackpackPager({rpc:async()=>({})},{pageSize:41}),/1–40/);
 const p=createNpcBackpackPager({rpc:async()=>({data:{
  npc_id:two,items:[],has_more:false,next_cursor:null}})});
 assert.throws(()=>p.selectNpc("not UUID"),/NPC UUID/);
 p.selectNpc(one);
 await assert.rejects(p.loadNext(),/Invalid NPC backpack response/);
 const wrongCursor=createNpcBackpackPager({rpc:async()=>({data:{
  npc_id:one,items:[],has_more:true,next_cursor:null}})});
 wrongCursor.selectNpc(one);
 await assert.rejects(wrongCursor.loadNext(),/Missing keyset cursor/);
});
