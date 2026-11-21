import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {createItemIntentDispatchResearchClient} from "./candidates/t46_p3_p4b_c2b14_p8_intent_dispatch_client.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const uid=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const request=uid(1),item=uid(2),sender=uid(3),other=uid(4),npc=uid(5);
const one={requestId:request,itemId:item,expectedOwnerType:"player",
 expectedOwnerId:sender,targetType:"npc",targetId:npc};
const player={...one,targetType:"player",targetId:other};
const response=(args,status="pending")=>({request_id:args.p_request_id,
 item_id:args.p_item_id,target_type:args.p_target_type,target_id:args.p_target_id,
 status,auto_accepted:status==="accepted"&&args.p_target_type==="npc"});
const blob=b=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
test("source-original player trade/Forge item card/June send/inventory page remain pinned (unfixed P8 RED)",()=>{
 for(const [file,sha] of [
  ["pages/inventory.js","02d52821d0f22aa82ad92263c5014712906ee385"],
  ["sql/20260624_01_inventory_item_send_rpc.sql","2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6"],
  ["components/AssignItemButton.js","dc09dc77c66896ed842d240c584225cde26581db"],
  ["components/OfferTradeButton.js","5b689a2f4d65412264afd1af395b0fe93a0f151d"],
  ["components/TradeRequestsPanel.js","aa7cd652e0338e38e208d1ab3050c7739c61bb32"]
 ])assert.equal(blob(fs.readFileSync(path.join(root,file))),sha,file+" original drift");
});
test("genuine player-to-player path uses one proposed RPC with CAS and no client authority flags",async()=>{
 const calls=[];
 const proxy=createItemIntentDispatchResearchClient({rpc:async(name,args)=>{
  calls.push({name,args});return {data:response(args,"accepted")};
 }});
 assert.deepEqual(await proxy.sendOne(player),{request_id:request,item_id:item,
  target_type:"player",target_id:other,status:"accepted",auto_accepted:false});
 assert.deepEqual(calls,[{name:"c34_b14_p8_dispatch_item_intent_v1",args:{
  p_request_id:request,p_item_id:item,p_expected_owner_type:"player",
  p_expected_owner_id:sender,p_target_type:"player",p_target_id:other
 }}]);
});
test("independent NPC offer stays pending; caller cannot forge auto-accept actor or issuer",async()=>{
 const calls=[];
 const api=createItemIntentDispatchResearchClient({rpc:async(name,args)=>{
  calls.push([name,args]);return {data:response(args)};
 }});
 assert.equal((await api.sendOne({...one,actorId:uid(60),isGM:true,
  autoAccept:true,questCredit:true,issuerNpcId:uid(70)})).status,"pending");
 assert.deepEqual(Object.keys(calls[0][1]).sort(),[
  "p_request_id","p_item_id","p_expected_owner_type",
  "p_expected_owner_id","p_target_type","p_target_id"].sort());
 assert.ok(!JSON.stringify(calls).includes("actorId"));
 assert.ok(!JSON.stringify(calls).includes("autoAccept"));
});
test("Forge-owned character gear can propose NPC recipient but not player; same-account PC route denied",async()=>{
 const api=createItemIntentDispatchResearchClient({rpc:async(_name,args)=>({
  data:response(args)})});
 const charOwner={...one,expectedOwnerType:"character",expectedOwnerId:sender};
 assert.equal((await api.sendOne(charOwner)).status,"pending");
 await assert.rejects(api.sendOne({...charOwner,targetType:"player",targetId:other}),
  /Character-to-player/);
 await assert.rejects(api.sendOne({...one,targetType:"character",targetId:other}),
  /only authorizes/);
 await assert.rejects(api.sendOne({...one,targetType:"merchant",targetId:other}),
  /only authorizes/);
 await assert.rejects(api.sendOne({...one,expectedOwnerType:"npc"}),
  /only authorizes/);
 await assert.rejects(api.sendOne({...player,targetId:sender}),/Self-send/);
});
test("NPC role, hidden-state and player-character tags belong to server verification, not client claims",async()=>{
 const api=createItemIntentDispatchResearchClient({rpc:async(_name,args)=>({
  error:{code:"42501",message:"NPC target is hidden or tagged player-character"}
 })});
 await assert.rejects(api.sendOne({...one,recipientVisible:true,isRealNpc:true}),
  /hidden or tagged/);
});
test("signed revocation error does not fall back to June transfer, B14-P2 or raw UPDATE",async()=>{
 const calls=[];
 const api=createItemIntentDispatchResearchClient({rpc:async(name,args)=>{
  calls.push([name,args]);return {error:{code:"42501",message:"Current rights revoked"}};
 }});
 await assert.rejects(api.sendOne(one),/Current rights revoked/);
 assert.deepEqual(calls.map(([name])=>name),["c34_b14_p8_dispatch_item_intent_v1"]);
});
test("suspicious full-row or forged receipt, missing fields, player auto-accept fail closed",async()=>{
 for(const data of [
  {...response({p_request_id:request,p_item_id:item,p_target_type:"npc",p_target_id:npc}),card_payload:{gm:"secret"}},
  {...response({p_request_id:request,p_item_id:item,p_target_type:"npc",p_target_id:npc}),item_id:uid(70)},
  {...response({p_request_id:request,p_item_id:item,p_target_type:"npc",p_target_id:npc}),status:"received"},
  {...response({p_request_id:request,p_item_id:item,p_target_type:"npc",p_target_id:npc}),auto_accepted:true}
 ]){
  const api=createItemIntentDispatchResearchClient({rpc:async()=>({data})});
  await assert.rejects(api.sendOne(one),/Invalid redacted transfer receipt/);
 }
 const bogus=createItemIntentDispatchResearchClient({rpc:async(_name,args)=>({
  data:{...response(args,"accepted"),auto_accepted:true}
 })});
 await assert.rejects(bogus.sendOne(player),/Invalid redacted transfer receipt/);
});
test("same request cannot execute in parallel; account change discards old reply",async()=>{
 let finish;
 const waiting=new Promise(resolve=>{finish=resolve});
 const api=createItemIntentDispatchResearchClient({rpc:async(name,args)=>waiting});
 const first=api.sendOne(one);
 await assert.rejects(api.sendOne(one),/already in flight/);
 api.clear();
 finish({data:response({p_request_id:request,p_item_id:item,p_target_type:"npc",p_target_id:npc})});
 assert.deepEqual(await first,{discarded:true});
});
test("atomic bulk routes one RPC, rejects duplicates, invalid bounds and mixed settlement",async()=>{
 const base={requestId:request,itemIds:[item,uid(7)],expectedOwnerType:"player",
  expectedOwnerId:sender,targetType:"npc",targetId:npc};
 const calls=[];
 const api=createItemIntentDispatchResearchClient({rpc:async(name,args)=>{
  calls.push({name,args});
  return {data:{request_id:request,receipts:args.p_item_ids.map(id=>
   response({...args,p_item_id:id}))}};
 }});
 const sent=await api.sendBatch(base);
 assert.equal(sent.receipts.length,2);
 assert.deepEqual(calls.map(x=>x.name),["c34_b14_p8_dispatch_batch_intent_v1"]);
 await assert.rejects(api.sendBatch({...base,itemIds:[item,item]}),/Duplicate/);
 await assert.rejects(api.sendBatch({...base,itemIds:[]}),/1–50/);
 const broken=createItemIntentDispatchResearchClient({rpc:async(_name,args)=>({
  data:{request_id:request,receipts:args.p_item_ids.map((id,index)=>
   response({...args,p_item_id:id},index?"accepted":"pending"))}
 })});
 await assert.rejects(broken.sendBatch(base),/Mixed immediate\/pending/);
});
