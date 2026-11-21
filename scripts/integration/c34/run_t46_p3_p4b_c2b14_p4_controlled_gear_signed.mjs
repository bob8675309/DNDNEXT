// C34 B14-P4: versioned item-send via ORIGINAL separated NPC control decision.
// Real GoTrue users and PostgREST to disposable PG17 only; never runtime SQL.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const scriptPath="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p4_controlled_npc_gear_pg17.sql";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function runC34B14P4ControlledGearSigned({env,sql,q,lit,roles}) {
 for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGDATABASE:"postgres",PGUSER:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 })) assert.equal(env[key],value,"P4 refuses non-disposable "+key);
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 assert.equal(sql("SELECT current_database()"),"postgres");

 const originalP2=sql("SELECT md5(pg_get_functiondef('public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)'::regprocedure))");
 const originalP3=sql("SELECT md5(pg_get_functiondef('public.c34_b14_p3_inventory_context_v1(text,text)'::regprocedure))");
 const originalLegacy=sql("SELECT md5(pg_get_functiondef('public.transfer_inventory_item_v1(uuid,text,text)'::regprocedure))");
 const originalRole=sql("SELECT md5(pg_get_functiondef('public.is_admin(uuid)'::regprocedure))");
 const originalBuyer=sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");

 const candidate=fs.readFileSync(path.join(root,scriptPath),"utf8");
 assert.match(candidate,/RESEARCH ONLY/);
 assert.match(candidate,/ADD COLUMN IF NOT EXISTS can_control boolean NOT NULL DEFAULT false/);
 assert.match(candidate,/v_item\.user_id IS DISTINCT FROM v_caller/);
 assert.match(candidate,/v_item\.owner_type IS DISTINCT FROM 'character'/);
 assert.match(candidate,/v_target_kind IS DISTINCT FROM 'npc'/);
 assert.match(candidate,/coalesce\(cp\.can_control,false\) OR coalesce\(cp\.can_edit,false\)/);
 assert.doesNotMatch(candidate,/ALTER POLICY|DROP POLICY|ALTER FUNCTION public\.is_admin/i);
 sql(candidate);
 assert.equal(sql("SELECT has_function_privilege('anon',"+
  "'public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)','EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+
  "'public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)','EXECUTE')"),"t");
 sql("NOTIFY pgrst,'reload schema'");

 const character=(id,name,kind,tags,hidden=false)=>{
  sql("INSERT INTO public.characters(id,name,kind,is_hidden,state,tags) VALUES("+
   q(id)+","+lit(name)+","+lit(kind)+","+(hidden?"true":"false")+
   ",'resting',ARRAY["+tags.map(t=>lit(t)).join(",")+"]::text[])");
 };
 const permission=(characterId,userId,{inventory=false,edit=false,control=false}={})=>{
  sql("INSERT INTO public.character_permissions("+
   "character_id,user_id,can_inventory,can_edit,can_convert,can_control) VALUES("+
   q(characterId)+","+q(userId)+","+(inventory?"true":"false")+","+
   (edit?"true":"false")+",false,"+(control?"true":"false")+") "+
   "ON CONFLICT(character_id,user_id) DO UPDATE SET "+
   "can_inventory=EXCLUDED.can_inventory,can_edit=EXCLUDED.can_edit,can_control=EXCLUDED.can_control");
 };
 const source=randomUUID(),otherSameAccountPC=randomUUID(),outsiderPC=randomUUID();
 const sidekick=randomUUID(),henchman=randomUUID(),uncontrolledNpc=randomUUID();
 const otherControlled=randomUUID(),hiddenNpc=randomUUID();
 character(source,"P4 source player character","player",["player-character"]);
 character(otherSameAccountPC,"P4 other same-account character","player",["player-character"]);
 character(outsiderPC,"P4 foreign player's character","player",["player-character"]);
 character(sidekick,"P4 sidekick under control","npc",["sidekick"]);
 character(henchman,"P4 henchman under control","npc",["henchman"]);
 character(uncontrolledNpc,"P4 inventory-only unrelated NPC","npc",["npc"]);
 character(otherControlled,"P4 second controllable NPC","npc",["sidekick"]);
 character(hiddenNpc,"P4 hidden controlled sidekick","npc",["sidekick"],true);
 permission(source,roles.OWNER.id,{inventory:true});
 permission(otherSameAccountPC,roles.OWNER.id,{inventory:true});
 permission(outsiderPC,roles.OUTSIDER.id,{inventory:true});
 permission(sidekick,roles.OWNER.id,{control:true});
 permission(henchman,roles.OWNER.id,{edit:true});
 permission(uncontrolledNpc,roles.OWNER.id,{inventory:true});
 permission(otherControlled,roles.OWNER.id,{control:true});
 permission(hiddenNpc,roles.OWNER.id,{control:true});

 const seed=(label,characterId,userId=roles.OWNER.id)=>{
  const id=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,"+
   "item_id,item_name,item_type,item_rarity,card_payload,is_equipped,equip_slot) VALUES("+
   q(id)+",'character',"+q(characterId)+","+q(userId)+
   ",'p4-forge-source',"+lit(label)+",'Misc','Common',"+
   lit(JSON.stringify({source:"forge",itemKey:"p4-original-gear",label}))+
   "::jsonb,true,'weapon_1')");
  return id;
 };
 const state=id=>JSON.parse(sql("SELECT row_to_json(x)::text FROM public.inventory_items x WHERE id="+q(id)));
 const send=async(actor,itemId,sourceCharacterId,targetNpcId)=>{
  let result;
  for(let i=0;i<28;i++){
   result=await actor.who.rpc("c34_b14_p4_send_character_gear_to_controlled_npc_v1",{
    p_item_id:itemId,p_expected_source_character_id:sourceCharacterId,
    p_target_npc_id:targetNpcId
   });
   if(result.error?.code!=="PGRST202") break;
   await delay(180);
  }
  return result;
 };
 const denied=(response,label,code="42501")=>{
  assert.ok(response.error,label+": unexpected success "+JSON.stringify(response.data));
  assert.equal(response.error.code,code,label+": "+JSON.stringify(response.error));
 };
 const first=seed("P4 sidekick donation",source);
 const allowed=await send(roles.OWNER,first,source,sidekick);
 assert.ifError(allowed.error);
 assert.equal(allowed.data.owner_type,"npc");
 assert.equal(allowed.data.owner_id,sidekick);
 assert.equal(allowed.data.user_id,null);
 assert.equal(allowed.data.is_equipped,false);
 assert.equal(allowed.data.equip_slot,null);
 assert.equal(allowed.data.card_payload.source,"forge");
 assert.equal(state(first).owner_id,sidekick);
 const controlDoesNotGrantInventory=await roles.OWNER.who.from("inventory_items")
  .select("id").eq("id",first);
 assert.ifError(controlDoesNotGrantInventory.error);
 assert.deepEqual(controlDoesNotGrantInventory.data,[],
  "Independent combat control may receive one item, not infer NPC inventory SELECT");
 console.log("PASS T46-C2B14-P4-SIDEKICK: genuine signed player sends character-scoped gear to explicitly controlled sidekick; original Forge payload preserved, auto-unequipped, control-only recipient does not grant inventory read");

 const toHenchman=seed("P4 henchman donation",source);
 const viaEdit=await send(roles.OWNER,toHenchman,source,henchman);
 assert.ifError(viaEdit.error);
 assert.equal(viaEdit.data.owner_id,henchman,
  "PR312 independent can_edit remains a legitimate controller path");
 const inventoryOnly=seed("P4 inventory does not grant control",source);
 denied(await send(roles.OWNER,inventoryOnly,source,uncontrolledNpc),
  "inventory-only permission must not be interpreted as combat control");
 assert.equal(state(inventoryOnly).owner_id,source);
 const foreign=seed("P4 foreign creator gear",outsiderPC,roles.OUTSIDER.id);
 permission(outsiderPC,roles.OWNER.id,{inventory:true});
 denied(await send(roles.OWNER,foreign,outsiderPC,sidekick),
  "stale/foreign provenance must not authorize character gear despite inventory permission");
 assert.equal(state(foreign).owner_id,outsiderPC);
 console.log("PASS T46-C2B14-P4-CONTROL-SEPARATION: existing can_edit controller works, can_inventory-only recipient denied, foreign-account source denied");

 const noPCtoPC=seed("P4 no same-account PC to PC",source);
 denied(await send(roles.OWNER,noPCtoPC,source,otherSameAccountPC),
  "owner-directed same-account PC destination prohibited");
 assert.equal(state(noPCtoPC).owner_id,source);
 const hidden=seed("P4 hidden NPC denied",source);
 denied(await send(roles.OWNER,hidden,source,hiddenNpc),
  "hidden controlled sidekick remains invisible to ordinary player");
 assert.equal(state(hidden).owner_id,source);
 const wrongOwner=seed("P4 incorrect source CAS",source);
 denied(await send(roles.OWNER,wrongOwner,otherSameAccountPC,sidekick),
  "stale source-owner compare-and-swap","40001");
 assert.equal(state(wrongOwner).owner_id,source);
 console.log("PASS T46-C2B14-P4-BOUNDARIES: same-account player-character destination, hidden controlled NPC and stale owner denied without changes");

 const afterRevoke=seed("P4 revocation of controlled NPC",source);
 sql("UPDATE public.character_permissions SET can_control=false "+
  "WHERE character_id="+q(sidekick)+" AND user_id="+q(roles.OWNER.id));
 denied(await send(roles.OWNER,afterRevoke,source,sidekick),
  "signed controller grant revocation with same JWT");
 assert.equal(state(afterRevoke).owner_id,source);
 const sourceRevoked=seed("P4 source inventory revocation",source);
 sql("UPDATE public.character_permissions SET can_inventory=false,can_edit=false "+
  "WHERE character_id="+q(source)+" AND user_id="+q(roles.OWNER.id));
 denied(await send(roles.OWNER,sourceRevoked,source,henchman),
  "signed source inventory revoke with same JWT");
 assert.equal(state(sourceRevoked).owner_id,source);
 console.log("PASS T46-C2B14-P4-REVOKE: same JWT sees source inventory and destination delegated-control revocations immediately");

 permission(source,roles.OWNER.id,{inventory:true});
 permission(sidekick,roles.OWNER.id,{control:true});
 const concurrent=seed("P4 competing destinations",source);
 const racing=await Promise.all([
  send(roles.OWNER,concurrent,source,sidekick),
  send(roles.OWNER,concurrent,source,otherControlled)
 ]);
 const wins=racing.filter(x=>!x.error),fails=racing.filter(x=>x.error);
 assert.equal(wins.length,1,"exactly one competing recipient wins");
 assert.equal(fails.length,1,"one stale source rejected");
 assert.equal(fails[0].error.code,"40001");
 assert.equal(state(concurrent).owner_id,wins[0].data.owner_id);
 console.log("PASS T46-C2B14-P4-CONCURRENCY: overlapping real signed PostgREST character gear donation serializes; one commit, losing 40001");

 const otherAccountItem=randomUUID();
 sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,item_type,item_rarity) VALUES("+
  q(otherAccountItem)+",'player',"+q(roles.OWNER.id)+","+q(roles.OWNER.id)+
  ",'P4 original other-player send','Misc','Common')");
 const preservedOther=await roles.OWNER.who.rpc("c34_b14_p2_transfer_inventory_item_v1",{
  p_item_id:otherAccountItem,p_target_type:"player",p_target_id:roles.OUTSIDER.id,
  p_expected_owner_type:"player",p_expected_owner_id:roles.OWNER.id
 });
 assert.ifError(preservedOther.error);
 assert.equal(preservedOther.data.owner_id,roles.OUTSIDER.id);
 assert.equal(preservedOther.data.user_id,roles.OUTSIDER.id);
 const {createClient}=await import("@supabase/supabase-js");
 const anon=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 denied(await send({who:anon},sourceRevoked,source,sidekick),
  "anon API cannot send character-owned gear");
 console.log("PASS T46-C2B14-P4-OTHER-RECIPIENTS: unchanged P2 player-account-to-other-player send still succeeds, anonymous character gear transfer denied");

 const hash=(name,sig)=>sql("SELECT md5(pg_get_functiondef('"+name+sig+"'::regprocedure))");
 assert.equal(hash("public.c34_b14_p2_transfer_inventory_item_v1",
  "(uuid,text,text,text,text)"),originalP2);
 assert.equal(hash("public.c34_b14_p3_inventory_context_v1","(text,text)"),originalP3);
 assert.equal(hash("public.transfer_inventory_item_v1","(uuid,text,text)"),originalLegacy);
 assert.equal(hash("public.is_admin","(uuid)"),originalRole);
 assert.equal(hash("public.buy_from_merchant","(uuid,uuid,integer)"),originalBuyer);
 console.log("PASS T46-C2B14-P4-SIGNED: owner-directed source-PC to controlled henchmen/sidekick only, no same-account PC transfer, permissions independent/revocable, original functions unmodified; disposable research ONLY");
}
