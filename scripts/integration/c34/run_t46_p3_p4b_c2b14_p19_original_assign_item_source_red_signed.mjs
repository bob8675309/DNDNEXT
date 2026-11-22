// B14-P19 research: signed original AssignItemButton direct Data API INSERT shape.
// EXPECTED RED for GM/DM under historical strict-admin RLS, no gameplay changes.
// Executed only while disposable P16 + P18 guards are installed. The actual
// original JSX file stays Git-blob pinned and is NOT modified for the probe.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

export async function runC34B14P19OriginalAssignItemSourceRedSigned({sql,q,lit,roles,hired}){
 const gm=roles.GM,dm=roles.DM,admin=roles.ADMIN,owner=roles.OWNER,outsider=roles.OUTSIDER;
 for(const who of [gm,dm,admin,owner,outsider])
  assert.ok(who?.who&&who.id,"P19 requires independently signed original role actors");
 assert.equal(new Set([gm.id,dm.id,admin.id,owner.id,outsider.id]).size,5);
 assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
  " AND tgname IN ('c34_b14_p16_guard_direct_inventory_dml',"+
  "'c34_b14_p18_guard_direct_character_item_creation') AND NOT tgisinternal"),"2",
  "P19 expected original P16 and P18 authorization protections simultaneously");

 const merchant=randomUUID(),made=[];
 let merchantAdded=false;
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
  const r=await who.who.from("inventory_items").insert(payload(type,target,label))
   .select("id,owner_type,owner_id,user_id");
  if(r.data?.length)for(const row of r.data)made.push(row.id);
  return r;
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
   assert.equal(r.data?.length,1);
   assert.equal(r.data[0].owner_type,type);
   assert.equal(r.data[0].owner_id,id);
   assert.equal(row(r.data[0].id).user_id,null,
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
  assert.equal(minted.data?.length,1);
  assert.equal(minted.data[0].owner_id,owner.id);
  assert.equal(minted.data[0].user_id,owner.id);
  const foreign=await put(owner,"player",outsider.id,
   "P19 forged foreign account item");
  deny(foreign,"Original player-account foreign ownership must remain denied","42501");
  console.log("PASS P19-ACCOUNT-MINT-RED: genuine signed player can still arbitrarily mint account-owned item; foreign account INSERT denied (P18 does not address this independent release gap)");
 } finally {
  for(const id of made)sql("DELETE FROM public.inventory_items WHERE id="+q(id));
  if(merchantAdded)sql("DELETE FROM public.characters WHERE id="+q(merchant));
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
   " AND tgname IN ('c34_b14_p16_guard_direct_inventory_dml',"+
   "'c34_b14_p18_guard_direct_character_item_creation') AND NOT tgisinternal"),"2");
  console.log("PASS P19-ASSIGN-RESTORE: all source-shaped temporary inventory and merchant target records removed; P16/P18 triggers preserved for original finally blocks");
 }
}
