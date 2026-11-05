#!/usr/bin/env node
// P1.3 actual source v5→v4→v3→base-v3 versus sheet's original CS→CP trigger.
// Genuine GoTrue JWT/PostgREST for BOTH competing transactions; test-only
// CS timing hook, source-original levelup functions and source fingerprint gate.
// Only featureless Fighter 1→2 tails are reduced, NOT full class/game coverage.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
const e=process.env;
for(const [key,val] of Object.entries({
 GITHUB_ACTIONS:"true",CI:"true",
 DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:"P13_SOURCE_V5_LOCAL_AUTH_ONLY",
 PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"
})) assert.equal(e[key],val,"Unsafe P1.3 levelup test environment "+key);
assert.match(e.DNDNEXT_P13_LEVELUP_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LEVELUP_ANON_KEY);
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const sql=query=>{
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],{
  encoding:"utf8",timeout:15000,env:{...e,PGUSER:"postgres"}
 });
 assert.equal(p.status,0,"Scratch PG17 SQL failed: "+p.stderr);
 return p.stdout.trim();
};
const api=()=>createClient(e.DNDNEXT_P13_LEVELUP_URL,e.DNDNEXT_P13_LEVELUP_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const signed=[];
const password="LocalP13Levelup-"+randomUUID()+"-X9!";
for(const name of ["OWNER","COEDITOR","OUTSIDER"]){
 const client=api(),email="p13-levelup-"+randomUUID()+"@example.invalid";
 const up=await client.auth.signUp({email,password});
 assert.ifError(up.error);
 const log=await client.auth.signInWithPassword({email,password});
 assert.ifError(log.error);
 const user=await client.auth.getUser();
 const claims=await client.auth.getClaims();
 assert.ifError(user.error);assert.ifError(claims.error);
 assert.equal(user.data.user.id,log.data.user.id);
 assert.equal(claims.data.claims.sub,user.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(user.data.user.is_anonymous,true);
 signed.push({name,client,uid:user.data.user.id});
}
const [owner,coeditor,outsider]=signed;
assert.equal(new Set(signed.map(x=>x.uid)).size,3);
const cClass=id(8201),cSolo=id(8211),cRace=id(8212),cRevoked=id(8213);
function addCharacter(char,name){
 const initSheet=JSON.stringify({
  classKey:"fighter",rulesetSource:"XPHB",ruleset:"2024",level:1,
  hp:12,maxHp:12,abilities:{con:{score:12}},
  meta:{classKey:"fighter",rulesetSource:"XPHB",level:1}
 });
 sql("INSERT INTO public.characters(id,name,kind) VALUES('"+char+"','"+name+"','npc');"+
 "INSERT INTO public.character_sheets(character_id,sheet) VALUES('"+char+"','"+initSheet.replaceAll("'","''")+"'::jsonb);"+
 // Original sheet AFTER INSERT has ALREADY seeded character_progression with NULL
 // created_by. Match the original Forge v2 finalization with UPSERT, not INSERT.
 "INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by)"+
 " VALUES('"+char+"','"+cClass+"',1,300,true,'"+owner.uid+"')"+
 " ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,"+
 " class_level=excluded.class_level,experience_points=excluded.experience_points,"+
 " pending_level_up=excluded.pending_level_up,created_by=excluded.created_by;"+
 "INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,metadata_ready,status,created_by)"+
 " VALUES('"+char+"',1,2,true,'open','"+owner.uid+"');"+
 "INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES"+
 "('"+char+"','"+owner.uid+"',true),('"+char+"','"+coeditor.uid+"',true);");
}
addCharacter(cSolo,"P13 Source Fighter Solo");
addCharacter(cRace,"P13 Source Fighter Concurrent");
addCharacter(cRevoked,"P13 Source Fighter Revoked");
const level=(who,char)=>who.client.rpc("complete_character_level_up_v5",{
 p_character_id:char,p_selections:{hp_method:"fixed"}
});
const edit=(who,char,note)=>who.client.rpc("p13_test_sheet_edit_hold_v1",{
 p_character_id:char,p_note:note
});
const noLevel=await level(outsider,cSolo);
assert.ok(noLevel.error,"Unrelated authenticated JWT was allowed to level character");
assert.equal(noLevel.error.code,"42501");
const noSheet=await edit(outsider,cSolo,"intruder");
assert.ok(noSheet.error,"Outsider JWT was allowed to write sheet through held test helper");
assert.equal(noSheet.error.code,"42501");
console.log("PASS F07 real GoTrue outsider cannot level-up or edit sheet via source permissions");

const normal=await level(owner,cSolo);
assert.ifError(normal.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+cSolo+"'"),"2");
assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets WHERE character_id='"+cSolo+"'"),"2");
assert.equal(sql("SELECT sheet->>'maxHp' FROM public.character_sheets WHERE character_id='"+cSolo+"'"),"19");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+cSolo+"' AND event_type='level_up_completed'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id='"+cSolo+"' AND status='completed'"),"1");
const repeated=await level(owner,cSolo);
assert.ok(repeated.error,"Second level-up with no open session was accepted");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+cSolo+"' AND event_type='level_up_completed'"),"1");
console.log("PASS F08 genuine signed-in original v5→v4→v3→base Fighter lv1→2 advances HP, CS, CP and one session/event; replay cannot duplicate");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+cRevoked+"' AND user_id='"+owner.uid+"'");
const revoked=await level(owner,cRevoked);
assert.ok(revoked.error,"Revoked original controller was permitted to level-up");
assert.equal(revoked.error.code,"42501");
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+cRevoked+"'"),"1");
console.log("PASS F09 original permission helper enforces current edit-grant revocation for signed JWT");

