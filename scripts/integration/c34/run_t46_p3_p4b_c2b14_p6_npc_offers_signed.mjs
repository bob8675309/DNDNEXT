// C34 B14-P6 real GoTrue/PostgREST signed disposable PG17 research only.
// Runs AFTER unchanged accepted P4 tests; stages independent read-only NPC
// capabilities and pending-versus-auto-accepted item offers. No gameplay edits.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const localSqlPath="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p6_npc_capabilities_and_offers_pg17.sql";
const delay=ms=>new Promise(r=>setTimeout(r,ms));

export async function runC34B14P6NpcOffersSigned({env,sql,q,lit,roles}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[k],v,"P6 local scratch guard "+k);
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 assert.equal(sql("SELECT current_database()"),"postgres");
 const hash=(reg)=>sql("SELECT md5(pg_get_functiondef('"+reg+"'::regprocedure))");
 const original={
  p4:hash("public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)"),
  p3:hash("public.c34_b14_p3_inventory_context_v1(text,text)"),
  p2:hash("public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)"),
  legacy:hash("public.transfer_inventory_item_v1(uuid,text,text)"),
  role:hash("public.is_admin(uuid)"),
  buyer:hash("public.buy_from_merchant(uuid,uuid,integer)")
 };
 const code=fs.readFileSync(path.join(root,localSqlPath),"utf8");
 assert.match(code,/RESEARCH-ONLY disposable PG17/);
 assert.match(code,/CREATE TABLE IF NOT EXISTS private.c34_b14_p6_item_offers/);
 assert.match(code,/ALTER TABLE private.c34_b14_p6_item_offers ENABLE ROW LEVEL SECURITY/);
 assert.match(code,/REVOKE EXECUTE ON FUNCTION\s+public.c34_b14_p4_send_character_gear/);
 assert.doesNotMatch(code,/DROP TABLE|DROP POLICY|ALTER FUNCTION public.is_admin/i);
 sql(code);
 for(const sig of [
  "public.c34_b14_p6_set_npc_capability_v1(uuid,uuid,text,boolean)",
  "public.c34_b14_p6_npc_capability_context_v1(uuid)",
  "public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)",
  "public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)",
  "public.c34_b14_p6_cancel_item_offer_v1(uuid)"
 ]){
  assert.equal(sql("SELECT has_function_privilege('anon',"+lit(sig)+",'EXECUTE')"),"f");
  assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(sig)+",'EXECUTE')"),"t");
 }
 const p4sig="public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)";
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(p4sig)+",'EXECUTE')"),"f");
 assert.equal(sql("SELECT has_table_privilege('authenticated','private.c34_b14_p6_item_offers','SELECT')"),"f");
 assert.equal(sql("SELECT has_table_privilege('authenticated','private.c34_b14_p6_npc_grants','SELECT')"),"f");
 sql("NOTIFY pgrst,'reload schema'");
 console.log("PASS T46-C2B14-P6-LOCAL: versioned sealed private RLS grants/offers; anon denied, direct P4 bypass revoked only in scratch, originals unchanged");

 const createNpc=(name,{hidden=false,pc=false}={})=>{
  const id=randomUUID();
  sql("INSERT INTO public.characters(id,name,kind,is_hidden,state,tags) VALUES("+
   q(id)+","+lit(name)+",'npc',"+(hidden?"true":"false")+
   ",'resting',ARRAY["+ (pc?"'player-character'":"'npc'")+"]::text[])");
  return id;
 };
 const sourcePc=createNpc("P6 Forge source",{pc:true});
 const independent=createNpc("P6 independent hireling");
 const delegated=createNpc("P6 fully delegated friend");
 const viewOnly=createNpc("P6 hired read-only");
 const hidden=createNpc("P6 hidden quest NPC",{hidden:true});
 const forgedPcRecipient=createNpc("P6 other user PC",{pc:true});
 const sourceGrant=(user,inventory=true)=>{
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert,can_control) VALUES("+
   q(sourcePc)+","+q(user.id)+","+(inventory?"true":"false")+",false,false,false) "+
   "ON CONFLICT(character_id,user_id) DO UPDATE SET can_inventory=EXCLUDED.can_inventory,can_edit=false");
 };
 sourceGrant(roles.OWNER);
 const control=(npc,enabled)=>{
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert,can_control) VALUES("+
   q(npc)+","+q(roles.OWNER.id)+",false,false,false,"+(enabled?"true":"false")+") "+
   "ON CONFLICT(character_id,user_id) DO UPDATE SET can_inventory=false,can_edit=false,can_control=EXCLUDED.can_control");
 };
 control(viewOnly,true);
 control(delegated,true);
 control(forgedPcRecipient,true);
 const seedItem=(label,{kind="character",ownerId=sourcePc,owner=roles.OWNER.id,equipped=true}={})=>{
  const id=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,item_type,item_rarity,is_equipped,equip_slot,card_payload) VALUES("+
   q(id)+","+lit(kind)+","+q(ownerId)+","+q(owner)+","+lit(label)+
   ",'Misc','Common',"+(equipped?"true,'weapon_1'":"false,NULL")+
   ","+lit(JSON.stringify({source:"Forge",marker:label,privateNote:"P6-provenance"}))+"::jsonb)");
  return id;
 };
 const state=id=>JSON.parse(sql("SELECT row_to_json(i)::text FROM public.inventory_items i WHERE id="+q(id)));
 const rpc=async(actor,name,args)=>{
  let r;
  for(let n=0;n<28;n++){
   r=await actor.who.rpc(name,args);
   if(r.error?.code!=="PGRST202")break;
   await delay(180);
  }
  return r;
 };
 const grant=(actor,npc,cap,enabled)=>rpc(actor,"c34_b14_p6_set_npc_capability_v1",{
  p_npc_id:npc,p_user_id:roles.OWNER.id,p_capability:cap,p_enabled:enabled
 });
 const ctx=(actor,npc)=>rpc(actor,"c34_b14_p6_npc_capability_context_v1",{p_npc_id:npc});
 const offer=(actor,item,npc,request=randomUUID(),type="character",source=sourcePc)=>
  rpc(actor,"c34_b14_p6_offer_item_v1",{
   p_request_id:request,p_item_id:item,p_source_owner_type:type,
   p_source_owner_id:source,p_target_npc_id:npc
  });
 const decision=(actor,request,accept)=>
  rpc(actor,"c34_b14_p6_decide_item_offer_v1",{p_request_id:request,p_accept:accept});
 const cancel=(actor,request)=>
  rpc(actor,"c34_b14_p6_cancel_item_offer_v1",{p_request_id:request});
 const denied=(res,label,code="42501")=>{
  assert.ok(res.error,label+" unexpectedly succeeded: "+JSON.stringify(res.data));
  if(code)assert.equal(res.error.code,code,label+" wrong error "+JSON.stringify(res.error));
 };

 const equipped=seedItem("P6 publicly worn sword",{kind:"npc",ownerId:viewOnly,owner:roles.OUTSIDER.id});
 const backpack=seedItem("P6 private hidden pouch",{kind:"npc",ownerId:viewOnly,owner:roles.OUTSIDER.id,equipped:false});
 const before=await ctx(roles.OWNER,viewOnly);assert.ifError(before.error);
 assert.equal(before.data.can_view_public_profile,true);
 assert.equal(before.data.can_view_backpack,false);
 assert.equal(before.data.can_manage_equipment,false);
 assert.equal(before.data.can_withdraw_items,false);
 assert.equal(before.data.can_issue_encounter_commands,true);
 assert.deepEqual(before.data.backpack,[]);
 assert.ok(before.data.worn_gear.some(r=>r.name==="P6 publicly worn sword"));
 assert.ok(!JSON.stringify(before.data).includes("P6 private hidden pouch"));
 assert.ok(!JSON.stringify(before.data).includes("privateNote"));
 denied(await grant(roles.OBSERVER,viewOnly,"view_backpack",true),"observer may not grant");
 denied(await grant(roles.OWNER,viewOnly,"view_backpack",true),"player may not grant self");
 const hireGrant=await grant(roles.GM,viewOnly,"view_backpack",true);
 assert.ifError(hireGrant.error);
 const hired=await ctx(roles.OWNER,viewOnly);assert.ifError(hired.error);
 assert.equal(hired.data.can_view_backpack,true);
 assert.equal(hired.data.can_manage_equipment,false);
 assert.equal(hired.data.can_withdraw_items,false);
 assert.ok(hired.data.backpack.some(r=>r.name==="P6 private hidden pouch"));
 assert.ok(hired.data.backpack.every(r=>!Object.hasOwn(r,"card_payload")&&!Object.hasOwn(r,"user_id")));
 const rawUpdate=await roles.OWNER.who.from("inventory_items").update({is_equipped:true})
  .eq("id",backpack).select("id");
 assert.ifError(rawUpdate.error);
 assert.deepEqual(rawUpdate.data,[],"Hired inventory viewer must not bypass existing RLS with raw UPDATE");
 assert.equal(state(backpack).is_equipped,false);
 const revokedView=await grant(roles.GM,viewOnly,"view_backpack",false);
 assert.ifError(revokedView.error);
 const afterView=await ctx(roles.OWNER,viewOnly);assert.ifError(afterView.error);
 assert.equal(afterView.data.can_view_backpack,false);
 assert.deepEqual(afterView.data.backpack,[]);
 denied(await ctx(roles.OWNER,hidden),"hidden NPC can never leak private inventory");
 denied(await ctx(roles.OWNER,forgedPcRecipient),"Forge PC kind=npc is not NPC inventory scope");
 console.log("PASS T46-C2B14-P6-READONLY-HIRE: real signed view-only backpack grant/revoke; visible worn gear vs private backpack, no equip, withdrawal or card secrets; observer/player grant denied");

 // The GM may select the preset but the capabilities remain independently
 // grantable/revocable, not a numeric tier with automatic authority.
 assert.ifError((await grant(roles.GM,viewOnly,"manage_equipment",true)).error);
 let managed=await ctx(roles.OWNER,viewOnly);assert.ifError(managed.error);
 assert.equal(managed.data.can_manage_equipment,true);
 assert.equal(managed.data.can_view_backpack,true);
 assert.equal(managed.data.can_withdraw_items,false);
 assert.equal(managed.data.can_auto_accept_items,false);
 assert.ifError((await grant(roles.GM,viewOnly,"manage_equipment",false)).error);
 managed=await ctx(roles.OWNER,viewOnly);assert.ifError(managed.error);
 assert.equal(managed.data.can_manage_equipment,false);
 assert.equal(managed.data.can_view_backpack,false);
 console.log("PASS T46-C2B14-P6-CAPABILITY-ORTHOGONAL: view, manage, withdraw, auto-receive and combat control remain distinct; GM grant/revoke is immediate");

 // Independent NPC: offer pending, item remains character-owned and equipped.
 const pendingItem=seedItem("P6 independent offer");
 const requestId=randomUUID();
 const initialOffer=await offer(roles.OWNER,pendingItem,independent,requestId);
 assert.ifError(initialOffer.error);
 assert.equal(initialOffer.data.status,"pending");
 assert.equal(initialOffer.data.auto_accepted,false);
 assert.equal(state(pendingItem).owner_id,sourcePc);
 assert.equal(state(pendingItem).is_equipped,true);
 denied(await decision(roles.OWNER,requestId,true),"sender cannot impersonate NPC acceptance");
 denied(await decision(roles.OBSERVER,requestId,true),"observer cannot impersonate GM");
 assert.equal(state(pendingItem).owner_id,sourcePc);
 const accepted=await decision(roles.GM,requestId,true);
 assert.ifError(accepted.error);
 assert.equal(accepted.data.status,"accepted");
 assert.equal(state(pendingItem).owner_id,independent);
 assert.equal(state(pendingItem).is_equipped,false);
 assert.equal(state(pendingItem).equip_slot,null);
 assert.equal(state(pendingItem).card_payload.source,"Forge");
 denied(await decision(roles.GM,requestId,true),"idempotent replay must not duplicate transfer","40001");
 denied(await offer(roles.OWNER,pendingItem,independent,requestId),"same request cannot clone accepted gear","40001");
 console.log("PASS T46-C2B14-P6-PENDING-CONSENT: independent NPC offer waits without moving item, player/observer cannot approve, real GM accepts once, equips cleared, payload preserved, replay blocked");

 const declinedItem=seedItem("P6 declined item");
 const declinedId=randomUUID();
 assert.equal((await offer(roles.OWNER,declinedItem,independent,declinedId)).data.status,"pending");
 assert.equal((await decision(roles.GM,declinedId,false)).data.status,"declined");
 assert.equal(state(declinedItem).owner_id,sourcePc);
 const cancelledItem=seedItem("P6 cancelled item");
 const cancelledId=randomUUID();
 assert.equal((await offer(roles.OWNER,cancelledItem,independent,cancelledId)).data.status,"pending");
 denied(await cancel(roles.OUTSIDER,cancelledId),"other user cannot cancel");
 const cancelled=await cancel(roles.OWNER,cancelledId);
 assert.ifError(cancelled.error);
 assert.equal(cancelled.data.status,"cancelled");
 assert.equal(state(cancelledItem).owner_id,sourcePc);
 console.log("PASS T46-C2B14-P6-DECLINE-CANCEL: decline/cancel leave exact item owner and equipped state intact; outsider cannot cancel");

 // Explicit auto-accept grant alone is insufficient. Control alone is also
 // insufficient. BOTH current NPC control and explicit auto flag required.
 assert.ifError((await grant(roles.GM,delegated,"auto_accept_items",true)).error);
 control(delegated,false);
 const notControlled=seedItem("P6 auto without control");
 const notCtrlReq=randomUUID();
 assert.equal((await offer(roles.OWNER,notControlled,delegated,notCtrlReq)).data.status,"pending");
 assert.equal(state(notControlled).owner_id,sourcePc);
 control(delegated,true);
 const autoItem=seedItem("P6 fully delegated immediate gift");
 const auto=await offer(roles.OWNER,autoItem,delegated);
 assert.ifError(auto.error);
 assert.equal(auto.data.status,"accepted");
 assert.equal(auto.data.auto_accepted,true);
 assert.equal(state(autoItem).owner_id,delegated);
 const stillNoPillage=await ctx(roles.OWNER,delegated);assert.ifError(stillNoPillage.error);
 assert.equal(stillNoPillage.data.can_auto_accept_items,true);
 assert.equal(stillNoPillage.data.can_withdraw_items,false);
 assert.equal(stillNoPillage.data.can_manage_equipment,false);
 assert.equal(stillNoPillage.data.can_view_backpack,false);
 assert.ifError((await grant(roles.GM,delegated,"auto_accept_items",false)).error);
 const afterAutoRevoke=seedItem("P6 grant revoked pending");
 assert.equal((await offer(roles.OWNER,afterAutoRevoke,delegated)).data.status,"pending");
 assert.equal(state(afterAutoRevoke).owner_id,sourcePc);
 console.log("PASS T46-C2B14-P6-AUTO-EXPLICIT: only explicit GM auto-accept AND active NPC control yields immediate gift; revocation immediately restores pending; never grants inventory withdrawal");

 // Revalidate the sender's source permissions when GM approves. A stale offer
 // should never bypass a revoked character inventory grant.
 const stale=seedItem("P6 source revoke pending");
 const staleReq=randomUUID();
 assert.equal((await offer(roles.OWNER,stale,independent,staleReq)).data.status,"pending");
 sourceGrant(roles.OWNER,false);
 denied(await decision(roles.GM,staleReq,true),"source inventory revoked before NPC approval");
 assert.equal(state(stale).owner_id,sourcePc);
 assert.ifError((await decision(roles.GM,staleReq,false)).error);
 sourceGrant(roles.OWNER,true);
 // Concurrent duplicate GM acceptance: request row lock serializes.
 const raceItem=seedItem("P6 parallel GM consent");
 const raceReq=randomUUID();
 assert.equal((await offer(roles.OWNER,raceItem,independent,raceReq)).data.status,"pending");
 const results=await Promise.all([decision(roles.GM,raceReq,true),decision(roles.ADMIN,raceReq,true)]);
 const winners=results.filter(r=>!r.error),losers=results.filter(r=>!!r.error);
 assert.equal(winners.length,1);
 assert.equal(losers.length,1);
 assert.equal(losers[0].error.code,"40001");
 assert.equal(state(raceItem).owner_id,independent);
 // An unrelated already-promised item cannot be offered twice concurrently.
 const onePending=seedItem("P6 one pending offer per row");
 const oneId=randomUUID();
 assert.equal((await offer(roles.OWNER,onePending,independent,oneId)).data.status,"pending");
 const duplicate=await offer(roles.OWNER,onePending,viewOnly,randomUUID());
 assert.ok(duplicate.error,"same item cannot be pending with two NPCs");
 assert.equal(state(onePending).owner_id,sourcePc);
 console.log("PASS T46-C2B14-P6-CONCURRENCY: parallel signed GM decisions exactly one commit and one stale conflict; duplicate pending item offer blocked");

 // Signed role isolation, owner/account and taxonomy limitations.
 const foreign=seedItem("P6 foreign source",{owner:roles.OUTSIDER.id});
 denied(await offer(roles.OWNER,foreign,independent),"foreign user item cannot be donated by caller");
 const hiddenAttempt=seedItem("P6 hidden target");
 denied(await offer(roles.OWNER,hiddenAttempt,hidden),"hidden NPC target denied");
 const pcAttempt=seedItem("P6 PC disguised NPC target");
 denied(await offer(roles.OWNER,pcAttempt,forgedPcRecipient),"PC tagged npc cannot receive as an NPC");
 const originalP4Response=await rpc(roles.OWNER,
  "c34_b14_p4_send_character_gear_to_controlled_npc_v1",
  {p_item_id:hiddenAttempt,p_expected_source_character_id:sourcePc,p_target_npc_id:viewOnly});
 assert.ok(originalP4Response.error,"P4 direct transfer must not bypass P6 pending consent");
 assert.equal(state(hiddenAttempt).owner_id,sourcePc);
 const playerAccountItem=seedItem("P6 original account item",{kind:"player",ownerId:roles.OWNER.id});
 const playerOffer=await offer(roles.OWNER,playerAccountItem,independent,randomUUID(),"player",roles.OWNER.id);
 assert.ifError(playerOffer.error);
 assert.equal(playerOffer.data.status,"pending");
 const {createClient}=await import("@supabase/supabase-js");
 const anonymous=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 denied(await offer({who:anonymous},pcAttempt,independent),"anon cannot initiate offer",null);
 console.log("PASS T46-C2B14-P6-AUTH: other-player item, hidden NPC/Forge PC destination, old P4 direct bypass and anon fail closed; original player account offer stays pending");

 for(const [name,reg] of Object.entries({
  p4:"public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)",
  p3:"public.c34_b14_p3_inventory_context_v1(text,text)",
  p2:"public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)",
  legacy:"public.transfer_inventory_item_v1(uuid,text,text)",
  role:"public.is_admin(uuid)",
  buyer:"public.buy_from_merchant(uuid,uuid,integer)"
 }))assert.equal(hash(reg),original[name],"Original "+name+" function body changed");
 console.log("PASS T46-C2B14-P6-SIGNED: view-only hire, explicit GM flags, independent pending offers/consent, full companion auto-accept, replay/revocation/concurrent GM security all source-local; legacy P2 NPC direct-send still requires separate cutover");
}
