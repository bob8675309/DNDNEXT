#!/usr/bin/env node
// I1-P: signed source-original earned-v5 and rest legacy mirror collision.
// Run ONLY after the unchanged P1.3 F06-F28 suite, and the exact
// i1p_original_rest_shared_p13_pg17.sql source graph in scratch local PG17.
// Characters are SQL-seeded source-shaped P1.3 specimens, NOT real Forge
// v2/v3 signed creation with private Story or immutable nonce reservations.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
  GITHUB_ACTIONS:"true",CI:"true",
  PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres",
  DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:"P13_SOURCE_V5_LOCAL_AUTH_ONLY",
  DNDNEXT_I1P_LOCAL_CONFIRM:"DISPOSABLE_P13_SOURCE_V5_REST_PG17_ONLY"
}))assert.equal(e[k],v,"I1-P unsafe run environment "+k);
assert.match(e.DNDNEXT_P13_LEVELUP_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LEVELUP_ANON_KEY);
const sql=q=>{
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],{
   encoding:"utf8",timeout:20000,env:{...e,PGUSER:"postgres"}
 });
 assert.equal(r.status,0,"I1-P disposable SQL: "+r.stderr);
 return r.stdout.trim();
};
const fixture=p=>{
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",p],{
   encoding:"utf8",timeout:25000,env:{...e,PGUSER:"postgres"}
 });
 assert.equal(r.status,0,"I1-P scratch fixture: "+r.stderr);
};
const uid=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const client=()=>createClient(e.DNDNEXT_P13_LEVELUP_URL,e.DNDNEXT_P13_LEVELUP_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const actors=[];
const pwd="I1P-RestEarned-"+randomUUID()+"-X!";
for(const name of ["owner","coeditor","outsider"]){
 const c=client(),email="i1p-"+randomUUID()+"@example.invalid";
 const up=await c.auth.signUp({email,password:pwd});assert.ifError(up.error);
 const login=await c.auth.signInWithPassword({email,password:pwd});assert.ifError(login.error);
 const claims=await c.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.sub,login.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 actors.push({name,client:c,id:login.data.user.id});
}
const [owner,coeditor,outsider]=actors;
const root="public.";
const hash=(sig)=>sql("SELECT md5(pg_get_functiondef('"+sig+"'::regprocedure))");
assert.equal(hash("public.complete_character_level_up_v5(uuid,jsonb)"),"02d74b973a763c53c595be20e35e512f");
assert.equal(hash("private.complete_character_level_up_base_v3(uuid,jsonb)"),"e33639d549ef557976a3970ea51f5238");
assert.equal(hash("private.sync_player_forge_class_spell_summary_v1(uuid)"),"5b1b275a268a57591a2e35a05ce7480d");
assert.equal(hash("public.complete_character_rest_v1(uuid,text)"),"fffbf0705d640a7d2bfb08aa78ad521a");
assert.equal(hash("private.restore_character_rest_action_state_v1(uuid,text)"),"d75edf2ac583e3790882155c702e2165");
assert.equal(hash("private.sync_character_spell_slots_v1(uuid)"),"6c276ab2135fb90894fd8684e39ce1c3");
assert.equal(hash("private.character_sheet_resource_profile_json_v1(uuid)"),"2c798f8351282d80e63ab8e9e9019272");
assert.equal(sql("SELECT count(*) FROM private.p13_levelup_case_guard WHERE scope='disposable'"),"1");
console.log("PASS I1P-01: original signed earned v5 and full rest orchestrator plus exact original slot/profile/Rage helpers staged with seven source MD5s");

const eSql=s=>"'"+s.replaceAll("'","''")+"'";
const canonicalNonce=cid=>sql("SELECT sheet#>>'{meta,creationRequestId}' FROM public.character_sheets WHERE character_id="+eSql(cid));
const canonicalHash=cid=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+eSql(cid));
const legacyNonce=who=>sql("SELECT sheet#>>'{meta,creationRequestId}' FROM public.players WHERE user_id="+eSql(who.id));
const legacyHash=who=>sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+eSql(who.id));
const mark=(cid,nonce)=>{
 sql("UPDATE public.characters SET creation_request_id="+eSql(nonce)+" WHERE id="+eSql(cid)+";"+
 "UPDATE public.character_sheets SET sheet=jsonb_set(sheet,'{meta,creationRequestId}',to_jsonb("+eSql(nonce)+"::text),true) "+
 "WHERE character_id="+eSql(cid)+";");
 assert.equal(canonicalNonce(cid),nonce);
};
const add=(cid,label)=>{
 const init=JSON.stringify({
   classKey:"fighter",rulesetSource:"XPHB",ruleset:"2024",level:1,
   hp:12,maxHp:12,abilities:{con:{score:12}},
   meta:{classKey:"fighter",rulesetSource:"XPHB",level:1}
 });
 sql("INSERT INTO public.characters(id,name,kind) VALUES("+eSql(cid)+","+eSql("I1P "+label)+",'npc');"+
 "INSERT INTO public.character_sheets(character_id,sheet) VALUES("+eSql(cid)+","+eSql(init)+"::jsonb);"+
 "INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by)"+
 " VALUES("+eSql(cid)+","+eSql(uid(8201))+",1,300,true,"+eSql(owner.id)+")"+
 " ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,class_level=excluded.class_level,"+
 " experience_points=excluded.experience_points,pending_level_up=excluded.pending_level_up,created_by=excluded.created_by;"+
 "INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,metadata_ready,status,created_by)"+
 " VALUES("+eSql(cid)+",1,2,true,'open',"+eSql(owner.id)+");"+
 "INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES"+
 "("+eSql(cid)+","+eSql(owner.id)+",true),("+eSql(cid)+","+eSql(coeditor.id)+",true);");
 mark(cid,randomUUID());
};
const barbarian=cid=>{
 const payload=JSON.stringify({classKey:"barbarian",className:"Barbarian",
  rulesetSource:"XPHB",level:1,rages:2,
  actionState:{rage:{active:false,usesRemaining:0,usesMax:2}}});
 sql("UPDATE public.character_progression SET class_id="+eSql(uid(8521))+
 ",class_level=1,experience_points=0,pending_level_up=false WHERE character_id="+eSql(cid)+";"+
 "UPDATE public.character_sheets SET sheet=sheet || "+eSql(payload)+"::jsonb WHERE character_id="+eSql(cid)+";");
 assert.equal(sql("SELECT sheet#>>'{actionState,rage,usesRemaining}' FROM public.character_sheets WHERE character_id="+eSql(cid)),"0");
};
const mirror=(who,cid)=>{
 sql("INSERT INTO public.players(user_id,sheet) SELECT "+eSql(who.id)+",sheet FROM public.character_sheets WHERE character_id="+eSql(cid)+
 " ON CONFLICT(user_id) DO UPDATE SET sheet=excluded.sheet,updated_at=now();");
 assert.equal(legacyNonce(who),canonicalNonce(cid));
};
const earn=(who,cid)=>who.client.rpc("complete_character_level_up_v5",{
 p_character_id:cid,p_selections:{hp_method:"fixed"}
});
const rest=(who,cid,type)=>who.client.rpc("complete_character_rest_v1",{
 p_character_id:cid,p_rest_type:type
});
const a=uid(8531),d=uid(8532),bRed=uid(8533),cRed=uid(8534),bGreen=uid(8535),cGreen=uid(8536);
for(const [cid,label] of [
 [a,"Owner mirror Fighter A"],[d,"Coeditor mirror Barbarian D"],
 [bRed,"Original earned-v5 Fighter B"],[cRed,"Original rest Barbarian C"],
 [bGreen,"Candidate earned-v5 Fighter B"],[cGreen,"Candidate rest Barbarian C"]
]) add(cid,label);
for(const cid of [d,cRed,cGreen])barbarian(cid);
mirror(owner,a);mirror(coeditor,d);
const aNonce=canonicalNonce(a),dNonce=canonicalNonce(d);
const hA=canonicalHash(a),hD=canonicalHash(d),lOwner=legacyHash(owner),lCo=legacyHash(coeditor);
assert.notEqual(aNonce,dNonce);
assert.notEqual(aNonce,canonicalNonce(bRed));
assert.notEqual(dNonce,canonicalNonce(cRed));