const sleeping=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
// Supabase PostgREST builders are lazy: .then() starts the authenticated HTTP
// request before polling pg_locks. Without this, no prelock can be observed.
const levelPromise=owner.client.rpc("p13_test_levelup_cp_prelock_v1",{p_character_id:cRace}).then(x=>x);
const deadline=Date.now()+3500;
let observedPrelock=false;
while(Date.now()<deadline){
 const held=sql("SELECT count(*) FROM pg_locks WHERE locktype='advisory'"+
 " AND classid='9313'::oid AND objid='1'::oid AND granted='t'");
 if(held==="1"){observedPrelock=true;break;}
 await sleeping(80);
}
assert.ok(observedPrelock,"Test-only signed-in owner CP prelock marker not observed");
const sheetPromise=edit(coeditor,cRace,"original sheet CS-first hold").then(x=>x);
const both=await Promise.all([sheetPromise,levelPromise]);
const failures=both.filter(x=>x.error);
const successful=both.filter(x=>!x.error);
assert.equal(failures.length,1,"Expected one actual two-user 40P01 victim: "+JSON.stringify(both));
assert.equal(successful.length,1,"Expected one surviving original source transaction");
assert.equal(failures[0].error.code,"40P01","Expected PostgreSQL deadlock SQLSTATE, not timeout/permission: "+JSON.stringify(both));
const raceLevel=Number(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+cRace+"'"));
assert.ok([1,2].includes(raceLevel));
if(raceLevel===1){
 const after=await level(owner,cRace);
 assert.ifError(after.error);
}
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+cRace+"'"),"2");
assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets WHERE character_id='"+cRace+"'"),"2");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+cRace+"' AND event_type='level_up_completed'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id='"+cRace+"' AND status='completed'"),"1");
console.log("PASS F10 synthetic CP prelock + original signed JWT v5 CP→CS versus original signed JWT CS→CP sheet edit produces real 40P01, one victim and exactly one level/event; production timing NOT established");

console.log("P1.3 original full source v5-v4-v3/base F06-F10 accepted for a Fighter lv1→2 using REDUCED class-choice helpers and local editor RLS; not global grant/inventory or production trigger proof.");

