// C34 P9 RESEARCH ONLY. Executed AFTER accepted P7 in disposable signed PG17.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const script="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p9_slim_npc_context_pg17.sql";
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function runC34B14P9SlimNpcSigned({env,sql,q,lit,roles,hired,hiddenNpc,forgePc,ids}){
 for(const [k,v] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",PGUSER:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321"
 }))assert.equal(env[k],v,"P9 cannot run outside disposable local PG17");
 const p6="public.c34_b14_p6_npc_capability_context_v1(uuid)";
 const p7="public.c34_b14_p7_npc_backpack_page_v1(uuid,integer,timestamptz,uuid)";
 const eq="public.c34_b14_p7_set_npc_equipment_v1(uuid,uuid,boolean,text,boolean)";
 const legacy="public.transfer_inventory_item_v1(uuid,text,text)";
 const hash=sig=>sql("SELECT md5(pg_get_functiondef('"+sig+"'::regprocedure))");
 const originals=[p6,p7,eq,legacy,"public.is_admin(uuid)","public.buy_from_merchant(uuid,uuid,integer)"]
  .map(hash);
 const source=fs.readFileSync(path.join(root,script),"utf8");
 assert.match(source,/RESEARCH ONLY/);
 assert.match(source,/LIMIT 12/);
 assert.doesNotMatch(source.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n"),/card_payload|SELECT \*|CREATE TABLE|ALTER TABLE|DROP FUNCTION|DROP POLICY/i);
 sql(source);
 const name="c34_b14_p9_npc_slim_context_v1";
 const sig="public."+name+"(uuid)";
 assert.equal(sql("SELECT has_function_privilege('anon',"+lit(sig)+",'EXECUTE')"),"f");
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(sig)+",'EXECUTE')"),"t");
 sql("NOTIFY pgrst,'reload schema'");
 const rpc=async(actor,npc)=>{
  let r;for(let k=0;k<25;k++){
   r=await actor.who.rpc(name,{p_npc_id:npc});
   if(r.error?.code!=="PGRST202")break;
   await delay(180);
  }
  return r;
 };
 const deny=async(actor,npc,label)=>{
  const r=await rpc(actor,npc);
  assert.ok(r.error,label+" should be denied");
  assert.equal(r.error.code,"42501",label+" wrong SQLSTATE "+JSON.stringify(r.error));
 };
 const grant=async(capability,enabled)=>{
  const r=await roles.GM.who.rpc("c34_b14_p6_set_npc_capability_v1",{
   p_npc_id:hired,p_user_id:roles.OWNER.id,p_capability:capability,p_enabled:enabled
  });
  assert.ifError(r.error);
 };
 const keys=["npc_id","can_view_public_profile","can_view_worn_gear","worn_gear",
  "can_view_backpack","can_manage_equipment","can_withdraw_items",
  "can_auto_accept_items","can_issue_encounter_commands"];
 const baseline=await rpc(roles.OWNER,hired);
 assert.ifError(baseline.error);
 assert.deepEqual(Object.keys(baseline.data).sort(),keys.sort());
 assert.equal(baseline.data.can_issue_encounter_commands,true);
 assert.ok(baseline.data.worn_gear.some(row=>row.name==="P7 sword"));
 assert.ok(baseline.data.worn_gear.length<=12);
 assert.ok(!JSON.stringify(baseline.data).includes(ids[0]));
 assert.ok(!JSON.stringify(baseline.data).includes("P7-private-GM-payload"));
 assert.equal(Object.hasOwn(baseline.data,"backpack"),false);
 assert.equal(Object.hasOwn(baseline.data,"user_id"),false);
 console.log("PASS T46-C2B14-P9-SLIM: signed combat-only profile loads bounded outward name, zero private backpack rows/IDs/cards");
 await deny(roles.OWNER,hiddenNpc,"hidden ordinary NPC");
 await deny(roles.GM,forgePc,"tagged Forge PC even for GM");
 await deny(roles.OUTSIDER,hiddenNpc,"foreign hidden NPC");
 await deny(roles.OBSERVER,hiddenNpc,"observer not GM");
 const hidden=await rpc(roles.GM,hiddenNpc);
 assert.ifError(hidden.error);
 assert.equal(hidden.data.can_manage_equipment,true);
 console.log("PASS T46-C2B14-P9-PRIVACY: hidden/Forge/observer denied, canonical GM retains hidden reader");
 await grant("manage_equipment",false);
 await grant("view_backpack",true);
 const hiredCtx=await rpc(roles.OWNER,hired);
 assert.ifError(hiredCtx.error);
 assert.equal(hiredCtx.data.can_view_backpack,true);
 assert.equal(hiredCtx.data.can_manage_equipment,false);
 assert.equal(hiredCtx.data.can_withdraw_items,false);
 assert.equal(hiredCtx.data.can_auto_accept_items,false);
 assert.equal(hiredCtx.data.can_issue_encounter_commands,true);
 assert.ok(!Object.hasOwn(hiredCtx.data,"backpack"));
 await grant("manage_equipment",true);
 const trusted=await rpc(roles.OWNER,hired);
 assert.ifError(trusted.error);
 assert.equal(trusted.data.can_manage_equipment,true);
 await grant("view_backpack",false);
 await grant("manage_equipment",false);
 const revoked=await rpc(roles.OWNER,hired);
 assert.ifError(revoked.error);
 assert.equal(revoked.data.can_view_backpack,false);
 assert.equal(revoked.data.can_manage_equipment,false);
 assert.equal(revoked.data.can_issue_encounter_commands,true);
 console.log("PASS T46-C2B14-P9-REVOKE: same-JWT read-only/equip grants independently changed, combat control never becomes property access");
 const {createClient}=await import("@supabase/supabase-js");
 const anon=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 const anonRes=await rpc({who:anon},hired);
 assert.ok(anonRes.error,"anon cannot execute P9");
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 for(let i=0;i<originals.length;i++)assert.equal(hash([p6,p7,eq,legacy,
  "public.is_admin(uuid)","public.buy_from_merchant(uuid,uuid,integer)"][i]),originals[i],
  "P9 changed original/P6/P7 function");
 console.log("PASS T46-C2B14-P9-SIGNED: local GoTrue/PostgREST/PG17 current grants, anon denied, P6/P7/legacy/buyer/role function bodies byte-preserved");
}
