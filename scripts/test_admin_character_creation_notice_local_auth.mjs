#!/usr/bin/env node
// DNDNext Admin character-creation notice real local GoTrue/PostgREST test.
// Ephemeral GitHub CI ONLY. No production credentials/URL/DB mutation.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
  GITHUB_ACTIONS:"true", CI:"true",
  DNDNEXT_ADMIN_NOTICE_LOCAL_CONFIRM:"EPHEMERAL_LOCAL_GOTRUE_ONLY",
  PGHOST:"127.0.0.1", PGPORT:"54322", PGDATABASE:"postgres"
})) assert.equal(e[k],v,`Unsafe/unexpected local test configuration: ${k}`);
assert.match(e.DNDNEXT_ADMIN_NOTICE_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_ADMIN_NOTICE_LOCAL_ANON_KEY);
const make=()=>createClient(e.DNDNEXT_ADMIN_NOTICE_LOCAL_URL,
  e.DNDNEXT_ADMIN_NOTICE_LOCAL_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function db(sql){
 const run=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",sql],{
   encoding:"utf8", timeout:18000, env:{...e,PGUSER:"postgres"}
 });
 if(run.status!==0) throw Error("Ephemeral SQL fixture failed: "+run.stderr);
 return run.stdout.trim();
}
const users=[],pwd="P13AdminNotice-"+randomUUID()+"-X9!";
for(const label of ["GM_A","GM_B","PLAYER","OUTSIDER"]){
 const who=make(),email="dndnext-admin-notice-"+randomUUID()+"@example.invalid";
 const signup=await who.auth.signUp({email,password:pwd});
 assert.ifError(signup.error);
 const login=await who.auth.signInWithPassword({email,password:pwd});
 assert.ifError(login.error);
 const me=await who.auth.getUser();
 const claims=await who.auth.getClaims();
 assert.ifError(me.error);assert.ifError(claims.error);
 assert.equal(me.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 users.push({who,email,uid:me.data.user.id,label});
}
const [gmA,gmB,player,outsider]=users;
assert.equal(new Set(users.map(x=>x.uid)).size,4);
for(const user of [gmA,gmB,player,outsider])
 assert.match(user.uid,/^[0-9a-f-]{36}$/);
db("INSERT INTO private.admin_notice_auth_fixture_admins(id) VALUES "+
 ["('"+gmA.uid+"')","('"+gmB.uid+"')"].join(","));
const charA="00000000-0000-0000-0000-000000001101";
const charB="00000000-0000-0000-0000-000000001102";
const eventA="00000000-0000-0000-0000-000000001201";
const eventB="00000000-0000-0000-0000-000000001202";
db("INSERT INTO public.characters(id,name) VALUES "+
 "('"+charA+"','JWT Underling'),('"+charB+"','JWT Alternate')");
db("INSERT INTO public.character_level_events(id,character_id,event_type,created_by,details) VALUES "+
 "('"+eventA+"','"+charA+"','player_character_created','"+player.uid+"','{\"GM_SECRET\":\"DO_NOT_EXPOSE\"}'::jsonb),"+
 "('"+eventB+"','"+charB+"','player_character_created','"+player.uid+"','{\"GM_SECRET\":\"DO_NOT_EXPOSE\"}'::jsonb)");

async function call(who,fn,args){
 for(let i=0;i<25;i++){
  const r=await who.rpc(fn,args);
  if(r.error?.code==="PGRST202"){await sleep(180);continue;}
  return r;
 }
 throw Error("Local PostgREST did not pick up Admin notice function");
}
const list=who=>call(who,"get_admin_character_creation_notices_v1",{p_limit:80});
const review=(who,id)=>call(who,"review_admin_character_creation_notice_v1",{p_event_id:id});
const initial=await list(gmA.who);
assert.ifError(initial.error);
assert.equal(initial.data.length,2);
assert.equal(Number(initial.data[0].unread_total),2);
const linked=initial.data.find(x=>x.event_id===eventA);
assert.equal(linked.character_id,charA);
assert.equal(linked.character_name,"JWT Underling");
assert.equal(linked.creator_email,player.email);
assert.ok(!("details" in linked));
assert.ok(!JSON.stringify(initial.data).includes("GM_SECRET"));
console.log("PASS N01: genuine GM JWT reads two committed creation notices; no hidden event details");

const outsiderList=await list(outsider.who);
assert.ok(outsiderList.error);
assert.equal(outsiderList.error.code,"42501");
const playerList=await list(player.who);
assert.ok(playerList.error);
assert.equal(playerList.error.code,"42501");
const outsiderReview=await review(outsider.who,eventA);
assert.ok(outsiderReview.error);
assert.equal(outsiderReview.error.code,"42501");
const anonList=await list(make());
assert.ok(anonList.error);
console.log("PASS N02: genuine player, outsider and anonymous JWT/API calls denied");

const first=await review(gmA.who,eventA);
assert.ifError(first.error);assert.ok(first.data);
const again=await review(gmA.who,eventA);
assert.ifError(again.error);assert.equal(first.data,again.data);
const afterA=await list(gmA.who);
assert.ifError(afterA.error);
assert.equal(Number(afterA.data[0].unread_total),1);
const afterB=await list(gmB.who);
assert.ifError(afterB.error);
assert.equal(Number(afterB.data[0].unread_total),2);
assert.equal(db("SELECT count(*) FROM private.admin_character_creation_notice_reviews"),"1");
console.log("PASS N03: genuine JWT idempotent per-Admin review and independent unread totals");

const forbiddenEvent=await player.who.from("character_level_events")
 .select("id,details").eq("id",eventA);
assert.ok(forbiddenEvent.error || (Array.isArray(forbiddenEvent.data) &&
 forbiddenEvent.data.length===0));
assert.equal(db("SELECT count(*) FROM public.character_level_events"),"2");
console.log("PASS N04: no raw event access for player; creation event count unchanged");
// Existing-source character_permissions contract for the new NPC Admin editor.
// All tests run in disposable GoTrue with exact Admin/self RLS predicates.
const addGrant=await gmA.who.from("character_permissions")
 .insert({character_id:charA,user_id:player.uid,can_edit:true,can_inventory:true,can_convert:false})
 .select("character_id,user_id,can_edit,can_inventory,can_convert").single();
assert.ifError(addGrant.error);
assert.equal(addGrant.data.user_id,player.uid);
const ownGrant=await player.who.from("character_permissions")
 .select("character_id,can_edit,can_inventory").eq("character_id",charA);
assert.ifError(ownGrant.error);
assert.equal(ownGrant.data.length,1);
const outsiderGrants=await outsider.who.from("character_permissions")
 .select("character_id").eq("character_id",charA);
assert.ifError(outsiderGrants.error);
assert.deepEqual(outsiderGrants.data,[]);
console.log("PASS N05: GM INSERT new character-scoped grant, creator sees own flags, outsider denied");

const outsiderEdit=await outsider.who.from("character_permissions")
 .update({can_edit:false}).eq("character_id",charA)
 .eq("user_id",player.uid).select("character_id");
assert.ifError(outsiderEdit.error);
assert.deepEqual(outsiderEdit.data,[]);
const outsiderInsert=await outsider.who.from("character_permissions")
 .insert({character_id:charB,user_id:outsider.uid,can_edit:true})
 .select("character_id");
assert.ok(outsiderInsert.error);
const protectedGrant=await gmA.who.from("character_permissions")
 .select("can_edit,can_inventory").eq("character_id",charA)
 .eq("user_id",player.uid).single();
assert.ifError(protectedGrant.error);
assert.equal(protectedGrant.data.can_edit,true);
assert.equal(protectedGrant.data.can_inventory,true);
console.log("PASS N06: outsider cannot update existing grant or insert elevated rights");

const secondAdmin=await gmB.who.from("character_permissions")
 .update({can_inventory:false}).eq("character_id",charA)
 .eq("user_id",player.uid).select("can_inventory").single();
assert.ifError(secondAdmin.error);
assert.equal(secondAdmin.data.can_inventory,false);
const staleAdmin=await gmA.who.from("character_permissions")
 .update({can_edit:false,can_inventory:true,can_convert:false})
 .eq("character_id",charA).eq("user_id",player.uid)
 .eq("can_edit",true).eq("can_inventory",true).eq("can_convert",false)
 .select("character_id,user_id").maybeSingle();
assert.ifError(staleAdmin.error);
assert.equal(staleAdmin.data,null,
 "Stale Admin compare-and-update must affect zero rows");
const afterConflict=await gmA.who.from("character_permissions")
 .select("can_edit,can_inventory").eq("character_id",charA)
 .eq("user_id",player.uid).single();
assert.ifError(afterConflict.error);
assert.equal(afterConflict.data.can_edit,true);
assert.equal(afterConflict.data.can_inventory,false);
console.log("PASS N07: stale Admin edit refused after another GM changed flags, preserving newer values");
console.log("Admin creation notices and legacy editor GoTrue JWT N01-N07 PASS in isolated local Supabase; NOT production readiness.");