// F11-F16 original Admin G grant vs v5 CP/CS, genuine Admin/owner JWTs.
// Source originals, timing and reduced-RLS limits documented in matching report.
const originalGrantFixture=spawnSync('psql',[
 '-X','-v','ON_ERROR_STOP=1','-f',
 'scripts/fixtures/p1_3_admin_grant_levelup_extension_pg17.sql'
],{encoding:'utf8',timeout:15000,env:{...e,PGUSER:'postgres'}});
assert.equal(originalGrantFixture.status,0,'F11 Admin grant fixture: '+originalGrantFixture.stderr);
console.log('PASS F11 original Admin G/CS source fingerprint and scratch ACL gates installed');
const adminClient=api(),adminEmail='p13-original-grant-'+randomUUID()+'@example.invalid';
const adminSignup=await adminClient.auth.signUp({email:adminEmail,password});assert.ifError(adminSignup.error);
const adminLogin=await adminClient.auth.signInWithPassword({email:adminEmail,password});assert.ifError(adminLogin.error);
const adminClaims=await adminClient.auth.getClaims();assert.ifError(adminClaims.error);
assert.equal(adminClaims.data.claims.sub,adminLogin.data.user.id);
assert.equal(adminClaims.data.claims.role,'authenticated');
const adminUid=adminLogin.data.user.id;
assert.ok(!signed.some(x=>x.uid===adminUid));
sql(`INSERT INTO public.user_profiles(id,role) VALUES('${adminUid}','admin')`);
const aOption=id(8292),aSolo=id(8293),aRace=id(8294);
addCharacter(aSolo,'P13 Source Admin Grant Solo');
addCharacter(aRace,'P13 Source Admin Grant and Level-up Race');
const g=(client,char,note)=>client.rpc('grant_character_option_v1',{
 p_character_id:char,p_option_id:aOption,p_notes:note
});
const gc=char=>Number(sql(`SELECT count(*) FROM public.character_option_grants WHERE character_id='${char}' AND option_id='${aOption}'`));
const gb=char=>sql(`SELECT granted_by FROM public.character_option_grants WHERE character_id='${char}' AND option_id='${aOption}'`);
const fc=char=>Number(sql(`SELECT count(*) FROM public.character_sheets cs, LATERAL jsonb_array_elements_text(coalesce(cs.sheet->'adminGrantedFeats','[]'::jsonb)) f(name) WHERE cs.character_id='${char}' AND f.name='Lucky'`));
const anonymousGrant=await g(api(),aSolo,'anonymous');
assert.ok(anonymousGrant.error,'Anonymous original grant unexpectedly succeeded');
for(const other of signed){
 const denied=await g(other.client,aSolo,'not-admin');
 assert.ok(denied.error,`Non-admin ${other.name} granted feat`);
 assert.equal(denied.error.code,'42501');
}
assert.equal(gc(aSolo),0);assert.equal(fc(aSolo),0);
console.log('PASS F12 anonymous/three player JWTs denied source Admin grant without changing G/CS');
const normalGrant=await g(adminClient,aSolo,'source original Admin');
assert.ifError(normalGrant.error);
assert.equal(gc(aSolo),1);assert.equal(fc(aSolo),1);assert.equal(gb(aSolo),adminUid);
const repeatedGrant=await g(adminClient,aSolo,'updated original grant note');
assert.ifError(repeatedGrant.error);
assert.equal(gc(aSolo),1);assert.equal(fc(aSolo),1);
assert.equal(sql(`SELECT notes FROM public.character_option_grants WHERE character_id='${aSolo}'`),'updated original grant note');
console.log('PASS F13 original signed Admin actual G insert/upsert, one projected feat, verified grant attribution; no immutable replay claimed');
sql(`UPDATE public.user_profiles SET role='player' WHERE id='${adminUid}'`);
const revokedAdmin=await g(adminClient,aSolo,'after-revocation');
assert.ok(revokedAdmin.error);assert.equal(revokedAdmin.error.code,'42501');
assert.equal(gc(aSolo),1);assert.equal(fc(aSolo),1);
sql(`UPDATE public.user_profiles SET role='admin' WHERE id='${adminUid}'`);
console.log('PASS F14 current DB-admin revocation denies same signed JWT; unchanged grant and sheet');

