// C34 B14-P8 isolated signed local disposable PG17 and GoTrue/PostgREST.
// Tests NEW dispatcher but explicitly acknowledges June/P2/P4 direct NPC
// consent bypass still exists. No hosted SQL or original gameplay patch.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID,createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const file="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_intent_dispatch_pg17.sql";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runC34B14P8IntentSigned({env,sql,q,lit,roles,hired,another,hiddenNpc,forgePc}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGDATABASE:"postgres",PGUSER:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321"
 }))assert.equal(env[k],v,"P8 only local disposable PG17");
 const sigs=[
  "public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)",
  "public.c34_b14_p2_transfer_inventory_items_bulk_v1(uuid[],text,text,text,text)",
  "public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)",
  "public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)",
  "public.c34_b14_p7_set_npc_equipment_v1(uuid,uuid,boolean,text,boolean)",
  "public.transfer_inventory_item_v1(uuid,text,text)",
  "public.is_admin(uuid)",
  "public.buy_from_merchant(uuid,uuid,integer)"
 ];
 const hash=sig=>sql("SELECT md5(pg_get_functiondef('"+sig+"'::regprocedure))");
 const initial=sigs.map(hash);
 const source=fs.readFileSync(path.join(root,file),"utf8");
 assert.match(source,/SOURCE-ONLY SQL CANDIDATE/);
 assert.match(source,/NOT a cutover/);
 assert.ok(!source.includes("DROP FUNCTION"));
 assert.ok(!source.includes("ALTER POLICY"));
 sql(source);
 const singleSig="public.c34_b14_p8_dispatch_item_intent_v1(uuid,uuid,text,text,text,text)";
 const bulkSig="public.c34_b14_p8_dispatch_batch_intent_v1(uuid,uuid[],text,text,text,text)";
 for(const signature of [singleSig,bulkSig]){
  assert.equal(sql("SELECT has_function_privilege('anon',"+lit(signature)+",'EXECUTE')"),"f");
  assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(signature)+",'EXECUTE')"),"t");
 }
 sql("NOTIFY pgrst,'reload schema'");
 const rpc=async(actor,name,args)=>{
  let r;
  for(let tries=0;tries<30;tries++){
   r=await actor.who.rpc(name,args);
   if(r.error?.code!=="PGRST202")break;
   await delay(170);
  }
  return r;
 };
 const ONE="c34_b14_p8_dispatch_item_intent_v1";
 const BULK="c34_b14_p8_dispatch_batch_intent_v1";
 const actor=roles.OWNER,other=roles.OUTSIDER;
 const make=(label,ownerType="player",ownerId=actor.id)=>{
  const id=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,item_type,item_rarity,is_equipped,equip_slot) VALUES("+
   q(id)+","+lit(ownerType)+","+q(ownerId)+","+q(actor.id)+","+
   lit("P8 "+label)+",'Misc','Common',false,NULL)");
  return id;
 };
 const owner=id=>JSON.parse(sql("SELECT json_build_object('owner_type',owner_type,"+
  "'owner_id',owner_id,'user_id',user_id,'is_equipped',is_equipped)::text FROM public.inventory_items WHERE id="+q(id)));
 const request=(id,targetType,targetId,sourceType="player",sourceId=actor.id,key=randomUUID())=>({
  p_request_id:key,p_item_id:id,p_expected_owner_type:sourceType,
  p_expected_owner_id:sourceId,p_target_type:targetType,p_target_id:targetId
 });
 const bulk=(ids,targetType,targetId,key=randomUUID())=>({
  p_request_id:key,p_item_ids:ids,p_expected_owner_type:"player",
  p_expected_owner_id:actor.id,p_target_type:targetType,p_target_id:targetId
 });
 const deny=(r,label,code)=>{
  assert.ok(r.error,label+" wrongly passed "+JSON.stringify(r.data));
  if(code)assert.equal(r.error.code,code,label+" unexpected SQLSTATE "+JSON.stringify(r.error));
 };
 console.log("PASS T46-C2B14-P8-LOCAL: strictly disposable PG17 additive idempotent dispatcher, anon EXECUTE denied and original P2/P6/P7/JUNE preserved");
 const playerItem=make("player-to-player"),send=request(playerItem,"player",other.id);
 const sent=await rpc(actor,ONE,send);assert.ifError(sent.error);
 assert.deepEqual(Object.keys(sent.data).sort(),[
  "request_id","item_id","target_type","target_id","status","auto_accepted"].sort());
 assert.equal(sent.data.status,"accepted");
 assert.equal(sent.data.auto_accepted,false);
 assert.equal(owner(playerItem).owner_id,other.id);
 assert.equal(owner(playerItem).user_id,other.id);
 const beforeReplay=sql("SELECT updated_at::text FROM public.inventory_items WHERE id="+q(playerItem));
 const replay=await rpc(actor,ONE,send);
 assert.ifError(replay.error);assert.deepEqual(replay.data,sent.data);
 assert.equal(sql("SELECT updated_at::text FROM public.inventory_items WHERE id="+q(playerItem)),beforeReplay);
 deny(await rpc(actor,ONE,{...send,p_target_id:roles.OBSERVER.id}),
  "conflicting idempotence","40001");
 console.log("PASS T46-C2B14-P8-PLAYER: signed immediate player-account send, six-field receipt, idempotent replay no second transfer, original player path preserved");

 // The P9/P10 grant may have toggled view/equip but never authorizes auto.
 const grant=async(cap,enabled)=>{
  const r=await rpc(roles.GM,"c34_b14_p6_set_npc_capability_v1",{
   p_npc_id:hired,p_user_id:actor.id,p_capability:cap,p_enabled:enabled
  });assert.ifError(r.error);
 };
 await grant("auto_accept_items",false);
 const pendingItem=make("independent pending"),offer=request(pendingItem,"npc",hired);
 const pending=await rpc(actor,ONE,offer);assert.ifError(pending.error);
 assert.equal(pending.data.status,"pending");
 assert.equal(owner(pendingItem).owner_type,"player");
 assert.equal(owner(pendingItem).owner_id,actor.id);
 const same=await rpc(actor,ONE,offer);assert.ifError(same.error);
 assert.deepEqual(same.data,pending.data);
 const managerDecision=await rpc(roles.GM,"c34_b14_p6_decide_item_offer_v1",{
  p_request_id:offer.p_request_id,p_accept:true
 });assert.ifError(managerDecision.error);
 assert.equal(managerDecision.data.status,"accepted");
 assert.equal(owner(pendingItem).owner_type,"npc");
 assert.equal(owner(pendingItem).owner_id,hired);
 deny(await rpc(actor,ONE,request(pendingItem,"npc",hired)),"cannot re-offer changed source","40001");
 console.log("PASS T46-C2B14-P8-PENDING: genuine signed source-owned item stays put until GM NPC acceptance, strict replay and post-settlement CAS");

 // Real Forge PC uses kind=npc, tags=[player-character]; item scope is
 // owner_type=character. This is source type NOT an NPC recipient.
 const forgeSource=randomUUID();
 sql("INSERT INTO public.characters(id,name,kind,state,is_hidden,tags) VALUES("+
  q(forgeSource)+",'P8 verified source PC','npc','resting',false,ARRAY['player-character']::text[])");
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert,can_control) VALUES("+
  q(forgeSource)+","+q(actor.id)+",true,false,false,false)");
 const forgeItem=make("true Forge character gear","character",forgeSource);
 const forgeOffer=request(forgeItem,"npc",hired,"character",forgeSource);
 const sourceSent=await rpc(actor,ONE,forgeOffer);assert.ifError(sourceSent.error);
 assert.equal(sourceSent.data.status,"pending");
 assert.equal(owner(forgeItem).owner_type,"character");
 // NEW: a Forge-owned source can only offer to a currently controlled
 // companion, not an arbitrary NPC who happens to be visible.
 const uncontrolled=make("uncontrolled Forge source","character",forgeSource);
 deny(await rpc(actor,ONE,request(uncontrolled,"npc",another,"character",forgeSource)),
  "unrelated NPC cannot receive Forge-character gear even as pending","42501");
 assert.equal(owner(uncontrolled).owner_type,"character");
 assert.equal(sql("SELECT count(*) FROM private.c34_b14_p6_item_offers WHERE item_id="+
  q(uncontrolled)),"0","Rejected offer must roll back P6 pending row");
 const revokedSource=make("revoked companion source","character",forgeSource);
 sql("UPDATE public.character_permissions SET can_control=false WHERE character_id="+
  q(hired)+" AND user_id="+q(actor.id));
 deny(await rpc(actor,ONE,request(revokedSource,"npc",hired,"character",forgeSource)),
  "same-JWT revoked companion control denies Forge donation","42501");
 assert.equal(owner(revokedSource).owner_type,"character");
 assert.equal(sql("SELECT count(*) FROM private.c34_b14_p6_item_offers WHERE item_id="+
  q(revokedSource)),"0");
 sql("UPDATE public.character_permissions SET can_control=true WHERE character_id="+
  q(hired)+" AND user_id="+q(actor.id));
 console.log("PASS T46-C2B14-P8-CONTROLLED-FORGE: signed source-PC cannot offer to unrelated NPC or after same-JWT control revoke; no pending offer/item mutation");
 await grant("auto_accept_items",true);
 const donated=make("delegated auto accepted");
 const auto=await rpc(actor,ONE,request(donated,"npc",hired));
 assert.ifError(auto.error);
 assert.equal(auto.data.status,"accepted");
 assert.equal(auto.data.auto_accepted,true);
 assert.equal(owner(donated).owner_id,hired);
 await grant("auto_accept_items",false);
 const failNpc=make("tag forged target");
 deny(await rpc(actor,ONE,request(failNpc,"npc",forgePc)),"tagged Forge PC target","42501");
 deny(await rpc(actor,ONE,request(failNpc,"npc",hiddenNpc)),"hidden NPC target","42501");
 assert.equal(owner(failNpc).owner_type,"player");
 console.log("PASS T46-C2B14-P8-NPC: genuine Forge-character gear source pending, explicitly delegated autoaccept, hidden/tagged NPC recipient denied");

 const bad=make("source denied");
 deny(await rpc(other,ONE,request(bad,"npc",hired)),"outsider cannot give account item","42501");
 deny(await rpc(actor,ONE,request(bad,"merchant",hired)),"merchant unsupported","22023");
 deny(await rpc(actor,ONE,request(bad,"player",other.id,"character",forgeSource)),
  "Forge-to-account not admitted","22023");
 deny(await rpc(actor,ONE,request(bad,"player",actor.id)),"self account send not admitted","22023");
 console.log("PASS T46-C2B14-P8-AUTH: actor/owner verified server-side, no merchant stock, no character-to-account, self-send or hidden destination bypass");

 const n1=make("pending batch 1"),n2=make("pending batch 2");
 const np=bulk([n2,n1],"npc",hired);
 const nRes=await rpc(actor,BULK,np);assert.ifError(nRes.error);
 assert.equal(nRes.data.receipts.length,2);
 assert.deepEqual(nRes.data.receipts.map(x=>x.status),["pending","pending"]);
 assert.deepEqual(nRes.data.receipts.map(x=>x.request_id),[np.p_request_id,np.p_request_id]);
 assert.equal(owner(n1).owner_type,"player");assert.equal(owner(n2).owner_type,"player");
 const nReplay=await rpc(actor,BULK,np);assert.ifError(nReplay.error);
 assert.deepEqual(nReplay.data,nRes.data);
 console.log("PASS T46-C2B14-P8-BULK-NPC: signed atomic 2 pending offers, deterministic replay, parent request ID and no premature ownership move");
 const p1=make("player batch 1"),p2=make("player batch 2");
 const pb=bulk([p2,p1],"player",other.id);
 const pbResult=await rpc(actor,BULK,pb);assert.ifError(pbResult.error);
 assert.equal(pbResult.data.receipts.length,2);
 assert.equal(owner(p1).owner_id,other.id);
 assert.equal(owner(p2).owner_id,other.id);
 const rollbackRows=[make("rollback valid"),make("rollback belongs to another")].sort();
 // The valid first UUID MUST be committed speculatively before the second
 // invalid UUID forces a rollback; avoids a false pass from random ordering.
 const rollback=rollbackRows[0],wrong=rollbackRows[1];
 sql("UPDATE public.inventory_items SET owner_id="+q(other.id)+",user_id="+q(other.id)+
  " WHERE id="+q(wrong));
 const badBatch=bulk([rollback,wrong],"player",other.id);
 deny(await rpc(actor,BULK,badBatch),"atomic owner mismatch batch","40001");
 assert.equal(owner(rollback).owner_id,actor.id);
 const count=sql("SELECT count(*) FROM private.c34_b14_p8_intent_receipts WHERE request_id="+q(badBatch.p_request_id));
 assert.equal(count,"0");
 deny(await rpc(actor,BULK,bulk([rollback,rollback],"npc",hired)),"duplicate bulk item","22023");
 console.log("PASS T46-C2B14-P8-BULK-PLAYER: signed immediate player atomic batch, failed second item rolls back all and duplicate IDs denied");
 // Adversarial test: a caller knows any chosen parent UUID and item ID.
 // The OLD deterministic child=md5("c34-p8-child:" + parent + ":" + item)
 // was publicly computable; pre-seeding that single P8 request could make a
 // later batch silently reuse an old receipt instead of checking ownership.
 const preseeded=make("predictable child preseed"),sibling=make("preseed sibling");
 const parentNonce=randomUUID();
 const digest=createHash("md5").update(
  "c34-p8-child:"+parentNonce+":"+preseeded).digest("hex");
 const predictedChild=[digest.slice(0,8),digest.slice(8,12),
  digest.slice(12,16),digest.slice(16,20),digest.slice(20)].join("-");
 const malicious=await rpc(actor,ONE,request(
  preseeded,"player",other.id,"player",actor.id,predictedChild));
 assert.ifError(malicious.error);
 assert.equal(owner(preseeded).owner_id,other.id);
 const adversarialBulk=bulk([sibling,preseeded],"player",other.id,parentNonce);
 deny(await rpc(actor,BULK,adversarialBulk),
  "preseeded deterministic child cannot bypass stale ownership check","40001");
 assert.equal(owner(sibling).owner_id,actor.id,
  "Entire batch must roll back despite a previously submitted child-like ID");
 assert.equal(sql("SELECT count(*) FROM private.c34_b14_p8_intent_receipts WHERE request_id="+
  q(parentNonce)),"0","Bad bulk request cannot leave a parent receipt");
 console.log("PASS T46-C2B14-P8-CHILD-NONCE: preseeded predictable child request cannot skip current item owner-CAS or partially settle a batch");

 const racer=make("same request concurrency"),race=request(racer,"player",other.id);
 const parallel=await Promise.all([rpc(actor,ONE,race),rpc(actor,ONE,race)]);
 parallel.forEach(x=>assert.ifError(x.error));
 assert.deepEqual(parallel[0].data,parallel[1].data);
 assert.equal(owner(racer).owner_id,other.id);
 console.log("PASS T46-C2B14-P8-CONCURRENT: real same-JWT parallel idempotent request serialized to one transfer/receipt");

 const {createClient}=await import("@supabase/supabase-js");
 const anon=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 deny(await rpc({who:anon},ONE,request(bad,"npc",hired)),"anonymous P8",null);
 for(let i=0;i<sigs.length;i++)
  assert.equal(hash(sigs[i]),initial[i],"P8 changed original "+sigs[i]);
 console.log("PASS T46-C2B14-P8-SIGNED: signed local player/NPC/Forge/grant/atomic-bulk/replay/parallel, original function MD5 parity; legacy direct consent bypass STILL NOT CLOSED");
}
