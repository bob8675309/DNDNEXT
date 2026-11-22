// C34 B14-P8 GM settlement; genuine signed disposable PG17 research only.
// Runs after accepted P8 dispatcher tests. Does NOT edit original P6 SQL.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const script="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_gm_offer_settlement_pg17.sql";
const wait=ms=>new Promise(r=>setTimeout(r,ms));

export async function runC34B14P8GmSettlementSigned({env,sql,q,lit,roles,hired,forgeSource}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321"
 }))assert.equal(env[k],v,"P8 GM settlement is local PG17 ONLY");
 const p6sig="public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)";
 const p8sig="public.c34_b14_p8_dispatch_item_intent_v1(uuid,uuid,text,text,text,text)";
 const hash=sig=>sql("SELECT md5(pg_get_functiondef('"+sig+"'::regprocedure))");
 const original=[hash(p6sig),hash(p8sig)];
 const actor=roles.OWNER;
 const give=(name,ownerType="character",ownerId=forgeSource)=>{
  const id=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,"+
   "item_type,item_rarity,is_equipped,card_payload) VALUES("+
   q(id)+","+lit(ownerType)+","+q(ownerId)+","+q(actor.id)+","+
   lit("P8-GM "+name)+",'Misc','Common',false,'"+
   '{"privateNote":"P8-GM-SECRET-NEVER-RETURN"}'+"'::jsonb)");
  return id;
 };
 const owned=id=>JSON.parse(sql("SELECT json_build_object('owner_type',owner_type,"+
  "'owner_id',owner_id,'user_id',user_id)::text FROM public.inventory_items WHERE id="+q(id)));
 const state=id=>sql("SELECT state FROM private.c34_b14_p6_item_offers WHERE request_id="+q(id));
 const args=(id,sourceType="character",ownerId=forgeSource,key=randomUUID())=>({
  p_request_id:key,p_item_id:id,p_expected_owner_type:sourceType,
  p_expected_owner_id:ownerId,p_target_type:"npc",p_target_id:hired
 });
 const rpc=async(who,name,p)=>{
  let r;for(let i=0;i<30;i++){
   r=await who.who.rpc(name,p);
   if(r.error?.code!=="PGRST202")break;
   await wait(180);
  }return r;
 };
 const deny=(r,label,code)=>{
  assert.ok(r.error,label+" wrongly succeeded "+JSON.stringify(r.data));
  if(code)assert.equal(r.error.code,code,label+" SQLSTATE "+JSON.stringify(r.error));
 };
 const cp=(npc,column,value)=>sql("UPDATE public.character_permissions SET "+
  column+"="+(value?"true":"false")+" WHERE character_id="+q(npc)+
  " AND user_id="+q(actor.id));
 const one="c34_b14_p8_dispatch_item_intent_v1";
 const gm="c34_b14_p8_gm_decide_item_offer_v1";
 const queue="c34_b14_p8_gm_pending_offers_v1";
 // Expected original RED, before installing the versioned replacement.
 const redItem=give("historical original RED");
 const redOffer=args(redItem);
 const redPending=await rpc(actor,one,redOffer);assert.ifError(redPending.error);
 assert.equal(redPending.data.status,"pending");
 cp(hired,"can_control",false);
 const old=await rpc(roles.GM,"c34_b14_p6_decide_item_offer_v1",{
  p_request_id:redOffer.p_request_id,p_accept:true
 });
 assert.ifError(old.error);
 assert.equal(old.data.status,"accepted","Original P6 has the documented recipient-control gap");
 assert.equal(owned(redItem).owner_type,"npc");
 cp(hired,"can_control",true);
 console.log("PASS T46-C2B14-P8-GM-ORIGINAL-RED: disposable original P6 GM acceptance succeeds after recipient controller revoke; original gap reproduced without hosted writes");

 const source=fs.readFileSync(path.join(root,script),"utf8");
 assert.match(source,/DISPOSABLE SIGNED RESEARCH ONLY/);
 assert.match(source,/REVOKE ALL ON FUNCTION public.c34_b14_p6_decide_item_offer_v1/);
 assert.doesNotMatch(source,/DROP FUNCTION|ALTER POLICY|DROP TABLE/);
 sql(source);
 assert.equal(hash(p6sig),original[0],"P8 GM changed accepted P6 function body");
 assert.equal(hash(p8sig),original[1],"P8 GM changed accepted dispatcher");
 for(const signature of [p6sig,
  "public.c34_b14_p8_gm_pending_offers_v1(uuid,integer)",
  "public.c34_b14_p8_gm_decide_item_offer_v1(uuid,boolean)"]){
  const allow=signature===p6sig?"f":"t";
  assert.equal(sql("SELECT has_function_privilege('authenticated',"+
   lit(signature)+",'EXECUTE')"),allow);
  assert.equal(sql("SELECT has_function_privilege('anon',"+
   lit(signature)+",'EXECUTE')"),"f");
 }
 sql("NOTIFY pgrst,'reload schema'");
 const {createClient}=await import("@supabase/supabase-js");
 const anon=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 deny(await rpc(actor,queue,{p_npc_id:hired,p_limit:25}),
  "non-GM source player sees private offer queue","42501");
 deny(await rpc(roles.OUTSIDER,queue,{p_npc_id:hired,p_limit:25}),
  "outsider sees private queue","42501");
 deny(await rpc({who:anon},queue,{p_npc_id:hired,p_limit:25}),
  "anon sees private queue",null);
 deny(await rpc(actor,gm,{p_request_id:redOffer.p_request_id,p_accept:true}),
  "non-GM can settle offer","42501");
 deny(await rpc(roles.GM,"c34_b14_p6_decide_item_offer_v1",{
  p_request_id:redOffer.p_request_id,p_accept:false
 }),"old P6 GM decision bypass remains executable",null);
 console.log("PASS T46-C2B14-P8-GM-ACL: private GM queue/decision reject source player/outsider/anon; original P6 decision EXECUTE removed in disposable fixture only");

 const item=give("revocable Forge recipient");
 const offer=args(item);
 const pending=await rpc(actor,one,offer);assert.ifError(pending.error);
 assert.equal(pending.data.status,"pending");
 const listing=await rpc(roles.GM,queue,{p_npc_id:hired,p_limit:50});
 assert.ifError(listing.error);
 assert.ok(Array.isArray(listing.data));
 assert.ok(listing.data.some(x=>x.request_id===offer.p_request_id));
 assert.ok(!JSON.stringify(listing.data).includes("P8-GM-SECRET-NEVER-RETURN"));
 assert.equal(listing.data.find(x=>x.request_id===offer.p_request_id).item_name,
  "P8-GM revocable Forge recipient");
 cp(hired,"can_control",false);
 deny(await rpc(roles.GM,gm,{p_request_id:offer.p_request_id,p_accept:true}),
  "GM cannot settle a revoked recipient delegation","42501");
 assert.equal(state(offer.p_request_id),"pending");
 assert.equal(owned(item).owner_type,"character");
 cp(hired,"can_control",true);
 cp(forgeSource,"can_inventory",false);
 deny(await rpc(roles.GM,gm,{p_request_id:offer.p_request_id,p_accept:true}),
  "GM cannot settle after source inventory grant revoked","42501");
 assert.equal(state(offer.p_request_id),"pending");
 cp(forgeSource,"can_inventory",true);
 sql("UPDATE public.characters SET is_hidden=true WHERE id="+q(hired));
 deny(await rpc(roles.GM,gm,{p_request_id:offer.p_request_id,p_accept:true}),
  "GM cannot accept into now hidden NPC","42501");
 assert.equal(owned(item).owner_type,"character");
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(hired));
 const accepted=await rpc(roles.GM,gm,{p_request_id:offer.p_request_id,p_accept:true});
 assert.ifError(accepted.error);
 assert.equal(accepted.data.status,"accepted");
 assert.equal(state(offer.p_request_id),"accepted");
 assert.equal(owned(item).owner_id,hired);
 deny(await rpc(roles.GM,gm,{p_request_id:offer.p_request_id,p_accept:true}),
  "GM duplicate decision replay","40001");
 console.log("PASS T46-C2B14-P8-GM-REVOCATION: current recipient controller, source inventory, hidden status checked at final acceptance; deny preserves pending/item; final accept once");

 const no=give("decline preserved");
 const noOffer=args(no);
 assert.ifError((await rpc(actor,one,noOffer)).error);
 cp(hired,"can_control",false);
 const declined=await rpc(roles.GM,gm,{p_request_id:noOffer.p_request_id,p_accept:false});
 assert.ifError(declined.error);
 assert.equal(declined.data.status,"declined");
 assert.equal(owned(no).owner_type,"character");
 assert.equal(state(noOffer.p_request_id),"declined");
 cp(hired,"can_control",true);
 console.log("PASS T46-C2B14-P8-GM-DECLINE: GM may decline after controller revoke without taking item");

 const player=give("independent player account pending","player",actor.id);
 const playerOffer=args(player,"player",actor.id);
 assert.ifError((await rpc(actor,one,playerOffer)).error);
 cp(hired,"can_control",false);
 const playerAccepted=await rpc(roles.GM,gm,{
  p_request_id:playerOffer.p_request_id,p_accept:true
 });assert.ifError(playerAccepted.error);
 assert.equal(playerAccepted.data.status,"accepted");
 assert.equal(owned(player).owner_id,hired);
 cp(hired,"can_control",true);
 console.log("PASS T46-C2B14-P8-GM-ACCOUNT: independent player-account gift still uses GM consent without requiring NPC controller");

 const raceItem=give("parallel GM acceptance");
 const raceOffer=args(raceItem);
 assert.ifError((await rpc(actor,one,raceOffer)).error);
 const both=await Promise.all([
  rpc(roles.GM,gm,{p_request_id:raceOffer.p_request_id,p_accept:true}),
  rpc(roles.GM,gm,{p_request_id:raceOffer.p_request_id,p_accept:true})
 ]);
 assert.equal(both.filter(r=>!r.error).length,1,"Exactly one GM settlement wins");
 assert.equal(both.filter(r=>r.error?.code==="40001").length,1,
  "Loser gets stale offer/ownership conflict");
 assert.equal(state(raceOffer.p_request_id),"accepted");
 assert.equal(owned(raceItem).owner_id,hired);
 assert.equal(hash(p6sig),original[0],"P6 must remain source-identical after tests");
 assert.equal(hash(p8sig),original[1],"P8 must remain source-identical after tests");
 console.log("PASS T46-C2B14-P8-GM-RACE: parallel genuine signed decisions settle once; loser 40001, original P6/P8 function bodies unchanged");
 console.log("PASS T46-C2B14-P8-GM-SIGNED: original RED then versioned GM queue/accept/decline/current-control GREEN in disposable local PG17; old decision blocked; NO hosted cutover or legacy transfer claim");
}