// All unchanged production functions run directly. Only the CP prelock and
// the separate AFTER-CS probe impose repeatable, artificial timing.
const gLevelPromise=owner.client.rpc('p13_test_grant_race_levelup_prelock_v1',{
 p_character_id:aRace
}).then(x=>x);
const pollMarker=async(key,deadline)=>{
 while(Date.now()<deadline){
  if(sql(`SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND classid='${key}'::oid AND objid='1'::oid AND granted`)==='1') return true;
  await sleeping(85);
 }
 return false;
};
assert.ok(await pollMarker(9315,Date.now()+3500),'Source v5 CP prelock marker not observed');
const gGrantPromise=g(adminClient,aRace,'G contention').then(x=>x);
assert.ok(await pollMarker(9314,Date.now()+2700),'Admin source G->CS lock probe not observed');
const [gLevelResult,gGrantResult]=await Promise.all([gLevelPromise,gGrantPromise]);
const gFailures=[gLevelResult,gGrantResult].filter(x=>x.error);
assert.equal(gFailures.length,1,'Expected one real 40P01 deadlock victim: '+JSON.stringify([gLevelResult,gGrantResult]));
assert.equal(gFailures[0].error.code,'40P01','Expected actual PG17 SQLSTATE 40P01');
if(gGrantResult.error){assert.equal(gc(aRace),0);assert.equal(fc(aRace),0);}
else{assert.equal(gc(aRace),1);assert.equal(fc(aRace),1);}
if(gLevelResult.error){
 assert.equal(sql(`SELECT class_level FROM public.character_progression WHERE character_id='${aRace}'`),'1');
 assert.equal(sql(`SELECT count(*) FROM public.character_level_events WHERE character_id='${aRace}' AND event_type='level_up_completed'`),'0');
}else assert.equal(sql(`SELECT class_level FROM public.character_progression WHERE character_id='${aRace}'`),'2');
console.log('PASS F15 source-original Admin G->CS->CP versus signed owner source-original v5 CP->CS: genuine test-timed 40P01 and rollback');
if(gLevelResult.error){const retry=await level(owner,aRace);assert.ifError(retry.error);}
if(gGrantResult.error){const retry=await g(adminClient,aRace,'G contention');assert.ifError(retry.error);}
assert.equal(gc(aRace),1);assert.equal(fc(aRace),1);assert.equal(gb(aRace),adminUid);
assert.equal(sql(`SELECT class_level FROM public.character_progression WHERE character_id='${aRace}'`),'2');
assert.equal(sql(`SELECT sheet->>'level' FROM public.character_sheets WHERE character_id='${aRace}'`),'2');
assert.equal(sql(`SELECT count(*) FROM public.character_level_events WHERE character_id='${aRace}' AND event_type='level_up_completed'`),'1');
assert.equal(sql(`SELECT count(*) FROM public.character_level_up_sessions WHERE character_id='${aRace}' AND status='completed'`),'1');
console.log('PASS F16 retry converges to one canonical G, sheet feat, level event/session, correct Admin provenance; no inventory or full trigger parity claimed');


 
// F17-F21: source-qualified XPHB Fighter Champion 3->4, ACTUAL player-earned
// advancement G-instance+G writes through original public v5->v4->v3->private
// apply_character_level_advancement_v1 under genuine signed GoTrue JWTs.
const f17Setup=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",
 "scripts/fixtures/p1_3_level4_advancement_extension_pg17.sql"],{
 encoding:"utf8",timeout:20000,env:{...e,PGUSER:"postgres"}
});
assert.equal(f17Setup.status,0,"F17 source-original level4 test setup failed: "+f17Setup.stderr);
console.log("PASS F17 original source MD5 gate, subclass and ASI level4 specimen, G/GI trigger graph loaded (reduced local schema)");
const asiOption="7fea59fa-064e-40dd-8f25-dcebe28f1e9d";
const asiChoice={
 optionId:asiOption, optionType:"feat", source:"XPHB",
 name:"Ability Score Improvement", acquisitionLevel:4,
 choices:{"asi-mode":[{kind:"asi-mode",value:"plus-two"}],
          "asi-plus-two":[{kind:"ability",value:"str"}]}
};
const l4Solo=id(8391),l4Race=id(8392),l4Revoked=id(8393);
function addLevel4Fighter(char,name){
 const init=JSON.stringify({
  classKey:"fighter",rulesetSource:"XPHB",ruleset:"2024",level:3,
  subclass:"Champion",subclassName:"Champion",subclassSource:"XPHB",
  hp:30,maxHp:30,abilities:{str:{score:12},con:{score:12}},
  meta:{classKey:"fighter",rulesetSource:"XPHB",level:3}
 });
 sql("INSERT INTO public.characters(id,name,kind) VALUES('"+char+"','"+name+"','npc');"
 +"INSERT INTO public.character_sheets(character_id,sheet) VALUES('"+char+"','"+init+"');"
 +"INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,subclass_name,subclass_source,created_by)"
 +" VALUES('"+char+"','"+cClass+"',3,2700,true,'Champion','XPHB','"+owner.uid+"')"
 +" ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,class_level=excluded.class_level,"
 +" experience_points=excluded.experience_points,pending_level_up=excluded.pending_level_up,"
 +" subclass_name=excluded.subclass_name,subclass_source=excluded.subclass_source,created_by=excluded.created_by;"
 +"INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,status,metadata_ready,created_by)"
 +" VALUES('"+char+"',3,4,'open',true,'"+owner.uid+"');"
 +"INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES"
 +"('"+char+"','"+owner.uid+"',true),('"+char+"','"+coeditor.uid+"',true);");
}
addLevel4Fighter(l4Solo,"P13 Lv4 XPHB Champion ASI Solo");
addLevel4Fighter(l4Race,"P13 Lv4 XPHB Champion ASI vs Admin G");
addLevel4Fighter(l4Revoked,"P13 Lv4 XPHB Champion Revoked");
const level4=(who,char)=>who.client.rpc("complete_character_level_up_v5",{
 p_character_id:char,p_selections:{hp_method:"fixed",advancement_instance:asiChoice}
});
const giCount=char=>Number(sql("SELECT count(*) FROM public.character_option_grant_instances WHERE character_id='"+char+"' AND option_id='"+asiOption+"'"));
const gCount=(char,opt)=>Number(sql("SELECT count(*) FROM public.character_option_grants WHERE character_id='"+char+"' AND option_id='"+opt+"'"));
const sheetCount=(char,key,value)=>Number(sql("SELECT count(*) FROM public.character_sheets cs, LATERAL jsonb_array_elements_text(coalesce(cs.sheet->'"+key+"','[]'::jsonb)) x(v) WHERE cs.character_id='"+char+"' AND x.v='"+value+"'"));
const by=(char,opt,instance)=>sql("SELECT granted_by FROM public."+ (instance?"character_option_grant_instances":"character_option_grants")+" WHERE character_id='"+char+"' AND option_id='"+opt+"'");
const solo4=await level4(owner,l4Solo);
assert.ifError(solo4.error);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+l4Solo+"'"),"4");
assert.equal(sql("SELECT sheet #>> '{abilities,str,score}' FROM public.character_sheets WHERE character_id='"+l4Solo+"'"),"14");
assert.equal(giCount(l4Solo),1);assert.equal(gCount(l4Solo,asiOption),1);
assert.equal(by(l4Solo,asiOption,true),owner.uid);
assert.equal(by(l4Solo,asiOption,false),owner.uid);
assert.equal(sheetCount(l4Solo,"feats","Ability Score Improvement"),1);
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+l4Solo+"' AND event_type='level_up_completed'"),"1");
const soloReplay=await level4(owner,l4Solo);
assert.ok(soloReplay.error,"Repeated Lv4 completion was not rejected");
assert.equal(giCount(l4Solo),1);assert.equal(gCount(l4Solo,asiOption),1);
console.log("PASS F18 signed owner original v5->v3->advancement produces ASI sheet/stat +2, one actual G instance and aggregate G, owner provenance; repeat blocked");
const outsider4=await level4(outsider,l4Revoked);
assert.ok(outsider4.error);assert.equal(outsider4.error.code,"42501");
sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id='"+l4Revoked+"' AND user_id='"+owner.uid+"'");
const revoked4=await level4(owner,l4Revoked);
assert.ok(revoked4.error);assert.equal(revoked4.error.code,"42501");
assert.equal(giCount(l4Revoked),0);assert.equal(gCount(l4Revoked,asiOption),0);
const forbiddenInsert=await owner.client.from("character_option_grant_instances").insert({
 character_id:l4Solo,option_id:asiOption,option_key:"feat:ability-score-improvement|XPHB",
 option_type:"feat",option_name:"Ability Score Improvement",option_source:"XPHB",instance_key:"forged-by-client"
});
assert.ok(forbiddenInsert.error,"Direct player canonical G instance INSERT unexpectedly succeeded");
assert.equal(giCount(l4Solo),1);
console.log("PASS F19 signed outsider/revoked player blocked; direct client G-instance table write denied");

