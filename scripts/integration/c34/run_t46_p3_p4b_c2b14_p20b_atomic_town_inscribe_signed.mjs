// P20B signed source-narrow Town "Inscribe & Copy" atomic research.
// Works ONLY inside P20A/P18/P16 ephemeral PG17/GoTrue signed stack.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const sqlPath="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20b_disposable_atomic_town_inscribe_pg17.sql";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function runC34B14P20BAtomicTownInscribeSigned({env,sql,q,lit,roles}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  C34_P16_SIGNED_CONFIRM:"P16_NO_BYPASS_DISPOSABLE_PG17_ONLY",
  C34_P18_SIGNED_CONFIRM:"P18_CHARACTER_INSERT_DISPOSABLE_PG17_ONLY",
  C34_P19_SIGNED_CONFIRM:"P19_MANAGER_ASSIGN_DISPOSABLE_PG17_ONLY",
  C34_P20A_SIGNED_CONFIRM:"P20A_EARNED_RECEIPT_DISPOSABLE_PG17_ONLY",
  C34_P20B_SIGNED_CONFIRM:"P20B_ATOMIC_TOWN_INSCRIBE_DISPOSABLE_PG17_ONLY"
 }))assert.equal(env[k],v,"P20B refuses hosted or unsigned fixture");
 const base=roles.OWNER,foreign=roles.OUTSIDER;
 assert.ok(base.who&&foreign.who&&base.id!==foreign.id);
 const town=81247,scribe=randomUUID(),label="P20B "+randomUUID()+" ";
 const source=fs.readFileSync(path.join(root,sqlPath),"utf8");
 const oldPolicies=sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass");
 assert.equal(oldPolicies,"5","P20A must be installed before P20B");
 assert.equal(sql("SELECT count(*) FROM public.locations WHERE id="+town),"1",
  "Must reuse the original Town browser fixture location, not invent a town");
 assert.ok(source.includes("DELETE FROM public.inventory_items WHERE id=v_item.id"));
 assert.ok(source.includes("pg_advisory_xact_lock"));
 const count=name=>sql("SELECT count(*) FROM public.inventory_items WHERE item_name="+lit(label+name));
 const deny=(response,context,code="42501")=>{
  assert.equal(response.error?.code,code,context+": "+JSON.stringify(response));
 };
 const call=async(who,request,item,crafter=scribe,location=town)=>{
  let result;
  for(let n=0;n<30;n++){
   result=await who.who.rpc("c34_b14_p20b_inscribe_owned_item_v1",{
    p_request_id:request,p_primary_item_id:item,
    p_crafter_id:crafter,p_town_id:location
   });
   if(result.error?.code!=="PGRST202")break;
   await sleep(180);
  }
  return result;
 };
 const claim=async(who,id)=>{
  const r=await who.who.rpc("c34_b14_p20a_claim_earned_account_item_v1",{p_receipt_id:id});
  assert.ifError(r.error);return r.data;
 };
 const trustedBase=async suffix=>{
  const receipt=randomUUID(),origin=randomUUID();
  sql("INSERT INTO private.c34_b14_p20a_earned_item_receipts"+
   "(receipt_id,recipient_user_id,source_kind,source_ref,item_id,item_name) VALUES("+
   q(receipt)+","+q(base.id)+",'trusted_loot',"+q(origin)+
   ",'P20B_APPROVED_SOURCE',"+lit(label+suffix)+")");
  const item=await claim(base,receipt);
  assert.match(item,/^[0-9a-f-]{36}$/i);
  return item;
 };
 let installed=false,crafterAdded=false,forcedFailure=false;
 try {
  sql(source);installed=true;
  sql("NOTIFY pgrst,'reload schema'");
  sql("INSERT INTO public.characters(id,name,kind,location_id,state,is_hidden,tags) VALUES("+
    q(scribe)+",'P20B Local Scribe','npc',"+town+",'resting',false,ARRAY['scribe']::text[])");
  crafterAdded=true;
  assert.equal(sql("SELECT has_table_privilege('authenticated',"+
    lit("private.c34_b14_p20b_town_inscribe_receipts")+",'INSERT')"),"f");
  assert.equal(sql("SELECT has_function_privilege('anon',"+
    lit("public.c34_b14_p20b_inscribe_owned_item_v1(uuid,uuid,uuid,bigint)")+
    ",'EXECUTE')"),"f");
  assert.ok(fs.readFileSync(path.join(root,"components/TownSheet.js"),"utf8")
    .includes('id: "inscribe"'));
  const page=fs.readFileSync(path.join(root,"pages/town/[id].js"),"utf8");
  assert.ok(page.includes("case \"inscribe\":"));
  assert.ok(page.includes('.insert(craftedInsert)')&&page.includes('.insert(rollbackRows)'));
  console.log("PASS P20B-ORIGINAL-TOWN-SOURCE: exact mounted Town service is 'inscribe'; original two-request deletion, crafted insert and compensating rollback still untouched");

  const baseItem=await trustedBase("Original Plain Ledger");
  const before=sql("SELECT md5(row_to_json(i)::text) FROM public.inventory_items i WHERE id="+q(baseItem));
  const nonce=randomUUID();
  deny(await call(foreign,nonce,baseItem),"Foreign signed claimant must not consume another user's item");
  deny(await call(base,nonce,baseItem,randomUUID()),"Invented scribe");
  deny(await call(base,nonce,baseItem,scribe,town+1),"Nonpresent scribe/town");
  deny(await call(base,nonce,randomUUID()),"Invented inventory input");
  assert.equal(sql("SELECT md5(row_to_json(i)::text) FROM public.inventory_items i WHERE id="+q(baseItem)),before);
  assert.equal(sql("SELECT count(*) FROM private.c34_b14_p20b_town_inscribe_receipts"),"0");
  console.log("PASS P20B-SIGNED-DENY: forged input/crafter/town and independent outsider JWT rejected without consuming original item");

  // A deliberate AFTER-consumption INSERT failure proves real SQL rollback
  // returns the original inventory row with all original fields intact.
  const failingNonce=randomUUID();
  sql("CREATE FUNCTION private.c34_b14_p20b_fail_insert_v1() RETURNS trigger"+
   " LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,private"+
   " AS $fail$ BEGIN IF NEW.card_payload->>'craft_request_id'="+lit(failingNonce)+
   " THEN RAISE EXCEPTION 'P20B deliberate post-delete rollback fixture' USING ERRCODE='P0001';"+
   " END IF; RETURN NEW; END; $fail$;");
  sql("CREATE TRIGGER c34_b14_p20b_injected_post_delete_failure BEFORE INSERT"+
   " ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION private.c34_b14_p20b_fail_insert_v1()");
  forcedFailure=true;
  const failed=await call(base,failingNonce,baseItem);
  deny(failed,"Post-DELETE INSERT failure must rollback original consumed source","P0001");
  assert.equal(sql("SELECT md5(row_to_json(i)::text) FROM public.inventory_items i WHERE id="+q(baseItem)),before);
  assert.equal(sql("SELECT count(*) FROM private.c34_b14_p20b_town_inscribe_receipts"),"0");
  sql("DROP TRIGGER c34_b14_p20b_injected_post_delete_failure ON public.inventory_items");
  sql("DROP FUNCTION private.c34_b14_p20b_fail_insert_v1()");
  forcedFailure=false;
  console.log("PASS P20B-ATOMIC-ROLLBACK: real trigger failure AFTER server DELETE rolls back every original item field and the request ledger; no raw browser compensating mint");

  const [one,two]=await Promise.all([call(base,nonce,baseItem),call(base,nonce,baseItem)]);
  assert.ifError(one.error);assert.ifError(two.error);
  assert.equal(one.data,two.data,"Exact concurrent nonce must share one result");
  const result=one.data;
  assert.match(result,/^[0-9a-f-]{36}$/i);
  assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE id="+q(baseItem)),"0");
  assert.equal(count("Original Plain Ledger"),"1");
  assert.equal(sql("SELECT count(*) FROM private.c34_b14_p20b_town_inscribe_receipts"+
    " WHERE request_id="+q(nonce)),"1");
  assert.equal(sql("SELECT item_name||'|'||item_type||'|'||item_rarity FROM public.inventory_items WHERE id="+q(result)),
   label+"Original Plain Ledger|gear|Common");
  const payload=JSON.parse(sql("SELECT card_payload::text FROM public.inventory_items WHERE id="+q(result)));
  assert.equal(payload.crafted_by,"P20B Local Scribe");
  assert.equal(payload.crafted_service,"inscribe");
  assert.equal(payload.crafted_bonus,0);
  assert.deepEqual(payload.crafted_components,[]);
  assert.equal(payload.source_item_id,baseItem);
  assert.equal(payload.craft_request_id,nonce);
  assert.equal(sql("SELECT item_description FROM public.inventory_items WHERE id="+q(result)),
   "P20B Local Scribe inscribed "+label+"Original Plain Ledger into a utility script or encoded form.");
  assert.equal(sql("SELECT item_id LIKE 'crafted-%' FROM public.inventory_items WHERE id="+q(result)),"t");
  const ownerRead=await base.who.from("inventory_items").select("id,is_equipped").eq("id",result);
  assert.ifError(ownerRead.error);assert.equal(ownerRead.data?.length,1);
  const foreignRead=await foreign.who.from("inventory_items").select("id").eq("id",result);
  assert.ifError(foreignRead.error);assert.equal(foreignRead.data?.length,0);
  const equip=await base.who.from("inventory_items").update({is_equipped:true,equip_slot:"weapon_1"})
   .eq("id",result).select("id,is_equipped");
  assert.ifError(equip.error);assert.equal(equip.data?.[0]?.is_equipped,true);
  deny(await call(base,nonce,randomUUID()),"Changed complete original intent on same nonce");
  deny(await call(foreign,nonce,baseItem),"Cross-account replay of another user's original nonce");
  const repeat=await call(base,nonce,baseItem);
  assert.ifError(repeat.error);assert.equal(repeat.data,result);
  assert.equal(count("Original Plain Ledger"),"1");
  console.log("PASS P20B-INSCRIBE-GREEN: source-derived plain-gear Inscribe & Copy result is atomic and signed, original base consumed once, payload/provenance preserved, account view/equip private");
  console.log("PASS P20B-NONCE-CONCURRENCY: two same-request signed concurrent RPCs yield exactly one result; changed/foreign replay denied and repeated nonce inert");

  const contending=await trustedBase("Second Plain Folio");
  const [a,b]=await Promise.all([call(base,randomUUID(),contending),call(base,randomUUID(),contending)]);
  const accepted=[a,b].filter(x=>!x.error),rejected=[a,b].filter(x=>x.error);
  assert.equal(accepted.length,1,"Different nonces for same ingredient must not both succeed");
  assert.equal(rejected.length,1);
  assert.equal(rejected[0].error.code,"42501");
  assert.equal(count("Second Plain Folio"),"1");
  console.log("PASS P20B-DOUBLE-CONSUME: independent competing request nonces cannot both consume one source item; one output, one authoritative denial");

 } finally {
  if(forcedFailure){
   sql("DROP TRIGGER IF EXISTS c34_b14_p20b_injected_post_delete_failure ON public.inventory_items");
   sql("DROP FUNCTION IF EXISTS private.c34_b14_p20b_fail_insert_v1()");
  }
  if(installed){
   sql("DROP FUNCTION IF EXISTS public.c34_b14_p20b_inscribe_owned_item_v1(uuid,uuid,uuid,bigint)");
   sql("DROP TABLE IF EXISTS private.c34_b14_p20b_town_inscribe_receipts");
  }
  sql("DELETE FROM public.inventory_items WHERE item_name LIKE "+lit(label+"%"));
  if(crafterAdded)sql("DELETE FROM public.characters WHERE id="+q(scribe));
  assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass"),oldPolicies);
  assert.equal(sql("SELECT to_regprocedure('public.c34_b14_p20b_inscribe_owned_item_v1(uuid,uuid,uuid,bigint)') IS NULL"),"t");
  assert.equal(sql("SELECT to_regclass('private.c34_b14_p20b_town_inscribe_receipts') IS NULL"),"t");
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass"+
   " AND tgname IN ('c34_b14_p16_guard_direct_inventory_dml',"+
   "'c34_b14_p18_guard_direct_character_item_creation') AND NOT tgisinternal"),"2");
  console.log("PASS P20B-RESTORE: local craft RPC, private idempotency ledger, injected failure trigger, scribe and items removed; original P20A/P16/P18 and RLS untouched");
 }
}
