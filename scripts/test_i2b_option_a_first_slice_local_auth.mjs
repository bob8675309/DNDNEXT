#!/usr/bin/env node
// I2-B OWNER OPTION A: FIRST signed no-legacy-write acceptance slice.
// Never run against hosted Supabase. Run AFTER original P1.3 and I1-P suites,
// after both source-original REDs and historical bounded GREEN tests.
// I1P originals are preserved unchanged; this is an independent contract.
// All six existing public/foreign characters from I1P remain unmodified.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
  GITHUB_ACTIONS:"true", CI:"true",
  PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres",
  DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:"P13_SOURCE_V5_LOCAL_AUTH_ONLY",
  DNDNEXT_I1P_LOCAL_CONFIRM:"DISPOSABLE_P13_SOURCE_V5_REST_PG17_ONLY",
  DNDNEXT_I2B_LOCAL_CONFIRM:"DISPOSABLE_I2B_OPTION_A_FIRST_SLICE_ONLY"
})) assert.equal(e[k],v,"unsafe I2-B environment "+k);
assert.match(e.DNDNEXT_P13_LEVELUP_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LEVELUP_ANON_KEY);
const ps=(command,args,timeout=20000)=>{
 const r=spawnSync(command,args,{encoding:"utf8",timeout,env:{...e,PGUSER:"postgres"}});
 assert.equal(r.status,0,command+" error: "+r.stderr+"\n"+r.stdout.slice(-900));
 return r.stdout.trim();
};
const sql=q=>ps("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q]);
const fixture=path=>ps("psql",["-X","-v","ON_ERROR_STOP=1","-f",path],30000);
const lit=x=>"'"+String(x).replaceAll("'","''")+"'";
const uid=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const api=()=>createClient(e.DNDNEXT_P13_LEVELUP_URL,e.DNDNEXT_P13_LEVELUP_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const actors=[];
const password="I2B-optionA-"+randomUUID()+"-Q!";
for(const name of ["owner","coeditor","outsider","historical","newProfile"]){
 const client=api(),email="i2b-"+randomUUID()+"@example.invalid";
 const signup=await client.auth.signUp({email,password});assert.ifError(signup.error);
 const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const claims=await client.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.sub,login.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 actors.push({name,client,id:login.data.user.id});
}
const [owner,coeditor,outsider,historical,newProfile]=actors;
const fnHash=sig=>sql("SELECT md5(pg_get_functiondef("+lit(sig)+"::regprocedure))");
const legacySheet=who=>sql("SELECT sheet::text FROM public.players WHERE user_id="+lit(who.id));
const legacyStamp=who=>sql("SELECT updated_at::text FROM public.players WHERE user_id="+lit(who.id));
const canonical=cid=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+lit(cid));
const expectPreserved=(before,context)=>{
 for(const [actor,sheet,stamp] of before){
   assert.equal(legacySheet(actor),sheet,context+" must not mutate "+actor.name+" legacy sheet");
   assert.equal(legacyStamp(actor),stamp,context+" must not touch "+actor.name+" account updated_at");
 }
};
assert.equal(fnHash("public.complete_character_level_up_v5(uuid,jsonb)"),"02d74b973a763c53c595be20e35e512f");
assert.equal(fnHash("public.complete_character_rest_v1(uuid,text)"),"fffbf0705d640a7d2bfb08aa78ad521a");
assert.equal(sql("SELECT count(*) FROM private.p13_levelup_case_guard WHERE scope='disposable'"),"1");
// Three I1-P protected source candidates are still installed after I1P-08,
// not already frozen or silently made production-ready.
for(const name of [
 "private.complete_character_level_up_base_v3(uuid,jsonb)",
 "private.sync_player_forge_class_spell_summary_v1(uuid)",
 "private.restore_character_rest_action_state_v1(uuid,text)"
]){
 assert.ok(sql("SELECT position('p.sheet #>> ' IN pg_get_functiondef("+lit(name)+"::regprocedure))::text")!=="0",
   "I1-P conditional historical candidate must be present before I2-B");
}
fixture("scripts/fixtures/i2b_option_a_first_three_writers_scratch_pg17.sql");
for(const sig of [
 "private.complete_character_level_up_base_v3(uuid,jsonb)",
 "private.sync_player_forge_class_spell_summary_v1(uuid)",
 "private.restore_character_rest_action_state_v1(uuid,text)"
]){
 const src=sql("SELECT lower(pg_get_functiondef("+lit(sig)+"::regprocedure))");
 assert.ok(!src.includes("update public.players"),"I2-B still updates legacy: "+sig);
 assert.ok(src.includes("i2b_option_a_frozen_legacy_mirror"),"missing I2-B narrow source sentinel");
}
assert.equal(fnHash("public.complete_character_level_up_v5(uuid,jsonb)"),"02d74b973a763c53c595be20e35e512f");
assert.equal(fnHash("public.complete_character_rest_v1(uuid,text)"),"fffbf0705d640a7d2bfb08aa78ad521a");
console.log("PASS I2B-01: source-reversible three-writer Option A no-op installed AFTER original I1-P RED/GREEN; original public earned/rest unchanged");

// A and D are existing mirrored characters; B and C are different targets.
// We deliberately test BOTH same-character and other-character operations.
const createCharacter=(cid,label,barbarian=false)=>{
 const sheet={classKey:barbarian?"barbarian":"fighter",rulesetSource:"XPHB",ruleset:"2024",
  level:1,hp:12,maxHp:12,abilities:{con:{score:12}},
  meta:{classKey:barbarian?"barbarian":"fighter",rulesetSource:"XPHB",level:1}};
 if(barbarian)Object.assign(sheet,{className:"Barbarian",rages:2,
  actionState:{rage:{active:false,usesRemaining:0,usesMax:2}}});
 const nonce=randomUUID();
 sheet.meta.creationRequestId=nonce;
 sql("INSERT INTO public.characters(id,name,kind,creation_request_id) VALUES("+
  lit(cid)+","+lit("I2B "+label)+",'npc',"+lit(nonce)+");"+
  "INSERT INTO public.character_sheets(character_id,sheet) VALUES("+lit(cid)+","+lit(JSON.stringify(sheet))+"::jsonb);"+
  "INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by)"+
  " VALUES("+lit(cid)+","+lit(uid(barbarian?8521:8201))+",1,"+(barbarian?"0,false":"300,true")+","+lit(owner.id)+");"+
  "INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,metadata_ready,status,created_by)"+
  " VALUES("+lit(cid)+",1,2,true,'open',"+lit(owner.id)+");"+
  "INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES"+
  "("+lit(cid)+","+lit(owner.id)+",true),("+lit(cid)+","+lit(coeditor.id)+",true);");
 return nonce;
};
const a=uid(8561),d=uid(8562),b=uid(8563),c=uid(8564);
const nA=createCharacter(a,"owner same-character Fighter A");
const nD=createCharacter(d,"coeditor same-character Barbarian D",true);
const nB=createCharacter(b,"other-character Fighter B");
const nC=createCharacter(c,"other-character Barbarian C",true);
const setLegacy=(actor,cid,name)=>{
 sql("INSERT INTO public.players(user_id,sheet,updated_at) SELECT "+
 lit(actor.id)+",sheet,now() FROM public.character_sheets WHERE character_id="+lit(cid)+
 " ON CONFLICT(user_id) DO UPDATE SET sheet=excluded.sheet,updated_at=now();");
 assert.equal(sql("SELECT sheet#>>'{meta,creationRequestId}' FROM public.players WHERE user_id="+lit(actor.id)),
  cid===a?nA:nD);
};
setLegacy(owner,a);setLegacy(coeditor,d);
sql("INSERT INTO public.players(user_id,sheet,updated_at) VALUES("+lit(historical.id)+
 ", '{\"historical\":\"no creation marker\",\"legacyLevel\":9}'::jsonb,now());");
const base=[[owner,legacySheet(owner),legacyStamp(owner)],
 [coeditor,legacySheet(coeditor),legacyStamp(coeditor)],
 [historical,legacySheet(historical),legacyStamp(historical)]];
const earn=(who,cid)=>who.client.rpc("complete_character_level_up_v5",{
 p_character_id:cid,p_selections:{hp_method:"fixed"}
});
const rest=(who,cid,type)=>who.client.rpc("complete_character_rest_v1",{
 p_character_id:cid,p_rest_type:type
});
assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id="+lit(a)),"2");
assert.equal(sql("SELECT sheet#>>'{meta,creationRequestId}' FROM public.players WHERE user_id="+lit(historical.id)),"");
console.log("PASS I2B-02: distinct canonical IDs, unrelated owner/coeditor legacy snapshots and historical unmarked snapshot established");

// Option A differs explicitly from the historical I1-P GREEN: even updating
// the SAME character must NEVER touch its legacy snapshot or its timestamp.
const sameEarn=await earn(owner,a);assert.ifError(sameEarn.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+lit(a)),"2");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+lit(a)+
 " AND event_type='level_up_completed'"),"1");
