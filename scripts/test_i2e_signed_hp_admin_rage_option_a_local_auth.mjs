#!/usr/bin/env node
// I2-E owner Option A: signed original HP/Admin/Rage RED then isolated
// exact-source reversible no-account-mirror GREEN. Run ONLY after unchanged
// I1-B..O + I2C-01..10 + I2D-01..11 in disposable local PostgreSQL 17.
// This is NOT a production migration or full 31-trigger acceptance.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"55622",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_I1G_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 DNDNEXT_I2C_LOCAL_CONFIRM:"DISPOSABLE_I2C_OPTION_A_CREATION_ONLY",
 DNDNEXT_I2D_LOCAL_CONFIRM:"DISPOSABLE_I2D_PRIVATE_V3_STORY_ONLY",
 DNDNEXT_I2E_LOCAL_CONFIRM:"DISPOSABLE_I2E_HP_ADMIN_RAGE_ONLY"
})) assert.equal(e[k],v,"I2E unsafe environment: "+k);
assert.match(e.DNDNEXT_I1G_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:55621\/?$/);
assert.ok(e.DNDNEXT_I1G_LOCAL_ANON_KEY);
const make=()=>createClient(e.DNDNEXT_I1G_LOCAL_URL,e.DNDNEXT_I1G_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const psql=args=>{
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],
 {encoding:"utf8",env:e,timeout:45000});
 assert.equal(r.status,0,"I2E local-only psql failed: "+(r.stderr||"").slice(-2400));
 return r.stdout.trim();
};
const sql=q=>psql(["-qAt","-c",q]);
const fixture=p=>psql(["-q","-f",p]);
const lit=x=>"'"+String(x).replaceAll("'","''")+"'";
const md5=sig=>sql("SELECT md5(pg_get_functiondef("+lit(sig)+"::regprocedure))");
const lag=ms=>new Promise(done=>setTimeout(done,ms));
async function rpc(w,name,args) {
 for(let i=0;i<35;i++){
  const r=await w.client.rpc(name,args);
  if(r.error?.code==="PGRST202"){await lag(180);continue;}
  return r;
 }
 throw Error("I2E local PostgREST never registered "+name);
}
const succeeded=(r,label)=>{assert.ifError(r.error);assert.ok(r.data,label+" missing returned data");return r.data;};
const denied=(r,label,code)=>{
 assert.ok(r.error,label+" unexpectedly allowed");
 if(code)assert.equal(r.error.code,code,label+" SQLSTATE");
};
async function actor(label) {
 const client=make(),email="i2e-"+randomUUID()+"@example.invalid";
 const password="I2E-"+randomUUID()+"-X!";
 const reg=await client.auth.signUp({email,password,options:{data:{display_name:label}}});
 assert.ifError(reg.error);
 const auth=await client.auth.signInWithPassword({email,password});
 assert.ifError(auth.error);
 const claims=await client.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.equal(claims.data.claims.sub,auth.data.user.id);
 const w={id:auth.data.user.id,name:label,client};
 assert.equal(sql("SELECT sheet::text FROM public.players WHERE user_id="+lit(w.id)),"{}");
 assert.equal(sql("SELECT name FROM public.players WHERE user_id="+lit(w.id)),label);
 return w;
}
const sheet=id=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+lit(id));
const legacy=w=>sql("SELECT sheet::text FROM public.players WHERE user_id="+lit(w.id));
const stamp=w=>sql("SELECT updated_at::text FROM public.players WHERE user_id="+lit(w.id));
const profile=w=>sql("SELECT name FROM public.players WHERE user_id="+lit(w.id));
const secret=id=>sql("SELECT secret_text FROM public.character_backstory_secrets WHERE character_id="+lit(id));
const xp=id=>Number(sql("SELECT experience_points FROM public.character_progression WHERE character_id="+lit(id)));
const eventCount=id=>Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+lit(id)));
const fn={
 hp:"public.adjust_character_hit_points_v1(uuid,integer,integer)",
 admin:"public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text)",
 action:"public.update_character_sheet_action_state_v1(uuid,text,text)"
};
const exact={
 hp:"f855be60d971aa63e32ade327d14c369",
 admin:"c4ea1c7993912f6b4c6fe9ee7b25343f",
 action:"313a533250724b2e2abc754899d0f8d4"
};
const hp=(w,id,amount=0,tempHp=null)=>rpc(w,"adjust_character_hit_points_v1",{
 p_character_id:id,p_amount:amount,p_temp_hp:tempHp
});
const progress=(w,id,experiencePoints=300)=>rpc(w,"set_character_progression_v2",{
 p_character_id:id,p_class_key:"fighter",p_source:"XPHB",p_level:1,
 p_experience_points:experiencePoints,p_subclass_name:null,p_subclass_source:null
});
const action=(w,id,operation)=>rpc(w,"update_character_sheet_action_state_v1",{
 p_character_id:id,p_action_key:"rage",p_operation:operation
});
const payload=(label,nonce)=>({
 name:label,creation_request_id:nonce,secret:null,
 sheet:{classKey:"fighter",level:1,hp:12,maxHp:12,tempHp:0,
   startingEquipmentSelections:{mode:"package",classOption:"A",ruleset:"vanilla"}}
});
async function create(w,label) {
 const nonce=randomUUID(),story="I2E private synthetic "+label+" Story";
 const r=await rpc(w,"create_player_character_with_private_backstory_v1",{
  p_payload:payload(label,nonce),p_spell_choices:[],p_magic_selections:[],p_private_backstory:story
 });
 const id=succeeded(r,"signed v3/Story "+label);
 assert.equal(JSON.parse(sheet(id)).meta.creationRequestId,nonce);
 assert.equal(secret(id),story);
 assert.equal(Number(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character' AND owner_id="+lit(id)+" AND card_payload->>'startingEquipment'='true'")),1);
 return {id,nonce,story};
}
const accountSnapshot=actors=>actors.map(w=>[w,legacy(w),stamp(w)]);
const unchanged=(snap,label)=>{
 for(const [who,s,t] of snap) {
  assert.equal(legacy(who),s,label+": unchanged players.sheet for "+who.name);
  assert.equal(stamp(who),t,label+": unchanged legacy account updated_at for "+who.name);
 }
};
const mirror=(who,id)=>{
 sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+lit(id)+"),updated_at=now() WHERE user_id="+lit(who.id));
 assert.equal(legacy(who),sheet(id));
};
const sigs=Object.values(fn);
const origin=()=>{
 assert.equal(md5(fn.hp),exact.hp);assert.equal(md5(fn.admin),exact.admin);
 assert.equal(md5(fn.action),exact.action);
 assert.equal(md5("public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)"),
 "eb467b7c7a8d548581a36cfcb0d8f77b");
};
fixture("scripts/fixtures/i2e_original_hp_admin_rage_shared_forge_pg17.sql");
origin();
assert.equal(md5("private.create_player_character_v2_source_20261105(jsonb,jsonb)"),
 "00b2167041b9c2e4e1a98d3873839f37");
console.log("PASS I2E-01: after full unchanged I1-B..O/I2C/I2D signed suites, three exact original live HP/Admin/Rage RPCs installed and MD5 locked; Admin-v1 and Story Forge unchanged");

const owner=await actor("I2E owner signed account");
const editor=await actor("I2E delegated editor account");
const outside=await actor("I2E unauthorized signed account");
const gm=await actor("I2E privileged local test admin");
const historical=await actor("I2E unmarked historical snapshot");
sql("INSERT INTO private.test_admins(id) VALUES("+lit(gm.id)+")");
assert.equal(sql("SELECT count(*) FROM private.test_admins WHERE id="+lit(gm.id)),"1");
const A=await create(owner,"I2E canonical first Fighter A");
const B=await create(owner,"I2E canonical second Fighter B");
const C=await create(owner,"I2E signed Fighter C for synthetic Barbarian action specimen");
const D=await create(editor,"I2E editor own Fighter D");
assert.notEqual(A.id,B.id);assert.notEqual(B.id,C.id);assert.notEqual(C.id,D.id);
assert.equal(legacy(owner),"{}");
assert.equal(legacy(editor),"{}");
// All four characters were created by the genuine signed v3/Story path.
// For action-state ONLY, change C's canonical sheet to source-shaped Barbarian
// Rage using PRIVILEGED LOCAL SQL. This is NOT signed Barbarian Forge creation.
sql("UPDATE public.character_sheets SET sheet=sheet || "+
 lit(JSON.stringify({classKey:"barbarian",className:"Barbarian",class:"Barbarian",rages:2,
 actionState:{rage:{active:false,usesRemaining:2,usesMax:2}}}))+
 "::jsonb WHERE character_id="+lit(C.id));
assert.equal(sql("SELECT sheet#>>'{actionState,rage,usesRemaining}' FROM public.character_sheets WHERE character_id="+lit(C.id)),"2");
sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES "+
 "("+lit(B.id)+","+lit(editor.id)+",false,true,false),"+
 "("+lit(C.id)+","+lit(editor.id)+",false,true,false)"+
 " ON CONFLICT(character_id,user_id) DO UPDATE SET can_edit=true");
assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id="+lit(B.id)+" AND can_edit"),"2");
assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id="+lit(C.id)+" AND can_edit"),"2");
mirror(owner,A.id);
mirror(editor,D.id);
sql("UPDATE public.players SET sheet="+lit(JSON.stringify({historical:"I2E synthetic legacy without creation marker",xp:777}))+"::jsonb WHERE user_id="+lit(historical.id));
const firstA=sheet(A.id), historicSheet=legacy(historical);
const accountRed=accountSnapshot([owner,editor,historical]);
console.log("PASS I2E-02: genuine signed v3/Story Fighter A/B/C/D and two editor accounts, privileged local Barbarian action-sheet specimen, and untouched unmarked historical sheet established");

// Three original source REDs all overwrite existing, nonempty OLD ACCOUNT
// sheets for both editor users, while unrelated canonical sheets stay safe.
const redHp=succeeded(await hp(owner,B.id,0,4),"original HP second Fighter");
assert.equal(redHp.tempHp,4);
assert.equal(JSON.parse(sheet(B.id)).tempHp,4);
assert.equal(legacy(owner),sheet(B.id));
assert.equal(legacy(editor),sheet(B.id));
assert.equal(sheet(A.id),firstA);
assert.equal(legacy(historical),historicSheet);
console.log("PASS I2E-03 EXPECTED ORIGINAL HP RED: signed second character HP changes canonical and clobbers BOTH owner/editor nonempty legacy sheets");
mirror(owner,A.id);mirror(editor,D.id);
const adminBefore=eventCount(B.id);
const redAdmin=succeeded(await progress(gm,B.id,400),"original Admin v2 progression");
assert.ok(redAdmin.progression);
assert.equal(xp(B.id),400);
assert.ok(eventCount(B.id)>adminBefore);
assert.equal(legacy(owner),sheet(B.id));
assert.equal(legacy(editor),sheet(B.id));
assert.equal(sheet(A.id),firstA);
console.log("PASS I2E-04 EXPECTED ORIGINAL ADMIN RED: signed Admin v2 updates canonical progression but overwrites two unrelated editors' old account sheets");
mirror(owner,A.id);mirror(editor,D.id);
const redAction=succeeded(await action(owner,C.id,"activate"),"original Rage activate");
assert.equal(redAction.active,true);
assert.equal(redAction.usesRemaining,1);
assert.equal(JSON.parse(sheet(C.id)).actionState.rage.usesRemaining,1);
assert.equal(legacy(owner),sheet(C.id));
assert.equal(legacy(editor),sheet(C.id));
assert.equal(sheet(A.id),firstA);
console.log("PASS I2E-05 EXPECTED ORIGINAL ACTION RED: signed Rage activation alters its canonical specimen then overwrites BOTH unrelated editor legacy sheets");

