#!/usr/bin/env node
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {readEldritchSignedInState,assertNoEldritchCombatMutation,
 assertEldritchCommittedOnce} from "./lib/eldritchBlastSignedInAssertions.mjs";
const e=process.env,url=e.DNDNEXT_EB_LOCAL_URL,key=e.DNDNEXT_EB_LOCAL_ANON_KEY;
assert.ok(e.GITHUB_ACTIONS==="true"&&e.CI==="true"&&
 e.DNDNEXT_EB_LOCAL_CI_CONFIRM==="CI_DISPOSABLE_LOCAL_ONLY"&&
 e.PGPORT==="54322"&&e.PGDATABASE==="postgres"&&
 (e.PGHOST==="127.0.0.1"||e.PGHOST==="localhost"),"Not a local CI environment");
assert.ok(/^http:\/\/(?:localhost|127\.0\.0\.1):54321\/?$/.test(url||"")&&key,"Remote API forbidden");
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
function db(q){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",q],
  {encoding:"utf8",env:{...e,PGUSER:"postgres"}});
 if(r.status!==0)throw Error("Local database fixture command failed: "+r.stderr);
 return r.stdout.trim();
}
const clients=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
const users=[],password="Disposable-"+randomUUID()+"!X9";
try{
 for(const client of clients){
  const email="eb-test-"+randomUUID()+"@example.invalid";
  const signup=await client.auth.signUp({email,password});assert.ifError(signup.error);
  const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
  assert.ok(login.data.session?.access_token);
  const u=await client.auth.getUser();assert.ifError(u.error);
  assert.equal(u.data.user.id,login.data.user.id);
  const jwt=await client.auth.getClaims();assert.ifError(jwt.error);
  assert.equal(jwt.data.claims.sub,login.data.user.id);
  assert.equal(jwt.data.claims.role,"authenticated");
  assert.notEqual(jwt.data.claims.is_anonymous,true);
  users.push({client,uid:login.data.user.id});
 }
 const [a,b]=users;assert.notEqual(a.uid,b.uid);
 db("update public.encounter_participants set controller_user_id='"+a.uid+"' where id=public.fixture_uuid(11)");
 db("update public.encounter_participants set controller_user_id='"+b.uid+"' where id=public.fixture_uuid(21)");
 const identity=await a.client.rpc("eb_ci_identity_v1");assert.ifError(identity.error);
 assert.equal(identity.data.uid,a.uid);assert.equal(identity.data.role,"authenticated");
 const actor=id(11),target=id(21),assignment=id(51),encounter=id(1),rid=randomUUID();
 const req=uuid=>({p_caster_id:actor,p_assignment_id:assignment,p_target_ids:[target],p_request_id:uuid});
 const ctx={encounterId:encounter,actorId:actor,targets:[target],requestId:rid};
 const before=await readEldritchSignedInState(a.client,ctx);assert.equal(before.logs.length,0);
 const forbidden=await b.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(randomUUID()));
 assert.equal(forbidden.error?.code,"42501","Other user's cast not denied");
 assertNoEldritchCombatMutation(before,await readEldritchSignedInState(a.client,ctx),"Foreign player");
 const cast=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(rid));
 assert.ifError(cast.error);
 const after=await readEldritchSignedInState(a.client,ctx);
 assertEldritchCommittedOnce(before,after,cast.data,[target],rid);
 const again=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(rid));
 assert.ifError(again.error);assert.deepEqual(again.data,cast.data);
 assertNoEldritchCombatMutation(after,await readEldritchSignedInState(a.client,ctx),"Replay");
 const foreign=await b.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(rid));
 assert.equal(foreign.error?.code,"42501");
 const altered=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",
  {...req(rid),p_target_ids:[id(22)]});
 assert.equal(altered.error?.code,"42501");
 assertNoEldritchCombatMutation(after,await readEldritchSignedInState(a.client,ctx),"Wrong intent");
 assert.equal(Number(db("select count(*) from public.encounter_command_requests where request_id='"+rid+"'")),1);
 // A real revocation round trip with an unchanged signed JWT:
 // grant editor -> successful cast -> revoke -> immediate denial.
 db("insert into public.character_permissions(character_id,user_id,can_edit) values("+
  "public.fixture_uuid(31),'"+b.uid+"',true)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 const editorId=randomUUID(),editorCtx={...ctx,requestId:editorId};
 const beforeEditor=await readEldritchSignedInState(a.client,editorCtx);
 const editorCast=await b.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(editorId));
 assert.ifError(editorCast.error);
 const afterEditor=await readEldritchSignedInState(a.client,editorCtx);
 assertEldritchCommittedOnce(beforeEditor,afterEditor,editorCast.data,[target],editorId);
 assert.equal(Number(db("select count(*) from public.encounter_command_requests where request_id='"+
  editorId+"' and requested_by='"+b.uid+"'")),1,"Editor command ledger identity mismatch");
 db("delete from public.character_permissions where character_id=public.fixture_uuid(31) and user_id='"+
  b.uid+"'");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 const revokedId=randomUUID(),revokedCtx={...ctx,requestId:revokedId};
 const beforeRevoked=await readEldritchSignedInState(a.client,revokedCtx);
 const stillSignedIn=await b.client.auth.getUser();
 assert.ifError(stillSignedIn.error);
 assert.equal(stillSignedIn.data.user.id,b.uid,"Revocation test changed the JWT session");
 const revoked=await b.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(revokedId));
 assert.equal(revoked.error?.code,"42501","Revoked editor still allowed a new cast");
 assertNoEldritchCombatMutation(beforeRevoked,
  await readEldritchSignedInState(a.client,revokedCtx),"Revoked permission");
 assert.equal(Number(db("select count(*) from public.encounter_command_requests where request_id='"+
  revokedId+"'")),0,"Revoked editor inserted a command");
 const oldEditorReplay=await b.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(editorId));
 assert.equal(oldEditorReplay.error?.code,"42501","Revoked editor could replay prior command");
 console.log("PASS real JWT permission grant -> authorized editor cast -> revocation -> unchanged JWT denied, no unauthorized state/ledger mutation");
 // Real LIVE damage resolver against synthetic equipment in the LOCAL DB:
 // Resistance -> max flat reduction -> vulnerability -> temporary HP.
 db("insert into public.items_catalog(item_key,item_name,payload) values("+
  "'eb-ci-force-ward','CI Force Ward','{}'::jsonb)");
 db("insert into public.inventory_items(id,item_id,item_name,owner_type,owner_id,is_equipped,card_payload) "+
  "values(public.fixture_uuid(900),'eb-ci-force-ward','CI Force Ward','character',"+
  "public.fixture_uuid(32)::text,true,'{\"resist\":[\"force\"],"+
  "\"damageReductionByType\":{\"force\":3}}'::jsonb)");
 db("update public.character_progression set class_level=5 where character_id=public.fixture_uuid(31)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 db("update public.encounter_participants set current_hp=200,temp_hp=4,is_defeated=false,"+
  "damage_resistances='{}'::text[],damage_immunities='{}'::text[],"+
  "damage_vulnerabilities=array['force'] where id=public.fixture_uuid(21)");
 db("insert into public.fixture_rolls(roll) values(20),(15)");
 const wardId=randomUUID(),wardTargets=[target,target];
 const wardCtx={...ctx,requestId:wardId};
 const wardBefore=await readEldritchSignedInState(a.client,wardCtx);
 const wardResult=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",{
  ...req(wardId),p_target_ids:wardTargets});
 assert.ifError(wardResult.error);
 const wardAfter=await readEldritchSignedInState(a.client,wardCtx);
 assertEldritchCommittedOnce(wardBefore,wardAfter,wardResult.data,wardTargets,wardId);
 assert.equal(wardResult.data.beams.length,2);
 for(const beam of wardResult.data.beams){
  assert.equal(beam.hit,true,"Forced critical/regular beam must hit");
  const damage=beam.damage,raw=beam.rawDamage;
  assert.ok(Number.isInteger(raw)&&raw>=0);
  assert.equal(damage.damageAfterResistance,Math.floor(raw/2));
  assert.equal(damage.equipmentResistance,true);
  assert.equal(damage.resistant,true);
  assert.equal(damage.flatReductionAvailable,3);
  assert.equal(damage.flatReductionApplied,Math.min(3,Math.floor(raw/2)));
  assert.equal(damage.damageAfterFlatReduction,Math.max(0,Math.floor(raw/2)-3));
  assert.equal(damage.vulnerable,true);
  assert.equal(damage.damage,Math.max(0,Math.floor(raw/2)-3)*2,
   "Force vulnerability must apply AFTER equipment reduction");
  assert.deepEqual(damage.mitigationSources,["CI Force Ward"]);
 }
 const wardReplay=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",{
  ...req(wardId),p_target_ids:wardTargets});
 assert.ifError(wardReplay.error);
 assert.deepEqual(wardReplay.data,wardResult.data);
 assertNoEldritchCombatMutation(wardAfter,
  await readEldritchSignedInState(a.client,wardCtx),"Equipment-reduced beam replay");
 // Immunity overrides ALL other affinities and cannot consume temporary HP.
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 db("update public.encounter_participants set current_hp=200,temp_hp=4,is_defeated=false,"+
  "damage_immunities=array['force'] where id=public.fixture_uuid(21)");
 db("insert into public.fixture_rolls(roll) values(20),(15)");
 const immuneId=randomUUID(),immuneTargets=[target,target];
 const immuneCtx={...ctx,requestId:immuneId};
 const immuneBefore=await readEldritchSignedInState(a.client,immuneCtx);
 const immuneCast=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",{
  ...req(immuneId),p_target_ids:immuneTargets});
 assert.ifError(immuneCast.error);
 const immuneAfter=await readEldritchSignedInState(a.client,immuneCtx);
 assertEldritchCommittedOnce(immuneBefore,immuneAfter,immuneCast.data,immuneTargets,immuneId);
 assert.deepEqual(immuneAfter.targetState,immuneBefore.targetState,
  "Force immunity must preserve HP and temp HP");
 for(const beam of immuneCast.data.beams){
  assert.equal(beam.hit,true);
  assert.equal(beam.damage.immune,true);
  assert.equal(beam.damage.damage,0);
  assert.equal(beam.damage.targetTempHp,4);
 }
 console.log("PASS real JWT two-beam repeated targets against LIVE damage SQL: equipment resistance, flat reduction, vulnerability, temporary HP, replay, immunity");
 // Switch ONLY the isolated local DB from deterministic mock dice/LOS to
 // frozen live attack-roll, hex-line, cover, targeting and hostility functions.
 const activation=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",
  "scripts/fixtures/eldritch_blast_activate_targeting_pg17.sql"],
  {encoding:"utf8",env:{...e,PGUSER:"postgres"}});
 assert.equal(activation.status,0,"Live targeting fixture failed: "+activation.stderr);
 db("update public.character_progression set class_level=3 where character_id=public.fixture_uuid(31)");
 db("update public.inventory_items set is_equipped=false where item_id='eb-ci-force-ward'");
 db("update public.encounter_participants set current_hp=200,temp_hp=0,is_defeated=false,"+
  "damage_immunities='{}'::text[],damage_vulnerabilities='{}'::text[] "+
  "where id=public.fixture_uuid(21)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 db("update public.encounter_participants set q=4,r=0 where id=public.fixture_uuid(21)");
 db("update public.encounter_participants set q=1,r=0 where id=public.fixture_uuid(22)");
 db("insert into public.encounter_map_objects(id,map_id,object_type,q,r,cover_level) "+
  "values(public.fixture_uuid(1001),public.fixture_uuid(81),'cover_wall',4,0,'half')");
 db("insert into public.encounter_timed_effects"+
  "(id,encounter_id,participant_id,source_participant_id,effect_key) values "+
  "(public.fixture_uuid(1301),public.fixture_uuid(1),public.fixture_uuid(21),"+
  "public.fixture_uuid(11),'guiding_bolt_next_attack_advantage'),"+
  "(public.fixture_uuid(1302),public.fixture_uuid(1),public.fixture_uuid(11),"+
  "public.fixture_uuid(11),'vicious_mockery_next_attack_disadvantage')");
 const bothId=randomUUID(),bothCtx={...ctx,requestId:bothId};
 const beforeBoth=await readEldritchSignedInState(a.client,bothCtx);
 const both=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(bothId));
 assert.ifError(both.error);
 const afterBoth=await readEldritchSignedInState(a.client,bothCtx);
 assertEldritchCommittedOnce(beforeBoth,afterBoth,both.data,[target],bothId);
 const br=both.data.beams[0],roll=br.attackRoll;
 assert.equal(br.targeting.coverAcBonus,2);
 assert.equal(br.targetAc,16);
 assert.equal(roll.baseDisadvantage,true,"Adjacent enemy can see caster");
 assert.equal(roll.guidingBoltAdvantage,true);
 assert.equal(roll.viciousMockeryDisadvantage,true);
 assert.equal(roll.advantageCanceledByDisadvantage,true);
 assert.equal(roll.advantage,false);assert.equal(roll.disadvantage,false);
 assert.equal(roll.secondRoll,null);
 assert.equal(roll.roll,roll.firstRoll);
 assert.equal(roll.guidingBoltEffectConsumed,true);
 assert.equal(roll.viciousMockeryEffectConsumed,true);
 assert.equal(Number(db("select count(*) from public.encounter_timed_effects where id in "+
  "(public.fixture_uuid(1301),public.fixture_uuid(1302))")),0);
 assert.equal(Number(db("select count(*) from public.encounter_combat_log "+
  "where event_type='effect_consumed'")),2);
 const replayBoth=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(bothId));
 assert.ifError(replayBoth.error);assert.deepEqual(replayBoth.data,both.data);
 assert.equal(Number(db("select count(*) from public.encounter_combat_log "+
  "where event_type='effect_consumed'")),2,"Replay consumed effects twice");
 // Advantage-only must choose the higher of two independently rolled d20s.
 db("update public.encounter_participants set q=5 where id=public.fixture_uuid(22)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 db("insert into public.encounter_timed_effects"+
  "(id,encounter_id,participant_id,source_participant_id,effect_key) values "+
  "(public.fixture_uuid(1303),public.fixture_uuid(1),public.fixture_uuid(21),"+
  "public.fixture_uuid(11),'guiding_bolt_next_attack_advantage')");
 const onlyAdv=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(randomUUID()));
 assert.ifError(onlyAdv.error);
 const ar=onlyAdv.data.beams[0].attackRoll;
 assert.equal(ar.baseDisadvantage,false);
 assert.equal(ar.advantage,true);assert.equal(ar.disadvantage,false);
 assert.ok(Number.isInteger(ar.secondRoll));
 assert.equal(ar.roll,Math.max(ar.firstRoll,ar.secondRoll));
 // Visible nearby enemy with no Advantage imposes Disadvantage: min(d20,d20).
 db("update public.encounter_participants set q=1 where id=public.fixture_uuid(22)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 const onlyDis=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(randomUUID()));
 assert.ifError(onlyDis.error);
 const dr=onlyDis.data.beams[0].attackRoll;
 assert.equal(dr.baseDisadvantage,true);
 assert.equal(dr.disadvantage,true);assert.equal(dr.advantage,false);
 assert.ok(Number.isInteger(dr.secondRoll));
 assert.equal(dr.roll,Math.min(dr.firstRoll,dr.secondRoll));
 // Directionality: an obstacle at the caster's own hex blocks enemy->caster
 // but not caster->target, because the latter skips its first hex.
 db("insert into public.encounter_map_objects(id,map_id,object_type,q,r,cover_level,blocks_los) "+
  "values(public.fixture_uuid(1002),public.fixture_uuid(81),'screen',0,0,'total',true)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 const cantSee=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(randomUUID()));
 assert.ifError(cantSee.error);
 assert.equal(cantSee.data.beams[0].attackRoll.baseDisadvantage,false,
  "Enemy who cannot see caster should not impose ranged disadvantage");
 db("delete from public.encounter_map_objects where id=public.fixture_uuid(1002)");
 // Three-quarter cover adds +5 AC, including against spell attacks.
 db("update public.encounter_map_objects set cover_level='three_quarters' "+
  "where id=public.fixture_uuid(1001)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 const cover3=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(randomUUID()));
 assert.ifError(cover3.error);
 assert.equal(cover3.data.beams[0].targeting.coverAcBonus,5);
 assert.equal(cover3.data.beams[0].targetAc,19);
 // Total cover rejects the command atomically, including request ledger.
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 db("insert into public.encounter_map_objects(id,map_id,object_type,q,r,cover_level,blocks_los) "+
  "values(public.fixture_uuid(1003),public.fixture_uuid(81),'solid_wall',2,0,'total',true)");
 const deniedId=randomUUID(),deniedCtx={...ctx,requestId:deniedId};
 const beforeWall=await readEldritchSignedInState(a.client,deniedCtx);
 const wall=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(deniedId));
 assert.ok(wall.error,"Total cover must reject a cast");
 assertNoEldritchCombatMutation(beforeWall,
  await readEldritchSignedInState(a.client,deniedCtx),"Total-cover rollback");
 assert.equal(Number(db("select count(*) from public.encounter_command_requests "+
  "where request_id='"+deniedId+"'")),0,"Total-cover denial wrote a command");
 console.log("PASS real JWT live LOS/cover/attack-roll parity: half/+2, three-quarter/+5, Guiding Bolt and Vicious Mockery effect consumption, Advantage/Disadvantage, directional nearby enemy, total-cover atomic rollback");
 // Load exact deployed character ability / spellcasting profile / controller
 // functions against minimal local canonical class + sheet fixtures.
 const profileLoad=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",
  "scripts/fixtures/eldritch_blast_activate_profile_pg17.sql"],
  {encoding:"utf8",env:{...e,PGUSER:"postgres"}});
 assert.equal(profileLoad.status,0,
  "Real local spellcasting profile fixture failed: "+profileLoad.stderr);
 // SQL schema changes occur after PostgREST starts: refresh its RPC cache.
 db("notify pgrst, 'reload schema'");
 await new Promise(resolve=>setTimeout(resolve,1200));
 const noSession=createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const unsignedProfile=await noSession.rpc("encounter_spellcasting_profile_v1",{
  p_participant_id:actor});
 assert.ok(unsignedProfile.error,"Anonymous profile RPC should be inaccessible");
 const profileB=await b.client.rpc("encounter_spellcasting_profile_v1",{
  p_participant_id:actor});
 assert.ok(profileB.error,"Foreign player read a Warlock spellcasting profile");
 const profileA=await a.client.rpc("encounter_spellcasting_profile_v1",{
  p_participant_id:actor});
 assert.ifError(profileA.error);
 const firstProfile=profileA.data;
 assert.equal(firstProfile.classKey,"warlock|XPHB");
 assert.equal(firstProfile.className,"Warlock");
 assert.equal(firstProfile.classSource,"XPHB");
 assert.equal(firstProfile.ruleset,"2024");
 assert.equal(firstProfile.classLevel,3);
 assert.equal(firstProfile.castingAbility,"cha");
 assert.equal(firstProfile.castingAbilityScore,20);
 assert.equal(firstProfile.castingAbilityModifier,5);
 assert.equal(firstProfile.proficiencyBonus,2);
 assert.equal(firstProfile.spellAttackBonus,7);
 assert.equal(firstProfile.spellSaveDc,15);
 assert.ok(firstProfile.knownSpells.some(s=>s.assignmentId===assignment
  && s.spellKey.toLowerCase()==="eldritch-blast|xphb"
  && s.sourceType==="class" && s.sourceLabel==="warlock"));
 assert.equal(firstProfile.slotSnapshot[0].remaining,1);
 assert.equal(firstProfile.knownSpells.find(s=>s.assignmentId===assignment)?.known,true);
 db("update public.character_spells set known=false where id=public.fixture_uuid(51)");
 const unlearned=await a.client.rpc("encounter_spellcasting_profile_v1",{p_participant_id:actor});
 assert.ifError(unlearned.error);
 assert.equal(unlearned.data.knownSpells.find(s=>s.assignmentId===assignment)?.known,false);
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 const unknownId=randomUUID(),unknownContext={...ctx,requestId:unknownId};
 const beforeUnknown=await readEldritchSignedInState(a.client,unknownContext);
 const deniedUnknown=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",req(unknownId));
 assert.ok(deniedUnknown.error,"Unlearned cantrip must be rejected");
 assertNoEldritchCombatMutation(beforeUnknown,
  await readEldritchSignedInState(a.client,unknownContext),"Unknown spell rejection");
 assert.equal(Number(db("select count(*) from public.encounter_command_requests where request_id='"+
  unknownId+"'")),0);
 db("update public.character_spells set known=true where id=public.fixture_uuid(51)");

 // A DB editor grant must allow profile access with same JWT, and a revoke
 // must immediately remove it even though the existing token remains valid.
 db("insert into public.character_permissions(character_id,user_id,can_edit) values("+
  "public.fixture_uuid(31),'"+b.uid+"',true)");
 const editorProfile=await b.client.rpc("encounter_spellcasting_profile_v1",{
  p_participant_id:actor});
 assert.ifError(editorProfile.error);
 assert.equal(editorProfile.data.spellAttackBonus,7);
 db("delete from public.character_permissions where character_id=public.fixture_uuid(31)"+
  " and user_id='"+b.uid+"'");
 const revokedProfile=await b.client.rpc("encounter_spellcasting_profile_v1",{
  p_participant_id:actor});
 assert.ok(revokedProfile.error,"Revoked editor still read spellcasting profile");
 // Cast through REAL canonical profile, CHA score and class-level bonus.
 db("delete from public.encounter_map_objects");
 db("update public.encounter_participants set q=5 where id=public.fixture_uuid(22)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 const canonicalId=randomUUID(),canonicalCtx={...ctx,requestId:canonicalId};
 const canonicalBefore=await readEldritchSignedInState(a.client,canonicalCtx);
 const canonical=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",{
  ...req(canonicalId)});
 assert.ifError(canonical.error);
 const canonicalAfter=await readEldritchSignedInState(a.client,canonicalCtx);
 assertEldritchCommittedOnce(canonicalBefore,canonicalAfter,canonical.data,[target],canonicalId);
 assert.equal(canonical.data.castingAbilityModifier,5);
 assert.equal(canonical.data.beams[0].attackBonus,7);
 assert.equal(canonical.data.agonizingBlastBoundToEldritchBlast,true);
 assert.equal(canonical.data.damageFeatures.damageModifier,5);
 if(canonical.data.beams[0].hit){
  assert.equal(canonical.data.beams[0].agonizingBlastDamageModifier,5);
 }
 // Exercise real score recalculation and Warlock level-5 proficiency + beams.
 db("update public.character_sheets set sheet='"+
  '{"abilities":{"cha":{"score":14}},"proficiencyBonus":2}'+
  "'::jsonb where character_id=public.fixture_uuid(31)");
 db("update public.character_progression set class_level=5 where character_id=public.fixture_uuid(31)");
 db("update public.encounter_participants set action_available=true where id=public.fixture_uuid(11)");
 const higherProfile=await a.client.rpc("encounter_spellcasting_profile_v1",{
  p_participant_id:actor});
 assert.ifError(higherProfile.error);
 assert.equal(higherProfile.data.classLevel,5);
 assert.equal(higherProfile.data.castingAbilityScore,14);
 assert.equal(higherProfile.data.castingAbilityModifier,2);
 assert.equal(higherProfile.data.proficiencyBonus,3);
 assert.equal(higherProfile.data.spellAttackBonus,5);
 assert.equal(higherProfile.data.spellSaveDc,13);
 const level5Id=randomUUID(),level5Targets=[target,target];
 const level5Ctx={...ctx,requestId:level5Id};
 const level5Before=await readEldritchSignedInState(a.client,level5Ctx);
 const level5=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",{
  ...req(level5Id),p_target_ids:level5Targets});
 assert.ifError(level5.error);
 const level5After=await readEldritchSignedInState(a.client,level5Ctx);
 assertEldritchCommittedOnce(level5Before,level5After,level5.data,level5Targets,level5Id);
 assert.equal(level5.data.castingAbilityModifier,2);
 assert.equal(level5.data.beamCount,2);
 assert.equal(level5.data.damageFeatures.damageModifier,2);
 assert.equal(level5.data.agonizingBlastBoundToEldritchBlast,true);
 for(const beam of level5.data.beams){
  assert.equal(beam.attackBonus,5);
  if(beam.hit)assert.equal(beam.agonizingBlastDamageModifier,2);
 }
 const again5=await a.client.rpc("encounter_cast_eldritch_blast_candidate_v1",{
  ...req(level5Id),p_target_ids:level5Targets});
 assert.ifError(again5.error);
 assert.deepEqual(again5.data,level5.data);
 assertNoEldritchCombatMutation(level5After,
  await readEldritchSignedInState(a.client,level5Ctx),"Canonical profile replay");
 console.log("PASS real JWT LIVE spellcasting profile: class/score/proficiency, spells/slots, CHA and invocation recomputation, level-5 beams, forbidden anonymous/foreign/revoked profile access");
 console.log("PASS real Supabase JWTs, signed-in RLS, unauthorized user, exactly one action/version/HP/log/ledger write, replay/intent denial");
}finally{await Promise.allSettled(clients.map(x=>x.auth.signOut()));}
