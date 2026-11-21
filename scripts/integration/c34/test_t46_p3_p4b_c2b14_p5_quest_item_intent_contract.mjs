import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {normalizeQuestItemProposal,planQuestItemRequestDecision}
 from "./candidates/t46_p3_p4b_c2b14_p5_quest_item_intent_contract.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const owner="00000000-0000-4000-8000-000000000011";
const npc="00000000-0000-4000-8000-000000000012";
const id="00000000-0000-4000-8000-000000000013";
const itemId="00000000-0000-4000-8000-000000000014";
const read=pathName=>fs.readFileSync(path.join(root,pathName));
const blob=bytes=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+bytes.length+"\0"),bytes
])).digest("hex");

test("send proposal is side-effect-free; never pretends to authorize transfer",()=>{
 const input={requestId:id,intent:"send",itemId,
  counterparty:{type:"npc",id:npc},questId:"delivery:act.2"};
 const out=normalizeQuestItemProposal(input);
 assert.deepEqual(out,{
  requestId:id,intent:"send",questId:"delivery:act.2",
  counterparty:{type:"npc",id:npc},
  itemId,requestedItemKey:null,quantity:1,state:"proposed",mutationAuthorized:false
 });
 assert.ok(Object.isFrozen(out));
 assert.ok(Object.isFrozen(out.counterparty));
 assert.deepEqual(input.counterparty,{type:"npc",id:npc});
 assert.equal("issuerId" in out,false);
 assert.equal("canControl" in out,false);
 assert.equal("status" in out,false);
});

test("request proposal means pending decision; no inventory row or transfer",()=>{
 const out=normalizeQuestItemProposal({
  requestId:id,intent:"request",requestedItemKey:"iron-ore",quantity:3,
  // recipient of the REQUEST message, not presumed destination of item.
  counterparty:{type:"player",id:owner},questId:"quest.craft/act:1"
 });
 assert.equal(out.state,"proposed");
 assert.equal(out.itemId,null);
 assert.equal(out.quantity,3);
 assert.equal(out.requestedItemKey,"iron-ore");
 assert.equal(out.counterparty.type,"player");
 assert.equal(out.mutationAuthorized,false);
 assert.equal(out.questId,"quest.craft/act:1");
});

test("quest reference is TEXT, NOT forced to UUID; control chars forbidden",()=>{
 const proposal={requestId:id,intent:"send",itemId,counterparty:{type:"npc",id:npc}};
 assert.equal(normalizeQuestItemProposal({...proposal,questId:"Cave of Echoes - act 1"}).questId,
  "Cave of Echoes - act 1");
 assert.equal(normalizeQuestItemProposal(proposal).questId,null);
 for(const questId of ["", " whitespace ", "line\nbreak", "\u0000", "x".repeat(257)])
  assert.throws(()=>normalizeQuestItemProposal({...proposal,questId}),/quest reference/);
});

test("caller cannot forge NPC issuer, quest resolution, metadata, roles or grant",()=>{
 const good={requestId:id,intent:"send",itemId,counterparty:{type:"npc",id:npc}};
 for(const [key,value] of Object.entries({
  actorUserId:owner,issuerNpcId:npc,manager:true,canControl:true,
  questStatus:"completed",autoAccept:true,transferReceiptId:id
 }))
  assert.throws(()=>normalizeQuestItemProposal({...good,[key]:value}),/Invalid item interaction proposal fields/);
 for(const [key,value] of Object.entries({
  hidden:false,can_inventory:true,can_control:true,kind:"sidekick",secret:"gm"
 }))
  assert.throws(()=>normalizeQuestItemProposal({...good,
   counterparty:{type:"npc",id:npc,[key]:value}}),/Invalid recipient fields|Invalid counterparty fields/);
});

