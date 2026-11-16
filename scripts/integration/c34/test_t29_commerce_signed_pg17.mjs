#!/usr/bin/env node
// C34 T29 SIGNED LOCAL ONLY: requires C34 T26/27/28 completed first.
// Executes owner-approved role candidate on disposable PG17/GoTrue/PostgREST,
// source-original wallet, stock, reroll bodies, original buyer untouched.
// No production database, hosted API, map modifications, or migrations.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const env=process.env;
for(const [name,expected] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T29_ROLE_CONFIRM:"OWNER_APPROVED_COMMERCE_LOCAL_ONLY"
}))assert.equal(env[name],expected,"T29 unsafe environment "+name);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
const sql=q=>{
 const x=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],
  {cwd:root,env,encoding:"utf8",timeout:30000});
 assert.equal(x.status,0,"T29 local SQL error "+x.stderr?.slice(-850));
 return x.stdout.trim();
};
const quote=v=>{assert.match(v,/^[a-f0-9-]{36}$/i);return "'"+v+"'";};
const makeClient=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const actors={};
async function createActor(role) {
 const who=makeClient(),email="t29-"+role+"-"+randomUUID()+"@example.invalid",
 password="T29-"+randomUUID()+"!";
 let a=await who.auth.signUp({email,password});assert.ifError(a.error);
 a=await who.auth.signInWithPassword({email,password});assert.ifError(a.error);
 a=await who.auth.getUser();assert.ifError(a.error);
 const id=a.data.user.id;
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+quote(id)+",'"+role+
  "') ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role");
 return {who,id,email,password,role};
}
async function mustDeny(label,task,{allowHidden=false}={}){
 const res=await task();
 assert.ok(res.error,label+" unexpectedly authorized: "+JSON.stringify(res.data));
 if(!allowHidden)assert.notEqual(res.error.code,"PGRST202",label+" signed RPC absent rather than denied");
 return res;
}
function dbStockState(){
 return sql("SELECT count(*)::text||':'||coalesce(sum(qty),0)::text FROM public.character_stock");
}
const fixture="scripts/integration/c34/t29_disposable_commerce_role_gate_pg17.sql";
const installed=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",
 "-v","T29_DISPOSABLE_LOCAL_CONFIRMED=true","-q","-f",fixture],{
 cwd:root,env,encoding:"utf8",timeout:45000
});
assert.equal(installed.status,0,"T29 disposable original source SQL failed: "+installed.stderr?.slice(-2300));
assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),
 "1dbe8c24c4c718396d7256f6f7465354","Original buyer unexpectedly changed");
console.log("PASS T29-LOCAL-SOURCE: local-only SQL, four exact original RPC guard modifications, unchanged atomic buyer");
for(const role of ["admin","gm","dm","player","editor","unknown"])actors[role]=await createActor(role);
const id=actors.player.id;
sql("INSERT INTO public.player_wallets(user_id,gp) VALUES("+quote(id)+",11) "+
 "ON CONFLICT(user_id) DO UPDATE SET gp=11");
