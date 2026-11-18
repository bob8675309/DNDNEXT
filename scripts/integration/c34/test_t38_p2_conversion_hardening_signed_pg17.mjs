#!/usr/bin/env node
// T38-P2-R2 GREEN: real signed local PG17/GoTrue/PostgREST after exact-original R1 RED.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {createClient} from "@supabase/supabase-js";
const env=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T38_P2_SIGNED_CONFIRM:"ORIGINAL_CONVERSION_DISPOSABLE_RED_ONLY",
 C34_T38_P2_GREEN_CONFIRM:"STRICT_CONVERSION_DISPOSABLE_GREEN_ONLY"
}))assert.equal(env[k],v,"T38-R2 unsafe environment "+k);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
function sql(query){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],{env,encoding:"utf8",timeout:25000});
 assert.equal(r.status,0,"T38 local SQL "+r.stderr?.slice(-1000));return r.stdout.trim();
}
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
async function actor(label,role=label){
 const who=client(),email="t38-r2-"+label+"-"+randomUUID()+"@example.invalid",password="T38-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const u=await who.auth.getUser();assert.ifError(u.error);const id=u.data.user.id;
 assert.match(role,/^(admin|gm|dm|player|unknown)$/);
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(id)+",'"+role+"') ON CONFLICT(id) DO UPDATE SET role=excluded.role");
 return {who,id};
}
async function character(gm,kind,tag){
 const nonce=randomUUID(),secret="T38 GM PRIVATE "+tag;
 const r=await gm.who.rpc("create_character_v1",{p_payload:{
  name:"T38 R2 "+tag+" "+randomUUID().slice(0,8),kind,
  creation_request_id:nonce,secret,sheet:{classKey:"fighter",level:1,marker:tag}
 }});
 assert.ifError(r.error);assert.match(r.data,/^[a-f0-9-]{36}$/i);
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(r.data));
 return {id:r.data,nonce,secret};
}
const kind=c=>sql("SELECT kind FROM public.characters WHERE id="+q(c.id));
const stock=c=>sql("SELECT coalesce(string_agg(id::text||':'||qty::text||':'||price_gp::text,',' ORDER BY id::text),'') FROM public.character_stock WHERE character_id="+q(c.id));
const secretSheet=c=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(c.id))+"|"+
 sql("SELECT coalesce(secret,'') FROM public.characters WHERE id="+q(c.id))+"|"+
 sql("SELECT creation_request_id::text FROM public.characters WHERE id="+q(c.id));
const state=c=>({kind:kind(c),stock:stock(c),canon:secretSheet(c),store:sql(
 "SELECT coalesce(storefront_enabled::text,'null')||'|'||coalesce(storefront_title,'null')||'|'||coalesce(storefront_tagline,'null') FROM public.characters WHERE id="+q(c.id))});
const same=(c,expected)=>assert.deepEqual(state(c),expected,"Denied/no-op changed kind, stock, canonical sheet, secret, nonce or storefront");
function seed(c,qty=4){
 sql("INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES("+
  q(randomUUID())+","+q(c.id)+","+qty+",'T38 R2 SHELF','{}'::jsonb,37,'t38_item')");
}
async function call(who,name,c,target){
 let r;
 for(let i=0;i<35;i++){
  r=await who.rpc(name,name==="set_character_kind"?
   {p_character_id:c.id,p_target:target}:{p_character_id:c.id,p_target_type:target});
  if(r.error?.code!=="PGRST202")break;
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert.notEqual(r.error?.code,"PGRST202","T38 R2 PostgREST schema missing RPC");return r;
}
assert.equal(sql("SELECT md5(pg_get_functiondef('public.set_character_kind(uuid,text)'::regprocedure))"),
 "04588d4b433b13c92e612039a7c7e56e","Original source RED test must precede R2");
const installed=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",
 "-v","T38_P2_HARDENING_DISPOSABLE_CONFIRMED=1","-f",
 path.join(root,"scripts/integration/c34/t38_p2_disposable_conversion_hardening_candidate_pg17.sql")],
 {env,cwd:root,encoding:"utf8",timeout:60000});
assert.equal(installed.status,0,"T38 candidate installation "+installed.stderr?.slice(-1800));
assert.equal(sql("SELECT has_column_privilege('authenticated','public.characters','kind','UPDATE')"),"f");
assert.equal(sql("SELECT has_column_privilege('authenticated','public.characters','storefront_enabled','UPDATE')"),"t");
assert.equal(sql("SELECT has_table_privilege('authenticated','public.characters','UPDATE')"),"f");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.convert_character_type(uuid,text)'::regprocedure))"),
 "1a6ab5aa4bc58eceace51ad3803ed961");
console.log("PASS T38-P2-R2-COLUMN-ACL: direct kind UPDATE revoked without removing storefront toggle or changing alias");
const users={
 gm:await actor("gm"),dm:await actor("dm"),admin:await actor("admin"),
 player:await actor("player"),unknown:await actor("unknown"),
 editor:await actor("editor","player"),inventory:await actor("inventory","player"),
 converter:await actor("converter","player"),outsider:await actor("outsider","player")
};
sql("INSERT INTO private.test_admins(id) VALUES("+q(users.gm.id)+") ON CONFLICT DO NOTHING");
const victim=await character(users.gm,"merchant","deny");seed(victim,7);
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(victim.id)+","+q(users.editor.id)+",true,false,false),("+
 q(victim.id)+","+q(users.inventory.id)+",false,true,false)");