// Original-source REDs are preserved above. Only now stage Option A scratch.
fixture("scripts/fixtures/i2e_option_a_hp_admin_rage_scratch_pg17.sql");
for(const sig of sigs){
 const s=sql("SELECT lower(pg_get_functiondef("+lit(sig)+"::regprocedure))");
 assert.ok(!s.includes("update public.players"),"new original mirror statement remains: "+sig);
 assert.ok(s.includes("i2e_option_a_no_legacy_sheet_write"));
 assert.notEqual(md5(sig),exact[Object.keys(fn).find(k=>fn[k]===sig)]);
}
assert.equal(md5("public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)"),
 "eb467b7c7a8d548581a36cfcb0d8f77b");
assert.equal(md5("public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)"),
 "6e39477f971c9d40c6726c9f4dbc456e");
console.log("PASS I2E-06: scratch-only source-reversible three-write freeze installed after all ORIGINAL REDs; original canonical Admin-v1 and Story/nonce source unchanged");

// A is the SAME canonical character as owner's stored historical snapshot.
// C is the SAME canonical action specimen that editor's snapshot will mirror.
// The other account is unrelated to each targeted character.
mirror(owner,A.id);
mirror(editor,C.id);
const frozen=accountSnapshot([owner,editor,historical]);
const oldA=sheet(A.id);
const newA=succeeded(await hp(owner,A.id,0,3),"signed matching-account HP");
assert.equal(newA.tempHp,3);
assert.notEqual(sheet(A.id),oldA);
assert.equal(JSON.parse(sheet(A.id)).tempHp,3);
unchanged(frozen,"same-character HP A");
const newB=succeeded(await hp(editor,B.id,-2,6),"signed delegate editor HP B");
assert.equal(newB.tempHp,6);
unchanged(frozen,"delegate other-character HP B");
console.log("PASS I2E-07: owner SAME-character and editor DIFFERENT-character signed HP updates change only target canonical sheet, no legacy content or gameplay account timestamp change");

