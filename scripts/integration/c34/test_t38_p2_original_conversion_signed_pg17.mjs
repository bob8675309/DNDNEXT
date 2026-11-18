#!/usr/bin/env node
// T38-P2-R1: characterize original signed conversion REDs; no correction or production access.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {createClient} from "@supabase/supabase-js";
const env=process.env;
for(const [key,value] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T38_P2_SIGNED_CONFIRM:"ORIGINAL_CONVERSION_DISPOSABLE_RED_ONLY"
}))assert.equal(env[key],value,"T38 refuses unsafe environment "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const q=x=>{assert.match(x,/^[0-9a-f-]{36}$/i);return "'"+x+"'";};
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
function sql(query){
 const result=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],{env,encoding:"utf8",timeout:25000});
 assert.equal(result.status,0,"T38 local-only SQL "+result.stderr?.slice(-1200));
 return result.stdout.trim();
}
async function createActor(label,role=label){
 const who=client(),email="t38p2-"+label+"-"+randomUUID()+"@example.invalid";
 const password="T38-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const identity=await who.auth.getUser();assert.ifError(identity.error);
 const id=identity.data.user.id;
 assert.match(role,/^(gm|dm|admin|player|unknown)$/);
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(id)+",'"+role+"') ON CONFLICT(id) DO UPDATE SET role=excluded.role");
 return {who,id};
}
async function create(manager,kind,tag){
 const nonce=randomUUID(),secret="T38 PRIVATE "+tag;
 const result=await manager.who.rpc("create_character_v1",{p_payload:{
   name:"T38 original "+tag+" "+randomUUID().slice(0,7),
   kind,creation_request_id:nonce,secret,
   sheet:{classKey:"fighter",level:1,marker:"T38 "+tag}
 }});
 assert.ifError(result.error);
 assert.match(result.data,/^[0-9a-f-]{36}$/i);
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(result.data));
 assert.equal(sql("SELECT count(*) FROM public.character_sheets WHERE character_id="+q(result.data)),"1");
 return {id:result.data,nonce,secret};
}
function seedStock(c){
 sql("INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES("+
 q(randomUUID())+","+q(c.id)+",4,'T38 ORIGINAL SHELF','{}'::jsonb,12,'t38_shelf')");
}
const kind=c=>sql("SELECT kind FROM public.characters WHERE id="+q(c.id));
const stockCount=c=>sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(c.id));
const record=c=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(c.id))+"|"+
 sql("SELECT coalesce(secret,'') FROM public.characters WHERE id="+q(c.id))+"|"+
 sql("SELECT creation_request_id::text FROM public.characters WHERE id="+q(c.id));
function retain(c,snapshot){
 assert.equal(record(c),snapshot,"Conversion unexpectedly modified canonical Sheet, GM Secret or original nonce");
 assert.equal(sql("SELECT count(*) FROM public.character_sheets WHERE character_id="+q(c.id)),"1");
}
async function rpc(who,name,c,target){
 let response;
 for(let i=0;i<35;i++){
  response=await who.rpc(name,name==="set_character_kind"?
   {p_character_id:c.id,p_target:target}:{p_character_id:c.id,p_target_type:target});
  if(response.error?.code!=="PGRST202")break;
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert.notEqual(response.error?.code,"PGRST202","Original conversion missing from signed PostgREST schema");
 return response;
}
assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
const installed=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-v","T38_P2_DISPOSABLE_LOCAL_CONFIRMED=1",
 "-f",path.join(root,"scripts/integration/c34/t38_p2_original_conversion_source_pg17.sql")],
 {env,cwd:root,encoding:"utf8",timeout:45000});
assert.equal(installed.status,0,"Source-authentic conversion SQL "+installed.stderr?.slice(-1700));
assert.equal(sql("SELECT md5(pg_get_functiondef('public.set_character_kind(uuid,text)'::regprocedure))"),
 "04588d4b433b13c92e612039a7c7e56e");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.convert_character_type(uuid,text)'::regprocedure))"),
 "1a6ab5aa4bc58eceace51ad3803ed961");
