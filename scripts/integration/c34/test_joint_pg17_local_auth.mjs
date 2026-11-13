#!/usr/bin/env node
// C34: genuine signed GoTrue/PostgREST + PostgreSQL 17 in a DISPOSABLE CI DB.
// Runs AFTER unchanged #351 I1C original suite (full Story/nonce), then joins
// the original materializer and inventory CHECK/RLS research candidate.
// This is a bounded source-original trigger subset, NOT the full 31-trigger graph.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
for (const [key,value] of Object.entries({
  CI:"true", GITHUB_ACTIONS:"true",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  PGHOST:"127.0.0.1", PGPORT:"54322", PGDATABASE:"postgres",
  PGUSER:"postgres",
})) assert.equal(env[key],value,"Unsafe environment for signed C34 test: "+key);
assert.match(env.DNDNEXT_C34_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
const makeClient=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
function psql(args) {
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{
    env,encoding:"utf8",timeout:35000
  });
  assert.equal(r.status,0,"C34 disposable SQL failed: "+(r.stderr||"").slice(-1900));
  return r.stdout.trim();
}
const sql=(q)=>psql(["-qAt","-c",q]);
const sqlFile=(p)=>psql(["-q","-f",p]);
const one=(table,where)=>Number(sql("SELECT count(*) FROM "+table+" WHERE "+where));
const quote=(id)=>{assert.match(id,/^[a-f0-9-]{36}$/i);return "'"+id+"'";};
async function signed(label) {
  const client=makeClient(),email="c34-"+label+"-"+randomUUID()+"@example.invalid";
  const password="C34-"+randomUUID()+"!";
  assert.ifError((await client.auth.signUp({email,password})).error);
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  const user=await client.auth.getUser(),jwt=await client.auth.getClaims();
  assert.ifError(user.error);
  assert.ifError(jwt.error);
  assert.equal(jwt.data.claims.sub,user.data.user.id);
  assert.equal(jwt.data.claims.role,"authenticated");
  return {id:user.data.user.id,client};
}
async function read(actor,whereId) {
  const r=await actor.client.from("inventory_items").select("id,owner_type,owner_id,user_id")
    .eq("id",whereId);
  assert.ifError(r.error);
  return r.data;
}
function rejected(r,label,code) {
  assert.ok(r.error,label+" should have been blocked");
  if(code) assert.equal(r.error.code,code,label+" SQLSTATE mismatch");
  return r.error;
}
const fighter=(id,name)=>({
  creation_request_id:id,name,secret:null,
  sheet:{classKey:"fighter",level:1,marker:"C34_SOURCE_EQUIPMENT_AFTER_INVENTORY_RLS"}
});
const rpc=async(actor,name,args)=>actor.client.rpc(name,args);
const nonceCountBefore=Number(sql(
 "SELECT count(*) FROM private.player_creation_intent_reservations_v1"
));
assert.ok(nonceCountBefore>=1,"Original I1C signed Story/nonces must already have run");
assert.equal(sql("SELECT to_regclass('private.character_creator_attribution') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regclass('public.inventory_items') IS NULL"),"t");

sqlFile("scripts/integration/c34/c34_inventory_materializer_setup_pg17.sql");
const holder=await signed("inventory-holder");
const stale=await signed("stale-owner");
const outsider=await signed("outsider");
const admin=await signed("admin");
sql("INSERT INTO private.test_admins(id) VALUES("+quote(admin.id)+")");
const characterId=randomUUID(),staleItem=randomUUID(),holderItem=randomUUID(),stockId=randomUUID();
sql("INSERT INTO public.characters(id,name,kind,is_hidden,secret) VALUES("+
 quote(characterId)+",'C34 synthetic original inventory NPC','npc',false,'C34_GM_SECRET_STAYS_PRIVATE')");
sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES("+
 quote(characterId)+","+quote(holder.id)+",true,false,false)");
sql("INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES("+
 quote(stockId)+","+quote(characterId)+",2,'C34 preserved original stock','{}'::jsonb,1,'training-dagger')");
const insertHistorical=(itemId,userId,label)=>sql(
 "INSERT INTO public.inventory_items(id,user_id,owner_type,owner_id,item_name,card_payload,quantity) VALUES("+
 quote(itemId)+","+quote(userId)+",'character',"+quote(characterId)+
 ",'"+label+"','{}'::jsonb,1)"
);
insertHistorical(staleItem,stale.id,"C34 legacy stale owner");
insertHistorical(holderItem,holder.id,"C34 valid inventory holder");
assert.equal(one("public.inventory_items","owner_type='character'"),2);

sqlFile("scripts/integration/c34/c34_inventory_original_policy_baseline_pg17.sql");
const legacy=await read(stale,staleItem);
assert.equal(legacy.length,1,"RED: historical owner policy improperly reveals character item to revoked/unrelated user");
assert.equal((await read(holder,holderItem)).length,1);
assert.equal((await read(outsider,staleItem)).length,0);
const insertOld=await stale.client.from("inventory_items").insert({
  user_id:stale.id,owner_type:"character",owner_id:characterId,
  item_name:"C34 blocked by legacy NOT VALID check",quantity:1,card_payload:{}
});
rejected(insertOld,"historical owner_type_chk rejects a NEW character item","23514");
assert.equal(one("public.inventory_items","owner_type='character'"),2);
console.log("PASS C34-RED01: real signed stale owner READ leaks prior character item; old NOT VALID CHECK blocks new character items");