expectPreserved(base,"same-character earned v5");
const sameRest=await rest(coeditor,d,"long_rest");assert.ifError(sameRest.error);
assert.equal(sameRest.data.restResult.restoredClassFeatureUses,2);
assert.equal(sql("SELECT sheet#>>'{actionState,rage,usesRemaining}' FROM public.character_sheets WHERE character_id="+lit(d)),"2");
expectPreserved(base,"same-character Rage long rest");
assert.notEqual(canonical(a),base[0][1]);
assert.notEqual(canonical(d),base[1][1]);
console.log("PASS I2B-03: signed same-character earned level-up and long rest advance canonicals but leave BOTH old matching legacy snapshots byte/timestamp-identical");

// Other-character workflows share permissions across both logged-in
// accounts, yet must never touch either established legacy mirror.
const otherEarn=await earn(owner,b);assert.ifError(otherEarn.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+lit(b)),"2");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+lit(b)+
 " AND event_type='level_up_completed'"),"1");
expectPreserved(base,"other-character earned v5");
const otherRest=await rest(owner,c,"short_rest");assert.ifError(otherRest.error);
assert.equal(otherRest.data.restResult.restoredClassFeatureUses,1);
assert.equal(sql("SELECT sheet#>>'{actionState,rage,usesRemaining}' FROM public.character_sheets WHERE character_id="+lit(c)),"1");
assert.equal(sql("SELECT count(*) FROM public.character_rest_log WHERE character_id="+lit(c)),"1");
expectPreserved(base,"other-character Rage short rest");
console.log("PASS I2B-04: signed cross-character earned v5 and short rest update canonical B/C and history while owner/coeditor/historical sheets stay frozen");