const cBefore=sheet(C.id);
const deactivated=succeeded(await action(editor,C.id,"deactivate"),"coeditor Rage deactivate");
assert.equal(deactivated.active,false);
assert.equal(deactivated.usesRemaining,1);
assert.notEqual(sheet(C.id),cBefore);
unchanged(frozen,"coeditor SAME-character Rage deactivate");
const reset=succeeded(await action(owner,C.id,"reset"),"owner Rage reset");
assert.equal(reset.usesRemaining,2);
assert.equal(reset.active,false);
unchanged(frozen,"owner cross-character Rage reset");
console.log("PASS I2E-08: Rage deactivate/reset preserve original class-resource semantics under signed coeditor/owner while SAME+other editor account sheets remain frozen");

// Admin progression updates canonical character and records original events
// but never writes to any account, even if one account snapshot is the same
// character. Source-original Admin v1 internal work is unchanged.
const eventsBefore=eventCount(B.id);
const greenAdmin=succeeded(await progress(gm,B.id,650),"Admin v2 no mirror");
assert.equal(xp(B.id),650);
assert.ok(eventCount(B.id)>eventsBefore);
assert.ok(greenAdmin.progression);
unchanged(frozen,"Admin v2 on other-character B");
mirror(owner,B.id);
const matchingAdmin=accountSnapshot([owner,editor,historical]);
const events2=eventCount(B.id);
const sameAdmin=succeeded(await progress(gm,B.id,750),"Admin v2 on SAME-owner legacy B");
assert.equal(xp(B.id),750);
assert.ok(eventCount(B.id)>events2);
assert.ok(sameAdmin.progression);
unchanged(matchingAdmin,"Admin v2 matching owner account");
console.log("PASS I2E-09: original Admin v1/v2 progression+event logic intact, both other-character and same-character historical legacy account mirrors remain unchanged");

// Rejected operations and direct signed-client writes must not mutate any
// canonical sheet, owner/editor/historical sheet, Story, or grant history.
const canonicalA=sheet(A.id),canonicalB=sheet(B.id),canonicalC=sheet(C.id);
const finalEvents=eventCount(B.id);
denied(await hp(outside,B.id,0,99),"outsider HP", "42501");
denied(await action(outside,C.id,"activate"),"outsider Rage","42501");
denied(await progress(owner,B.id,800),"non-Admin progression","42501");
denied(await hp(owner,B.id,100001,null),"invalid over-limit HP");
denied(await action(editor,C.id,"nap"),"unsupported Rage operation","22023");
const rogue=await owner.client.from("players").update({sheet:{attack:"I2E"}})
 .eq("user_id",owner.id).select("user_id");
denied(rogue,"direct unauthorized legacy-sheet write","42501");
assert.equal(sheet(A.id),canonicalA);
assert.equal(sheet(B.id),canonicalB);
assert.equal(sheet(C.id),canonicalC);
assert.equal(eventCount(B.id),finalEvents);
unchanged(matchingAdmin,"all denied signed requests");
assert.equal(secret(A.id),A.story);
assert.equal(secret(B.id),B.story);
assert.equal(secret(C.id),C.story);
assert.equal(legacy(historical),historicSheet);
console.log("PASS I2E-10: signed outsider/non-Admin/invalid/direct sheet-write requests rejected; canonical, history, private Story, unmarked legacy and timestamps remain unchanged");

// Legitimate account/profile display edits still work; they must never
// trigger a sheet replacement from the formerly privileged RPCs.
const renamed=await editor.client.from("players")
 .update({name:"I2E coeditor renamed account"}).eq("user_id",editor.id).select("name").single();
assert.ifError(renamed.error);
assert.equal(renamed.data.name,"I2E coeditor renamed account");
assert.equal(legacy(editor),matchingAdmin[1][1]);
assert.equal(legacy(owner),matchingAdmin[0][1]);
assert.equal(legacy(historical),historicSheet);
console.log("PASS I2E-11: authenticated account-name edit remains supported under existing scratch ACL; frozen historical sheet bytes unchanged");

assert.equal(md5("public.create_player_character_v3(jsonb,jsonb,jsonb)"),
 "ab48d46376075a79b3f5a5de21fdada6");
assert.equal(md5("private.create_player_character_v2_source_20261105(jsonb,jsonb)"),
 "00b2167041b9c2e4e1a98d3873839f37");
assert.equal(md5("public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)"),
 "6e39477f971c9d40c6726c9f4dbc456e");
console.log("I2E RESULT: signed source-original HP/Admin/Rage RED x3 followed by three source-MD5-reversible Option A scratch GREEN, original Admin-v1/Story/nonce unchanged. 7/34 original UPDATE writers now have bounded Option A local evidence; remaining 27 original UPDATE writers, indirect UPSERTs, full 31-trigger/browser/recovery/production approval remain OPEN. No live SQL/runtime changes.");
