// C34 C2-B14-P2: DISPOSABLE local PG17/real GoTrue/PostgREST candidate checks.
// No hosted SQL, original June function replacements, protected map, or gameplay edits.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {runC34B14P4ControlledGearSigned} from "./run_t46_p3_p4b_c2b14_p4_controlled_gear_signed.mjs";
import {runC34B14P6NpcOffersSigned} from "./run_t46_p3_p4b_c2b14_p6_npc_offers_signed.mjs";
import {runC34B14P7NpcBackpackSigned} from "./run_t46_p3_p4b_c2b14_p7_npc_backpack_signed.mjs";

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


 // C2 source owner-domain intersection. Actual Forge v3 + original deferred
 // materialization are already signed-tested by C34 joint/J94-J102 research,
 // under a DIFFERENT review-only combined owner CHECK/RLS candidate.
 // Do not confuse this minimal June-policy fixture with that real Forge graph.
 const forgeCharId=randomUUID();
 sql("INSERT INTO public.characters(id,name,kind,is_hidden) VALUES("+
  q(forgeCharId)+",'P2 source-shaped individual Forge character','player',false)");
 const forgeGear=seed("Forge source-shaped held gear","character",forgeCharId,roles.OWNER.id);
 assert.equal(state(forgeGear).owner_type,"character");
 assert.equal(state(forgeGear).owner_id,forgeCharId);
 assert.equal(state(forgeGear).user_id,roles.OWNER.id);
 const forgeRead=await roles.OWNER.who.from("inventory_items")
  .select("id,owner_type,owner_id").eq("id",forgeGear);
 assert.ifError(forgeRead.error);
 assert.equal(forgeRead.data.length,1,
  "Historical June RLS reads account-user character gear without checking character access");
 const scopedRejected=await single(roles.OWNER,forgeGear,"npc",npc,"character",forgeCharId);
 assertDenied(scopedRejected,"unapproved character source transfer","22023");
 assert.equal(state(forgeGear).owner_type,"character");
 assert.equal(state(forgeGear).owner_id,forgeCharId);
 const scopedBulkRejected=await bulk(roles.ADMIN,[forgeGear],"npc",npc,"character",forgeCharId);
 assertDenied(scopedBulkRejected,"unapproved character source bulk transfer","22023");
 assert.equal(state(forgeGear).owner_type,"character");
 const separateHistorical=seed("June direct character DML RED","character",forgeCharId,roles.OWNER.id);
 const JuneRaw=await roles.OWNER.who.from("inventory_items")
  .update({owner_type:"player",owner_id:roles.OWNER.id})
  .eq("id",separateHistorical).select("id,owner_type,owner_id");
 assert.ifError(JuneRaw.error);
 assert.equal(JuneRaw.data.length,1,
  "Expected original June owner-only RLS to allow character->player laundering in minimal fixture");
 assert.equal(state(separateHistorical).owner_type,"player");
 console.log("PASS T46-C2B14-P2-FORGE-DOMAIN-RED: source-shaped character gear remains outside explicit versioned transfer, while original June raw owner RLS still accepts character->player laundering; historical RED only, real original Forge acceptance belongs to separate source-complete joint suite");


 // B14-P3 source-only ADDITIVE read context: one Data API call for roles,
 // owner capabilities and legal visible targets. NOT mounted by gameplay.
 const contextSql=fs.readFileSync(path.join(root,
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p3_inventory_context_pg17.sql"),"utf8");
 assert.match(contextSql,/NOT a migration/);
 assert.match(contextSql,/coalesce\(c.is_hidden,false\)=false/);
 assert.match(contextSql,/v_owner_type = 'character'/);
 sql(contextSql);
 assert.equal(sql("SELECT has_function_privilege('anon',"+
  "'public.c34_b14_p3_inventory_context_v1(text,text)','EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+
  "'public.c34_b14_p3_inventory_context_v1(text,text)','EXECUTE')"),"t");
 sql("NOTIFY pgrst,'reload schema'");
 const context=async(actor,type,id)=>{
  let response;
  for(let tries=0;tries<28;tries++){
   response=await actor.who.rpc("c34_b14_p3_inventory_context_v1",{
    p_owner_type:type,p_owner_id:id
   });
   if(response.error?.code!=="PGRST202")break;
   await delay(180);
  }
  return response;
 };
 const hiddenNpc=randomUUID(),hiddenStateNpc=randomUUID(),hiddenMerchant=randomUUID();
 for(const [id,kind,hidden,stateStr,name] of [
  [hiddenNpc,"npc",true,"resting","B14 SECRET NPC"],
  [hiddenStateNpc,"npc",false,"hidden","B14 HIDDEN STATE NPC"],
  [hiddenMerchant,"merchant",true,"resting","B14 PRIVATE MERCHANT"]
 ]){
  sql("INSERT INTO public.characters(id,name,kind,is_hidden,state) VALUES("+
   q(id)+","+lit(name)+","+lit(kind)+","+(hidden?"true":"false")+","+lit(stateStr)+")");
 }
 // Original Forge player PCs have kind='npc' AND player-character tag;
 // NPC kind alone is not a safe target or inventory-domain discriminator.
 const realForgeKindPc=randomUUID();
 sql("INSERT INTO public.characters(id,name,kind,is_hidden,state,tags) VALUES("+
  q(realForgeKindPc)+",'P3 REAL FORGE KIND NPC PC','npc',false,'resting',"+
  "ARRAY['player-character']::text[])");
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES("+
  q(realForgeKindPc)+","+q(roles.OWNER.id)+",true,false,false)");
 const ownContext=await context(roles.OWNER,"player",roles.OWNER.id);
 assert.ifError(ownContext.error);
 assert.equal(ownContext.data.can_view,true);
 assert.equal(ownContext.data.can_manage,true);
 assert.equal(ownContext.data.is_manager,false);
 assert.equal(ownContext.data.owner_type,"player");
 assert.equal(ownContext.data.owner_id,roles.OWNER.id);
 const labels=ownContext.data.targets.map(t=>t.name);
 assert.ok(labels.includes("P2 Delegated Source"));
 assert.ok(!labels.includes("B14 SECRET NPC"));
 assert.ok(!labels.includes("P3 REAL FORGE KIND NPC PC"));
 assert.ok(!labels.includes("B14 HIDDEN STATE NPC"));
 assert.ok(!labels.includes("B14 PRIVATE MERCHANT"));
 assert.ok(!ownContext.data.targets.some(t=>t.kind==="merchant"),
  "Player should never enumerate merchant direct-send targets");
 assert.ok(!ownContext.data.targets.some(t=>t.kind==="player"&&t.id===roles.OWNER.id));
 const otherContext=await context(roles.OWNER,"player",roles.OUTSIDER.id);
 assert.ifError(otherContext.error);
 assert.equal(otherContext.data.can_view,false);
 assert.equal(otherContext.data.can_manage,false);
 assert.deepEqual(otherContext.data.targets,[]);
 const observerContext=await context(roles.OBSERVER,"player",roles.OBSERVER.id);
 assert.ifError(observerContext.error);
 assert.equal(observerContext.data.is_manager,false);
 assert.ok(!observerContext.data.targets.some(t=>t.kind==="merchant"));
 const gmContext=await context(roles.GM,"player",roles.OUTSIDER.id);
 assert.ifError(gmContext.error);
 assert.equal(gmContext.data.is_manager,true);
 assert.equal(gmContext.data.can_view,true);
 const gmLabels=gmContext.data.targets.map(t=>t.name);
 assert.ok(gmLabels.includes("B14 SECRET NPC"));
 assert.ok(gmLabels.includes("B14 HIDDEN STATE NPC"));
 assert.ok(gmLabels.includes("B14 PRIVATE MERCHANT"));
 assert.ok(!gmLabels.includes("P3 REAL FORGE KIND NPC PC"));
 const forgeAsNpcOwner=await context(roles.OWNER,"npc",realForgeKindPc);
 assert.ifError(forgeAsNpcOwner.error);
 assert.equal(forgeAsNpcOwner.data.can_view,false);
 assert.deepEqual(forgeAsNpcOwner.data.targets,[]);
 const forgeAsNpcManager=await context(roles.GM,"npc",realForgeKindPc);
 assert.ifError(forgeAsNpcManager.error);
 assert.equal(forgeAsNpcManager.data.can_view,false);
 assert.ok(gmContext.data.targets.some(t=>t.kind==="merchant"&&t.id===hiddenMerchant));
 console.log("PASS T46-C2B14-P3-CONTEXT-PRIVACY: genuine signed player/GM exclude Forge player-character-tagged kind=npc from both recipients and NPC owner context; hidden NPC/merchant and observer policies retained in ONE RPC");

 // A delegated private NPC must remain manager-only even if its underlying
 // character_permissions row grants inventory access to a normal player.
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES("+
  q(hiddenNpc)+","+q(roles.OWNER.id)+",true,false,false)");
 const delegatedHidden=await context(roles.OWNER,"npc",hiddenNpc);
 assert.ifError(delegatedHidden.error);
 assert.equal(delegatedHidden.data.can_view,false);
 assert.equal(delegatedHidden.data.can_manage,false);
 assert.deepEqual(delegatedHidden.data.targets,[]);
 const managerHidden=await context(roles.GM,"npc",hiddenNpc);
 assert.ifError(managerHidden.error);
 assert.equal(managerHidden.data.can_view,true);
 assert.equal(managerHidden.data.can_manage,true);
 console.log("PASS T46-C2B14-P3-HIDDEN-OWNER: hidden NPC cannot be opened via inventory context using a stale/delegated permission; true GM manager retains access");


 const npcNoGrant=await context(roles.OWNER,"npc",npcOther);
 assert.ifError(npcNoGrant.error);
 assert.equal(npcNoGrant.data.can_view,false);
 assert.deepEqual(npcNoGrant.data.targets,[]);
 sql("UPDATE public.character_permissions SET can_inventory=true WHERE character_id="+q(npc)+
  " AND user_id="+q(roles.OWNER.id));
 const delegatedContext=await context(roles.OWNER,"npc",npc);
 assert.ifError(delegatedContext.error);
 assert.equal(delegatedContext.data.can_view,true);
 sql("UPDATE public.character_permissions SET can_inventory=false,can_edit=false WHERE character_id="+q(npc)+
  " AND user_id="+q(roles.OWNER.id));
 const revokedContext=await context(roles.OWNER,"npc",npc);
 assert.ifError(revokedContext.error);
 assert.equal(revokedContext.data.can_view,false);
 assert.deepEqual(revokedContext.data.targets,[]);
 const forgedCharContext=await context(roles.OWNER,"character",forgeCharId);
 assertDenied(forgedCharContext,"unreviewed Forge character-scope context","42501");
 const anonContext=await context({who:(await import("@supabase/supabase-js")).createClient(
  env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
 )},"player",roles.OWNER.id);
 assertDenied(anonContext,"anonymous context");
 console.log("PASS T46-C2B14-P3-CONTEXT-REVOKE: signed NPC delegation allowed then revoked without JWT renewal; unreviewed character scope and anon denied");

 await runC34B14P4ControlledGearSigned({env,sql,q,lit,roles});
 await runC34B14P6NpcOffersSigned({env,sql,q,lit,roles});
 await runC34B14P7NpcBackpackSigned({env,sql,q,lit,roles});

 const demotedItem=seed("GM role revoked","player",roles.OUTSIDER.id,roles.OUTSIDER.id);
 sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(roles.GM.id));
 const demotedContext=await context(roles.GM,"player",roles.OUTSIDER.id);
 assert.ifError(demotedContext.error);
 assert.equal(demotedContext.data.is_manager,false,
  "Same signed JWT must recheck the current database role after GM demotion");
 assert.equal(demotedContext.data.can_view,false);
 assert.equal(demotedContext.data.can_manage,false);
 assert.deepEqual(demotedContext.data.targets,[]);
 console.log("PASS T46-C2B14-P3-CONTEXT-ROLE-REVOKE: original GM JWT remains valid, database demotion immediately revokes manager/browser targets and capabilities");

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