const merchant=sql("SELECT id::text FROM public.characters WHERE name='T26 Probe Merchant' AND kind='merchant' LIMIT 1");
assert.match(merchant,/^[0-9a-f-]{36}$/i);
let stockCache=0;
for(const role of ["admin","gm","dm"]){
 const user=actors[role];
 const amount={admin:21,gm:31,dm:41}[role];
 const wallet=await user.who.rpc("wallet_set",{p_user:id,p_amount:amount});
 assert.ifError(wallet.error);assert.equal(Number(wallet.data),amount);
 const cross=await user.who.rpc("wallet_get",{p_user:id});
 assert.ifError(cross.error);assert.equal(Number(cross.data),amount);
 const item={character_id:merchant,display_name:"T29 "+role+" Stock",
  qty:2,price_gp:7,card_payload:{item_type:"Potion",item_name:"T29 "+role+" Stock"}};
 const direct=await user.who.from("character_stock").insert(item).select("id").single();
 assert.ifError(direct.error);assert.match(direct.data.id,/^[0-9a-f-]{36}$/i);
 const update=await user.who.from("character_stock").update({qty:3})
  .eq("id",direct.data.id).select("qty").single();
 assert.ifError(update.error);assert.equal(update.data.qty,3);
 const del=await user.who.from("character_stock").delete()
  .eq("id",direct.data.id).select("id").single();
 assert.ifError(del.error);assert.equal(del.data.id,direct.data.id);
 const addRpc=await user.who.rpc("stock_merchant_item",{
  p_merchant_id:merchant,p_display_name:"T29 "+role+" RPC Stock",
  p_price_gp:9,p_qty:2,p_payload:{item_type:"Potion",item_name:"T29 "+role+" RPC Stock"}
 });
 assert.ifError(addRpc.error);assert.match(addRpc.data,/^[0-9a-f-]{36}$/i);
 const stock=await user.who.from("character_stock").select("id,qty")
  .eq("id",addRpc.data).single();
 assert.ifError(stock.error);assert.equal(stock.data.qty,2);
 const reroll=await user.who.rpc("reroll_merchant_inventory_v2",{
  p_merchant_id:merchant,p_theme:"general",p_count:12
 });
 assert.ifError(reroll.error);
 assert.equal(reroll.data?.[0]?.merchant_id,merchant);
 assert.ok(reroll.data?.[0]?.inserted_count>=1,"Reroll emitted no stock for "+role);
 stockCache=Number(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+quote(merchant)));
 assert.ok(stockCache>=1);
 console.log("PASS T29-ROLE-"+role.toUpperCase()+": genuine signed direct stock CRUD, source-stock RPC, original reroll, cross-target wallet_get/set");
}
const beforeMoney=sql("SELECT gp::text FROM public.player_wallets WHERE user_id="+quote(id));
const beforeStock=dbStockState();
for(const role of ["player","editor","unknown"]){
 const user=actors[role];
 await mustDeny(role+" wallet_set",()=>user.who.rpc("wallet_set",{p_user:id,p_amount:999}));
 if(role!=="player")await mustDeny(role+" foreign wallet_get",()=>user.who.rpc("wallet_get",{p_user:id}));
 const insert=await user.who.from("character_stock").insert({
  character_id:merchant,display_name:"T29 FORBIDDEN "+role,qty:9,price_gp:7,
  card_payload:{item_type:"Potion"}
 }).select("id");
 assert.ok(insert.error,"Unprivileged direct stock insert succeeded: "+role);
 await mustDeny(role+" source stock RPC",()=>user.who.rpc("stock_merchant_item",{
  p_merchant_id:merchant,p_display_name:"T29 DENIED",p_price_gp:9,p_qty:1,p_payload:{item_type:"Potion"}
 }));
 await mustDeny(role+" original reroll",()=>user.who.rpc("reroll_merchant_inventory_v2",{
  p_merchant_id:merchant,p_theme:"general",p_count:12
 }));
}
assert.equal(sql("SELECT gp::text FROM public.player_wallets WHERE user_id="+quote(id)),beforeMoney);
assert.equal(dbStockState(),beforeStock);
console.log("PASS T29-NEGATIVE: player/editor/unknown denied stock RLS, stock RPC, reroll and wallet changes");
const anon=makeClient();
await mustDeny("anon wallet_set",()=>anon.rpc("wallet_set",{p_user:id,p_amount:999}),{allowHidden:true});
await mustDeny("anon stock RPC",()=>anon.rpc("stock_merchant_item",{
 p_merchant_id:merchant,p_display_name:"T29 ANON",p_price_gp:9,p_qty:1,p_payload:{}
}),{allowHidden:true});
await mustDeny("anon reroll",()=>anon.rpc("reroll_merchant_inventory_v2",{
 p_merchant_id:merchant,p_theme:"general",p_count:12
}),{allowHidden:true});
assert.equal(dbStockState(),beforeStock);
assert.equal(sql("SELECT gp::text FROM public.player_wallets WHERE user_id="+quote(id)),beforeMoney);
console.log("PASS T29-ANON: anonymous clients denied direct and RPC commerce modification");
const gm=actors.gm;
sql("UPDATE public.user_profiles SET role='player' WHERE id="+quote(gm.id));
await mustDeny("current GM demoted wallet",()=>gm.who.rpc("wallet_set",{p_user:id,p_amount:999}));
await mustDeny("current GM demoted stock",()=>gm.who.rpc("stock_merchant_item",{
 p_merchant_id:merchant,p_display_name:"T29 STALE ROLE",p_price_gp:3,p_qty:1,p_payload:{}
}));
assert.equal(sql("SELECT gp::text FROM public.player_wallets WHERE user_id="+quote(id)),beforeMoney);
console.log("PASS T29-REVOKE: live signed GM role demotion immediately denies commerce, no JWT role cache");
const switched=makeClient();
let r=await switched.auth.signInWithPassword({email:actors.dm.email,password:actors.dm.password});
assert.ifError(r.error);
r=await switched.rpc("wallet_get",{p_user:id});assert.ifError(r.error);
r=await switched.auth.signOut();assert.ifError(r.error);
r=await switched.auth.signInWithPassword({email:actors.editor.email,password:actors.editor.password});
assert.ifError(r.error);
await mustDeny("same-client DM to editor wallet_set",()=>switched.rpc("wallet_set",{p_user:id,p_amount:999}));
await mustDeny("same-client DM to editor stock",()=>switched.rpc("stock_merchant_item",{
 p_merchant_id:merchant,p_display_name:"T29 STALE ACTOR",p_price_gp:3,p_qty:1,p_payload:{}
}));
assert.equal(dbStockState(),beforeStock);
assert.equal(sql("SELECT gp::text FROM public.player_wallets WHERE user_id="+quote(id)),beforeMoney);
console.log("PASS T29-ACTOR-SWITCH: signed DM→editor same client cannot inherit stock or wallet privileges");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),
 "1dbe8c24c4c718396d7256f6f7465354");
console.log("PASS T29-SIGNED-GM-DM: full disposable local role-positive/negative matrix and unchanged original buyer; NOT production release");
