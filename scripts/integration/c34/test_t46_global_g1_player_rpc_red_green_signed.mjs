#!/usr/bin/env node
// T46-GLOBAL-G1. Exact SOURCE-ORIGINAL original RED -> held #345 Stage1 GREEN.
// Signed LOCAL PostgreSQL17/GoTrue/PostgREST ONLY. Not a live migration.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto,{randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";

const env=process.env;
for(const [key,want] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
}))assert.equal(env[key],want,"Refusing non-disposable G1 "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const gitBlob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const pinned={
 "sql/20260804_01_multi_player_character_forge_v2.sql":"84bae166ca2e6332cf40b57e60b039cd7a3a7181",
 "scripts/integration/c34/sources/02_npc_profile_stage1.sql":"9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3",
 "scripts/fixtures/c33_forge_privacy_original_policy_join_pg17.sql":"12612c4acbe861817037e1ab5a79ddb7c40a55e9",
 "scripts/integration/c34/fixtures/forge_creation_replay_local_auth_pr351_pg17.sql":"aa701c679712475cd4f04d4e0a01fedc4616bafa",
 "components/PlayerCharacterProfilePanelUnified.js":"8a561e51eafd9e8507db7a4d3f15fd4699d6d1b8"
};
const source={};
for(const [file,sha] of Object.entries(pinned)){
 const bytes=fs.readFileSync(path.join(root,file));
 assert.equal(gitBlob(bytes),sha,"Original source drift "+file);
 source[file]=bytes.toString("utf8");
}
assert.ok(source["sql/20260804_01_multi_player_character_forge_v2.sql"].includes("and (cp.can_edit or cp.can_inventory or cp.can_convert)"));
assert.ok(source["scripts/integration/c34/sources/02_npc_profile_stage1.sql"].includes("CASE WHEN cp.can_edit THEN to_jsonb(c)"));
assert.ok(source["scripts/integration/c34/sources/02_npc_profile_stage1.sql"].includes("'character_sheet', CASE WHEN cp.can_edit"));
assert.ok(source["components/PlayerCharacterProfilePanelUnified.js"].includes("get_my_player_characters_v2"));

const q=s=>{assert.match(s,/^[0-9a-f-]{36}$/i);return "'"+s+"'";};
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(statement){
 const result=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],
  {cwd:root,env,encoding:"utf8",timeout:30000});
 assert.equal(result.status,0,"Disposable PG17 SQL failed: "+String(result.stderr).slice(-1900));
 return result.stdout.trim();
}
async function actor(role){
 const who=createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const email="t46-g1-"+role+"-"+randomUUID()+"@example.invalid";
 const password="T46G1-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const {data,error}=await who.auth.getUser();assert.ifError(error);
 return {id:data.user.id,who};
}
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const read=who=>who.rpc("get_my_player_characters_v2");
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
async function signedRead(actor,label){
 let response;
 for(let attempts=0;attempts<24;attempts++){
  response=await read(actor.who);
  if(!response.error)break;
  if(!["PGRST202","PGRST200"].includes(response.error.code))break;
  await sleep(260);
 }
 assert.ifError(response.error,"Signed source-original read "+label);
 assert.ok(Array.isArray(response.data),label+" result not JSON array");
 return response.data;
}
const originalDefMd5="deca87aaad0dce214743c87cdca03f36";
const beforeDef=sql("SELECT md5(pg_get_functiondef('public.get_my_player_characters_v2()'::regprocedure))");
assert.equal(beforeDef,originalDefMd5,"Unmodified live-original reader not installed in scratch fixture");
assert.equal(sql("SHOW server_version").startsWith("17."),true);
assert.equal(sql("SELECT current_database()"),"postgres");

const users={};
for(const role of ["OWNER","EDITOR","INVENTORY","CONVERT","GM","OUTSIDER"])
 users[role]=await actor(role);
const pc=randomUUID(),other=randomUUID();
const secret="T46_G1_ORIGINAL_PRIVATE_GM_SECRET_"+randomUUID();
const background="T46_G1_PRIVATE_BACKGROUND_"+randomUUID();
const sheetMarker="T46_G1_CANONICAL_SHEET_PRIVATE_"+randomUUID();
const xpMarker="T46_G1_PRIVATE_XP_NOTE_"+randomUUID();
sql("INSERT INTO public.characters(id,name,kind,tags,is_hidden,secret,background,motivation,quirk,mannerism,voice,description) VALUES("+
 q(pc)+",'T46 G1 signed player', 'npc',ARRAY['player-character']::text[],true,"+lit(secret)+","+
 lit(background)+",'private motivation','private quirk','private mannerism','private voice','Public marker')"+
 ",("+q(other)+",'T46 G1 non-PC','npc',ARRAY['npc']::text[],true,'T46_G1_UNRELATED_SECRET','T46_G1_NONPC_BACKGROUND','','','','','Not a PC')");
sql("INSERT INTO public.character_sheets(character_id,sheet) VALUES("+
 q(pc)+","+lit(JSON.stringify({classKey:"fighter",level:6,xp:14200,marker:sheetMarker,gmNotes:xpMarker}))+"::jsonb),("+
 q(other)+",'{}'::jsonb)");
