// C34 B14-P18 genuine local signed GoTrue/PG17 character-owned item mint gate.
// Must run AFTER preserved P16 legitimate writers, P17 original signed RED
// and P16 scoped consent/GM/trade assertions, while its local ACL is active.
// P18 does not install a hosted migration, change original gameplay sources,
// certify production pg_proc grants, or supply a new client creation API.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
import {runC34B14P19OriginalAssignItemSourceRedSigned} from "./run_t46_p3_p4b_c2b14_p19_original_assign_item_source_red_signed.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const file="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p18_disposable_character_item_creation_gate_pg17.sql";

export async function runC34B14P18CharacterInsertGuardSigned({env,sql,q,lit,roles,forgeSource,hired}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  C34_P16_SIGNED_CONFIRM:"P16_NO_BYPASS_DISPOSABLE_PG17_ONLY",
  C34_P18_SIGNED_CONFIRM:"P18_CHARACTER_INSERT_DISPOSABLE_PG17_ONLY"
 }))assert.equal(env[k],v,"P18 may run only inside explicitly signed disposable P16 environment");

 const source=fs.readFileSync(path.join(root,file),"utf8");
 assert.match(source,/DO \$p18_guard\$/);
 assert.match(source,/SECURITY INVOKER/);
 assert.match(source,/c34_b14_p16_is_item_grant_manager_v1/);
 assert.doesNotMatch(source,/ALTER POLICY|CREATE POLICY|DROP POLICY|REVOKE INSERT ON TABLE|DROP FUNCTION public\./);
 const actor=roles.OWNER,other=roles.OUTSIDER,gm=roles.GM;
 assert.ok(actor?.who && other?.who && gm?.who,"Require genuine independently signed GoTrue actors");
 assert.ok(actor.id!==other.id && actor.id!==gm.id && other.id!==gm.id);
 assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
  " AND tgname='c34_b14_p16_guard_direct_inventory_dml' AND NOT tgisinternal"),"1",
  "P18 cannot substitute for original live P16 scratch INSERT and owner-UPDATE guard");
 assert.equal(sql("SELECT to_regprocedure('private.c34_b14_p18_guard_character_item_creation_v1()') IS NULL"),"t",
  "P18 cannot overwrite a prior implementation");
 const originalSigs=[
  "public.c34_b14_p16_is_item_grant_manager_v1()",
  "public.transfer_inventory_item_v1(uuid,text,text)",
  "public.c34_b14_p14_dispatch_batch_intent_v1(uuid,uuid[],text,text,text,text)",
  "public.c34_b14_p8_gm_decide_item_offer_v1(uuid,boolean)"
 ];
 const hash=sig=>sql("SELECT md5(pg_get_functiondef("+lit(sig)+"::regprocedure))");
 const before=originalSigs.map(sig=>({sig,hash:hash(sig)}));
 const tableUpdate=sql("SELECT has_table_privilege('authenticated','public.inventory_items','UPDATE')");
 const ownerUpdate=sql("SELECT has_column_privilege('authenticated','public.inventory_items','owner_id','UPDATE')");
 const canManage=async who=>{
  const r=await who.who.rpc("c34_b14_p16_is_item_grant_manager_v1");
  assert.ifError(r.error);
  return r.data;
 };
 assert.equal(await canManage(gm),true,"GM role must be server-authorized manager");
 assert.equal(await canManage(actor),false,"Ordinary actor may not assign character items");
 assert.equal(await canManage(other),false,"Other account cannot assign character items");

 const id=()=>randomUUID();
 const own=id(),foreign=id();
 const madeChars=[],madeItems=[];
 const insertRow=(who,ownerId,whoId,label)=>who.who.from("inventory_items").insert({
  id:id(),owner_type:"character",owner_id:ownerId,user_id:whoId,
  item_name:"P18 "+label,item_type:"Misc",item_rarity:"Common",is_equipped:false
 }).select("id,owner_type,owner_id,user_id");
 const denied=(r,label,code="42501")=>{
  assert.ok(r.error,label+" incorrectly allowed: "+JSON.stringify(r.data));
  assert.equal(r.error.code,code,label+" SQLSTATE "+JSON.stringify(r.error));
 };
 const mkSqlItem=(name,type,ownerId,userId)=>{
  const row=id();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,item_type,item_rarity,is_equipped) VALUES("+
   q(row)+","+lit(type)+","+q(ownerId)+","+q(userId)+","+lit(name)+",'Misc','Common',false)");
  madeItems.push(row);return row;
 };
 let installed=false,restored=false;
 try {
  sql(source);installed=true;
  sql("NOTIFY pgrst,'reload schema'");
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
   " AND tgname='c34_b14_p18_guard_direct_character_item_creation' AND NOT tgisinternal"),"1");
  assert.equal(sql("SELECT has_function_privilege('authenticated',"+
   lit("private.c34_b14_p18_guard_character_item_creation_v1()")+",'EXECUTE')"),"f");
  console.log("PASS P18-GUARD-LOCAL: P18 signed guard added only after original P16, original RLS/grants untouched");

  // The real player-created character in original P8 was provisioned with
  // can_inventory but not can_edit. P18 rejects direct mint anyway.
  assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id="+
   q(forgeSource)+" AND user_id="+q(actor.id)+" AND can_inventory"),"1",
   "Expected original Forge owner's inventory grant");
  denied(await insertRow(actor,forgeSource,actor.id,"own Forge can_inventory"),
   "Original permitted inventory use cannot mint own character items");
  assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character'"+
   " AND owner_id="+q(forgeSource)+" AND item_name='P18 own Forge can_inventory'"),"0");

  sql("INSERT INTO public.characters(id,name,kind,state,is_hidden,tags) VALUES("+
   q(own)+",'P18 delegated own','npc','resting',false,ARRAY['player-character']::text[])");
  madeChars.push(own);
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert,can_control) VALUES("+
   q(own)+","+q(actor.id)+",true,true,false,true)");
  sql("INSERT INTO public.characters(id,name,kind,state,is_hidden,tags) VALUES("+
   q(foreign)+",'P18 foreign source','npc','resting',false,ARRAY['player-character']::text[])");
  madeChars.push(foreign);
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert,can_control) VALUES("+
   q(foreign)+","+q(other.id)+",true,true,false,true)");
  assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id="+
   q(foreign)+" AND user_id="+q(actor.id)),"0");
  denied(await insertRow(actor,own,actor.id,"can_edit and can_control"),
   "Editor and permanent controller are not mint authority");
  denied(await insertRow(actor,foreign,actor.id,"foreign owner"),
   "Foreign owner ID spoofing under real signed JWT");
  denied(await insertRow(other,foreign,other.id,"other account direct mint"),
   "Unrestricted editor owning their own character still cannot mint");
  denied(await insertRow(other,own,other.id,"foreign reverse"),
   "Reverse foreign actor cannot mint");
  assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND"+
   " owner_id IN ("+q(own)+","+q(foreign)+")"),"0");
  console.log("PASS P18-CHARACTER-MINT-DENY: both genuine player JWTs denied own/foreign character INSERT despite can_inventory, can_edit, can_control; no ghost rows");

  const authorized=await insertRow(gm,foreign,gm.id,"GM intentionally authored character grant");
  assert.ifError(authorized.error);
  assert.equal(authorized.data?.length,1);
  assert.equal(authorized.data[0].owner_type,"character");
  assert.equal(authorized.data[0].owner_id,foreign);
  madeItems.push(authorized.data[0].id);
  const gmNpc=await gm.who.from("inventory_items").insert({
   id:id(),owner_type:"npc",owner_id:hired,user_id:gm.id,
   item_name:"P18 manager NPC assignment preserved",item_type:"Misc",item_rarity:"Common",
   is_equipped:false
  }).select("id,owner_type");
  assert.ifError(gmNpc.error);assert.equal(gmNpc.data?.[0]?.owner_type,"npc");
  madeItems.push(gmNpc.data[0].id);

  // Original player Forge starting equipment uses trusted SECURITY DEFINER
  // materializers; this postgres-authority insert models their trigger
  // boundary, not an end-to-end source-original v3 Forge replay.
  const trusted=mkSqlItem("P18 trusted materializer-shaped character row",
   "character",own,actor.id);
  assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE id="+q(trusted)+
   " AND owner_type='character' AND owner_id="+q(own)+" AND user_id="+q(actor.id)),"1");
  assert.match(fs.readFileSync(path.join(root,
   "sql/20260808_51_player_forge_character_scoped_equipment_projection.sql"),"utf8"),
   /security definer[\s\S]*?insert into public\.inventory_items\(/i);
  console.log("PASS P18-TRUSTED-FORGE-SEAM: trusted postgres writer can create character gear; original source materializer definer verified, complete signed Forge v3 remains independent");

  const craft=mkSqlItem("P18 self-account craft rollback","player",actor.id,actor.id);
  const snapshot=JSON.parse(sql("SELECT row_to_json(i)::text FROM public.inventory_items i WHERE id="+q(craft)));
  const consume=await actor.who.from("inventory_items").delete().eq("id",craft).select("id");
  assert.ifError(consume.error);assert.equal(consume.data?.length,1);
  const restore=await actor.who.from("inventory_items").insert(snapshot).select("id");
  assert.ifError(restore.error);assert.equal(restore.data?.length,1);
  const equip=await actor.who.from("inventory_items")
   .update({is_equipped:true,equip_slot:"weapon_1"}).eq("id",craft).select("id,is_equipped");
  assert.ifError(equip.error);assert.equal(equip.data?.[0]?.is_equipped,true);
  assert.equal(sql("SELECT has_column_privilege('authenticated','public.inventory_items','owner_id','UPDATE')"),"f",
   "P18 cannot re-enable raw owner mutation");
  console.log("PASS P18-ACCOUNT-TOWN-EQUIP-GM: real signed Town-like account consume+restore, equip, GM NPC/character assignment preserve old P16 boundaries");

  // Account-to-account versioned consent and NPC GM settlement, merchant
  // stock and trade are tested BEFORE this overlay in P16/P8. P18's only
  // installed object is one inventory INSERT trigger; original funcs stable.
  for(const saved of before)
   assert.equal(hash(saved.sig),saved.hash,"Original function body changed: "+saved.sig);
  assert.equal(sql("SELECT has_table_privilege('authenticated','public.inventory_items','UPDATE')"),tableUpdate);
  assert.equal(sql("SELECT has_column_privilege('authenticated','public.inventory_items','owner_id','UPDATE')"),ownerUpdate);
  for(const sig of ["public.buy_from_merchant(uuid,uuid,integer)","public.accept_trade(uuid)"])
   if(sql("SELECT to_regprocedure("+lit(sig)+") IS NOT NULL")==="t")
    assert.equal(sql("SELECT pg_get_functiondef("+lit(sig)+"::regprocedure) IS NOT NULL"),"t");
  console.log("PASS P18-INDEPENDENT: June/P14/P8 function-body hash, original merchant/trade presence, raw owner UPDATE and original P16 grant separation preserved");
  // P19 records genuine unchanged original AssignItemButton shape under
  // independently signed GM, DM, Admin and player identities. The expected
  // old GM/DM/account RED is research evidence; NO client/RLS patch here.
  await runC34B14P19OriginalAssignItemSourceRedSigned({sql,q,lit,roles,hired});
 } finally {
  if(installed){
   sql("DROP TRIGGER IF EXISTS c34_b14_p18_guard_direct_character_item_creation ON public.inventory_items");
   sql("DROP FUNCTION IF EXISTS private.c34_b14_p18_guard_character_item_creation_v1()");
   restored=true;
  }
  for(const item of madeItems)sql("DELETE FROM public.inventory_items WHERE id="+q(item));
  for(const character of madeChars){
   sql("DELETE FROM public.character_permissions WHERE character_id="+q(character));
   sql("DELETE FROM public.characters WHERE id="+q(character));
  }
  if(restored){
   assert.equal(sql("SELECT to_regprocedure('private.c34_b14_p18_guard_character_item_creation_v1()') IS NULL"),"t");
   assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
    " AND tgname='c34_b14_p16_guard_direct_inventory_dml' AND NOT tgisinternal"),"1",
    "P18 cleanup must preserve P16 original scratch guard");
   for(const saved of before)
    assert.equal(hash(saved.sig),saved.hash,"Cleanup changed original "+saved.sig);
   console.log("PASS P18-RESTORE: P18 trigger/function dropped, test items/characters removed, original P16 still installed for its own later restoration");
  }
 }
 console.log("PASS P18-SIGNED DISPOSABLE: character-owner spoof denied with real JWT, owner-approved paths preserved in bounded fixture; NOT a hosted release");
}