const saved=state(victim);
for(const label of ["unknown","player","editor","inventory","outsider"]){
 const r=await call(users[label].who,"set_character_kind",victim,"npc");
 assert.equal(r.error?.code,"42501","Invalid role/permission accepted: "+label);same(victim,saved);
}
for(const label of ["unknown","editor"]){
 const r=await call(users[label].who,"convert_character_type",victim,"npc");
 assert.equal(r.error?.code,"42501","Legacy alias bypass: "+label);same(victim,saved);
}
assert.ok((await call(client(),"set_character_kind",victim,"npc")).error);same(victim,saved);
console.log("PASS T38-P2-R2-ROLE-DENIAL: unknown/player/editor-only/inventory-only/outsider/anon and alias rejected with all state intact");
const direct=await users.editor.who.from("characters").update({kind:"npc"}).eq("id",victim.id);
assert.ok(direct.error,"Editor-only direct PostgREST kind UPDATE bypasses can_convert");same(victim,saved);
console.log("PASS T38-P2-R2-DIRECT-DML: unsafe editor-only kind UPDATE blocked despite can_edit row RLS");
const off=await users.editor.who.from("characters").update({storefront_enabled:false}).eq("id",victim.id);
assert.ifError(off.error);
const on=await users.editor.who.from("characters").update({storefront_enabled:true}).eq("id",victim.id);
assert.ifError(on.error);same(victim,saved);
console.log("PASS T38-P2-R2-STOREFRONT-TOGGLE: original merchant storefront field still writable by editor");
for(const name of ["set_character_kind","convert_character_type"]){
 assert.ifError((await call(users.admin.who,name,victim,"merchant")).error);same(victim,saved);
}
console.log("PASS T38-P2-R2-SAME-KIND: both RPC entrypoints preserve exact merchant stock identities and metadata");
for(const target of ["creature","",null]){
 assert.equal((await call(users.admin.who,"set_character_kind",victim,target)).error?.code,"22023");same(victim,saved);
}
assert.equal((await call(users.admin.who,"set_character_kind",{id:randomUUID()},"merchant")).error?.code,"22023");
assert.equal((await call(users.admin.who,"set_character_kind",{id:null},"merchant")).error?.code,"22023");
same(victim,saved);
const unsupported=await character(users.gm,"npc","unsupported");
sql("UPDATE public.characters SET kind='creature' WHERE id="+q(unsupported.id));
const unsupportedState=state(unsupported);
assert.equal((await call(users.gm.who,"set_character_kind",unsupported,"merchant")).error?.code,"22023");
same(unsupported,unsupportedState);
console.log("PASS T38-P2-R2-INVALID-INPUT: missing character, invalid/null target, unsupported source kind all fail closed");
const delegated=await character(users.gm,"merchant","converter");seed(delegated,9);
const savedCanonical=secretSheet(delegated);
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(delegated.id)+","+q(users.converter.id)+",false,false,true)");
assert.ifError((await call(users.converter.who,"convert_character_type",delegated,"npc")).error);
assert.equal(kind(delegated),"npc");assert.equal(stock(delegated),"");
assert.ifError((await call(users.converter.who,"set_character_kind",delegated,"merchant")).error);
assert.equal(kind(delegated),"merchant");assert.equal(secretSheet(delegated),savedCanonical);
sql("UPDATE public.character_permissions SET can_convert=false WHERE character_id="+q(delegated.id)+
 " AND user_id="+q(users.converter.id));
const deniedState=state(delegated);
assert.equal((await call(users.converter.who,"set_character_kind",delegated,"npc")).error?.code,"42501");
same(delegated,deniedState);
console.log("PASS T38-P2-R2-DELEGATE: exact can_convert-only works, revoking under same signed JWT immediately denies");
for(const role of ["admin","gm","dm"]){
 const c=await character(users.gm,"npc","manager-"+role),baseline=secretSheet(c);
 assert.ifError((await call(users[role].who,"set_character_kind",c,"merchant")).error);
 assert.equal(kind(c),"merchant");
 assert.equal(sql("SELECT storefront_enabled::text FROM public.characters WHERE id="+q(c.id)),"true");
 seed(c);
 sql("UPDATE public.characters SET storefront_title='T38 Shop',storefront_tagline='Description' WHERE id="+q(c.id));
 assert.ifError((await call(users[role].who,"convert_character_type",c,"npc")).error);
 assert.equal(kind(c),"npc");assert.equal(stock(c),"");
 assert.equal(sql("SELECT storefront_enabled::text FROM public.characters WHERE id="+q(c.id)),"false");
 assert.equal(sql("SELECT coalesce(storefront_title,'NULL')||'|'||coalesce(storefront_tagline,'NULL') FROM public.characters WHERE id="+q(c.id)),"NULL|NULL");
 assert.equal(secretSheet(c),baseline);
 assert.equal(sql("SELECT count(*) FROM public.character_sheets WHERE character_id="+q(c.id)),"1");
 console.log("PASS T38-P2-R2-MANAGER-"+role.toUpperCase()+": both ways preserve Sheet/Secret/nonce, stock and storefront transitions");
}
const revoked=await character(users.gm,"merchant","revoked");seed(revoked);const prior=state(revoked);
sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(users.dm.id));
assert.equal((await call(users.dm.who,"set_character_kind",revoked,"npc")).error?.code,"42501");
same(revoked,prior);
console.log("PASS T38-P2-R2-REVOKED: same-JWT DM demotion denies all stock mutations");
console.log("PASS T38-P2-R2 signed strict candidate GREEN only — no release or original UI KindPicker acceptance");
