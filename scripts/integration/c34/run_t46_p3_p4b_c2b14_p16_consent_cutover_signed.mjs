// C34 B14-P16 research-only signed GoTrue + local PG17 privilege cutover.
// Must execute AFTER all original P6, P8 GM, P14 source-accepted tests.
// All scratch role grants and new objects are restored/dropped in finally.
// NO hosted SQL, no gameplay client patch, no original source overwrite.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const file="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p16_disposable_consent_cutover_pg17.sql";
const wait=ms=>new Promise(r=>setTimeout(r,ms));

export async function runC34B14P16ConsentCutoverSigned({env,sql,q,lit,roles,hired,forgeSource}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321"
 })) assert.equal(env[k],v,"P16 can run only against disposable local PG17");
 assert.equal(env.C34_P16_SIGNED_CONFIRM,
  "P16_NO_BYPASS_DISPOSABLE_PG17_ONLY","Explicit P16 local-only opt-in required");

 const candidateSigs=[
  "public.list_item_send_targets_v1()",
  "public.transfer_inventory_item_v1(uuid,text,text)",
  "public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)",
  "public.c34_b14_p2_transfer_inventory_items_bulk_v1(uuid[],text,text,text,text)",
  "public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)",
  "public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)",
  "public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)",
  "public.c34_b14_p8_dispatch_batch_intent_v1(uuid,uuid[],text,text,text,text)"
 ];
 const exists=sig=>sql("SELECT to_regprocedure("+lit(sig)+") IS NOT NULL")==="t";
 const sigs=candidateSigs.filter(exists);
 const missingLegacy=candidateSigs.filter(sig=>!exists(sig));
 const preserved=[
  ...sigs,
  "public.c34_b14_p8_dispatch_item_intent_v1(uuid,uuid,text,text,text,text)",
  "public.c34_b14_p14_dispatch_batch_intent_v1(uuid,uuid[],text,text,text,text)",
  "public.c34_b14_p8_gm_decide_item_offer_v1(uuid,boolean)",
  "public.buy_from_merchant(uuid,uuid,integer)",
  "public.accept_trade(uuid)"
 ];
 const fnPriv=(who,sig)=>sql("SELECT has_function_privilege("+
  lit(who)+","+lit(sig)+",'EXECUTE')");
 const hash=sig=>sql("SELECT md5(pg_get_functiondef("+lit(sig)+"::regprocedure))");
 const missingPreserved=preserved.filter(sig=>!exists(sig));
 const snapshots=preserved.filter(exists).map(sig=>({sig,hash:hash(sig)}));
 const roleBefore=Object.fromEntries(sigs.map(sig=>[sig,{
  authenticated:fnPriv("authenticated",sig),anon:fnPriv("anon",sig)
 }]));
 const tableBefore={
  authenticated:sql("SELECT has_table_privilege('authenticated','public.inventory_items','UPDATE')"),
  anon:sql("SELECT has_table_privilege('anon','public.inventory_items','UPDATE')"),
  equip:sql("SELECT has_column_privilege('authenticated','public.inventory_items','is_equipped','UPDATE')"),
  owner:sql("SELECT has_column_privilege('authenticated','public.inventory_items','owner_id','UPDATE')")
 };
 assert.equal(tableBefore.authenticated,"t","signed local old update grant expected before P16");
 assert.equal(tableBefore.owner,"t","P16 must prove closure against original direct owner UPDATE");
 assert.equal(roleBefore["public.transfer_inventory_item_v1(uuid,text,text)"]?.authenticated,"t",
  "original June transfer must be initially callable");
 assert.equal(roleBefore["public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)"]?.authenticated,"t",
  "original P2 direct item send must be initially callable");
 assert.ok(missingLegacy.every(sig=>sig==="public.list_item_send_targets_v1()"),
  "Required direct-transfer function unexpectedly missing: "+missingLegacy.join(","));
 assert.ok(missingPreserved.every(sig=>sig==="public.accept_trade(uuid)"),
  "Accepted original fixture unexpectedly missing source API: "+missingPreserved.join(","));
 if(missingLegacy.length)
  console.log("P16 SOURCE-VS-INSTALLED: June target enumeration is historical SQL but absent from the genuine original PG17 fixture; no shadow/fake function created");
 const source=fs.readFileSync(path.join(root,file),"utf8");
 assert.match(source,/DO \$p16_guard\$/);
 assert.match(source,/CREATE TRIGGER c34_b14_p16_guard_direct_inventory_dml/);
 assert.match(source,/REVOKE UPDATE ON TABLE public\.inventory_items/);
 assert.ok(!source.includes("DROP FUNCTION public."),"Do not destroy original source functions");
 const actor=roles.OWNER,other=roles.OUTSIDER,gm=roles.GM;
 const {createClient}=await import("@supabase/supabase-js");
 const anon=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 const rpc=async(user,name,args)=>{
  let r;for(let i=0;i<30;i++){
   r=await user.who.rpc(name,args);
   if(r.error?.code!=="PGRST202")break;
   await wait(160);
  }return r;
 };
 const deny=(result,name,code)=>{
  assert.ok(result.error,name+" must fail, got "+JSON.stringify(result.data));
  if(code) assert.equal(result.error.code,code,name+" SQLSTATE "+JSON.stringify(result.error));
 };
 const item=(name,ownerType="player",ownerId=actor.id)=>{
  const id=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,item_type,item_rarity,is_equipped) VALUES("+
   q(id)+","+lit(ownerType)+","+q(ownerId)+","+q(actor.id)+","+lit("P16 "+name)+
   ",'Misc','Common',false)");
  return id;
 };
 const owner=id=>JSON.parse(sql("SELECT json_build_object('type',owner_type,'id',owner_id,"+
  "'account',user_id,'equip',is_equipped)::text FROM public.inventory_items WHERE id="+q(id)));
 const bulk=(ids,type,id)=>({
  p_request_id:randomUUID(),p_item_ids:ids,p_expected_owner_type:"player",
  p_expected_owner_id:actor.id,p_target_type:type,p_target_id:id
 });
 const helper="c34_b14_p16_can_offer_forge_to_npc_v1";
 let installed=false;
 try{
  sql(source);installed=true;
  sql("NOTIFY pgrst,'reload schema'");
  for(const sig of sigs){
   assert.equal(fnPriv("authenticated",sig),"f","Old authenticated RPC remains reachable "+sig);
   assert.equal(fnPriv("anon",sig),"f","Old anonymous RPC remains reachable "+sig);
  }
  for(const allowed of [
   "public.c34_b14_p8_dispatch_item_intent_v1(uuid,uuid,text,text,text,text)",
   "public.c34_b14_p14_dispatch_batch_intent_v1(uuid,uuid[],text,text,text,text)",
   "public.c34_b14_p14_my_intent_status_v1(uuid)",
   "public.c34_b14_p8_gm_decide_item_offer_v1(uuid,boolean)",
   "public.c34_b14_p6_cancel_item_offer_v1(uuid)"
  ]) assert.equal(fnPriv("authenticated",allowed),"t","Required newer consent path disabled "+allowed);
  assert.equal(sql("SELECT has_table_privilege('authenticated','public.inventory_items','UPDATE')"),"f");
  for(const column of ["owner_type","owner_id","user_id"])
   assert.equal(sql("SELECT has_column_privilege('authenticated','public.inventory_items',"+
    lit(column)+",'UPDATE')"),"f","Raw owner column still writable: "+column);
  for(const column of ["is_equipped","equip_slot","updated_at"])
   assert.equal(sql("SELECT has_column_privilege('authenticated','public.inventory_items',"+
    lit(column)+",'UPDATE')"),"t","Safe equipment column lost "+column);
  assert.equal(fnPriv("anon","public."+helper+"(uuid)"),"f");
  assert.equal(fnPriv("authenticated","public."+helper+"(uuid)"),"t");
  console.log("PASS P16-ACL: June target+transfer, P2 single+bulk, P4, P6 old offer/decision and P8 unmapped bulk inaccessible to signed clients; private-only owner columns protected");

  const direct=item("legacy target");
  const baseline=owner(direct);
  deny(await rpc(actor,"transfer_inventory_item_v1",{
   p_item_id:direct,p_target_type:"npc",p_target_id:hired
  }),"June direct NPC transfer");
  deny(await rpc(actor,"c34_b14_p2_transfer_inventory_item_v1",{
   p_item_id:direct,p_target_type:"npc",p_target_id:hired,
   p_expected_owner_type:"player",p_expected_owner_id:actor.id
  }),"P2 direct NPC transfer");
  deny(await rpc(actor,"c34_b14_p2_transfer_inventory_items_bulk_v1",{
   p_item_ids:[direct],p_target_type:"npc",p_target_id:hired,
   p_expected_owner_type:"player",p_expected_owner_id:actor.id
  }),"P2 direct NPC bulk");
  deny(await rpc(actor,"list_item_send_targets_v1",{}),"legacy NPC target enumeration");
  deny(await rpc(gm,"transfer_inventory_item_v1",{
   p_item_id:direct,p_target_type:"npc",p_target_id:hired
  }),"GM cannot invoke retired June direct transfer");
  deny(await rpc(actor,"c34_b14_p8_dispatch_batch_intent_v1",bulk([direct],"npc",hired)),
   "unmapped old P8 bulk");
  assert.deepEqual(owner(direct),baseline,"Old RPCs must not change item owner");
  console.log("PASS P16-LEGACY-DENY: genuine sender+GM JWT old June/P2 single/bulk/unmapped P8 fail; no item mutation");

  const directChange=await actor.who.from("inventory_items")
   .update({owner_type:"npc",owner_id:hired,user_id:actor.id})
   .eq("id",direct).select("id,owner_type,owner_id,user_id");
  deny(directChange,"browser raw UPDATE cannot reassign owner",null);
  assert.deepEqual(owner(direct),baseline);
  const maliciousId=randomUUID();
  const rawCreate=await actor.who.from("inventory_items").insert({
   id:maliciousId,owner_type:"npc",owner_id:hired,user_id:actor.id,
   item_name:"P16 forged NPC item",item_type:"Misc",item_rarity:"Common",
   is_equipped:false
  }).select("id");
  deny(rawCreate,"browser direct NPC INSERT should not bypass offers","42501");
  assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE id="+q(maliciousId)),"0");
  console.log("PASS P16-RAW-DML: real JWT direct owner UPDATE and forged NPC INSERT denied; original owner and no new NPC item");

  const selfEquip=await actor.who.from("inventory_items")
   .update({is_equipped:true,equip_slot:"weapon_1"})
   .eq("id",direct).select("id,is_equipped,equip_slot");
  assert.ifError(selfEquip.error);
  assert.equal(owner(direct).equip,true);
  const playerCraft=item("craft consume/restore");
  const craftBefore=JSON.parse(sql("SELECT row_to_json(i)::text FROM public.inventory_items i WHERE id="+q(playerCraft)));
  const consumed=await actor.who.from("inventory_items").delete().eq("id",playerCraft).select("id");
  assert.ifError(consumed.error);
  assert.equal(consumed.data.length,1);
  const restored=await actor.who.from("inventory_items").insert(craftBefore).select("id");
  assert.ifError(restored.error);
  assert.equal(restored.data.length,1);
  const forgeItemId=randomUUID();
  const forgeRes=await actor.who.from("inventory_items").insert({
   id:forgeItemId,owner_type:"character",owner_id:forgeSource,user_id:actor.id,
   item_name:"P16 Forge materialization compatible",item_type:"Misc",
   item_rarity:"Common",is_equipped:false
  }).select("id");
  assert.ifError(forgeRes.error);
  assert.equal(owner(forgeItemId).type,"character");
  const gmSeed=randomUUID();
  const gmCreate=await gm.who.from("inventory_items").insert({
   id:gmSeed,owner_type:"npc",owner_id:hired,user_id:gm.id,
   item_name:"P16 GM intentional grant",item_type:"Misc",
   item_rarity:"Common",is_equipped:false
  }).select("id");
  assert.ifError(gmCreate.error);
  assert.equal(owner(gmSeed).type,"npc");
  console.log("PASS P16-PRESERVE-DML: signed self equip, Town-style account DELETE/INSERT rollback, Forge item materialization and explicit GM NPC item creation still work");

  const companion=randomUUID();
  sql("INSERT INTO public.characters(id,name,kind,is_hidden,state,tags) VALUES("+
   q(companion)+",'P16 scoped companion','npc',false,'resting',ARRAY['npc']::text[])");
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_control,can_edit,can_inventory,can_convert) VALUES("+
   q(companion)+","+q(actor.id)+",true,false,false,false)");
  const ctrl=async(user)=>rpc(user,helper,{p_npc_id:companion});
  assert.equal((await ctrl(actor)).data,true);
  assert.equal((await ctrl(other)).data,false);
  sql("UPDATE public.character_permissions SET can_control=false WHERE character_id="+
   q(companion)+" AND user_id="+q(actor.id));
  assert.equal((await ctrl(actor)).data,false);
  sql("UPDATE public.character_permissions SET can_inventory=true WHERE character_id="+
   q(companion)+" AND user_id="+q(actor.id));
  assert.equal((await ctrl(actor)).data,false,"Inventory grant must never become NPC control");
  sql("UPDATE public.character_permissions SET can_edit=true WHERE character_id="+
   q(companion)+" AND user_id="+q(actor.id));
  assert.equal((await ctrl(actor)).data,true,"PR312 preserves inherited edit control");
  assert.equal(sql("SELECT can_control FROM public.character_permissions WHERE character_id="+
   q(companion)+" AND user_id="+q(actor.id)),"f","Do not backfill edit to can_control");
  sql("UPDATE public.characters SET is_hidden=true WHERE id="+q(companion));
  assert.equal((await ctrl(actor)).data,false,"Hidden NPC cannot be delegated item recipient");
  sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(companion));
  console.log("PASS P16-PR312-CONTROL: character-scoped can_control, inherited can_edit, no backfill, inventory-only no control, hidden NPC/other JWT denied");

  const playerItem=item("versioned account send");
  const send=bulk([playerItem],"player",other.id);
  const sent=await rpc(actor,"c34_b14_p14_dispatch_batch_intent_v1",send);
  assert.ifError(sent.error);
  assert.equal(sent.data.receipts[0].status,"accepted");
  assert.equal(owner(playerItem).id,other.id);
  const npcItem=item("versioned pending NPC");
  const offer=bulk([npcItem],"npc",hired);
  const pending=await rpc(actor,"c34_b14_p14_dispatch_batch_intent_v1",offer);
  assert.ifError(pending.error);
  assert.equal(pending.data.receipts[0].status,"pending");
  assert.equal(owner(npcItem).id,actor.id);
  assert.equal((await rpc(actor,"c34_b14_p14_my_intent_status_v1",{p_request_id:offer.p_request_id})).data.status,"pending");
  const child=sql("SELECT child_offer_request_id FROM private.c34_b14_p14_batch_offer_links WHERE parent_request_id="+q(offer.p_request_id));
  const accepted=await rpc(gm,"c34_b14_p8_gm_decide_item_offer_v1",{p_request_id:child,p_accept:true});
  assert.ifError(accepted.error);
  assert.equal(owner(npcItem).id,hired);
  assert.equal((await rpc(actor,"c34_b14_p14_my_intent_status_v1",{p_request_id:offer.p_request_id})).data.status,"accepted");
  console.log("PASS P16-NEW-INTENTS: versioned player send and pending→GM accepted NPC gift continue through revoked old P2/P6 grants and DML guard");

  // Legitimate commerce and trade remain separate: functions and grants do
  // not change here; full real-browser replay remains an independent gate.
  for(const sig of ["public.buy_from_merchant(uuid,uuid,integer)","public.accept_trade(uuid)"]){
   const captured=snapshots.find(x=>x.sig===sig);
   if(captured)assert.equal(hash(sig),captured.hash,"Merchant/trade body changed");
   else assert.equal(exists(sig),false,"Uninstalled original function unexpectedly appeared: "+sig);
  }
  console.log("PASS P16-INDEPENDENT: merchant buy and trade function bodies preserved; buyer/wallet and complete craft/Forge browser release tests still required");
 }finally{
  if(installed){
   // Revert ONLY research-added ACL and trigger changes. The signed original
   // suites continue after P16; no other PR-source or fixture authorization
   // may be changed simply by testing a cutover.
   sql("DROP TRIGGER IF EXISTS c34_b14_p16_guard_direct_inventory_dml ON public.inventory_items");
   sql("DROP FUNCTION IF EXISTS private.c34_b14_p16_guard_direct_inventory_dml_v1()");
   sql("DROP FUNCTION IF EXISTS public.c34_b14_p16_can_offer_forge_to_npc_v1(uuid)");
   sql("DROP FUNCTION IF EXISTS public.c34_b14_p16_is_item_grant_manager_v1()");
   sql("REVOKE UPDATE(is_equipped,equip_slot,updated_at) ON public.inventory_items FROM authenticated");
   for(const who of ["authenticated","anon"]){
    sql((tableBefore[who]==="t"?"GRANT":"REVOKE")+
     " UPDATE ON public.inventory_items "+(tableBefore[who]==="t"?"TO ":"FROM ")+who);
   }
   for(const sig of sigs){
    for(const who of ["authenticated","anon"]){
     const allowed=roleBefore[sig][who]==="t";
     sql((allowed?"GRANT":"REVOKE")+" EXECUTE ON FUNCTION "+sig+
      (allowed?" TO ":" FROM ")+who);
    }
   }
   sql("NOTIFY pgrst,'reload schema'");
   for(const snapshot of snapshots)
    assert.equal(hash(snapshot.sig),snapshot.hash,
     "P16 altered an original function body "+snapshot.sig);
   for(const sig of sigs)
    for(const who of ["authenticated","anon"])
     assert.equal(fnPriv(who,sig),roleBefore[sig][who],
      "P16 failed to restore original scratch grant "+sig+" "+who);
   assert.equal(sql("SELECT has_table_privilege('authenticated','public.inventory_items','UPDATE')"),
    tableBefore.authenticated,"P16 failed to restore table UPDATE in local test fixture");
   assert.equal(sql("SELECT has_column_privilege('authenticated','public.inventory_items','owner_id','UPDATE')"),
    tableBefore.owner);
   assert.equal(sql("SELECT has_column_privilege('authenticated','public.inventory_items','is_equipped','UPDATE')"),
    tableBefore.equip);
   console.log("PASS P16-RESTORE: research trigger/functions removed and original signed fixture grants plus all original function bodies restored");
  }
 }
 console.log("PASS P16-SIGNED DISPOSABLE: only local testing; NOT a hosted migration, full caller cutover, or proof all 34 writers are compatible");
}
