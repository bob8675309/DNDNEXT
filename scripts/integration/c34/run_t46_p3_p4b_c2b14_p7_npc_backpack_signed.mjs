// C34 B14-P7: real signed users / local PostgREST / disposable PG17 ONLY.
// Separate redacted keyset backpack read and explicit equip; original Page/RPC
// and all prior P6 consent+NPC controller behavior remain source-original.
import assert from "node:assert/strict";
import {runC34B14P9SlimNpcSigned} from "./run_t46_p3_p4b_c2b14_p9_slim_npc_signed.mjs";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const localFile="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p7_npc_backpack_page_and_equipment_pg17.sql";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runC34B14P7NpcBackpackSigned({env,sql,q,lit,roles}){
 for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGDATABASE:"postgres",PGUSER:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321"
 }))assert.equal(env[key],value,"P7 forbids non-disposable "+key);
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 const hash=reg=>sql("SELECT md5(pg_get_functiondef('"+reg+"'::regprocedure))");
 const originals={
  P6context:hash("public.c34_b14_p6_npc_capability_context_v1(uuid)"),
  P6offer:hash("public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)"),
  P6decision:hash("public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)"),
  P6grant:hash("public.c34_b14_p6_set_npc_capability_v1(uuid,uuid,text,boolean)"),
  P4:hash("public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)"),
  P2:hash("public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)"),
  legacy:hash("public.transfer_inventory_item_v1(uuid,text,text)"),
  role:hash("public.is_admin(uuid)"),
  buyer:hash("public.buy_from_merchant(uuid,uuid,integer)")
 };
 const source=fs.readFileSync(path.join(root,localFile),"utf8");
 assert.match(source,/RESEARCH-ONLY/);
 assert.match(source,/LIMIT p_page_size\+1/);
 assert.match(source,/p_page_size NOT BETWEEN 1 AND 40/);
 assert.match(source,/manage_equipment/);
 assert.ok(source.indexOf("WHERE i.id=p_item_id AND i.owner_type='npc'") <
  source.indexOf("FROM public.characters c WHERE c.id=p_npc_id FOR UPDATE"),
  "P7 item lock must precede NPC lock to avoid inversion with accepted P6 offers");
 assert.doesNotMatch(source,/CREATE TABLE|ALTER POLICY|DROP FUNCTION|DROP TABLE/);
 sql(source);
 for(const sig of [
  "public.c34_b14_p7_npc_backpack_page_v1(uuid,integer,timestamptz,uuid)",
  "public.c34_b14_p7_set_npc_equipment_v1(uuid,uuid,boolean,text,boolean)"
 ]){
  assert.equal(sql("SELECT has_function_privilege('anon',"+lit(sig)+",'EXECUTE')"),"f");
  assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(sig)+",'EXECUTE')"),"t");
 }
 sql("NOTIFY pgrst,'reload schema'");
 const npc=(name,{hidden=false,pc=false}={})=>{
  const id=randomUUID();
  sql("INSERT INTO public.characters(id,name,kind,is_hidden,state,tags) VALUES("+
   q(id)+","+lit(name)+",'npc',"+(hidden?"true":"false")+
   ",'resting',ARRAY["+lit(pc?"player-character":"npc")+"]::text[])");
  return id;
 };
 const hired=npc("P7 hired private backpack"),another=npc("P7 unrelated NPC");
 const hiddenNpc=npc("P7 private GM NPC",{hidden:true});
 const forgePc=npc("P7 forged PC kind NPC",{pc:true});
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert,can_control) VALUES("+
   q(hired)+","+q(roles.OWNER.id)+",false,false,false,true)");
 const seed=(name,days,{ownerId=hired,equipped=false,slot=null}={})=>{
  const id=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,item_type,item_rarity,is_equipped,equip_slot,card_payload,created_at) VALUES("+
   q(id)+",'npc',"+q(ownerId)+",NULL,"+lit(name)+
   ",'Misc','Common',"+(equipped?"true":"false")+","+(slot?lit(slot):"NULL")+
   ","+lit(JSON.stringify({source:"GM",secret:"P7-private-GM-payload",original:id}))+
   "::jsonb,now() - interval '"+days+" days')");
  return id;
 };
 const ids=[
  seed("P7 sword",5,{equipped:true,slot:"weapon_1"}),
  seed("P7 dagger",4),
  seed("P7 hidden letter",3),
  seed("P7 potion",2),
  seed("P7 map",1)
 ];
 const outsiderItem=seed("P7 outsider item",1,{ownerId:another});
 seed("P7 hidden GM item",1,{ownerId:hiddenNpc});
 const state=id=>JSON.parse(sql("SELECT row_to_json(i)::text FROM public.inventory_items i WHERE id="+q(id)));
 const rpc=async(actor,name,args)=>{
  let r;
  for(let tries=0;tries<25;tries++){
   r=await actor.who.rpc(name,args);
   if(r.error?.code!=="PGRST202")break;
   await delay(200);
  }
  return r;
 };
 const page=(actor,npcId,size=2,cursor=null)=>rpc(actor,"c34_b14_p7_npc_backpack_page_v1",{
  p_npc_id:npcId,p_page_size:size,
  p_after_created_at:cursor?.created_at??null,
  p_after_item_id:cursor?.item_id??null
 });
 const equip=(actor,npcId,item,desired,slot,expected)=>rpc(
  actor,"c34_b14_p7_set_npc_equipment_v1",{
   p_npc_id:npcId,p_item_id:item,p_is_equipped:desired,p_equip_slot:slot,
   p_expected_equipped:expected
 });
 const grant=(actor,npcId,capability,enabled)=>rpc(
  actor,"c34_b14_p6_set_npc_capability_v1",{
   p_npc_id:npcId,p_user_id:roles.OWNER.id,p_capability:capability,p_enabled:enabled
 });
 const denied=(response,description,code="42501")=>{
  assert.ok(response.error,description+" unexpectedly succeeded "+JSON.stringify(response.data));
  if(code)assert.equal(response.error.code,code,description+" response "+JSON.stringify(response.error));
 };
 console.log("PASS T46-C2B14-P7-SOURCE: source-original P6/Forge/transfer preserved; anon EXECUTE denied and local-only P7 read/equip RPCs installed");

 // Combat control is never private backpack visibility. Manager can read;
 // unrelated actors cannot enumerate anything (including totals).
 denied(await page(roles.OWNER,hired),"combat controller without view permission");
 denied(await page(roles.OUTSIDER,hired),"unrelated user");
 denied(await page(roles.OBSERVER,hired),"unknown nonplayer role is not admin");
 denied(await page(roles.OWNER,another),"cannot choose another NPC");
 denied(await page(roles.OWNER,hiddenNpc),"cannot see GM hidden NPC");
 denied(await page(roles.GM,forgePc),"even GM cannot use NPC scope on tagged Forge PC");
 const gmPage=await page(roles.GM,hiddenNpc);
 assert.ifError(gmPage.error);
 assert.equal(gmPage.data.items.length,1);
 assert.equal(gmPage.data.items[0].name,"P7 hidden GM item");
 console.log("PASS T46-C2B14-P7-NO-ACCESS: signed combat-only/unrelated/observer/hidden/Forge PCs fail closed; authorized GM gets hidden scope");

 const grantView=await grant(roles.GM,hired,"view_backpack",true);
 assert.ifError(grantView.error);
 const pages=[];
 let cursor=null;
 for(let i=0;i<3;i++){
  const result=await page(roles.OWNER,hired,2,cursor);
  assert.ifError(result.error);
  pages.push(result.data);
  cursor=result.data.next_cursor;
 }
 assert.deepEqual(pages.map(p=>p.items.length),[2,2,1]);
 assert.deepEqual(pages.map(p=>p.has_more),[true,true,false]);
 assert.ok(pages[0].next_cursor?.created_at);
 assert.ok(pages[0].next_cursor?.item_id);
 assert.equal(pages[2].next_cursor,null);
 const all=pages.flatMap(p=>p.items);
 assert.equal(new Set(all.map(x=>x.id)).size,5);
 assert.deepEqual(new Set(all.map(x=>x.id)),new Set(ids));
 assert.deepEqual(all.map(x=>x.name),[
  "P7 map","P7 potion","P7 hidden letter","P7 dagger","P7 sword"
 ]);
 for(const entry of all){
  assert.deepEqual(Object.keys(entry).sort(),[
   "equip_slot","id","is_equipped","name","rarity","type"
  ].sort());
  assert.ok(!JSON.stringify(entry).includes("P7-private-GM-payload"));
  assert.ok(!Object.hasOwn(entry,"card_payload"));
  assert.ok(!Object.hasOwn(entry,"user_id"));
  assert.ok(!Object.hasOwn(entry,"created_at"));
 }
 assert.ok(!JSON.stringify(pages).includes("P7 outsider item"));
 denied(await page(roles.OWNER,hired,41),"unbounded request page","22023");
 denied(await page(roles.OWNER,hired,0),"zero-page request","22023");
 const partial=await rpc(roles.OWNER,"c34_b14_p7_npc_backpack_page_v1",{
  p_npc_id:hired,p_page_size:2,p_after_created_at:pages[0].next_cursor.created_at,
  p_after_item_id:null
 });
 denied(partial,"unpaired cursor input","22023");
 console.log("PASS T46-C2B14-P7-PAGINATE: signed 2+2+1 cursor scan stable, no duplicated private items, upper limit 40 and strict paired cursor");

 const originalSourcePayload=state(ids[1]).card_payload;
 const hiredDenied=await equip(roles.OWNER,hired,ids[1],true,"weapon_2",false);
 denied(hiredDenied,"hired view-only cannot equip");
 assert.equal(state(ids[1]).is_equipped,false);
 const rawUpdate=await roles.OWNER.who.from("inventory_items").update({is_equipped:true})
  .eq("id",ids[1]).select("id");
 assert.ifError(rawUpdate.error);
 assert.deepEqual(rawUpdate.data,[]);
 assert.equal(state(ids[1]).is_equipped,false);
 console.log("PASS T46-C2B14-P7-READONLY: signed read-only view and combat-control grant cannot equip via new RPC or raw inventory DML");

 const manage=await grant(roles.GM,hired,"manage_equipment",true);
 assert.ifError(manage.error);
 const equipOK=await equip(roles.OWNER,hired,ids[1],true,"weapon_2",false);
 assert.ifError(equipOK.error);
 assert.equal(equipOK.data.is_equipped,true);
 assert.equal(equipOK.data.equip_slot,"weapon_2");
 assert.deepEqual(Object.keys(equipOK.data).sort(),["equip_slot","id","is_equipped","npc_id"].sort());
 assert.equal(state(ids[1]).is_equipped,true);
 assert.equal(state(ids[1]).equip_slot,"weapon_2");
 assert.deepEqual(state(ids[1]).card_payload,originalSourcePayload);
 denied(await equip(roles.OWNER,hired,ids[1],true,"weapon_2",false),
  "stale equipment compare-and-swap","40001");
 denied(await equip(roles.OWNER,hired,ids[2],true,"weapon_2",false),
  "occupied equipment slot","23505");
 denied(await equip(roles.OWNER,hired,ids[2],true,"not_a_slot",false),
  "unsafe equipment slot","22023");
 denied(await equip(roles.OWNER,another,outsiderItem,true,"weapon_3",false),
  "cannot equip other NPC inventory");
 const unequip=await equip(roles.OWNER,hired,ids[1],false,null,true);
 assert.ifError(unequip.error);
 assert.equal(state(ids[1]).is_equipped,false);
 assert.equal(state(ids[1]).equip_slot,null);
 denied(await equip(roles.OWNER,hired,ids[1],false,"weapon_2",false),
  "unequip must not send slot","22023");
 const revoked=await grant(roles.GM,hired,"manage_equipment",false);
 assert.ifError(revoked.error);
 denied(await equip(roles.OWNER,hired,ids[2],true,"weapon_3",false),
  "same JWT post-revoke equip denied");
 assert.equal(state(ids[2]).is_equipped,false);
 const stillReadable=await page(roles.OWNER,hired,1);
 assert.ifError(stillReadable.error);
 assert.equal(stillReadable.data.items.length,1);
 console.log("PASS T46-C2B14-P7-EQUIP: independent current signed GM equipment-management grant, expected-state 40001, occupied-slot 23505, strict slots, unchanged payload, revoke with same JWT, read survives");

 const revokedRead=await grant(roles.GM,hired,"view_backpack",false);
 assert.ifError(revokedRead.error);
 denied(await page(roles.OWNER,hired),"same JWT post-revoke backpack page denied");
 const gmStill=await page(roles.GM,hired,1);
 assert.ifError(gmStill.error);
 assert.equal(gmStill.data.items.length,1);
 console.log("PASS T46-C2B14-P7-REVOKE: read/revoke independent of manage and combat, GM manager remains authorized");

 // Only one signed concurrent equip to an initially un-equipped row may
 // pass the expected-state CAS. Source NPC row lock serializes slot writes.
 assert.ifError((await grant(roles.GM,hired,"manage_equipment",true)).error);
 const racer=ids[2];
 const parallel=await Promise.all([
  equip(roles.OWNER,hired,racer,true,"weapon_3",false),
  equip(roles.GM,hired,racer,true,"weapon_3",false)
 ]);
 assert.equal(parallel.filter(r=>!r.error).length,1);
 assert.equal(parallel.filter(r=>r.error).length,1);
 assert.equal(parallel.find(r=>r.error)?.error.code,"40001");
 assert.equal(state(racer).is_equipped,true);
 assert.equal(state(racer).equip_slot,"weapon_3");
 console.log("PASS T46-C2B14-P7-CONCURRENCY: actual concurrently signed equip requests serialize on NPC lock, one succeeds and loser gets 40001");

 // Concurrent updates to DISTINCT item rows and the SAME free slot must
 // still serialize on the NPC row after locking each item in shared order.
 const sameSlot=await Promise.all([
  equip(roles.OWNER,hired,ids[1],true,"weapon_2",false),
  equip(roles.GM,hired,ids[3],true,"weapon_2",false)
 ]);
 assert.equal(sameSlot.filter(r=>!r.error).length,1);
 assert.equal(sameSlot.filter(r=>r.error).length,1);
 assert.equal(sameSlot.find(r=>r.error)?.error.code,"23505");
 assert.equal([ids[1],ids[3]].filter(id=>state(id).is_equipped).length,1);
 console.log("PASS T46-C2B14-P7-DISTINCT-SLOT: distinct-item same-slot signed race serializes item→NPC, exactly one equip without duplicate slot or lock inversion");

 const {createClient}=await import("@supabase/supabase-js");
 const anon=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 denied(await page({who:anon},hired),"anonymous backpack cannot execute",null);
 denied(await equip({who:anon},hired,ids[3],true,"weapon_3",false),
  "anonymous equipment cannot execute",null);
 for(const [name,reg] of Object.entries({
  P6context:"public.c34_b14_p6_npc_capability_context_v1(uuid)",
  P6offer:"public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)",
  P6decision:"public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)",
  P6grant:"public.c34_b14_p6_set_npc_capability_v1(uuid,uuid,text,boolean)",
  P4:"public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)",
  P2:"public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)",
  legacy:"public.transfer_inventory_item_v1(uuid,text,text)",
  role:"public.is_admin(uuid)",
  buyer:"public.buy_from_merchant(uuid,uuid,integer)"
 }))assert.equal(hash(reg),originals[name],"P7 changed original "+name);
 console.log("PASS T46-C2B14-P7-SIGNED: redacted bounded keyset inventory, independent signed equipment grant, no raw write from hired view, no original functions modified");
 await runC34B14P9SlimNpcSigned({env,sql,q,lit,roles,hired,hiddenNpc,forgePc,ids});
}