const lvl4Promise=owner.client.rpc("p13_test_level4_advancement_cp_prelock_v1",{
 p_character_id:l4Race,p_instance:asiChoice
}).then(x=>x);
assert.ok(await pollMarker(9316,Date.now()+3700),"Lv4 original source owner CP prelock not observed");
const adminGPromise=g(adminClient,l4Race,"Concurrent Admin Lucky").then(x=>x);
assert.ok(await pollMarker(9314,Date.now()+2900),"Actual original Admin G->CS lock probe not observed");
const [lv4Result,adminResult]=await Promise.all([lvl4Promise,adminGPromise]);
const l4Failures=[lv4Result,adminResult].filter(x=>x.error);
assert.equal(l4Failures.length,1,"Expected a real source-timed G/CP/CS PostgreSQL deadlock: "+JSON.stringify([lv4Result,adminResult]));
assert.equal(l4Failures[0].error.code,"40P01","Expected PG SQLSTATE 40P01");
if(lv4Result.error){
 assert.equal(giCount(l4Race),0,"Rolled-back earned G instance remained");
 assert.equal(gCount(l4Race,asiOption),0,"Rolled-back earned G aggregate remained");
 assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+l4Race+"'"),"3");
}else{assert.equal(giCount(l4Race),1);assert.equal(gCount(l4Race,asiOption),1);}
if(adminResult.error){assert.equal(gCount(l4Race,aOption),0);}
else assert.equal(gCount(l4Race,aOption),1);
console.log("PASS F20 independent signed Admin original G insert vs signed owner original Lv4 earned G insertion induces real test-timed 40P01; losing transaction atomic");

