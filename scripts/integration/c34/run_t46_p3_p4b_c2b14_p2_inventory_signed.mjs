// C34 C2-B14-P2: DISPOSABLE local PG17/real GoTrue/PostgREST candidate checks.
// No hosted SQL, original June function replacements, protected map, or gameplay edits.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const sourcePath="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p2_inventory_authority_pg17.sql";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function runC34C2B14P2InventorySigned({env,newActor,sql,q,lit}){
 for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[key],value,"B14-P2 refuses non-disposable "+key);
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 assert.equal(sql("SELECT current_database()"),"postgres");
 assert.equal(sql("SELECT to_regprocedure('public.transfer_inventory_item_v1(uuid,text,text)') IS NOT NULL"),"t");
 const original=sql("SELECT md5(pg_get_functiondef('public.transfer_inventory_item_v1(uuid,text,text)'::regprocedure))");
 const oldRole=sql("SELECT md5(pg_get_functiondef('public.is_admin(uuid)'::regprocedure))");
 const buyer=sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");
 const stock=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)'::regprocedure))");
 const quantity=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))");
 const file=fs.readFileSync(path.join(root,sourcePath),"utf8");
 assert.match(file,/RESEARCH-ONLY versioned SQL for disposable PG17/);
 assert.match(file,/WHERE up.id = auth.uid\(\) AND up.role IN \('admin', 'gm', 'dm'\)/);
 assert.doesNotMatch(file,/\b(?:ALTER|DROP)\s+(?:TABLE|POLICY)\b/i);
 sql(file);
 assert.equal(sql("SELECT has_function_privilege('anon',"+
  "'public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)','EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('anon',"+
  "'public.c34_b14_p2_transfer_inventory_items_bulk_v1(uuid[],text,text,text,text)','EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+
  "'public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)','EXECUTE')"),"t");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+
  "'public.c34_b14_p2_transfer_inventory_items_bulk_v1(uuid[],text,text,text,text)','EXECUTE')"),"t");
 sql("NOTIFY pgrst,'reload schema'");
 console.log("PASS T46-C2B14-P2-LOCAL-SOURCE: test-only canonical role manager and owner-CAS single/bulk installed; anon EXECUTE denied");

 const roles={};
 for(const [label,role] of [["ADMIN","admin"],["GM","gm"],["DM","dm"],
   ["OWNER","player"],["OUTSIDER","player"],["OBSERVER","observer"]]){
  roles[label]=await newActor("B14P2_"+label,role);
 }
 const [npc,npcOther,merchant]=[randomUUID(),randomUUID(),randomUUID()];
 for(const [id,kind,name] of [[npc,"npc","P2 Delegated Source"],
  [npcOther,"npc","P2 NPC Recipient"],[merchant,"merchant","P2 Merchant Recipient"]]){
  sql("INSERT INTO public.characters(id,name,kind,is_hidden) VALUES("+
   q(id)+","+lit(name)+","+lit(kind)+",false)");
 }
 for(const actor of Object.values(roles)){
  sql("INSERT INTO public.players(user_id,name) VALUES("+
   q(actor.id)+","+lit("P2 "+actor.role)+") ON CONFLICT(user_id) DO NOTHING");
 }
 const seed=(label,type,id,userId,equipped=true)=>{
  const item=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,"+
   "item_type,item_rarity,is_equipped,equip_slot) VALUES("+
   q(item)+","+lit(type)+","+lit(id)+","+(userId?q(userId):"NULL")+
   ","+lit("P2 "+label)+",'Misc','Common',"+(equipped?"true,'weapon_1'":"false,NULL")+")");
  return item;
 };
 const state=id=>JSON.parse(sql("SELECT row_to_json(s)::text FROM public.inventory_items s WHERE s.id="+q(id)));
 const single=(actor,id,targetType,targetId,expectedType,expectedId)=>
  actor.who.rpc("c34_b14_p2_transfer_inventory_item_v1",{
   p_item_id:id,p_target_type:targetType,p_target_id:targetId,
   p_expected_owner_type:expectedType,p_expected_owner_id:expectedId
  });
 const bulk=(actor,ids,targetType,targetId,expectedType,expectedId)=>
  actor.who.rpc("c34_b14_p2_transfer_inventory_items_bulk_v1",{
   p_item_ids:ids,p_target_type:targetType,p_target_id:targetId,
   p_expected_owner_type:expectedType,p_expected_owner_id:expectedId
  });
 const assertDenied=(r,label,code)=>{
  assert.ok(r.error,label+" erroneously succeeded "+JSON.stringify(r.data));
  if(code)assert.equal(r.error.code,code,label+" wrong error code "+JSON.stringify(r.error));
 };
 const probe=async(actor,id)=>{
  let r;
  for(let i=0;i<30;i++){
   r=await single(actor,id,"merchant",merchant,"player",roles.OUTSIDER.id);
   if(r.error?.code!=="PGRST202")break;
   await delay(180);
  }
  return r;
 };
 for(const name of ["ADMIN","GM","DM"]){
  const id=seed("canonical "+name,"player",roles.OUTSIDER.id,roles.OUTSIDER.id);
  const response=await probe(roles[name],id);
  assert.ifError(response.error);
  assert.equal(response.data.owner_type,"merchant");
  assert.equal(response.data.owner_id,merchant);
  assert.equal(response.data.user_id,null);
  assert.equal(response.data.is_equipped,false);
  assert.equal(response.data.equip_slot,null);
 }
 const observerItem=seed("observer denied","player",roles.OUTSIDER.id,roles.OUTSIDER.id);
 const deniedObserver=await probe(roles.OBSERVER,observerItem);
 assertDenied(deniedObserver,"unexpected observer manager", "42501");
 assert.equal(state(observerItem).owner_id,roles.OUTSIDER.id);
 const outsider=await probe(roles.OWNER,observerItem);
 assertDenied(outsider,"other player transfer","42501");
 assert.equal(state(observerItem).owner_id,roles.OUTSIDER.id);
 console.log("PASS T46-C2B14-P2-ROLE: authentic signed admin/gm/dm may manage; observer/player fail 42501, no mutated item");

 const ownerItem=seed("player permitted","player",roles.OWNER.id,roles.OWNER.id);
 const ownTransfer=await single(roles.OWNER,ownerItem,"npc",npc,"player",roles.OWNER.id);
 assert.ifError(ownTransfer.error);
 assert.equal(state(ownerItem).owner_id,npc);
 assert.equal(state(ownerItem).is_equipped,false);
 const stale=await single(roles.OWNER,ownerItem,"npc",npcOther,"player",roles.OWNER.id);
 assertDenied(stale,"stale owner compare and swap","40001");
 assert.equal(state(ownerItem).owner_id,npc);
 const directMerchant=seed("own merchant forbidden","player",roles.OWNER.id,roles.OWNER.id);
 assertDenied(await single(roles.OWNER,directMerchant,"merchant",merchant,"player",roles.OWNER.id),
  "nonmanager player direct merchant","42501");
 assert.equal(state(directMerchant).owner_id,roles.OWNER.id);
 console.log("PASS T46-C2B14-P2-OWNER: own transfer/unequip succeeds, stale owner 40001, nonmanager direct merchant 42501");

 sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES("+
  q(npc)+","+q(roles.OWNER.id)+",true,false,false) "+
  "ON CONFLICT(character_id,user_id) DO UPDATE SET can_inventory=true,can_edit=false");
 const delegationItem=seed("npc inventory delegated","npc",npc,null);
 assert.ifError((await single(roles.OWNER,delegationItem,"npc",npcOther,"npc",npc)).error);
 assert.equal(state(delegationItem).owner_id,npcOther);
 const revoked=seed("npc revocation","npc",npc,null);
 sql("UPDATE public.character_permissions SET can_inventory=false,can_edit=false WHERE character_id="+q(npc)+
  " AND user_id="+q(roles.OWNER.id));
 assertDenied(await single(roles.OWNER,revoked,"npc",npcOther,"npc",npc),
  "revoked NPC grant","42501");
 assert.equal(state(revoked).owner_id,npc);
 console.log("PASS T46-C2B14-P2-DELEGATION: signed NPC permission and postcommit revoke tested");

 const batch=[seed("atomic a","player",roles.OWNER.id,roles.OWNER.id),
  seed("atomic b","player",roles.OWNER.id,roles.OWNER.id)];
 const good=await bulk(roles.OWNER,batch,"npc",npc,"player",roles.OWNER.id);
 assert.ifError(good.error);
 assert.equal(good.data.length,2);
 for(const id of batch){
  assert.equal(state(id).owner_id,npc);
  assert.equal(state(id).is_equipped,false);
  assert.equal(state(id).equip_slot,null);
 }
 const rollback=[seed("rollback a","player",roles.OWNER.id,roles.OWNER.id),
  seed("rollback b","player",roles.OUTSIDER.id,roles.OUTSIDER.id)];
 assertDenied(await bulk(roles.OWNER,rollback,"npc",npc,"player",roles.OWNER.id),
  "mixed-owner atomic rollback");
 assert.equal(state(rollback[0]).owner_id,roles.OWNER.id);
 assert.equal(state(rollback[1]).owner_id,roles.OUTSIDER.id);
 const duplicate=seed("duplicate","player",roles.OWNER.id,roles.OWNER.id);
 assertDenied(await bulk(roles.OWNER,[duplicate,duplicate],"npc",npc,"player",roles.OWNER.id),
  "duplicate bulk","22023");
 assert.equal(state(duplicate).owner_id,roles.OWNER.id);
 const missing=randomUUID(),present=seed("missing rollback","player",roles.OWNER.id,roles.OWNER.id);
 assertDenied(await bulk(roles.OWNER,[present,missing],"npc",npc,"player",roles.OWNER.id),
  "missing item rollback","22023");
 assert.equal(state(present).owner_id,roles.OWNER.id);
 console.log("PASS T46-C2B14-P2-BULK: signed 2-item atomic move+unequip; mixed owner/duplicate/missing all roll back");


 // Concurrent POST requests go through distinct real PostgREST SQL transactions,
 // NOT an in-process mock or sequential calls.
 const clash=seed("competing single","player",roles.OWNER.id,roles.OWNER.id);
 const raceSingle=await Promise.all([
  single(roles.OWNER,clash,"npc",npc,"player",roles.OWNER.id),
  single(roles.OWNER,clash,"npc",npcOther,"player",roles.OWNER.id)
 ]);
 const singleWinners=raceSingle.filter(x=>!x.error);
 const singleDenied=raceSingle.filter(x=>!!x.error);
 assert.equal(singleWinners.length,1,"Exactly one competing single transfer must commit");
 assert.equal(singleDenied.length,1,"Exactly one competing single transfer must reject");
 assert.equal(singleDenied[0].error.code,"40001","Stale competitor must see owner conflict");
 assert.equal(state(clash).owner_id,singleWinners[0].data.owner_id);
 assert.equal(state(clash).is_equipped,false);
 console.log("PASS T46-C2B14-P2-CONCURRENCY-SINGLE: 2 concurrent genuine PostgREST transfers compete for one locked item; exactly 1 commit, loser 40001, no duplicate ownership");

 const shared=seed("race bulk shared","player",roles.OWNER.id,roles.OWNER.id);
 const onlyA=seed("race bulk A","player",roles.OWNER.id,roles.OWNER.id);
 const onlyB=seed("race bulk B","player",roles.OWNER.id,roles.OWNER.id);
 const raceBulk=await Promise.all([
  bulk(roles.OWNER,[shared,onlyA],"npc",npc,"player",roles.OWNER.id),
  bulk(roles.OWNER,[onlyB,shared],"npc",npcOther,"player",roles.OWNER.id)
 ]);
 const bulkWinners=raceBulk.map((result,index)=>({result,index})).filter(x=>!x.result.error);
 const bulkDenied=raceBulk.filter(x=>!!x.error);
 assert.equal(bulkWinners.length,1,"Exactly one competing bulk must commit");
 assert.equal(bulkDenied.length,1,"Exactly one competing bulk must reject");
 assert.equal(bulkDenied[0].error.code,"40001","Losing bulk must detect owner conflict");
 const winningIndex=bulkWinners[0].index;
 const winningDestination=winningIndex===0?npc:npcOther;
 const winnerOnly=winningIndex===0?onlyA:onlyB;
 const loserOnly=winningIndex===0?onlyB:onlyA;
 assert.equal(state(shared).owner_id,winningDestination);
 assert.equal(state(winnerOnly).owner_id,winningDestination);
 assert.equal(state(loserOnly).owner_id,roles.OWNER.id,
  "Competing bulk failure must roll back its disjoint item");
 console.log("PASS T46-C2B14-P2-CONCURRENCY-BULK: overlapping signed parallel transactions serialize via row locks, one wins, loser 40001 with unaffected unique item");

 // Source-locked Town item grant and Forge character-scoped materializers.
 // This fixture does not call the complete original Forge creation workflow;
 // never equate this source/owner-shape preservation with that positive E2E.
 const gitBlob=bytes=>createHash("sha1").update(
  Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes])
 ).digest("hex");
 for(const [file,sha,tokens] of [
  ["components/AssignItemButton.js","dc09dc77c66896ed842d240c584225cde26581db",
   ['.from("inventory_items").insert(insertData)',"if (finalType === \"player\") insertData.user_id = finalId"]],
  ["sql/20260808_51_player_forge_character_scoped_equipment_projection.sql",
   "7b84dfca57a5482fbc474db71ea4e00243ff58fb",
   ["insert into public.inventory_items(","'character',p_character_id::text"]],
  ["sql/20261010_01_player_forge_starting_market.sql",
   "f77f996e88e8b3f8f01f10f77da205af2a24f11d",
   ["insert into public.inventory_items(","'startingMarket',true"]]
 ]){
  const bytes=fs.readFileSync(path.join(root,file));
  assert.equal(gitBlob(bytes),sha,"P2 original Town/Forge materializer drift "+file);
  const src=bytes.toString();
  for(const token of tokens)assert.ok(src.includes(token),"Missing original source contract "+file+" "+token);
 }
 const townGrant=await roles.OWNER.who.from("inventory_items").insert({
  owner_type:"player",owner_id:roles.OWNER.id,user_id:roles.OWNER.id,
  item_id:"p2-town-grant",item_name:"P2 legitimate town item grant",
  item_type:"Misc",item_rarity:"Common",is_equipped:false,
  card_payload:{source:"town",materializedBy:"P2 signed compatibility fixture"}
 }).select("id,owner_type,owner_id,user_id,is_equipped,card_payload");
 assert.ifError(townGrant.error);
 assert.equal(townGrant.data.length,1);
 assert.equal(townGrant.data[0].owner_type,"player");
 assert.equal(townGrant.data[0].owner_id,roles.OWNER.id);
 assert.equal(townGrant.data[0].user_id,roles.OWNER.id);
 assert.equal(townGrant.data[0].is_equipped,false);
 assert.equal(townGrant.data[0].card_payload.source,"town");
 console.log("PASS T46-C2B14-P2-TOWN-INSERT: genuine player signed owner INSERT with item payload succeeds; original AssignItemButton and Forge character-scoped sources byte-pinned (NOT full Town crafting/Forge E2E)");

 const demotedItem=seed("GM role revoked","player",roles.OUTSIDER.id,roles.OUTSIDER.id);
 sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(roles.GM.id));
 assertDenied(await single(roles.GM,demotedItem,"merchant",merchant,"player",roles.OUTSIDER.id),
  "same JWT after GM demotion","42501");
 assert.equal(state(demotedItem).owner_id,roles.OUTSIDER.id);
 const {createClient}=await import("@supabase/supabase-js");
 const anonymous=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 assertDenied(await single({who:anonymous},demotedItem,"merchant",merchant,"player",roles.OUTSIDER.id),
  "anonymous candidate transfer");
 assert.equal(state(demotedItem).owner_id,roles.OUTSIDER.id);
 const bodyHash=(name,signature)=>sql("SELECT md5(pg_get_functiondef('"+name+signature+"'::regprocedure))");
 assert.equal(bodyHash("public.transfer_inventory_item_v1","(uuid,text,text)"),original);
 assert.equal(bodyHash("public.is_admin","(uuid)"),oldRole);
 assert.equal(bodyHash("public.buy_from_merchant","(uuid,uuid,integer)"),buyer);
 assert.equal(bodyHash("public.c34_t46_manage_merchant_stock_v1","(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)"),stock);
 assert.equal(bodyHash("public.c34_t46_manage_stock_qty_v1","(uuid,text,integer,integer,timestamptz)"),quantity);
 console.log("PASS T46-C2B14-P2-SIGNED: versioned candidate owner CAS/roles, NPC delegation and revoke, transactional bulk rollback, anon denied, original transfer/role/buyer/stock/quantity function bodies identical; disposable ONLY");
}