// Independent ORIGINAL source RED: real earned v5 executes both account-wide
// writers and changes unrelated owner and coeditor snapshots.
const eRed=await earn(owner,bRed);assert.ifError(eRed.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+eSql(bRed)),"2");
assert.equal(legacyNonce(owner),canonicalNonce(bRed));
assert.equal(legacyNonce(coeditor),canonicalNonce(bRed));
assert.notEqual(legacyHash(owner),lOwner);assert.notEqual(legacyHash(coeditor),lCo);
assert.equal(canonicalHash(a),hA);assert.equal(canonicalHash(d),hD);
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+eSql(bRed)+" AND event_type='level_up_completed'"),"1");
console.log("PASS I1P-02 EXPECTED ORIGINAL EARNED V5 RED: signed Fighter B 1->2 rewrites both A/D unrelated populated account sheets");

// Restore ONLY scratch snapshots, then use real original rest orchestration
// and original Rage class-action sheet writer to show a second SOURCE RED.
mirror(owner,a);mirror(coeditor,d);
const rRed=await rest(owner,cRed,"short_rest");assert.ifError(rRed.error);
assert.equal(rRed.data.restResult.restoredClassFeatureUses,1);
assert.equal(sql("SELECT sheet#>>'{actionState,rage,usesRemaining}' FROM public.character_sheets WHERE character_id="+eSql(cRed)),"1");
assert.equal(sql("SELECT count(*) FROM public.character_rest_log WHERE character_id="+eSql(cRed)+" AND rest_type='short_rest'"),"1");
assert.equal(legacyNonce(owner),canonicalNonce(cRed));
assert.equal(legacyNonce(coeditor),canonicalNonce(cRed));
assert.equal(canonicalHash(a),hA);assert.equal(canonicalHash(d),hD);
console.log("PASS I1P-03 EXPECTED ORIGINAL REST RED: signed short_rest restores one Rage use but rewrites both unrelated populated A/D account mirrors");

