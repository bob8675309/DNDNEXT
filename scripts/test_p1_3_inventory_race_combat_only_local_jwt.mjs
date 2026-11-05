#!/usr/bin/env node
// P1.3 original equip/transfer JWT writers versus attack I-lock model.
// Source-original mutation/attack functions; private profile is a
// RESEARCH-ONLY, minimally adjusted combat-authority clone. Never deploy.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
const e=process.env;
for(const [k,v] of Object.entries({GITHUB_ACTIONS:"true",CI:"true",DNDNEXT_P13_LOCAL_CI_CONFIRM:"P13_DISPOSABLE_REAL_GOTRUE_ONLY",PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"}))assert.equal(e[k],v);
assert.match(e.DNDNEXT_P13_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LOCAL_ANON_KEY);
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
function db(sql){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",sql],{
  encoding:"utf8",timeout:15000,env:{...e,PGUSER:"postgres"}});
 if(r.status!==0)throw Error("Disposable SQL test failed: "+r.stderr);
 return r.stdout.trim();
}
const num=sql=>Number(db(sql)),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const make=()=>createClient(e.DNDNEXT_P13_LOCAL_URL,e.DNDNEXT_P13_LOCAL_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const char=n=>id(1041+10*(n-40)),actor=n=>id(1001+10*n);
const item=n=>id(6000+10*n),window=n=>id(5000+10*n);
const attack=(client,n,inv,request,locked=true)=>client.rpc(
 locked?"p13_candidate_locked_weapon_reaction_v1":"p13_candidate_weapon_reaction_research_v1",
 {p_window_id:window(n),p_inventory_item_id:inv,p_request_id:request});
const equip=(client,n,value)=>client.rpc("set_character_inventory_equipment_v1",{
 p_character_id:char(n),p_item_id:item(n),p_is_equipped:value,p_equip_slot:value?"weapon_1":null});
const transfer=(client,n,target)=>client.rpc("transfer_inventory_item_v1",{
 p_item_id:item(n),p_target_type:"npc",p_target_id:target});
const noEffect=n=>{
 assert.equal(num("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(900+n)+"' AND event_type='opportunity_attack'"),0);
 assert.equal(db("SELECT status FROM public.encounter_reaction_windows WHERE id='"+window(n)+"'"),"pending");
 assert.equal(num("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1000+10*n)+"'"),20);
 assert.equal(db("SELECT reaction_available FROM public.encounter_participants WHERE id='"+actor(n)+"'"),"t");
};
const denied=(r,pattern,label)=>{
 assert.ok(r.error,label+" unexpectedly succeeded");
 assert.match(r.error.message,pattern,label+": "+r.error.message);
};
const raceActive=()=>num("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=131303 AND granted")>0;
async function startMutation(promiseFactory,label){
 // The source mutation executes with real user JWT. The test-only trigger
 // pauses AFTER locking I while the row update remains uncommitted.
 let resolved=false;
 const original=promiseFactory();
 const pending=original.then(v=>{resolved=true;return v;},err=>{resolved=true;throw err;});
 for(let i=0;i<85 && !raceActive();i++){
   if(resolved)throw Error(label+" ended before row lock was observed");
   await sleep(35);
 }
 assert.ok(raceActive(),label+" never acquired the original writer I-row lock");
 return {pending,settled:()=>resolved};
}
const users=[],pwd="P13Inventory-"+randomUUID()+"-X9!";
for(const label of ["GM","CONTROLLER","EQUIPMENT_MANAGER","OUTSIDER"]){
 const who=make(),email="p13-inventory-"+randomUUID()+"@example.invalid";
 const r=await who.auth.signUp({email,password:pwd});assert.ifError(r.error);
 const z=await who.auth.signInWithPassword({email,password:pwd});assert.ifError(z.error);
 const current=await who.auth.getUser(),claims=await who.auth.getClaims();
 assert.ifError(current.error);assert.ifError(claims.error);
 assert.equal(current.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 users.push({who,uid:current.data.user.id,label});
}
const [gm,controller,owner,outsider]=users;
assert.equal(new Set(users.map(x=>x.uid)).size,4);
db("INSERT INTO public.p13_auth_admins(user_id) VALUES('"+gm.uid+"')");
db("UPDATE public.encounter_participants SET controller_user_id='"+controller.uid+
 "' WHERE id IN ("+Array.from({length:8},(_,i)=>"'"+actor(40+i)+"'").join(",")+")");
db("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_control,can_inventory,can_convert) "+
 "SELECT public.p13_auth_uuid(1041+10*(n-40)),'"+owner.uid+"',false,false,true,false FROM generate_series(40,47) n");
assert.equal(num("SELECT count(*) FROM public.character_permissions WHERE user_id='"+controller.uid+"'"),0);
console.log("PASS 129: original writer functions, 4 real JWTs, controller has no inventory/edit permission");

const baselineWriter=await startMutation(()=>equip(owner.who,40,false),"Original unequip");
const baselineRequest=randomUUID();
const original=await attack(controller.who,40,item(40),baselineRequest,false);
assert.ifError(original.error);
assert.equal(baselineWriter.settled(),false,
 "Old attack unexpectedly waited on source writer I lock");
assert.equal(original.data.choice,"attack");
assert.equal(db("SELECT status FROM public.encounter_reaction_windows WHERE id='"+window(40)+"'"),"resolved");
const oldWriter=await baselineWriter.pending;assert.ifError(oldWriter.error);
assert.equal(db("SELECT is_equipped FROM public.inventory_items WHERE id='"+item(40)+"'"),"f");
console.log("PASS 130 [EXPECTED UNSAFE]: original attack source read stale equipped item while source unequip held I");

const newerWriter=await startMutation(()=>equip(owner.who,41,false),"Guarded unequip");
const guardedRequest=randomUUID();
denied(await attack(controller.who,41,item(41),guardedRequest),
 /P13_EQUIPMENT_NOT_AVAILABLE/,"Locked candidate after concurrent unequip");
const newWriter=await newerWriter.pending;assert.ifError(newWriter.error);
assert.equal(db("SELECT is_equipped FROM public.inventory_items WHERE id='"+item(41)+"'"),"f");
noEffect(41);
assert.equal(num("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+guardedRequest+"'"),0);
console.log("PASS 131: E/P/L/I guarded attack waits for committed unequip and fails without effects/ledger");

const sourceWriter=await startMutation(
 ()=>transfer(owner.who,42,char(43)),"Source transfer");
const transferId=randomUUID();
denied(await attack(controller.who,42,item(42),transferId),
 /P13_EQUIPMENT_NOT_AVAILABLE/,"Locked candidate after concurrent transfer");
const moved=await sourceWriter.pending;assert.ifError(moved.error);
assert.equal(db("SELECT owner_id FROM public.inventory_items WHERE id='"+item(42)+"'"),char(43));
assert.equal(db("SELECT is_equipped FROM public.inventory_items WHERE id='"+item(42)+"'"),"f");
noEffect(42);
console.log("PASS 132: original signed-in transfer writer blocks guarded attack; foreign owner fails closed");

const validId=randomUUID();
const valid=await attack(controller.who,43,item(43),validId);
assert.ifError(valid.error);assert.equal(valid.data.choice,"attack");
assert.equal(valid.data.attack.inventoryItemId,item(43));
const cached=await attack(controller.who,43,item(43),validId);
assert.ifError(cached.error);assert.deepEqual(cached.data,valid.data);
denied(await attack(controller.who,43,item(44),validId),
 /P13_REQUEST_CONFLICT/,"Retargeted equipped UUID");
assert.equal(num("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(943)+"' AND event_type='opportunity_attack'"),1);
console.log("PASS 133: owned item works through I lock and exact cached intent cannot change weapon");

// Inventory belongs to player owner; OWNER has only can_inventory, not edit.
// Combat controller has only P.controller_user_id, no character_permissions.
db("UPDATE public.inventory_items SET owner_type='player',owner_id='"+owner.uid+"',user_id='"+
 owner.uid+"' WHERE id='"+item(44)+"'");
assert.equal(db("SELECT can_edit FROM public.character_permissions WHERE character_id='"+
 char(44)+"' AND user_id='"+owner.uid+"'"),"f");
assert.equal(db("SELECT public.encounter_weapon_profile_internal_v1('"+actor(44)+
 "','"+item(44)+"') IS NULL"),"t");
const combatOnly=await attack(controller.who,44,item(44),randomUUID());
assert.ifError(combatOnly.error);
assert.equal(combatOnly.data.attack.inventoryItemId,item(44));
assert.equal(num("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(944)+"' AND event_type='opportunity_attack'"),1);
console.log("PASS 134: player-owned equipped item usable by actor controller with owner can_inventory; no can_edit grant");

// A combat-only controller must NOT gain inventory mutation or raw sheet access
// as an accidental side effect of performing a legal combat action.
denied(await equip(controller.who,45,false),/Not authorized to equip/i,
 "Combat-only equip mutation");
denied(await transfer(controller.who,45,char(46)),/Not authorized to transfer/i,
 "Combat-only inventory transfer");
for(const table of ["inventory_items","character_sheets","character_permissions"]){
 const read=await controller.who.from(table).select("*").limit(1);
 assert.ok(read.error,"Combat-only controller obtained raw "+table+" access");
}
console.log("PASS 135: combat-only actor may attack but cannot mutate or inspect raw inventory/sheet/permissions");

// Original equipment owner can inventory-mutate without sheet-edit privilege.
const equipmentManagerCanUse=await equip(owner.who,45,false);
assert.ifError(equipmentManagerCanUse.error);
assert.equal(db("SELECT is_equipped FROM public.inventory_items WHERE id='"+item(45)+"'"),"f");
noEffect(45);
console.log("PASS 136: original equip source honors owner can_inventory independently of can_edit");

// Owner's inventory grant is revoked after combat result: conservative result
// policy refuses cached private item details until association is valid again.
db("UPDATE public.character_permissions SET can_inventory=false WHERE character_id='"+
 char(44)+"' AND user_id='"+owner.uid+"'");
denied(await attack(controller.who,44,item(44),combatOnly.data.requestId||randomUUID()),
 /P13_EQUIPMENT_NOT_AVAILABLE|P13_WINDOW_RESOLVED/,
 "Revoked owner item association");
console.log("PASS 137: revoked player-owner inventory association cannot disclose protected item through new request");

// Distinct requests for one window must never duplicate damage or reaction.
const [a,b]=await Promise.all([
 attack(controller.who,46,item(46),randomUUID()),
 attack(controller.who,46,item(46),randomUUID())]);
assert.equal([a,b].filter(x=>!x.error).length,1);
denied([a,b].find(x=>x.error),/P13_WINDOW_RESOLVED/,"Competing attack IDs");
assert.equal(num("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(946)+"' AND event_type='opportunity_attack'"),1);
console.log("PASS 138: separate JWT attack UUIDs serialize on one E/P/I/W and one reaction");

const sameId=randomUUID();
const [sameA,sameB]=await Promise.all([
 attack(controller.who,47,item(47),sameId),
 attack(controller.who,47,item(47),sameId)]);
assert.ifError(sameA.error);assert.ifError(sameB.error);
assert.deepEqual(sameA.data,sameB.data);
assert.equal(num("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+sameId+"' AND result IS NOT NULL"),1);
console.log("PASS 139: same-UUID I-locked attack returns one original result and one effect");

// Live actor-controller revocation immediately cuts replay access (owner R2).
db("UPDATE public.encounter_participants SET controller_user_id=NULL WHERE id='"+actor(47)+"'");
denied(await attack(controller.who,47,item(47),sameId),
 /P13_ACCESS_DENIED/,"Revoked actor request replay");
console.log("PASS 140: actor-control revocation rejects previously authorized equipped-attack replay");

denied(await attack(outsider.who,43,item(43),randomUUID()),
 /P13_ACCESS_DENIED/,"Unauthorized actor");
const anonymous=await attack(make(),43,item(43),randomUUID());
assert.ok(anonymous.error);assert.equal(anonymous.error.code,"42501");
const rawProfile=await controller.who.rpc("encounter_weapon_profile_internal_v1",{
 p_participant_id:actor(43),p_inventory_item_id:item(43)});
assert.ok(rawProfile.error);assert.equal(rawProfile.error.code,"42501");
const privateProfile=await controller.who.rpc("p13_combat_weapon_profile_v1",{
 p_participant_id:actor(43),p_inventory_item_id:item(43)});
assert.ok(privateProfile.error);
console.log("PASS 141: outsider, anonymous, source-profile and private candidate bypass all denied");
console.log("P1.3 JWT cases 129-141 PASS: original I writers and candidate. Global S/C/X, full RLS/equip-transfer and deployment remain unproven.");