assert.equal(sql("SELECT has_table_privilege('authenticated','public.characters','UPDATE')"),"f");
const users={
 gm:await createActor("gm"),dm:await createActor("dm"),admin:await createActor("admin"),
 player:await createActor("player"),unknown:await createActor("unknown"),
 editor:await createActor("editor","player"),inventory:await createActor("inventory","player"),
 convert:await createActor("convert","player")
};
sql("INSERT INTO private.test_admins(id) VALUES("+q(users.gm.id)+") ON CONFLICT DO NOTHING");
const unsafe=await create(users.gm,"merchant","unknown");
seedStock(unsafe);const beforeUnsafe=record(unsafe);
assert.ifError((await rpc(users.unknown.who,"set_character_kind",unsafe,"npc")).error);
assert.equal(kind(unsafe),"npc");assert.equal(stockCount(unsafe),"0");retain(unsafe,beforeUnsafe);
console.log("PASS T38-P2-ORIGINAL-UNKNOWN-ROLE-RED: signed unknown role converted unrelated merchant and deleted stock");
const alias=await create(users.gm,"merchant","alias");
seedStock(alias);const beforeAlias=record(alias);
assert.ifError((await rpc(users.unknown.who,"convert_character_type",alias,"npc")).error);
assert.equal(kind(alias),"npc");assert.equal(stockCount(alias),"0");retain(alias,beforeAlias);
console.log("PASS T38-P2-ORIGINAL-ALIAS-RED: legacy conversion alias forwards unauthorized request");
const repeat=await create(users.gm,"merchant","noop");
seedStock(repeat);const beforeRepeat=record(repeat);
assert.ifError((await rpc(users.gm.who,"set_character_kind",repeat,"merchant")).error);
assert.equal(kind(repeat),"merchant");assert.equal(stockCount(repeat),"0");retain(repeat,beforeRepeat);
console.log("PASS T38-P2-ORIGINAL-NOOP-STOCK-RED: same-kind manager call wipes stock");
const protectedMerchant=await create(users.gm,"merchant","deny-control");
seedStock(protectedMerchant);const beforeProtected=record(protectedMerchant);
assert.ok((await rpc(users.player.who,"set_character_kind",protectedMerchant,"npc")).error);
assert.ok((await rpc(client(),"set_character_kind",protectedMerchant,"npc")).error);
assert.equal(kind(protectedMerchant),"merchant");assert.equal(stockCount(protectedMerchant),"1");
retain(protectedMerchant,beforeProtected);
console.log("PASS T38-P2-ORIGINAL-DENIAL-CONTROL: original player/anonymous denied, data unchanged");
const editor=await create(users.gm,"merchant","editor-direct");
seedStock(editor);const editorSnapshot=record(editor);
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(editor.id)+","+q(users.editor.id)+",true,false,false)");
const direct=await users.editor.who.from("characters").update({kind:"npc"}).eq("id",editor.id);
assert.ifError(direct.error);
assert.equal(kind(editor),"npc","Editor-only kind UPDATE was blocked: inspect source grant/RLS fidelity before claiming bypass");
assert.equal(stockCount(editor),"1");retain(editor,editorSnapshot);
console.log("PASS T38-P2-ORIGINAL-EDITOR-DIRECT-RED: editor-only changed kind without can_convert; stale merchant stock remained");
for(const name of ["admin","gm","dm"]){
 const c=await create(users.gm,"npc","manager-"+name),snapshot=record(c);
 assert.ifError((await rpc(users[name].who,"set_character_kind",c,"merchant")).error);
 assert.equal(kind(c),"merchant");
 seedStock(c);
 assert.ifError((await rpc(users[name].who,"convert_character_type",c,"npc")).error);
 assert.equal(kind(c),"npc");assert.equal(stockCount(c),"0");retain(c,snapshot);
 console.log("PASS T38-P2-ORIGINAL-MANAGER-"+name.toUpperCase()+": original RPC+alias keep Sheet/GM Secret/nonce");
}
const revoked=await create(users.gm,"merchant","revoke");
seedStock(revoked);const beforeRevoke=record(revoked);
sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(users.dm.id));
assert.ok((await rpc(users.dm.who,"set_character_kind",revoked,"npc")).error);
assert.equal(kind(revoked),"merchant");assert.equal(stockCount(revoked),"1");retain(revoked,beforeRevoke);
console.log("PASS T38-P2-ORIGINAL-SAME-JWT-REVOCATION: demoted DM denied; stock intact");
console.log("PASS T38-P2-R1 SIGNED ORIGINAL RED CHARACTERIZATION ONLY — correction/UI/release not claimed");