if(lv4Result.error){const retry=await level4(owner,l4Race);assert.ifError(retry.error);}
if(adminResult.error){const retry=await g(adminClient,l4Race,"Concurrent Admin Lucky");assert.ifError(retry.error);}
assert.equal(giCount(l4Race),1);assert.equal(gCount(l4Race,asiOption),1);assert.equal(gCount(l4Race,aOption),1);
assert.equal(by(l4Race,asiOption,true),owner.uid);assert.equal(by(l4Race,asiOption,false),owner.uid);
assert.equal(by(l4Race,aOption,false),adminUid);
assert.equal(sheetCount(l4Race,"feats","Ability Score Improvement"),1);
assert.equal(sheetCount(l4Race,"adminGrantedFeats","Lucky"),1);
assert.equal(sql("SELECT sheet #>> '{abilities,str,score}' FROM public.character_sheets WHERE character_id='"+l4Race+"'"),"14");
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+l4Race+"'"),"4");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+l4Race+"' AND event_type='level_up_completed'"),"1");
assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id='"+l4Race+"' AND status='completed'"),"1");
console.log("PASS F21 retry converges to exactly one owner-earned source G instance/aggregate plus one Admin G and one level-up event, preserved provenance and ASI stat; NOT full live-trigger or I acceptance");


// F22–F28 actual merchant inventory I vs owner-earned advancement G/GI;
// genuine local GoTrue for both actors, source-original buy and inventory
// crafting triggers; no claim of a cross-table deadlock where no lock exists.
const f22setup=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",
 "scripts/fixtures/p1_3_original_merchant_inventory_extension_pg17.sql"],{
 encoding:"utf8",timeout:20000,env:{...e,PGUSER:"postgres"}
});
assert.equal(f22setup.status,0,"F22 real source merchant inventory fixture: "+f22setup.stderr);
assert.equal(sql("SELECT count(*) FROM public.inventory_items"),"0");
console.log("PASS F22 original merchant/I source MD5s, two source inventory triggers, real new-row owner CHECK 23514 reproduced (scratch only)");
const merchantI=id(8491), stockSoloI=id(8492),stockFundsI=id(8493),stockRaceI=id(8494),stockCompeteI=id(8495);
sql("INSERT INTO public.characters(id,name,kind) VALUES('"+merchantI+"','P13 Inventory Source Research Merchant','merchant');"
 +"INSERT INTO public.player_wallets(user_id,gp) VALUES('"+owner.uid+"',40),('"+coeditor.uid+"',20),('"+outsider.uid+"',0);"
 +"INSERT INTO public.character_stock(id,character_id,display_name,item_id,qty,price_gp,card_payload) VALUES"
 +"('"+stockSoloI+"','"+merchantI+"','Plain Source Dagger','p13-dagger',1,5,'{\"item_type\":\"weapon\"}'::jsonb),"
 +"('"+stockFundsI+"','"+merchantI+"','Plain Source Rope','p13-rope',1,5,'{\"item_type\":\"gear\"}'::jsonb),"
 +"('"+stockRaceI+"','"+merchantI+"','Plain Source Lantern','p13-lantern',1,7,'{\"item_type\":\"gear\"}'::jsonb),"
 +"('"+stockCompeteI+"','"+merchantI+"','Plain Source Torch','p13-torch',1,4,'{\"item_type\":\"gear\"}'::jsonb);");