test("no player-character destination can be client-described as character type",()=>{
 for(const type of ["character","player-character","sidekick","unknown",""])
  assert.throws(()=>normalizeQuestItemProposal({
   requestId:id,intent:"send",itemId,counterparty:{type,id:npc}
  }),/Invalid counterparty type/);
 // 'npc' is only a wire type. The SERVER MUST exclude player-character tags
 // when it resolves the UUID; no client-provided 'kind' or role can bypass.
});

test("item sends and item requests use separate selectors; malformed requests denied",()=>{
 const send={requestId:id,intent:"send",itemId,counterparty:{type:"npc",id:npc}};
 assert.throws(()=>normalizeQuestItemProposal({...send,requestedItemKey:"iron-ore"}),/Send uses one exact/);
 assert.throws(()=>normalizeQuestItemProposal({...send,quantity:1}),/Send uses one exact/);
 assert.throws(()=>normalizeQuestItemProposal({...send,itemId:"not-uuid"}),/Invalid item UUID/);
 for(const invalid of [0,-1,100,1.5,"4",null])
  assert.throws(()=>normalizeQuestItemProposal({
   requestId:id,intent:"request",requestedItemKey:"iron-ore",
   quantity:invalid,counterparty:{type:"player",id:owner}
  }),/quantity/);
 for(const invalid of ["a b", "", "../bad", "x".repeat(130)])
  assert.throws(()=>normalizeQuestItemProposal({
   requestId:id,intent:"request",requestedItemKey:invalid,
   quantity:1,counterparty:{type:"player",id:owner}
  }),/item catalog key/);
 assert.throws(()=>normalizeQuestItemProposal({
  requestId:id,intent:"request",itemId,requestedItemKey:"iron-ore",
  quantity:1,counterparty:{type:"player",id:owner}
 }),/not another user's row ID/);
});

test("request decisions never claim status 'fulfilled' or fabricate receipt",()=>{
 const pending=planQuestItemRequestDecision({status:"pending",decision:"accept"});
 assert.deepEqual(pending,{decision:"accept",requiresServerSettlement:true,nextStatus:null});
 for(const decision of ["decline","cancel"]){
  const x=planQuestItemRequestDecision({status:"pending",decision});
  assert.equal(x.nextStatus,null);
  assert.equal(x.requiresServerSettlement,true);
 }
 for(const status of ["fulfilled","declined","expired","cancelled","proposed"])
  assert.throws(()=>planQuestItemRequestDecision({status,decision:"accept"}),/Only pending/);
 for(const decision of ["fulfill","auto_transfer","mint","reward","admin_override"])
  assert.throws(()=>planQuestItemRequestDecision({status:"pending",decision}),/Unsupported request decision/);
});

test("original player-player trade and location quest sources remain unchanged",()=>{
 const pins={
  "components/TradeRequestsPanel.js":"aa7cd652e0338e38e208d1ab3050c7739c61bb32",
  "components/OfferTradeButton.js":"5b689a2f4d65412264afd1af395b0fe93a0f151d",
  "components/quests.js":"dc489e09884edb7d18ce0bfa4cdbe74e12d0ed76",
  "pages/quest.js":"cf290e9cd48abfac6f66e8a225978ac36b3b37e2",
  "components/LocationSideBar.js":"a48ba8f85946ce8254b86d0c35ea3aa84fed6ea0"
 };
 for(const [file,sha] of Object.entries(pins))assert.equal(blob(read(file)),sha,"Source drift: "+file);
 const offer=read("components/OfferTradeButton.js").toString();
 assert.ok(offer.includes('.from("trade_requests").insert('));
 for(const col of ["inventory_item_id: row.id","from_user_id: me","to_user_id: toId"])
  assert.ok(offer.includes(col));
 const decisions=read("components/TradeRequestsPanel.js").toString();
 assert.ok(decisions.includes('supabase.rpc("accept_trade"'));
 const loc=read("components/LocationSideBar.js").toString();
 assert.ok(loc.includes('supabase.from("quests").select("id, title, status")'));
 // NOTE: live schema shows public.quests.name, not title: separate held
 // source/schema drift finding. Do not edit protected map/location surface.
});