for(const [role,col] of [["OWNER","can_edit"],["EDITOR","can_edit"],
 ["INVENTORY","can_inventory"],["CONVERT","can_convert"]]){
 const u=users[role];
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(pc)+","+q(u.id)+","+(col==="can_edit")+","
 +(col==="can_inventory")+","+(col==="can_convert")+")");
}
sql("INSERT INTO private.test_admins(id) VALUES("+q(users.GM.id)+")");
const sheetFingerprint=sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(pc));
const secureNoRows=async(role)=>{
 const rows=await signedRead(users[role],role);
 assert.deepEqual(rows,[],role+" read an unassigned player character");
};
function hasPrivate(row){return JSON.stringify(row).includes(secret)&&JSON.stringify(row).includes(sheetMarker)}
function checkOldFull(rows,role){
 assert.equal(rows.length,1,role+" original reader missing assigned PC");
 assert.equal(rows[0].id,pc);
 assert.equal(rows[0].secret,secret,role+" original private character JSON not returned");
 assert.equal(rows[0].background,background);
 assert.equal(rows[0].character_sheet?.marker,sheetMarker,role+" original full Sheet not returned");
 assert.equal(rows[0].character_sheet?.gmNotes,xpMarker);
 assert.equal(rows[0].permission?.user_id,users[role].id);
 assert.ok(hasPrivate(rows[0]));
}
for(const role of ["OWNER","EDITOR","INVENTORY","CONVERT"]){
 checkOldFull(await signedRead(users[role],role),role);
}
await secureNoRows("GM");
await secureNoRows("OUTSIDER");
const unsigned=await read(client());
assert.ok(unsigned.error || (Array.isArray(unsigned.data)&&unsigned.data.length===0),
 "Anonymous received a character from original definer");
console.log("EXPECTED ORIGINAL T46-GLOBAL-G1 RED: exact original get_my_player_characters_v2 SECURITY DEFINER returned private GM Secret + canonical Sheet to INVENTORY-only and CONVERT-only delegated users; original GM without cp and outsider returned no rows; anon denied/empty");

// Install the EXACT PRESERVED #345 Stage1 author correction, not a new RPC,
// and rely on its SHA+MD5 fail-closed preflight.
const install=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",
 "scripts/integration/c34/sources/02_npc_profile_stage1.sql"],
 {cwd:root,env,encoding:"utf8",timeout:35000});
assert.equal(install.status,0,"Exact original held Stage1 failed: "+String(install.stderr).slice(-1900));
assert.notEqual(sql("SELECT md5(pg_get_functiondef('public.get_my_player_characters_v2()'::regprocedure))"),
 beforeDef,"Held #345 original correction did not replace original reader");
sql("NOTIFY pgrst,'reload schema'");
await sleep(350);
function checkRedacted(rows,role){
 assert.equal(rows.length,1,role+" lost delegated character identity");
 const row=rows[0];
 assert.equal(row.id,pc);
 assert.equal(row.name,"T46 G1 signed player");
 assert.equal(row.character_sheet&&Object.keys(row.character_sheet).length,0,
   role+" unexpectedly received full canonical Sheet");
 assert.equal(row.permission?.user_id,users[role].id);
 assert.equal(row.permission?.can_edit,false);
 const serial=JSON.stringify(row);
 for(const marker of [secret,background,sheetMarker,xpMarker]){
  assert.ok(!serial.includes(marker),role+" leaked "+marker);
 }
 for(const field of ["secret","background","motivation","quirk","voice","mannerism"])
  assert.equal(Object.hasOwn(row,field),false,role+" retained hidden "+field);
}
for(const role of ["OWNER","EDITOR"]){
 checkOldFull(await signedRead(users[role],role),role);
}
for(const role of ["INVENTORY","CONVERT"]){
 checkRedacted(await signedRead(users[role],role),role);
}
await secureNoRows("GM");
await secureNoRows("OUTSIDER");
const anonAfter=await read(client());
assert.ok(anonAfter.error || (Array.isArray(anonAfter.data)&&anonAfter.data.length===0),
 "Anonymous received rows after Stage1");
assert.equal(sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(pc)),
 sheetFingerprint,"Original canonical Sheet changed by candidate");
console.log("PASS T46-GLOBAL-G1-STAGE1: exact held original #345 Stage1 projection hides secret/backstory/full Sheet for INVENTORY and CONVERT while preserving delegated identity and editor/owner access, anon/outsider denied, canonical Sheet unchanged");

// Live permission edits with same signed JWT (not re-authenticated).
sql("UPDATE public.character_permissions SET can_inventory=false WHERE character_id="+q(pc)+
 " AND user_id="+q(users.INVENTORY.id));
await secureNoRows("INVENTORY");
sql("UPDATE public.character_permissions SET can_convert=false WHERE character_id="+q(pc)+
 " AND user_id="+q(users.CONVERT.id));
await secureNoRows("CONVERT");
sql("UPDATE public.character_permissions SET can_edit=false,can_inventory=true WHERE character_id="+q(pc)+
 " AND user_id="+q(users.EDITOR.id));
checkRedacted(await signedRead(users.EDITOR,"EDITOR demoted"),"EDITOR");
sql("UPDATE public.character_permissions SET can_inventory=false WHERE character_id="+q(pc)+
 " AND user_id="+q(users.EDITOR.id));
await secureNoRows("EDITOR");
assert.equal(sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(pc)),
 sheetFingerprint,"Same-JWT permission mutation changed canonical Sheet");
console.log("PASS T46-GLOBAL-G1-SAME-JWT: server-current inventory/convert revocation and editor→inventory downgrade strip full Sheet/secret before signout/remount; later fully revoked accounts receive no rows");
console.log("PASS T46-GLOBAL-G1-LOCAL: source-original original RED to preserved held #345 Stage1 candidate GREEN, disposable signed PG17/GoTrue/PostgREST only; global active client fallback 42501 and all production release gates remain OPEN");