const buyI=(who,stockId,qty=1)=>who.rpc("buy_from_merchant",{
 p_merchant_id:merchantI,p_stock_uuid:stockId,p_qty:qty
});
const itemCount=(stockId)=>Number(sql("SELECT count(*) FROM public.inventory_items WHERE card_payload->>'stock_id'='"+stockId+"'"));
const gpOf=(who)=>Number(sql("SELECT gp FROM public.player_wallets WHERE user_id='"+who.uid+"'"));
const stockQty=(stockId)=>Number(sql("SELECT coalesce((SELECT qty FROM public.character_stock WHERE id='"+stockId+"'),0)"));
const goodI=await buyI(owner.client,stockSoloI);
assert.ifError(goodI.error);
assert.equal(goodI.data,1);
assert.equal(itemCount(stockSoloI),1);
assert.equal(stockQty(stockSoloI),0);
assert.equal(gpOf(owner),35);
assert.equal(sql("SELECT owner_type FROM public.inventory_items WHERE card_payload->>'stock_id'='"+stockSoloI+"'"),"player");
assert.equal(sql("SELECT owner_id FROM public.inventory_items WHERE card_payload->>'stock_id'='"+stockSoloI+"'"),owner.uid);
assert.equal(sql("SELECT user_id FROM public.inventory_items WHERE card_payload->>'stock_id'='"+stockSoloI+"'"),owner.uid);
console.log("PASS F23 signed owner original merchant stock->wallet->I purchase creates actual player-owned item through two installed source BEFORE triggers");
const noAuthI=await buyI(api(),stockFundsI);
assert.ok(noAuthI.error,"Anonymous original merchant purchase was accepted");
const noFundsI=await buyI(outsider.client,stockFundsI);
assert.ok(noFundsI.error,"Zero-wallet buyer was granted inventory");
assert.equal(itemCount(stockFundsI),0);assert.equal(stockQty(stockFundsI),1);
assert.equal(gpOf(outsider),0);
const unauthorizedClientI=await outsider.client.from("inventory_items").insert({
 user_id:outsider.uid,item_id:"free-inventory",item_name:"Direct Forger",
 owner_type:"player",owner_id:outsider.uid
});
assert.ok(unauthorizedClientI.error,"Scratch direct inventory INSERT unexpectedly allowed");
assert.equal(sql("SELECT count(*) FROM public.inventory_items"),"1");
console.log("PASS F24 unsigned/underfunded source purchase and direct client INSERT denied without phantom I, wallet, or stock writes");

const lv4InventoryRace=id(8496);
addLevel4Fighter(lv4InventoryRace,"P13 Level4 Earned GI Concurrent Merchant I");
const playerEarnedPromise=owner.client.rpc("p13_test_level4_advancement_cp_prelock_v1",{
 p_character_id:lv4InventoryRace,p_instance:asiChoice
}).then(x=>x);
assert.ok(await pollMarker(9316,Date.now()+3500),"P13 actual source earned-G CP prelock marker not seen");
const merchantPurchasePromise=buyI(owner.client,stockRaceI).then(x=>x);
const [earnedOutcome,merchantOutcome]=await Promise.all([playerEarnedPromise,merchantPurchasePromise]);
assert.ifError(earnedOutcome.error);
assert.ifError(merchantOutcome.error);
assert.equal(merchantOutcome.data,1);
assert.equal(giCount(lv4InventoryRace),1);
assert.equal(gCount(lv4InventoryRace,asiOption),1);
assert.equal(by(lv4InventoryRace,asiOption,true),owner.uid);
assert.equal(itemCount(stockRaceI),1);assert.equal(stockQty(stockRaceI),0);
assert.equal(gpOf(owner),28);
assert.equal(sql("SELECT class_level FROM public.character_progression WHERE character_id='"+lv4InventoryRace+"'"),"4");
assert.equal(sql("SELECT count(*) FROM public.character_level_events WHERE character_id='"+lv4InventoryRace+"' AND event_type='level_up_completed'"),"1");
console.log("PASS F25 original signed owner earned G+GI in flight alongside source merchant I purchase: both commit, exact wallets/stock/level conserved; no shared character-owned I lock inferred");

