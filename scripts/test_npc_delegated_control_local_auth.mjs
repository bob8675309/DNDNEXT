#!/usr/bin/env node
// REAL local GoTrue-issued JWTs, real PostgREST, held candidate SQL.
// CI-only disposable Supabase CLI stack; NEVER a live DnDWeb project.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
const env=process.env, url=env.DNDNEXT_NPC_LOCAL_URL, key=env.DNDNEXT_NPC_LOCAL_ANON_KEY;
assert.ok(env.GITHUB_ACTIONS==="true"&&env.CI==="true"&&
 env.DNDNEXT_NPC_LOCAL_CI_CONFIRM==="CI_DISPOSABLE_NPC_GOTRUE_ONLY"&&
 env.PGHOST==="127.0.0.1"&&env.PGPORT==="54322"&&env.PGDATABASE==="postgres",
 "Refusing non-CI/local PostgreSQL");
assert.ok(/^http:\/\/127\.0\.0\.1:54321\/?$/.test(url||"")&&key,
 "Refusing non-local Supabase GoTrue");
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
function db(sql){
 const result=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",sql],
  {encoding:"utf8",env:{...env,PGUSER:"postgres"}});
 if(result.status!==0)throw Error("Local-only fixture database command failed: "+result.stderr);
 return result.stdout.trim();
}
const users=[],password="LocalNpc-"+randomUUID()+"X9!";
try{
 for(const label of ["Admin","A","B"]){
  const client=createClient(url,key,{auth:{
   persistSession:false,autoRefreshToken:false,detectSessionInUrl:false
  }});
  const email="npc-local-"+randomUUID()+"@example.invalid";
  const signup=await client.auth.signUp({email,password});assert.ifError(signup.error);
  const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
  const u=await client.auth.getUser();assert.ifError(u.error);
  const jwt=await client.auth.getClaims();assert.ifError(jwt.error);
  assert.equal(u.data.user.id,login.data.user.id);
  assert.equal(jwt.data.claims.sub,u.data.user.id);
  assert.equal(jwt.data.claims.role,"authenticated");
  assert.notEqual(u.data.user.is_anonymous,true);
  assert.notEqual(jwt.data.claims.is_anonymous,true);
  users.push({client,uid:u.data.user.id,label});
 }
 const [admin,a,b]=users;
 assert.equal(new Set(users.map(x=>x.uid)).size,3);
 db("insert into public.p2_local_npc_admins(user_id) values('"+admin.uid+"')");
 db("update public.encounter_participants set controller_user_id='"+
    a.uid+"' where id=public.p2_id(11)");
 db("notify pgrst, 'reload schema'");
 await new Promise(resolve=>setTimeout(resolve,1300));
 const actor=id(33),own=id(11),npc=id(32),target=id(21),assignment=id(58);
 const resultAdmin=await admin.client.rpc("is_admin");
 const resultA=await a.client.rpc("is_admin");
 const resultB=await b.client.rpc("is_admin");
 for(const r of [resultAdmin,resultA,resultB])assert.ifError(r.error);
 assert.equal(resultAdmin.data,true);
 assert.equal(resultA.data,false);
 assert.equal(resultB.data,false);
 for(const player of [a,b]){
  const before=await player.client.rpc("encounter_can_control_participant_v1",
   {p_participant_id:actor});
  assert.ifError(before.error);assert.equal(before.data,false);
  const hidden=await player.client.from("encounter_participants")
   .select("id").eq("id",actor);
  assert.ifError(hidden.error);assert.deepEqual(hidden.data,[]);
  for(const allow of [true,false]){
   const tryAdmin=await player.client.rpc("admin_set_npc_control_v1",{
    p_character_id:npc,p_user_id:player.uid,p_can_control:allow});
   assert.equal(tryAdmin.error?.code,"42501",
    "Non-admin must never change a delegated NPC grant");
  }
 }
 // The protected profile must fail before a control grant.
 for(const player of [a,b]){
  const blocked=await player.client.rpc("encounter_spellcasting_profile_v1",{
   p_participant_id:actor
  });
  assert.ok(blocked.error,"Unassigned player read a hidden NPC spell profile");
 }
 const gmProfile=await admin.client.rpc("encounter_spellcasting_profile_v1",{
  p_participant_id:actor
 });
 assert.ifError(gmProfile.error);
 assert.equal(gmProfile.data.visibilityScope,undefined);
 assert.equal(gmProfile.data.knownSpells.length,5);
 assert.ok(gmProfile.data.knownSpells.some(x=>x.spellKey==="secret-ritual|XPHB"));
 assert.ok(gmProfile.data.knownSpells.some(x=>x.spellKey==="unlearned-ritual|XPHB"),
  "Legacy Admin profile includes unknown spell assignments");
 const ownProfile=await a.client.rpc("encounter_spellcasting_profile_v1",{
  p_participant_id:own
 });
 assert.ifError(ownProfile.error);
 assert.equal(ownProfile.data.visibilityScope,undefined);
 assert.equal(ownProfile.data.knownSpells.length,4,
  "Legacy direct-controller PC must retain its full spell profile");
 async function assertDelegatedProfile(player,allowed){
  const r=await player.client.rpc("encounter_spellcasting_profile_v1",{
   p_participant_id:actor
  });
  if(!allowed){
   assert.ok(r.error,"Revoked/unassigned player received tactical spell data");
   return;
  }
  assert.ifError(r.error);
  const profile=r.data;
  assert.equal(profile.visibilityScope,"delegated-combat");
  assert.equal(profile.spellListFiltered,true);
  for(const key of ["characterId","classId","classKey","classSource",
   "canonicalSlotProgression","preparedSpellsFormula","casterProgression"]){
   assert.equal(Object.hasOwn(profile,key),false,"Leaked extra metadata "+key);
  }
  assert.equal(profile.classLevel,5);
  assert.equal(profile.className,"Wizard");
  assert.equal(profile.spellAttackBonus,6);
  assert.equal(profile.spellSaveDc,14);
  assert.equal(profile.slotSnapshot.length,1);
  assert.deepEqual(Object.keys(profile.slotSnapshot[0]).sort(),
   ["max","poolKey","remaining","slotLevel"]);
  assert.deepEqual(new Set(profile.knownSpells.map(x=>x.spellKey)),
   new Set(["fire-bolt|XPHB","shield|XPHB","light|XPHB"]));
  assert.ok(profile.knownSpells.every(x=>x.known===true));
  assert.ok(!JSON.stringify(profile).includes("GM Secret Ritual"));
  assert.ok(!JSON.stringify(profile).includes("GM Unknown Ritual"));
  assert.ok(!profile.knownSpells.some(x=>x.spellKey==="unlearned-ritual|XPHB"),
   "Delegated profile leaked unknown assignment");
  assert.ok(!JSON.stringify(profile).includes("sourceBook"));
 }
 const ownRight=await a.client.rpc("encounter_can_control_participant_v1",
  {p_participant_id:own});assert.ifError(ownRight.error);
 assert.equal(ownRight.data,true,"Player retained own PC control");
 const unauthorized=await a.client.rpc("p2_local_npc_cast",{
  p_caster_id:actor,p_assignment_id:assignment,
  p_target_id:target,p_slot_level:null,p_request_id:randomUUID()});
 assert.equal(unauthorized.error?.code,"42501","Unassigned NPC cast accepted");
 async function assertNoHiddenSourceDisclosure(player){
  // The source character is *not* a granted sheet/inventory identity.
  // A combat token is necessary; full spell rows and GM sheet JSON are not.
  for(const permission of ["read","edit","inventory","convert"]){
    const checked=await player.client.rpc("p2_local_can_access_character",{
      p_character_id:npc,p_permission:permission
    });
    assert.ifError(checked.error);
    assert.equal(checked.data,false,
      "Delegated combat controller gained source "+permission+" rights");
  }
  for(const [table,filter,field] of [
    ["characters","id","id"],
    ["character_sheets","character_id","sheet"],
    ["character_spells","character_id","id"],
    ["inventory_items","id","item_name"]
  ]){
    const rowId=table==="inventory_items"?id(1998):npc;
    const checked=await player.client.from(table).select(field).eq(filter,rowId);
    // The production characters table lacks authenticated SELECT privilege;
    // its dependent sheet/spell policy may therefore produce 42501.
    if(checked.error){
      assert.equal(checked.error.code,"42501",
        table+" failed for a reason other than expected SQL permission denial");
    }else{
      assert.deepEqual(checked.data,[],
        "Delegated combat control exposed source "+table+" record");
    }
  }
 }
 const adminSheet=await admin.client.rpc("p2_local_can_access_character",{
   p_character_id:npc,p_permission:"read"
 });
 assert.ifError(adminSheet.error);
 assert.equal(adminSheet.data,true,"Local Admin must retain sheet access");
 await assertNoHiddenSourceDisclosure(a);
 await assertNoHiddenSourceDisclosure(b);
 async function setGrant(player,allow){
  const response=await admin.client.rpc("admin_set_npc_control_v1",{
   p_character_id:npc,p_user_id:player.uid,p_can_control:allow});
  assert.ifError(response.error);
  assert.equal(response.data.userId,player.uid);
  assert.equal(response.data.canControl,allow);
  assert.equal(response.data.canEdit,false);
 }
 async function verify(player,allowed){
  const [control,visible]=await Promise.all([
   player.client.rpc("encounter_can_control_participant_v1",
    {p_participant_id:actor}),
   player.client.from("encounter_participants").select("id").eq("id",actor)
  ]);
  assert.ifError(control.error);assert.ifError(visible.error);
  assert.equal(control.data,allowed);
  assert.equal(visible.data.length,allowed?1:0);
 }
 await setGrant(a,true);
 await Promise.all([verify(a,true),verify(b,false)]);
 await Promise.all([assertDelegatedProfile(a,true),assertDelegatedProfile(b,false)]);
 await setGrant(b,true);
 await Promise.all([verify(a,true),verify(b,true)]);
 await Promise.all([assertDelegatedProfile(a,true),assertDelegatedProfile(b,true)]);
 await Promise.all([assertNoHiddenSourceDisclosure(a),assertNoHiddenSourceDisclosure(b)]);
 const versionBefore=Number(db("select version from public.encounters where id=public.p2_id(81)"));
 const requests=[randomUUID(),randomUUID()];
 const cast=p=>p.player.client.rpc("p2_local_npc_cast",{
  p_caster_id:actor,p_assignment_id:assignment,p_target_id:target,
  p_slot_level:null,p_request_id:p.request});
 const [first,second]=await Promise.all([
  cast({player:a,request:requests[0]}),
  cast({player:b,request:requests[1]})
 ]);
 const winnerIndex=first.error?1:0;
 const successes=[first,second].filter(x=>!x.error);
 const failures=[first,second].filter(x=>x.error);
 assert.equal(successes.length,1,"Two signed-in controllers spent the same Action");
 assert.equal(failures.length,1);
 assert.match(failures[0].error.message,/Action already spent/);
 const winner=winnerIndex===0?a:b;
 const loser=winnerIndex===0?b:a;
 const winnerRequest=requests[winnerIndex];
 assert.equal(successes[0].data.spellKey,"fire-bolt|XPHB");
 assert.equal(Number(db("select count(*) from public.encounter_command_requests "+
  "where request_id in ('"+requests[0]+"','"+requests[1]+"')")),1);
 assert.equal(Number(db("select count(*) from public.encounter_combat_log "+
  "where event_type='spell_cast'")),1);
 assert.equal(Number(db("select version from public.encounters where id=public.p2_id(81)")),
  versionBefore+1);
 assert.equal(db("select action_available from public.encounter_participants "+
  "where id=public.p2_id(33)"),"f");
 assert.equal(db("select requested_by from public.encounter_command_requests "+
  "where request_id='"+winnerRequest+"'"),winner.uid);
 const exact=await cast({player:winner,request:winnerRequest});
 assert.ifError(exact.error);assert.deepEqual(exact.data,successes[0].data);
 const steal=await cast({player:loser,request:winnerRequest});
 assert.equal(steal.error?.code,"42501","Foreign signed-in controller saw cached result");
 await setGrant(winner,false);
 await Promise.all([verify(winner,false),verify(loser,true)]);
 await Promise.all([assertNoHiddenSourceDisclosure(winner),assertNoHiddenSourceDisclosure(loser)]);
 await Promise.all([assertDelegatedProfile(winner,false),assertDelegatedProfile(loser,true)]);
 const stillSigned=await winner.client.auth.getUser();
 assert.ifError(stillSigned.error);assert.equal(stillSigned.data.user.id,winner.uid);
 const revoked=await cast({player:winner,request:winnerRequest});
 assert.equal(revoked.error?.code,"42501","Revoked JWT can replay prior result");
 const regrant=await winner.client.rpc("admin_set_npc_control_v1",{
  p_character_id:npc,p_user_id:winner.uid,p_can_control:true});
 assert.equal(regrant.error?.code,"42501");
 assert.equal(Number(db("select count(*) from public.encounter_combat_log "+
  "where event_type='spell_cast'")),1,"Denials added combat events");
 assert.equal(Number(db("select version from public.encounters where id=public.p2_id(81)")),
  versionBefore+1,"Denials changed encounter version");
 console.log("PASS LOCAL REAL GoTrue: delegated spell projection (PC/Admin full parity), source confidentiality, two-player single-Action race, replay isolation and revoked JWT denied");
}finally{
 await Promise.allSettled(users.map(x=>x.client.auth.signOut()));
}
