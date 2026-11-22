// B14-P19 research: signed original AssignItemButton direct Data API INSERT shape.
// EXPECTED RED for GM/DM under historical strict-admin RLS, no gameplay changes.
// Executed only while disposable P16 + P18 guards are installed. The actual
// original JSX file stays Git-blob pinned and is NOT modified for the probe.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const candidate="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p19_disposable_game_manager_assignment_policy_pg17.sql";
export async function runC34B14P19OriginalAssignItemSourceRedSigned({env,sql,q,lit,roles,hired}){
 for(const [name,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  C34_P16_SIGNED_CONFIRM:"P16_NO_BYPASS_DISPOSABLE_PG17_ONLY",
  C34_P18_SIGNED_CONFIRM:"P18_CHARACTER_INSERT_DISPOSABLE_PG17_ONLY",
  C34_P19_SIGNED_CONFIRM:"P19_MANAGER_ASSIGN_DISPOSABLE_PG17_ONLY"
 }))assert.equal(env[name],value,"P19 must run in original disposable signed stack");
 const p19source=fs.readFileSync(path.join(root,candidate),"utf8");
 assert.ok(p19source.includes("CREATE POLICY c34_b14_p19_temporary_game_manager_insert"));
 assert.ok(p19source.includes("public.c34_b14_p16_is_item_grant_manager_v1()"));
 assert.ok(!p19source.includes("ALTER POLICY inventory_items_insert_owner_or_admin"));
 const beforePolicies=sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass");
 assert.equal(beforePolicies,"4","P19 cannot run against nonoriginal Stage4 policy state");
 const gm=roles.GM,dm=roles.DM,admin=roles.ADMIN,owner=roles.OWNER,outsider=roles.OUTSIDER;
 for(const who of [gm,dm,admin,owner,outsider])
  assert.ok(who?.who&&who.id,"P19 requires independently signed original role actors");
 assert.equal(new Set([gm.id,dm.id,admin.id,owner.id,outsider.id]).size,5);
 assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
  " AND tgname IN ('c34_b14_p16_guard_direct_inventory_dml',"+
  "'c34_b14_p18_guard_direct_character_item_creation') AND NOT tgisinternal"),"2",
  "P19 expected original P16 and P18 authorization protections simultaneously");

 const merchant=randomUUID(),made=[];
 let merchantAdded=false,policyInstalled=false;
 // Original AssignItemButton: cardPayload and item metadata, *no id*,
 // and user_id is present ONLY when finalType='player'. No extra runtime
 // entitlement was inferred and no new RPC is substituted.
 const payload=(targetType,targetId,label)=>({
  owner_type:targetType,owner_id:String(targetId),is_equipped:false,
  card_payload:{id:"P19_RESEARCH_SOURCE",item_name:label},
  item_id:"P19_RESEARCH_SOURCE",item_name:label,
  item_type:"Misc",item_rarity:"Common",item_description:null,
  item_weight:null,item_cost:null,
  ...(targetType==="player"?{user_id:targetId}:{})
 });
 const put=async(who,type,target,label)=>{
  // IMPORTANT: match original AssignItemButton's plain .insert(insertData),
  // which does not request RETURNING rows. A .select() here adds a second
  // RLS SELECT authorization requirement and invalidates the original
  // merchant/NPC writer acceptance test.
  const r=await who.who.from("inventory_items").insert(payload(type,target,label));
  // Trusted disposable postgres readback only; NOT returned to the browser.
  // Always capture scratch rows before assertions, even on an unexpected error.
  const rows=JSON.parse(sql("SELECT coalesce(json_agg(json_build_object("+
   "'id',id,'owner_type',owner_type,'owner_id',owner_id,"+
   "'user_id',user_id,'item_name',item_name)), '[]'::json)::text "+
   "FROM public.inventory_items WHERE item_name="+lit(label)));
  for(const entry of rows)made.push(entry.id);
  return {...r,rows};
 };
 const deny=(r,label,code)=>{
  assert.ok(r.error,label+" erroneously accepted: "+JSON.stringify(r.data));
  if(code)assert.equal(r.error.code,code,label+": "+JSON.stringify(r.error));
 };
 const row=(id)=>JSON.parse(sql("SELECT row_to_json(i)::text FROM public.inventory_items i WHERE id="+q(id)));
 try{
  sql("INSERT INTO public.characters(id,name,kind,state,is_hidden,tags) VALUES("+
   q(merchant)+",'P19 original merchant inventory target','merchant','resting',false,ARRAY['merchant']::text[])");
  merchantAdded=true;
  const npcName="P19 source-shaped GM NPC no user_id";
  const gmNpc=await put(gm,"npc",hired,npcName);
  deny(gmNpc,"Unchanged original NPC AssignItemButton GM under strict-admin policy","42501");
  const dmMerchant=await put(dm,"merchant",merchant,"P19 source-shaped DM merchant no user_id");
  deny(dmMerchant,"Unchanged original merchant AssignItemButton DM under strict-admin policy","42501");
  assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_name IN ("+
   lit(npcName)+","+lit("P19 source-shaped DM merchant no user_id")+")"),"0");
  console.log("PASS P19-ASSIGN-ORIGINAL-RED: genuine GM NPC and DM merchant direct INSERT without user_id fail original strict-admin RLS despite intended game-master parity; no assignment occurred");

  // True original Admin path, same payload, no user_id. This does not
  // authorize turning the public inventory RLS into observer/admin guessing.
  for(const [type,id,label] of [
   ["npc",hired,"P19 unchanged Admin NPC assign"],
   ["merchant",merchant,"P19 unchanged Admin merchant assign"]
  ]){
   const r=await put(admin,type,id,label);
   assert.ifError(r.error);
   assert.equal(r.rows?.length,1);
   assert.equal(r.rows[0].owner_type,type);
   assert.equal(r.rows[0].owner_id,id);
   assert.equal(row(r.rows[0].id).user_id,null,
    "Original Admin NPC/merchant assignment leaves account owner null");
  }
  console.log("PASS P19-ASSIGN-ADMIN-PRESERVE: genuine Admin original NPC+merchant direct source-shape INSERT succeeds without user_id; no new policy/grant");

  // Diagnostic ONLY: GM/DM success when user_id is explicitly populated
  // explains the P18 synthetic positive, but does not license client rewrite.
  for(const who of [gm,dm]){
   const label="P19 diagnostic non-original "+who.role+" user_id";
   const p={...payload("npc",hired,label),user_id:who.id};
   const r=await who.who.from("inventory_items").insert(p).select("id,owner_type,owner_id,user_id");
   assert.ifError(r.error);
   assert.equal(r.data?.length,1);
   assert.equal(r.data[0].user_id,who.id);
   made.push(r.data[0].id);
  }
  console.log("PASS P19-ASSIGN-CAUSE: same GM/DM role succeeds only when explicit user_id makes historical RLS pass; this is NOT an approved original-UI change");

  // Historical self-owned account INSERT remains possible without any
  // authentic item creation receipt. Player inventory uses a separate
  // gameplay entitlement from character-owned item creation.
  const minted=await put(owner,"player",owner.id,
   "P19 arbitrary unearned self account item expected RED");
  assert.ifError(minted.error);
  assert.equal(minted.rows?.length,1);
  assert.equal(minted.rows[0].owner_id,owner.id);
  assert.equal(minted.rows[0].user_id,owner.id);
  const foreign=await put(owner,"player",outsider.id,
   "P19 forged foreign account item");
  deny(foreign,"Original player-account foreign ownership must remain denied","42501");
  console.log("PASS P19-ACCOUNT-MINT-RED: genuine signed player can still arbitrarily mint account-owned item; foreign account INSERT denied (P18 does not address this independent release gap)");
  
  // Apply only the incremental disposable policy AFTER original genuine RED.
  // This is not an installed Stage4, not an approved production migration,
  // and cannot be used to mask owner_type='player' unearned self-mint.
  sql(p19source);policyInstalled=true;
  assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"5");
  const v=await Promise.all(["ADMIN","GM","DM","OWNER","OUTSIDER","OBSERVER"].map(async role=>{
   const response=await roles[role].who.rpc("c34_b14_p16_is_item_grant_manager_v1");
   assert.ifError(response.error);return [role,response.data];
  }));
  assert.deepEqual(Object.fromEntries(v),{
   ADMIN:true,GM:true,DM:true,OWNER:false,OUTSIDER:false,OBSERVER:false
  },"Current game manager authorization must never include Observer");
  console.log("PASS P19-ROLE-AUTH: P16 source-original strict current-user manager predicate accepts exactly admin/gm/dm, not Observer/player");

  for(const [who,type,target,label] of [
   [gm,"npc",hired,"P19 GREEN unchanged GM NPC no user_id"],
   [dm,"merchant",merchant,"P19 GREEN unchanged DM merchant no user_id"],
   [gm,"player",outsider.id,"P19 GREEN original GM player grant"]
  ]){
   const r=await put(who,type,target,label);
   assert.ifError(r.error);
   assert.equal(r.rows?.length,1);
   assert.equal(r.rows[0].owner_type,type);
   assert.equal(r.rows[0].owner_id,target);
   assert.equal(row(r.rows[0].id).user_id,type==="player"?outsider.id:null,
    "P19 must preserve original actual AssignItemButton user_id shape");
  }
  console.log("PASS P19-ASSIGN-TEMP-GREEN: original GM NPC and DM merchant without user_id plus GM player-target assignment succeed via temporary current-role policy, no client rewrite");

  // The original SELECT policy is independent of INSERT. A GM may now
  // author an item for an NPC but cannot read that null-user_id row directly
  // with the historical strict-admin SELECT RLS. Do not declare a full
  // inventory-manager UI cutover until the held Stage4 reader matrix is tested.
  const gmOwned=sql("SELECT id::text FROM public.inventory_items WHERE item_name="+
   lit("P19 GREEN unchanged GM NPC no user_id"));
  const gmRead=await gm.who.from("inventory_items").select("id,owner_type,owner_id,user_id")
   .eq("id",gmOwned);
  assert.ifError(gmRead.error);
  assert.equal(gmRead.data?.length,0,
   "P19 INSERT permission is separate from original strict-admin SELECT visibility");
  console.log("PASS P19-MANAGER-READ-HOLD: unchanged GM NPC INSERT succeeds but original strict-admin SELECT still hides assigned row; held Stage4 reader migration remains required");



  for(const who of [owner,outsider,roles.OBSERVER]){
   const label="P19 unprivileged raw NPC mint "+who.role+" "+who.id;
   const r=await put(who,"npc",hired,label);
   deny(r,"Player/Observer must never become NPC item manager","42501");
   assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE item_name="+lit(label)),"0");
  }
  assert.equal(sql("SELECT has_table_privilege('anon','public.inventory_items','INSERT')"),"f");
  console.log("PASS P19-ASSIGN-TEMP-DENY: signed player, outsider, Observer and anonymous grant excluded; no ghost rows");

  const stillMint=await put(owner,"player",owner.id,
   "P19 unchanged account mint under temporary manager policy RED");
  assert.ifError(stillMint.error);
  assert.equal(stillMint.rows?.length,1);
  console.log("PASS P19-ACCOUNT-MINT-HOLD: manager-only P19 policy does not repair ordinary unearned account-item mint; independent P20 prerequisite");

 } finally {
  if(policyInstalled)
   sql("DROP POLICY IF EXISTS c34_b14_p19_temporary_game_manager_insert ON public.inventory_items");
  assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),
   beforePolicies,"P19 must restore original four RLS policies");
  for(const id of made)sql("DELETE FROM public.inventory_items WHERE id="+q(id));
  if(merchantAdded)sql("DELETE FROM public.characters WHERE id="+q(merchant));
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
   " AND tgname IN ('c34_b14_p16_guard_direct_inventory_dml',"+
   "'c34_b14_p18_guard_direct_character_item_creation') AND NOT tgisinternal"),"2");
  console.log("PASS P19-ASSIGN-RESTORE: temporary manager policy, source-shaped inventory/merchant rows removed; original four RLS and P16/P18 triggers intact");
 }
}
