// P20A: signed disposable RED -> restricted direct INSERT and private receipt GREEN.
// NOT an installed earned-item service. Real Town craft, Forge v3/Stage4 and
// mounted /admin browser are release HOLD until source-authentic completion.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
import {runC34B14P20BAtomicTownInscribeSigned} from "./run_t46_p3_p4b_c2b14_p20b_atomic_town_inscribe_signed.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const candidate="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20a_disposable_earned_receipt_gate_pg17.sql";
const p19="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p19_disposable_game_manager_assignment_policy_pg17.sql";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function runC34B14P20AEarnedReceiptSigned({env,sql,q,lit,roles,hired}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  C34_P16_SIGNED_CONFIRM:"P16_NO_BYPASS_DISPOSABLE_PG17_ONLY",
  C34_P18_SIGNED_CONFIRM:"P18_CHARACTER_INSERT_DISPOSABLE_PG17_ONLY",
  C34_P19_SIGNED_CONFIRM:"P19_MANAGER_ASSIGN_DISPOSABLE_PG17_ONLY",
  C34_P20A_SIGNED_CONFIRM:"P20A_EARNED_RECEIPT_DISPOSABLE_PG17_ONLY"
 }))assert.equal(env[k],v,"P20A must run only in the genuine local signed fixture");
 const originalCount=sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass");
 assert.equal(originalCount,"4","P19 must have restored the four historical policies first");
 const sqlCandidate=fs.readFileSync(path.join(root,candidate),"utf8");
 assert.ok(sqlCandidate.includes("AS RESTRICTIVE FOR INSERT TO authenticated"));
 assert.ok(sqlCandidate.includes("SECURITY DEFINER"));
 assert.ok(!sqlCandidate.includes("ALTER POLICY inventory_items_insert_owner_or_admin"));
 const alice=roles.OWNER,bob=roles.OUTSIDER,admin=roles.ADMIN,gm=roles.GM,dm=roles.DM;
 for(const who of [alice,bob,admin,gm,dm,roles.OBSERVER])
  assert.ok(who?.id&&who?.who,"Independently signed source actor missing");
 const prefix="P20A "+randomUUID()+" ";
 const make=(who,type,ownerId,label,extra={})=>who.who.from("inventory_items").insert({
  owner_type:type,owner_id:ownerId,item_id:"P20A_SOURCE_AUTH",
  item_name:prefix+label,item_type:"Misc",item_rarity:"Common",
  card_payload:{source_test:"P20A",...extra},is_equipped:false,
  ...(type==="player"?{user_id:ownerId}:{})
 });
 const count=(name)=>sql("SELECT count(*) FROM public.inventory_items WHERE item_name="+lit(prefix+name));
 const denied=(response,context)=>{
  assert.equal(response.error?.code,"42501",context+" accepted or wrong SQLSTATE: "+JSON.stringify(response));
 };
 let installed=false,managerInstalled=false;
 try{
  const red=await make(alice,"player",alice.id,"raw-unearned-before");
  assert.ifError(red.error);
  assert.equal(count("raw-unearned-before"),"1");
  console.log("PASS P20A-ORIGINAL-SIGNED-RED: independently signed ordinary account can mint item by unchanged raw PostgREST INSERT under historical policy");

  sql(sqlCandidate);installed=true;
  sql("NOTIFY pgrst,'reload schema'");
  assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"5");
  assert.equal(sql("SELECT has_table_privilege('authenticated',"+
    lit("private.c34_b14_p20a_earned_item_receipts")+",'INSERT')"),"f");
  assert.equal(sql("SELECT has_function_privilege('anon',"+
    lit("public.c34_b14_p20a_claim_earned_account_item_v1(uuid)")+",'EXECUTE')"),"f");

  denied(await make(alice,"player",alice.id,"raw-unearned-after"),
   "Direct self-account mint despite restrictive receipt gate");
  denied(await make(bob,"player",bob.id,"raw-second-account"),
   "Second signed account minted without earned receipt");
  denied(await make(alice,"player",bob.id,"raw-foreign-account"),
   "Foreign recipient ID spoof");
  denied(await make(alice,"npc",hired,"raw-npc-no-user-id"),
   "Ordinary user NPC item");
  denied(await make(alice,"player",alice.id,"raw-forged-card-receipt",
    {earned_receipt:randomUUID(),source_kind:"trusted_craft"}),
   "Browser-provided fake receipt embedded in card_payload");
  denied(await make(roles.OBSERVER,"player",roles.OBSERVER.id,"raw-observer"),
   "Observer role game-manager bypass");
  for(const label of ["raw-unearned-after","raw-second-account","raw-foreign-account",
   "raw-npc-no-user-id","raw-forged-card-receipt","raw-observer"])
   assert.equal(count(label),"0",label+" left ghost items");
  console.log("PASS P20A-RAW-DENY: genuine player/outsider/observer self, foreign, NPC and forged-card direct INSERT rejected; original RLS policies not replaced");

  const claim=async(who,id)=>{
   let r;
   for(let t=0;t<30;t++){
    r=await who.who.rpc("c34_b14_p20a_claim_earned_account_item_v1",{p_receipt_id:id});
    if(r.error?.code!=="PGRST202")break;
    await sleep(160);
   }return r;
  };
  const receipt=randomUUID(),origin=randomUUID();
  const earned="trusted-craft-receipt";
  // Only the trusted disposable postgres connection seeds entitlement. This
  // does NOT establish the original Town recipe/ingredient issuance authority.
  sql("INSERT INTO private.c34_b14_p20a_earned_item_receipts"+
    "(receipt_id,recipient_user_id,source_kind,source_ref,item_id,item_name) VALUES("+
    q(receipt)+","+q(alice.id)+",'trusted_craft',"+q(origin)+
    ",'P20A_SOURCE_EARNED',"+lit(prefix+earned)+")");
  denied(await claim(bob,receipt),"Foreign signed claimant");
  denied(await claim(alice,randomUUID()),"Missing or invented server receipt");
  const [first,second]=await Promise.all([claim(alice,receipt),claim(alice,receipt)]);
  assert.ifError(first.error);assert.ifError(second.error);
  assert.equal(first.data,second.data,"Concurrent same-receipt claims duplicated item");
  const itemId=first.data;
  assert.match(itemId,/^[0-9a-f-]{36}$/i);
  assert.equal(count(earned),"1","Concurrent claim created duplicate inventory rows");
  assert.equal(sql("SELECT inventory_item_id::text FROM private.c34_b14_p20a_earned_item_receipts WHERE receipt_id="+q(receipt)),itemId);
  assert.equal(sql("SELECT owner_type||':'||owner_id||':'||user_id::text FROM public.inventory_items WHERE id="+q(itemId)),
   "player:"+alice.id+":"+alice.id,"Signed server grant wrote wrong inventory owner");
  const visible=await alice.who.from("inventory_items").select("id,item_name,is_equipped").eq("id",itemId);
  assert.ifError(visible.error);assert.equal(visible.data?.length,1);
  const hidden=await bob.who.from("inventory_items").select("id").eq("id",itemId);
  assert.ifError(hidden.error);assert.equal(hidden.data?.length,0);
  const equip=await alice.who.from("inventory_items")
   .update({is_equipped:true,equip_slot:"weapon_1"}).eq("id",itemId).select("id,is_equipped");
  assert.ifError(equip.error);assert.equal(equip.data?.[0]?.is_equipped,true);
  console.log("PASS P20A-RECEIPT-GREEN: locked trusted receipt + signed recipient only; two concurrent claims produce one self-owned item, private SELECT and self-equip preserved");

  const consume=await alice.who.from("inventory_items").delete().eq("id",itemId).select("id");
  assert.ifError(consume.error);assert.equal(consume.data?.length,1);
  const afterConsume=await claim(alice,receipt);
  assert.ifError(afterConsume.error);assert.equal(afterConsume.data,itemId);
  assert.equal(count(earned),"0","Consumed receipt was reissued as free gear");
  denied(await make(alice,"player",alice.id,"town-raw-rollback"),
   "Original Town raw INSERT is no longer compatible without server-side craft/rollback");
  console.log("PASS P20A-TOWN-RELEASE-HOLD: signed consume works and receipt cannot remint; original browser Town crafted-result/rollback direct INSERT is blocked, requires atomic source-authentic server replacement BEFORE any rollout");

  // Source-narrow P20B atomic Town inscribe research under original P20A restrictive INSERT.
  await runC34B14P20BAtomicTownInscribeSigned({env,sql,q,lit,roles});

  sql(fs.readFileSync(path.join(root,p19),"utf8"));managerInstalled=true;
  assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),"6");
  for(const [who,type,target,label] of [
   [admin,"npc",hired,"admin-npc"],
   [gm,"npc",hired,"gm-npc"],
   [dm,"merchant",hired,"dm-merchant"],
   [gm,"player",bob.id,"gm-player-target"]]){
   const response=await make(who,type,target,label);
   assert.ifError(response.error);
   assert.equal(count(label),"1","Game-manager authoring was blocked: "+label);
  }
  const gmId=sql("SELECT id::text FROM public.inventory_items WHERE item_name="+lit(prefix+"gm-npc"));
  const gmRead=await gm.who.from("inventory_items").select("id").eq("id",gmId);
  assert.ifError(gmRead.error);assert.equal(gmRead.data?.length,0);
  assert.equal(sql("SELECT has_column_privilege('authenticated','public.inventory_items','owner_id','UPDATE')"),"f");
  console.log("PASS P20A-MANAGER-PRESERVE-READ-HOLD: original no-user-id Admin/GM NPC, DM merchant, GM player-target INSERT positive under temporary P19; GM SELECT still hidden, no owner-column UPDATE grant");
 } finally{
  if(managerInstalled)
   sql("DROP POLICY IF EXISTS c34_b14_p19_temporary_game_manager_insert ON public.inventory_items");
  if(installed){
   sql("DROP POLICY IF EXISTS c34_b14_p20a_temporary_signed_insert_gate ON public.inventory_items");
   sql("DROP FUNCTION IF EXISTS public.c34_b14_p20a_claim_earned_account_item_v1(uuid)");
   sql("DROP TABLE IF EXISTS private.c34_b14_p20a_earned_item_receipts");
  }
  sql("DELETE FROM public.inventory_items WHERE item_name LIKE "+lit(prefix+"%"));
  assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),
   originalCount,"Historical inventory policies must be restored");
  assert.equal(sql("SELECT to_regprocedure('public.c34_b14_p20a_claim_earned_account_item_v1(uuid)') IS NULL"),"t");
  assert.equal(sql("SELECT to_regclass('private.c34_b14_p20a_earned_item_receipts') IS NULL"),"t");
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
   " AND tgname IN ('c34_b14_p16_guard_direct_inventory_dml',"+
   "'c34_b14_p18_guard_direct_character_item_creation') AND NOT tgisinternal"),"2");
  console.log("PASS P20A-RESTORE: scratch receipt, function, restrictive/manager policies and rows removed; original four RLS and both P16/P18 guards preserved");
 }
}