const snapshotEarned=sql("SELECT md5(row_to_json(g)::text || '|' || row_to_json(gi)::text) FROM "
 +"public.character_option_grants g JOIN public.character_option_grant_instances gi "
 +"ON gi.character_id=g.character_id AND gi.option_id=g.option_id "
 +"WHERE g.character_id='"+lv4InventoryRace+"' AND g.option_id='"+asiOption+"'");
const buyers=await Promise.all([buyI(owner.client,stockCompeteI).then(x=>x),buyI(coeditor.client,stockCompeteI).then(x=>x)]);
const winner=buyers.filter(x=>!x.error),loser=buyers.filter(x=>x.error);
assert.equal(winner.length,1,"Expected one stock winner: "+JSON.stringify(buyers));
assert.equal(loser.length,1,"Expected one stock loser");
assert.equal(itemCount(stockCompeteI),1);assert.equal(stockQty(stockCompeteI),0);
assert.equal((40-gpOf(owner))+(20-gpOf(coeditor)),16,
 "Total owner/coeditor purchases should have charged 5+7+4 GP");
assert.equal(sql("SELECT md5(row_to_json(g)::text || '|' || row_to_json(gi)::text) FROM "
 +"public.character_option_grants g JOIN public.character_option_grant_instances gi "
 +"ON gi.character_id=g.character_id AND gi.option_id=g.option_id "
 +"WHERE g.character_id='"+lv4InventoryRace+"' AND g.option_id='"+asiOption+"'"),snapshotEarned);
console.log("PASS F26 two signed JWT buyers serialize original merchant stock S->wallet W->I: one winner/one loser, 4GP only once; earned G/GI row hashes unchanged");

const againI=await buyI(owner.client,stockCompeteI);
assert.ok(againI.error,"Repeat against exhausted stock was granted");
const badMulti=await buyI(owner.client,stockFundsI,2);
assert.ok(badMulti.error,"Oversell against one-unit stock succeeded");
assert.equal(itemCount(stockFundsI),0);assert.equal(stockQty(stockFundsI),1);
assert.equal(sql("SELECT count(*) FROM public.inventory_items"),"3");
console.log("PASS F27 source repeat/oversell rejects, no extra inventory or wallet debit and F25 original player-earned grant remains unchanged");

// Opposing live constraints: owner_type='character' is allowed by the newer
// validated check, but the OLD NOT VALID CHECK still rejects new rows.
// In a ROLLED-BACK SCRATCH TRANSACTION ONLY, dropping the old check makes the
// same source-shaped INSERT legal: a causal constraint reproduction.
const oldStill=sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_chk' AND NOT convalidated");
assert.equal(oldStill,"1");
const probeInsert="INSERT INTO public.inventory_items(user_id,item_id,item_name,card_payload,owner_type,owner_id)"
 +" VALUES('"+owner.uid+"','p13-owner-check-control','Forge Character Ownership Control','{}'::jsonb,'character','"+lv4InventoryRace+"');";
const beforeOwnerCount=sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character'");
assert.equal(beforeOwnerCount,"0");
const scratchControl=sql("BEGIN; ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_owner_type_chk;"
 +probeInsert+" SELECT count(*) FROM public.inventory_items WHERE owner_type='character'; ROLLBACK;");
assert.equal(scratchControl.split("\n").filter(Boolean).at(-1),"1",
 "The new validated check should allow character-owned I when old check is dropped *in rolled-back scratch transaction*");
assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE owner_type='character'"),"0");
assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_chk' AND NOT convalidated"),"1");
console.log("PASS F28 old unvalidated owner_type check is the sole reproduced character-owned I INSERT blocker: temporary scratch-only DROP permits INSERT, ROLLBACK fully restores constraints; production NOT touched");