// Negative paths maintain rollback/permissions after legacy writes removed.
const originalB=canonical(b),originalC=canonical(c);
const unauthorized=await earn(outsider,b);assert.ok(unauthorized.error);
assert.equal(unauthorized.error.code,"42501");
const badRest=await rest(owner,c,"nap");assert.ok(badRest.error);assert.equal(badRest.error.code,"22023");
const outsideRest=await rest(outsider,c,"long_rest");assert.ok(outsideRest.error);
assert.equal(outsideRest.error.code,"42501");
const replay=await earn(owner,b);assert.ok(replay.error);
assert.equal(canonical(b),originalB);assert.equal(canonical(c),originalC);
expectPreserved(base,"rejected calls");
console.log("PASS I2B-05: outsider, unsupported rest and level replay denied without canonical/legacy/history drift");

// Permission freeze is deliberately separate from the three function edits.
// It must preserve authenticated account name insert/update/UPSERT while
// disallowing direct sheet writes (table-grant revoke + column grants).
fixture("scripts/fixtures/i2b_option_a_scratch_player_profile_acl_pg17.sql");
assert.equal(sql("SELECT has_table_privilege('authenticated','public.players','UPDATE')"),"f");
assert.equal(sql("SELECT has_column_privilege('authenticated','public.players','sheet','UPDATE')"),"f");
assert.equal(sql("SELECT has_column_privilege('authenticated','public.players','name','UPDATE')"),"t");
console.log("PASS I2B-06: scratch authenticated role has profile-column writes only; RLS enabled, sheet INSERT/UPDATE disallowed");

