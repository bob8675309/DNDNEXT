#!/usr/bin/env node
// DnDNext P1.3: source-policy RLS, real Admin grant revocation and
// modeled active controller reassignment versus guarded equipped reaction.
// All identities/SQL are GitHub CI disposable PG17; never production.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
const e=process.env;
for(const [key,value] of Object.entries({
 GITHUB_ACTIONS:"true",CI:"true",
 DNDNEXT_P13_LOCAL_CI_CONFIRM:"P13_DISPOSABLE_REAL_GOTRUE_ONLY",
 PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"
}))assert.equal(e[key],value);
assert.match(e.DNDNEXT_P13_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LOCAL_ANON_KEY);
const uuid=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const char=n=>uuid(1041+10*(n-40));
const actor=n=>uuid(1001+10*n);
const item=n=>uuid(6000+10*n);
const window=n=>uuid(5000+10*n);
const encounter=n=>uuid(900+n);
function psql(args){
 const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt",...args],
  {encoding:"utf8",timeout:16000,env:{...e,PGUSER:"postgres"}});
 if(p.status!==0)throw Error("Disposable psql assertion failed: "+p.stderr);
 return p.stdout.trim();
}
const db=sql=>psql(["-c",sql]);
const count=sql=>Number(db(sql));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const client=()=>createClient(e.DNDNEXT_P13_LOCAL_URL,e.DNDNEXT_P13_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const attack=(who,n,req)=>who.rpc("p13_candidate_locked_weapon_reaction_v1",{
 p_window_id:window(n),p_inventory_item_id:item(n),p_request_id:req
});
const reject=(res,pattern,label)=>{
 assert.ok(res.error,label+" unexpectedly succeeded");
 assert.match(res.error.message,pattern,label+": "+res.error.message);
};
function noEffects(n,req){
 assert.equal(db("SELECT status FROM public.encounter_reaction_windows WHERE id='"+window(n)+"'"),"pending");
 assert.equal(db("SELECT reaction_available FROM public.encounter_participants WHERE id='"+actor(n)+"'"),"t");
 assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+uuid(1000+10*n)+"'"),"20");
 assert.equal(count("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+
  encounter(n)+"' AND event_type='opportunity_attack'"),0);
 if(req)assert.equal(count("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+
  req+"'"),0);
}
function barrierActive(value){
 return count("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid="+value+" AND granted")>0;
}
async function beginWriter(operation,label,lockId){
 let settled=false;
 const pending=operation().then(x=>{settled=true;return x;},err=>{settled=true;throw err;});
 for(let tries=0;tries<80&&!barrierActive(lockId);tries++){
   if(settled)throw Error(label+" completed before the held-lock observation");
   await sleep(35);
 }
 assert.ok(barrierActive(lockId),label+" held lock never observed");
 return {pending,wasSettled:()=>settled};
}
const users=[],password="P13GrantRace-"+randomUUID()+"-X9!";
for(const name of ["GM","CONTROLLER_A","CONTROLLER_B","OWNER","OUTSIDER"]){
 const who=client(),email="p13-grant-"+randomUUID()+"@example.invalid";
 const signup=await who.auth.signUp({email,password});assert.ifError(signup.error);
 const login=await who.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const me=await who.auth.getUser(),claims=await who.auth.getClaims();
 assert.ifError(me.error);assert.ifError(claims.error);
 assert.equal(me.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 users.push({who,uid:me.data.user.id,name});
}
const [gm,a,b,owner,outsider]=users;
assert.equal(new Set(users.map(x=>x.uid)).size,5);
db("INSERT INTO public.p13_auth_admins(user_id) VALUES('"+gm.uid+"')");
db("UPDATE public.encounter_participants SET controller_user_id='"+a.uid+
 "' WHERE id IN ("+Array.from({length:8},(_,i)=>"'"+actor(48+i)+"'").join(",")+")");
db("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert,can_control) "+
 "SELECT public.p13_auth_uuid(1041+10*(n-40)),'"+owner.uid+
 "',true,false,false,false FROM generate_series(48,55) n");
db("UPDATE public.inventory_items SET owner_type='player',owner_id='"+owner.uid+
 "',user_id='"+owner.uid+"' WHERE id IN ("+
 [48,49,51,52,53].map(n=>"'"+item(n)+"'").join(",")+")");
assert.equal(count("SELECT count(*) FROM public.character_permissions WHERE user_id='"+a.uid+"'"),0);
console.log("PASS 142: 5 genuine signed JWTs and source-policy RLS provisioned; actor controls no inventory/sheet grants");

const revoke=n=>gm.who.from("character_permissions").update({can_inventory:false})
 .eq("character_id",char(n)).eq("user_id",owner.uid).select("character_id,can_inventory");
const firstWriter=await beginWriter(()=>revoke(48),"signed-in Admin G revocation baseline",131307);
const oldId=randomUUID(),oldAttack=await attack(a.who,48,oldId);
assert.ifError(oldAttack.error);
assert.equal(oldAttack.data.choice,"attack");
assert.equal(firstWriter.wasSettled(),false,
 "I-only attack unexpectedly blocked on the uncommitted G writer");
const before=await firstWriter.pending;
assert.ifError(before.error);assert.equal(before.data.length,1);
assert.equal(before.data[0].can_inventory,false);
assert.equal(db("SELECT can_inventory FROM public.character_permissions WHERE character_id='"+
 char(48)+"' AND user_id='"+owner.uid+"'"),"f");
console.log("PASS 143 [EXPECTED UNSAFE]: prior I-only guard authorized while Admin G revocation remained uncommitted");

// Patch only the isolated guarded candidate to also acquire G after I.
psql(["-f","scripts/fixtures/p1_3_permission_row_lock_candidate_pg17.sql"]);
console.log("PASS 144: research-only I then G grant-row-lock candidate installed in disposable PG17");

const secondWriter=await beginWriter(()=>revoke(49),"signed-in Admin G revocation locked",131307);
const deniedId=randomUUID();
reject(await attack(a.who,49,deniedId),
 /P13_EQUIPMENT_NOT_AVAILABLE/,"post-G-lock revoked equipment");
const second=await secondWriter.pending;
assert.ifError(second.error);assert.equal(second.data.length,1);
assert.equal(second.data[0].can_inventory,false);
noEffects(49,deniedId);
console.log("PASS 145: G-locked candidate waits for real Admin revocation, rejects equipment without ledger/HP/reaction spend");

// Original deployed staging-only Admin API must NOT be portrayed as an
// active-encounter reassignment API.
const stage=await gm.who.rpc("admin_update_encounter_participant_staging_v1",{
 p_participant_id:actor(50),p_controller_user_id:b.uid
});
reject(stage,/Staging changes are locked after active play begins/i,
 "source Admin staging API on active encounter");
assert.equal(db("SELECT controller_user_id FROM public.encounter_participants WHERE id='"+
 actor(50)+"'"),a.uid);
console.log("PASS 146: exact deployed Admin staging RPC rejects reassignment after activation");

const reassign=()=>gm.who.rpc("p13_reassign_active_controller_research_v1",{
 p_actor:actor(50),p_new_controller:b.uid
});
const modeled=await beginWriter(reassign,"model-only active reassignment",131308);
const staleId=randomUUID();
reject(await attack(a.who,50,staleId),/P13_ACCESS_DENIED/,
 "old controller competing with modeled Admin E/P reassignment");
const update=await modeled.pending;assert.ifError(update.error);assert.equal(update.data,true);
noEffects(50,staleId);
assert.equal(db("SELECT controller_user_id FROM public.encounter_participants WHERE id='"+
 actor(50)+"'"),b.uid);
console.log("PASS 147: research-only E/P Admin reassign serializes before old-controller attack, denying stale authority");

const freshId=randomUUID(),fresh=await attack(b.who,50,freshId);
assert.ifError(fresh.error);assert.equal(fresh.data.choice,"attack");
const cached=await attack(b.who,50,freshId);
assert.ifError(cached.error);assert.deepEqual(cached.data,fresh.data);
reject(await attack(a.who,50,freshId),/P13_ACCESS_DENIED/,
 "prior controller attempts cached new-controller result");
console.log("PASS 148: reassigned controller may act/replay; old controller denied under current authority");

const revokableId=randomUUID(),replay=await attack(a.who,51,revokableId);
assert.ifError(replay.error);
const revoked=await revoke(51);
assert.ifError(revoked.error);assert.equal(revoked.data.length,1);
reject(await attack(a.who,51,revokableId),
 /P13_EQUIPMENT_NOT_AVAILABLE/,
 "post-reaction owner equipment grant revocation on replay");
assert.equal(count("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+
 encounter(51)+"' AND event_type='opportunity_attack'"),1);
console.log("PASS 149: R2 model denies cached item-private reaction after owner grant is removed, no second combat log");

// RLS policy predicates are copied from live pg_policies, not from the
// previous restrictive research fixture. Test synthetic only, never live rows.
const hiddenChar=char(53),visibleChar=char(54);
const hiddenOut=await outsider.who.from("character_sheets").select("character_id,sheet")
 .eq("character_id",hiddenChar);
assert.ifError(hiddenOut.error);assert.deepEqual(hiddenOut.data,[]);
const hiddenControlled=await a.who.from("character_sheets").select("character_id,sheet")
 .eq("character_id",hiddenChar);
assert.ifError(hiddenControlled.error);assert.deepEqual(hiddenControlled.data,[]);
const hiddenOwner=await owner.who.from("character_sheets").select("character_id,sheet")
 .eq("character_id",hiddenChar);
assert.ifError(hiddenOwner.error);assert.equal(hiddenOwner.data.length,1);
const hiddenGM=await gm.who.from("character_sheets").select("character_id,sheet")
 .eq("character_id",hiddenChar);
assert.ifError(hiddenGM.error);assert.equal(hiddenGM.data.length,1);
console.log("PASS 150: source-like characters/sheet RLS hides hidden sheet from stranger+combat controller, but allows equipped owner and GM");

const visibleOut=await outsider.who.from("character_sheets").select("character_id,sheet")
 .eq("character_id",visibleChar);
assert.ifError(visibleOut.error);assert.equal(visibleOut.data.length,1);
assert.equal(visibleOut.data[0].sheet.secretFixture,"NON-PRODUCTION-TEST-NPC-SHEET-54");
console.log("PASS 151 [PRIVACY REVIEW REQUIRED]: live-style RLS permits unrelated signed-in player to SELECT full VISIBLE NPC sheet");

const actorItems=await a.who.from("inventory_items").select("id").eq("id",item(53));
assert.ifError(actorItems.error);assert.deepEqual(actorItems.data,[]);
const unrelatedItems=await outsider.who.from("inventory_items").select("id").eq("id",item(53));
assert.ifError(unrelatedItems.error);assert.deepEqual(unrelatedItems.data,[]);
const ownerItems=await owner.who.from("inventory_items").select("id").eq("id",item(53));
assert.ifError(ownerItems.error);assert.equal(ownerItems.data.length,1);
const gmItems=await gm.who.from("inventory_items").select("id").eq("id",item(53));
assert.ifError(gmItems.error);assert.equal(gmItems.data.length,1);
console.log("PASS 152: source-like owner/Admin inventory RLS does not grant raw item access to combat controller");

const ownerCP=await owner.who.from("character_permissions")
 .select("character_id,can_inventory").eq("character_id",hiddenChar);
assert.ifError(ownerCP.error);assert.equal(ownerCP.data.length,1);
const outsiderCP=await outsider.who.from("character_permissions")
 .select("character_id").eq("character_id",hiddenChar);
assert.ifError(outsiderCP.error);assert.deepEqual(outsiderCP.data,[]);
const actorCP=await a.who.from("character_permissions")
 .select("character_id").eq("character_id",hiddenChar);
assert.ifError(actorCP.error);assert.deepEqual(actorCP.data,[]);
const gmCP=await gm.who.from("character_permissions")
 .select("character_id").eq("character_id",hiddenChar);
assert.ifError(gmCP.error);assert.equal(gmCP.data.length,1);
console.log("PASS 153: source-like permission grants visible to self/Admin, not controlling actor or stranger");

const illicit=await outsider.who.from("character_permissions")
 .update({can_inventory:false}).eq("character_id",hiddenChar).eq("user_id",owner.uid)
 .select("character_id");
assert.ifError(illicit.error);assert.deepEqual(illicit.data,[]);
assert.equal(db("SELECT can_inventory FROM public.character_permissions WHERE character_id='"+
 hiddenChar+"' AND user_id='"+owner.uid+"'"),"t");
console.log("PASS 154: signed-in outsider UPDATE of someone else's grant affects zero rows under live-style Admin RLS");

const oldStage=await outsider.who.rpc("admin_update_encounter_participant_staging_v1",{
 p_participant_id:actor(52),p_controller_user_id:outsider.uid
});
reject(oldStage,/Admin required/i,"Non-Admin staging reassignment");
const modeledDenied=await outsider.who.rpc("p13_reassign_active_controller_research_v1",{
 p_actor:actor(52),p_new_controller:outsider.uid
});
reject(modeledDenied,/P13_ADMIN_REQUIRED/,"Non-Admin modeled active reassign");
const anon=await attack(client(),52,randomUUID());
assert.ok(anon.error);assert.equal(anon.error.code,"42501");
console.log("PASS 155: non-Admin caller denied both original staging and modeled reassign; anonymous attack denied");

const sameId=randomUUID();
const [one,two]=await Promise.all([
 attack(a.who,52,sameId),attack(a.who,52,sameId)]);
assert.ifError(one.error);assert.ifError(two.error);
assert.deepEqual(one.data,two.data);
assert.equal(count("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+
 sameId+"' AND result IS NOT NULL"),1);
console.log("PASS 156: G-locked attack preserves immutable same-ID replay and single reaction");
console.log("P1.3 cases 142-156 PASS in disposable genuine GoTrue: G-row revocation, modeled active reassignment, and source-like RLS. Global release security still UNPROVEN.");