// Only after both original REDs install three separately source-locked
// scratch mirror predicates, never modified public earn/rest entrypoints.
mirror(owner,a);mirror(coeditor,d);
fixture("scripts/fixtures/i1p_earned_levelup_rest_mirror_candidate_pg17.sql");
assert.equal(hash("public.complete_character_level_up_v5(uuid,jsonb)"),"02d74b973a763c53c595be20e35e512f");
assert.equal(hash("public.complete_character_rest_v1(uuid,text)"),"fffbf0705d640a7d2bfb08aa78ad521a");
console.log("PASS I1P-04: three independent scratch legacy mirror predicates source-locked; original public v5/rest unchanged");

const eGreen=await earn(owner,bGreen);assert.ifError(eGreen.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id="+eSql(bGreen)),"2");
assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets WHERE character_id="+eSql(bGreen)),"2");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+eSql(bGreen)+" AND event_type='level_up_completed'"),"1");
assert.equal(legacyHash(owner),lOwner);assert.equal(legacyHash(coeditor),lCo);
assert.equal(canonicalHash(a),hA);assert.equal(canonicalHash(d),hD);
const repeat=await earn(owner,bGreen);assert.ok(repeat.error,"repeated earned v5 should fail");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+eSql(bGreen)+" AND event_type='level_up_completed'"),"1");
console.log("PASS I1P-05: signed original earned v5 advances B once, preserves canonical A/D and both populated legacy mirrors");

const rGreen=await rest(owner,cGreen,"short_rest");assert.ifError(rGreen.error);
assert.equal(rGreen.data.restResult.restoredClassFeatureUses,1);
assert.equal(sql("SELECT sheet#>>'{actionState,rage,usesRemaining}' FROM public.character_sheets WHERE character_id="+eSql(cGreen)),"1");
assert.equal(sql("SELECT count(*) FROM public.character_rest_log WHERE character_id="+eSql(cGreen)),"1");
assert.equal(legacyHash(owner),lOwner);assert.equal(legacyHash(coeditor),lCo);
assert.equal(canonicalHash(a),hA);assert.equal(canonicalHash(d),hD);
console.log("PASS I1P-06: original short_rest/Rage logs and canonical state succeed without cross-character legacy mutation");

const beforeA=legacyHash(owner);
const sameEarn=await earn(owner,a);assert.ifError(sameEarn.error);
assert.equal(legacyNonce(owner),aNonce);
assert.equal(sql("SELECT sheet->>'level' FROM public.players WHERE user_id="+eSql(owner.id)),"2");
assert.notEqual(legacyHash(owner),beforeA);
const beforeD=legacyHash(coeditor);
const sameRest=await rest(coeditor,d,"long_rest");assert.ifError(sameRest.error);
assert.equal(sameRest.data.restResult.restoredClassFeatureUses,2);
assert.equal(sql("SELECT sheet#>>'{actionState,rage,usesRemaining}' FROM public.players WHERE user_id="+eSql(coeditor.id)),"2");
assert.equal(legacyNonce(coeditor),dNonce);
assert.notEqual(legacyHash(coeditor),beforeD);
assert.equal(legacyNonce(owner),aNonce);
console.log("PASS I1P-07: same-character earned level-up and long rest still synchronize correct legacy mirror, not delegated other-account mirror");

// Signed negatives; the original guards must remain active after candidate.
const lastOwner=legacyHash(owner),lastCo=legacyHash(coeditor),lastB=canonicalHash(bGreen),lastC=canonicalHash(cGreen);
const noRest=await rest(outsider,cGreen,"short_rest");assert.ok(noRest.error);assert.equal(noRest.error.code,"42501");
const badRest=await rest(owner,cGreen,"nap");assert.ok(badRest.error);assert.equal(badRest.error.code,"22023");
const noEarn=await earn(outsider,bGreen);assert.ok(noEarn.error);assert.equal(noEarn.error.code,"42501");
assert.equal(legacyHash(owner),lastOwner);assert.equal(legacyHash(coeditor),lastCo);
assert.equal(canonicalHash(bGreen),lastB);assert.equal(canonicalHash(cGreen),lastC);
assert.equal(sql("SELECT count(*) FROM public.character_rest_log WHERE character_id="+eSql(cGreen)),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+eSql(bGreen)+" AND event_type='level_up_completed'"),"1");
console.log("PASS I1P-08: signed outsider and invalid rest/level-up requests leave canonical/legacy and level/rest history unchanged");
console.log("I1P RESULT: original earned-v5 TWO account writers + original Rage-rest account writer SOURCE RED; three scratch candidate guards GREEN for two account snapshots. P1.3 characters locally seeded; no signed Forge creation/Story/nonce, original encounter veto or full spell-resource/31-trigger graph claimed.");
