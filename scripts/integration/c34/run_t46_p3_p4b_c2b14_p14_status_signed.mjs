// C34 B14-P14: genuine signed disposable PostgreSQL17, GoTrue, PostgREST.
// Status + private batch mapping AFTER P8 GM/nonce/cancel tests. NOT deployed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p14_offer_status_and_links_pg17.sql";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function runC34B14P14StatusSigned({env,sql,q,lit,roles,hired,forgeSource}){
 for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321"
 })) assert.equal(env[key],value,"P14 is disposable PG17 only");
 assert.equal(env.C34_P14_SIGNED_CONFIRM,"P14_STATUS_LOCAL_SIGNED_ONLY");
 const source=fs.readFileSync(path.join(root,src),"utf8");
 assert.match(source,/DO \$p14_local_guard\$/);
 assert.match(source,/private\.c34_b14_p14_batch_offer_links/);
 assert.ok(!source.includes("DROP FUNCTION"));
 const originals=[
  "public.c34_b14_p8_dispatch_batch_intent_v1(uuid,uuid[],text,text,text,text)",
  "public.c34_b14_p8_dispatch_item_intent_v1(uuid,uuid,text,text,text,text)",
  "public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)",
  "public.transfer_inventory_item_v1(uuid,text,text)"
 ];
 const hash=s=>sql("SELECT md5(pg_get_functiondef("+lit(s)+"::regprocedure))");
 const hashes=originals.map(hash);
 sql(source);sql("NOTIFY pgrst,'reload schema'");
 const BULK="c34_b14_p14_dispatch_batch_intent_v1";
 const STATUS="c34_b14_p14_my_intent_status_v1";
 const OLD="c34_b14_p8_dispatch_batch_intent_v1";
 const SINGLE="c34_b14_p8_dispatch_item_intent_v1";
 const GM="c34_b14_p8_gm_decide_item_offer_v1";
 const CANCEL="c34_b14_p6_cancel_item_offer_v1";
 const actor=roles.OWNER,other=roles.OUTSIDER;
 const rpc=async(user,name,args)=>{
  let res;for(let i=0;i<30;i++){
   res=await user.who.rpc(name,args);
   if(res.error?.code!=="PGRST202")break;
   await wait(170);
  }return res;
 };
 const deny=(r,label,code)=>{
  assert.ok(r.error,label+" expected denial but got "+JSON.stringify(r.data));
  if(code)assert.equal(r.error.code,code,label+" unexpected SQLSTATE: "+JSON.stringify(r.error));
 };
 const make=(label,type="player",ownerId=actor.id)=>{
  const id=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,item_type,item_rarity,is_equipped) VALUES("+
   q(id)+","+lit(type)+","+q(ownerId)+","+q(actor.id)+","+
   lit("P14 "+label)+",'Misc','Common',false)");
  return id;
 };
 const owned=id=>JSON.parse(sql("SELECT json_build_object('type',owner_type,"+
  "'id',owner_id,'user_id',user_id)::text FROM public.inventory_items WHERE id="+q(id)));
 const args=(ids,targetType="npc",targetId=hired,requestId=randomUUID(),
              type="player",ownerId=actor.id)=>({
  p_request_id:requestId,p_item_ids:ids,p_expected_owner_type:type,
  p_expected_owner_id:ownerId,p_target_type:targetType,p_target_id:targetId
 });
 const status=(user,id)=>rpc(user,STATUS,{p_request_id:id});
 const links=id=>JSON.parse(sql("SELECT coalesce(json_agg(json_build_object("+
  "'child',child_offer_request_id,'item',item_id,'ordinal',ordinal) ORDER BY ordinal),'[]'::json)::text"+
  " FROM private.c34_b14_p14_batch_offer_links WHERE parent_request_id="+q(id)));
 const immutable=id=>JSON.parse(sql("SELECT receipt::text FROM private.c34_b14_p8_intent_receipts WHERE request_id="+q(id)));
 assert.equal(sql("SELECT has_table_privilege('authenticated','private.c34_b14_p14_batch_offer_links','SELECT')"),"f");
 assert.equal(sql("SELECT has_function_privilege('anon',"+
  lit("public.c34_b14_p14_my_intent_status_v1(uuid)")+",'EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+
  lit("public.c34_b14_p14_my_intent_status_v1(uuid)")+",'EXECUTE')"),"t");
 assert.ifError((await rpc(roles.GM,"c34_b14_p6_set_npc_capability_v1",{
  p_npc_id:hired,p_user_id:actor.id,p_capability:"auto_accept_items",p_enabled:false
 })).error);
 console.log("PASS P14-LOCAL: installed versioned status/map into disposable signed fixture only; direct private SELECT denied");
 const {createClient}=await import("@supabase/supabase-js");
 const anon=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 deny(await status(other,randomUUID()),"unknown original sender","42501");
 deny(await anon.rpc(STATUS,{p_request_id:randomUUID()}),"anonymous status",null);
 const ids=[make("pending A"),make("pending B"),make("pending C")];
 const request=args([ids[2],ids[0],ids[1]]);
 const sent=await rpc(actor,BULK,request);assert.ifError(sent.error);
 assert.equal(sent.data.receipts.length,3);
 assert.deepEqual(sent.data.receipts.map(x=>x.status),["pending","pending","pending"]);
 assert.ok(sent.data.receipts.every(x=>x.request_id===request.p_request_id));
 const storedLinks=links(request.p_request_id);
 assert.equal(storedLinks.length,3);
 assert.equal(new Set(storedLinks.map(x=>x.child)).size,3);
 assert.deepEqual(storedLinks.map(x=>x.item).sort(),[...ids].sort());
 assert.ok(storedLinks.every(x=>x.child!==request.p_request_id));
 for(const link of storedLinks){
  assert.equal(sql("SELECT state FROM private.c34_b14_p6_item_offers WHERE request_id="+q(link.child)),"pending");
  assert.equal(owned(link.item).id,actor.id);
 }
 const before=immutable(request.p_request_id);
 const first=await status(actor,request.p_request_id);assert.ifError(first.error);
 assert.deepEqual(Object.keys(first.data).sort(),["items","request_id","status","target_type"]);
 assert.equal(first.data.status,"pending");
 assert.equal(first.data.items.length,3);
 for(const link of storedLinks)assert.ok(!JSON.stringify(first.data).includes(link.child));
 assert.ok(!JSON.stringify(first.data).includes("card_payload"));
 assert.ok(!JSON.stringify(first.data).includes("decided_by"));
 const replay=await rpc(actor,BULK,request);assert.ifError(replay.error);
 assert.deepEqual(replay.data,sent.data);
 assert.deepEqual(links(request.p_request_id),storedLinks);
 deny(await status(other,request.p_request_id),"other JWT read own-only request","42501");
 deny(await rpc(other,BULK,request),"other JWT adopt request UUID","40001");
 console.log("PASS P14-BULK-PENDING: 3 hidden unpredictable child IDs and source-owned items, sender-only current state and immutable replay");
 assert.ifError((await rpc(roles.GM,GM,{p_request_id:storedLinks[0].child,p_accept:true})).error);
 assert.ifError((await rpc(actor,CANCEL,{p_request_id:storedLinks[1].child})).error);
 assert.ifError((await rpc(roles.GM,GM,{p_request_id:storedLinks[2].child,p_accept:false})).error);
 const mixed=await status(actor,request.p_request_id);assert.ifError(mixed.error);
 assert.equal(mixed.data.status,"mixed");
 assert.deepEqual(mixed.data.items.map(x=>x.status),["accepted","cancelled","declined"]);
 assert.deepEqual(immutable(request.p_request_id),before);
 assert.equal(owned(storedLinks[0].item).id,hired);
 assert.equal(owned(storedLinks[1].item).id,actor.id);
 assert.equal(owned(storedLinks[2].item).id,actor.id);
 console.log("PASS P14-BULK-TERMINAL: GM accept, sender cancel, GM decline; distinct current states without editing P8 receipt");

 const singleItem=make("original P8 single"),singleRequest=randomUUID();
 assert.ifError((await rpc(actor,SINGLE,{
  p_request_id:singleRequest,p_item_id:singleItem,
  p_expected_owner_type:"player",p_expected_owner_id:actor.id,
  p_target_type:"npc",p_target_id:hired
 })).error);
 assert.equal((await status(actor,singleRequest)).data?.status,"pending");
 assert.ifError((await rpc(roles.GM,GM,{p_request_id:singleRequest,p_accept:true})).error);
 assert.equal((await status(actor,singleRequest)).data?.status,"accepted");
 console.log("PASS P14-SINGLE: original P8 submit UUID reads actual P6 state after GM acceptance");

 const legacyItem=make("original P8 unmapped"),legacy=args([legacyItem]);
 assert.ifError((await rpc(actor,OLD,legacy)).error);
 deny(await status(actor,legacy.p_request_id),
  "legacy P8 batch has no private child map, never pretend to know current state","40001");
 deny(await rpc(actor,BULK,legacy),
  "P14 cannot adopt P8 parent without links","40001");
 console.log("PASS P14-UNMAPPED-RED: old P8 bulk may still submit, but cannot be replayed or queried as mapped P14");

 const playerItem=make("player account"),playerBatch=args([playerItem],"player",other.id);
 assert.ifError((await rpc(actor,BULK,playerBatch)).error);
 const playerStatus=await status(actor,playerBatch.p_request_id);assert.ifError(playerStatus.error);
 assert.equal(playerStatus.data.status,"accepted");
 assert.equal(owned(playerItem).id,other.id);
 assert.deepEqual(links(playerBatch.p_request_id),[]);
 console.log("PASS P14-PLAYER: signed original immediate account recipient, no forged P6 link");

 const forgeItem=make("controlled companion","character",forgeSource);
 const forgeKey=randomUUID();
 assert.ifError((await rpc(actor,SINGLE,{
  p_request_id:forgeKey,p_item_id:forgeItem,
  p_expected_owner_type:"character",p_expected_owner_id:forgeSource,
  p_target_type:"npc",p_target_id:hired
 })).error);
 sql("UPDATE public.character_permissions SET can_control=false WHERE character_id="+
  q(hired)+" AND user_id="+q(actor.id));
 const revoked=await status(actor,forgeKey);assert.ifError(revoked.error);
 assert.equal(revoked.data.status,"pending",
  "sender can still read minimal own request lifecycle after NPC-control revocation");
 deny(await rpc(roles.GM,GM,{p_request_id:forgeKey,p_accept:true}),
  "GM cannot accept after source Forge sender loses control of target","42501");
 assert.equal(owned(forgeItem).id,forgeSource);
 assert.ifError((await rpc(actor,CANCEL,{p_request_id:forgeKey})).error);
 assert.equal((await status(actor,forgeKey)).data.status,"cancelled");
 sql("UPDATE public.character_permissions SET can_control=true WHERE character_id="+
  q(hired)+" AND user_id="+q(actor.id));
 console.log("PASS P14-REVOKE: same-JWT revoked NPC control fails GM settlement, own minimal status updates after cancel");

 const raceItem=make("accept vs cancel"),raceKey=randomUUID();
 assert.ifError((await rpc(actor,SINGLE,{
  p_request_id:raceKey,p_item_id:raceItem,p_expected_owner_type:"player",
  p_expected_owner_id:actor.id,p_target_type:"npc",p_target_id:hired
 })).error);
 const [accept,cancel]=await Promise.all([
  rpc(roles.GM,GM,{p_request_id:raceKey,p_accept:true}),
  rpc(actor,CANCEL,{p_request_id:raceKey})
 ]);
 assert.equal([accept,cancel].filter(x=>!x.error).length,1);
 assert.equal([accept,cancel].filter(x=>x.error?.code==="40001").length,1);
 const final=await status(actor,raceKey);assert.ifError(final.error);
 assert.equal(final.data.status,accept.error?"cancelled":"accepted");
 assert.equal(owned(raceItem).id,accept.error?actor.id:hired);
 console.log("PASS P14-GM-CANCEL-RACE: exactly one terminal outcome, status matches true ownership");

 const wrongItems=[make("rollback valid"),make("rollback wrong")].sort();
 sql("UPDATE public.inventory_items SET owner_id="+q(other.id)+",user_id="+q(other.id)+
  " WHERE id="+q(wrongItems[1]));
 const badKey=randomUUID();
 deny(await rpc(actor,BULK,args(wrongItems,"npc",hired,badKey)),
  "second item fails entire pending batch","40001");
 assert.equal(owned(wrongItems[0]).id,actor.id);
 assert.equal(sql("SELECT count(*) FROM private.c34_b14_p14_batch_offer_links WHERE parent_request_id="+q(badKey)),"0");
 assert.equal(sql("SELECT count(*) FROM private.c34_b14_p8_intent_receipts WHERE request_id="+q(badKey)),"0");
 assert.equal(sql("SELECT count(*) FROM private.c34_b14_p6_item_offers WHERE item_id="+q(wrongItems[0])),"0");
 const duplicate=make("duplicate");
 deny(await rpc(actor,BULK,args([duplicate,duplicate])),"duplicate IDs","22023");
 deny(await rpc(actor,BULK,args(Array.from({length:51},()=>randomUUID()))),
  "51 IDs exceed strict 1–50 bound","22023");
 console.log("PASS P14-ATOMIC: failed second item reverts first offer, child map and parent receipt; duplicates/51 denied");

 const parallelItem=make("same-parent concurrency"),parallelRequest=args([parallelItem]);
 const pair=await Promise.all([rpc(actor,BULK,parallelRequest),rpc(actor,BULK,parallelRequest)]);
 pair.forEach(x=>assert.ifError(x.error));
 assert.deepEqual(pair[0].data,pair[1].data);
 assert.equal(links(parallelRequest.p_request_id).length,1);
 assert.equal((await status(actor,parallelRequest.p_request_id)).data?.status,"pending");
 for(let i=0;i<originals.length;i++)
  assert.equal(hash(originals[i]),hashes[i],"P14 must not replace original "+originals[i]);
 console.log("PASS P14-CONCURRENT-PARITY: concurrent idempotent parent, 1 child, original June/P6/P8 MD5 unchanged");
 console.log("PASS P14-SIGNED: source-authentic live JWT status+private batch map in disposable PG17 ONLY; old direct bypass still RED");
}