const digestBefore=sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM public.character_stock x");
const originalForgeWrapper=sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))");
sqlFile("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
assert.equal(one("pg_constraint","conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_chk'"),0);
assert.equal(one("pg_constraint","conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_check' AND convalidated"),1);
assert.equal(one("pg_policy","polrelid='public.inventory_items'::regclass"),4);
assert.equal((await read(stale,staleItem)).length,0,
  "GREEN: stale row owner lacking character rights must not read item");
assert.equal((await read(holder,holderItem)).length,1,
  "GREEN: inventory-only assigned actor retains read access to own character item");
assert.equal((await read(outsider,holderItem)).length,0);
assert.equal((await read(admin,staleItem)).length,1,
  "GREEN: GM Admin still reads pre-existing inventory");
console.log("PASS C34-GREEN01: original inventory RLS denies stale owner and outsider; permits assigned inventory-only holder and Admin");

const forgedUpdate=await stale.client.from("inventory_items")
  .update({owner_type:"player",owner_id:stale.id})
  .eq("id",staleItem).select("id");
assert.ifError(forgedUpdate.error);
assert.equal(forgedUpdate.data.length,0,"stale owner cannot launder character item to player item");
const forbiddenUpdate=await holder.client.from("inventory_items")
  .update({item_name:"C34 forged character edit"}).eq("id",holderItem).select("id");
assert.ifError(forbiddenUpdate.error);
assert.equal(forbiddenUpdate.data.length,0,"inventory-only user cannot direct-edit character item");
const forbiddenDelete=await holder.client.from("inventory_items")
  .delete().eq("id",holderItem).select("id");
assert.ifError(forbiddenDelete.error);
assert.equal(forbiddenDelete.data.length,0,"inventory-only user cannot delete character item");
const forgedInsert=await holder.client.from("inventory_items").insert({
  user_id:holder.id,owner_type:"character",owner_id:characterId,
  item_name:"C34 direct forge item",quantity:1,card_payload:{}
});
rejected(forgedInsert,"non-Admin direct character item insert denied","42501");
assert.equal(one("public.inventory_items","id="+quote(holderItem)),1);
assert.equal(one("public.inventory_items","id="+quote(staleItem)),1);
console.log("PASS C34-GREEN02: no direct non-Admin character INSERT/UPDATE/DELETE or owner-type laundering");

const allowedPlayerItem=await holder.client.from("inventory_items").insert({
 user_id:holder.id,owner_type:"player",owner_id:holder.id,
 item_name:"C34 original personal item",quantity:1,card_payload:{}
}).select("id").single();
assert.ifError(allowedPlayerItem.error);
assert.ok(allowedPlayerItem.data.id,"original player-owned inventory writes must survive");
const allowedAdminItem=await admin.client.from("inventory_items").insert({
 user_id:stale.id,owner_type:"character",owner_id:characterId,
 item_name:"C34 Admin character item",quantity:1,card_payload:{}
}).select("id").single();
assert.ifError(allowedAdminItem.error);
assert.ok(allowedAdminItem.data.id,"original Admin character inventory writes must survive");
console.log("PASS C34-GREEN03: normal personal inventory and Admin character item insertion retained");

// Demonstrate the narrow preserved #319 nonempty historical account snapshot,
// while #324 Forge writes the real canonical per-character character_sheets.
const preservedAccount='{"c34_legacy_sheet_frozen":true,"source":"ORIGINAL_NONEMPTY"}';
sql("INSERT INTO public.players(user_id,name,sheet) VALUES("+
 quote(holder.id)+",'C34 test player','"+preservedAccount+"'::jsonb)");
const freshNonce=randomUUID(),payload=fighter(freshNonce,"C34 equipped fighter "+freshNonce.slice(0,8));
const created=await rpc(holder,"create_player_character_v3",{
 p_payload:payload,p_spell_choices:[],p_magic_selections:[]
});
assert.ifError(created.error);
assert.match(created.data,/^[0-9a-f-]{36}$/i);
assert.equal(one("public.characters","creation_request_id="+quote(freshNonce)),1);
assert.equal(one("public.character_sheets","character_id="+quote(created.data)),1);
assert.equal(sql("SELECT sheet->>'source' FROM public.players WHERE user_id="+quote(holder.id)),
  "ORIGINAL_NONEMPTY","historical nonempty account sheet source must remain frozen");
assert.equal(sql("SELECT sheet->>'c34_legacy_sheet_frozen' FROM public.players WHERE user_id="+quote(holder.id)),
  "true","historical nonempty account sheet marker must remain frozen");
const createdItemCount=one("public.inventory_items",
  "owner_type='character' AND owner_id="+quote(created.data));
assert.ok(createdItemCount>=1,
 "original privileged deferred materializer must create starting item after old CHECK removal");
assert.equal(sql("SELECT md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))"),
  originalForgeWrapper,"inventory candidate cannot rewrite immutable Forge v3");
assert.equal(one("private.player_creation_intent_reservations_v1","request_id="+quote(freshNonce)),1);
assert.equal(sql("SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM public.character_stock x"),
  digestBefore,"merchant stock preserved across inventory fix and Forge");
assert.equal(sql("SELECT secret FROM public.characters WHERE id="+quote(characterId)),
  "C34_GM_SECRET_STAYS_PRIVATE","GM Secret unchanged");
assert.ok(Number(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1"))>=nonceCountBefore+1);
console.log("PASS C34-GREEN04: signed original v3 + real nonce + deferred equipment materializer + nonempty legacy snapshot + GM secret/stock preservation");
console.log("C34 SIGNED JOIN PASS: genuine PG17/GoTrue source-original subset, NOT full 31-trigger or production acceptance");