// Signed REST API needs auth + policy. Denied paths must not rely solely on
// absence of matching rows or UI button hiding.
const rogueWrite=await owner.client.from("players")
 .update({sheet:{unauthorized:"replaced"}}).eq("user_id",owner.id).select("user_id");
assert.ok(rogueWrite.error,"direct signed sheet update must fail");
assert.equal(rogueWrite.error.code,"42501");
const rogueInsert=await newProfile.client.from("players")
 .insert({user_id:newProfile.id,name:"Bad",sheet:{unauthorized:"seed"}}).select("user_id");
assert.ok(rogueInsert.error,"direct signed sheet INSERT must fail");
assert.equal(rogueInsert.error.code,"42501");
const anonymous=await api().from("players").select("user_id,name").limit(1);
assert.ok(anonymous.error,"anonymous must not be allowed to read player rows");
expectPreserved(base,"denied signed direct sheet write");
console.log("PASS I2B-07: real authenticated direct sheet UPDATE/INSERT denied, anonymous SELECT denied, existing legacy data unchanged");

// No profile regression: actual current UI insert, update, onConflict
// upsert shapes are supported under the scratch role grant and RLS.
const ownerRename=await owner.client.from("players").update({name:"New owner account name",
 updated_at:new Date().toISOString()}).eq("user_id",owner.id).select("user_id,name").single();
assert.ifError(ownerRename.error);
assert.equal(ownerRename.data.name,"New owner account name");
const ownerUpsert=await owner.client.from("players")
 .upsert({user_id:owner.id,name:"Owner second display"}, {onConflict:"user_id"})
 .select("user_id,name").single();
assert.ifError(ownerUpsert.error);
assert.equal(ownerUpsert.data.name,"Owner second display");
const newAccount=await newProfile.client.from("players")
 .insert({user_id:newProfile.id,name:"Fresh Player"}).select("user_id,name").single();
assert.ifError(newAccount.error);
assert.equal(newAccount.data.name,"Fresh Player");
assert.equal(sql("SELECT sheet::text FROM public.players WHERE user_id="+lit(newProfile.id)),"{}");
const historicalRename=await historical.client.from("players")
 .update({name:"Historical account renamed"}).eq("user_id",historical.id).select("name").single();
assert.ifError(historicalRename.error);
assert.equal(historicalRename.data.name,"Historical account renamed");
for(const [actor,old] of base){
 assert.equal(legacySheet(actor),old,"name edits must not modify legacy sheet for "+actor.name);
}
assert.equal(sql("SELECT sheet #>> '{meta,creationRequestId}' FROM public.players WHERE user_id="+lit(historical.id)),"");
console.log("PASS I2B-08: signed player name UPDATE, existing-row UPSERT, new identity INSERT and historical missing-marker rename still work; all legacy sheets unchanged");

// This runner deliberately covers THREE of 34 SQL UPDATE writers, no v1/v2
// creator UPSERT, no signed full Forge create / private Story, no Admin
// entitlement or full production RLS. Never label this a migration pass.
assert.equal(fnHash("public.complete_character_level_up_v5(uuid,jsonb)"),"02d74b973a763c53c595be20e35e512f");
assert.equal(fnHash("public.complete_character_rest_v1(uuid,text)"),"fffbf0705d640a7d2bfb08aa78ad521a");
console.log("I2B RESULT: Option A FIRST signed disposable slice PASSED, 3/34 server updaters frozen with source-reversible changes, direct client sheet write denied, account names work. 31 other UPDATE writers + 3 INSERT/UPSERT source paths remain UNTESTED for Option A. NO production release.");
