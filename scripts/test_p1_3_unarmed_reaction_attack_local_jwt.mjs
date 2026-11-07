#!/usr/bin/env node
// Research ONLY: source-exact public reaction + original attack & damage processors
// under synthetic deterministic attack-roll, equipment and player stats.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
const e=process.env;
assert.equal(e.GITHUB_ACTIONS,"true");
assert.equal(e.CI,"true");
assert.equal(e.DNDNEXT_P13_LOCAL_CI_CONFIRM,"P13_DISPOSABLE_REAL_GOTRUE_ONLY");
assert.equal(e.PGHOST,"127.0.0.1");
assert.equal(e.PGPORT,"54322");
assert.equal(e.PGDATABASE,"postgres");
assert.match(e.DNDNEXT_P13_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LOCAL_ANON_KEY);
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
function db(sql){
 const v=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",sql],{
  encoding:"utf8",timeout:15000,env:{...e,PGUSER:"postgres"}
 });
 if(v.status!==0)throw Error("Disposable source DB assertion failed: "+v.stderr);
 return v.stdout.trim();
}
const count=sql=>Number(db(sql));
const make=()=>createClient(e.DNDNEXT_P13_LOCAL_URL,e.DNDNEXT_P13_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const attack=(who,window,weapon,request)=>who.rpc("p13_candidate_unarmed_reaction_research_v1",{
 p_window_id:window,p_inventory_item_id:weapon,p_request_id:request
});
const pass=(who,window,request)=>who.rpc("p13_candidate_reaction_v1",{
 p_window_id:window,p_choice:"pass",p_inventory_item_id:null,p_request_id:request
});
const expectDenied=(r,pattern,label)=>{
 assert.ok(r.error,label+" unexpectedly accepted");
 assert.match(r.error.message,pattern,label+": "+r.error.message);
};
const users=[],password="TempP13Attack-"+randomUUID()+"X9!";
for(const label of ["GM","MOVER","REACTOR","OUTSIDER"]){
 const client=make(),email="p13-unarmed-"+randomUUID()+"@example.invalid";
 const signed=await client.auth.signUp({email,password});assert.ifError(signed.error);
 const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const checked=await client.auth.getUser(),claims=await client.auth.getClaims();
 assert.ifError(checked.error);assert.ifError(claims.error);
 assert.equal(checked.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 users.push({client,uid:checked.data.user.id,label});
}
const [gm,mover,reactor,outsider]=users;
assert.equal(new Set(users.map(u=>u.uid)).size,4);
db("INSERT INTO public.p13_auth_admins(user_id) VALUES('"+gm.uid+"')");
db("UPDATE public.encounter_participants SET controller_user_id='"+mover.uid+
 "' WHERE id IN ("+Array.from({length:8},(_,i)=>"'"+id(1120+i*10)+"'").join(",")+")");
db("UPDATE public.encounter_participants SET controller_user_id='"+reactor.uid+
 "' WHERE id IN ("+Array.from({length:8},(_,i)=>"'"+id(1121+i*10)+"'").join(",")+")");
console.log("PASS 93: original attack/damage processors loaded with four genuine signed-in JWTs");

expectDenied(await attack(outsider.client,id(5120),null,randomUUID()),
 /P13_ACCESS_DENIED/,"Unowned unarmed attack");
expectDenied(await attack(reactor.client,id(5120),randomUUID(),randomUUID()),
 /P13_GM_ASSISTED_WEAPON_ATTACK/,"Unmodeled equipped-weapon branch");
expectDenied(await reactor.client.rpc("p13_candidate_reaction_v1",{
 p_window_id:id(5120),p_choice:"attack",p_inventory_item_id:null,
 p_request_id:randomUUID()
}),/P13_GM_ASSISTED_REACTION_ATTACK/,"Default candidate Attack remains blocked");
assert.equal(db("SELECT status FROM public.encounter_reaction_windows WHERE id='"+id(5120)+"'"),"pending");
console.log("PASS 94: outsider, equipped weapon, and unverified normal Attack paths fail closed");

const request=randomUUID();
const first=await attack(reactor.client,id(5120),null,request);
assert.ifError(first.error);
assert.equal(first.data.choice,"attack");
assert.equal(first.data.reactionSpent,true);
assert.equal(first.data.attack.roll,15);
assert.equal(first.data.attack.total,20);
assert.equal(first.data.attack.hit,true);
assert.equal(first.data.attack.critical,false);
assert.equal(first.data.attack.rawDamage,4);
assert.equal(first.data.attack.damage.damage,4);
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1120)+"'"),"16");
assert.equal(db("SELECT reaction_available FROM public.encounter_participants WHERE id='"+id(1121)+"'"),"f");
assert.equal(db("SELECT status FROM public.encounter_reaction_windows WHERE id='"+id(5120)+"'"),"resolved");
assert.equal(count("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(912)+
 "' AND event_type='opportunity_attack'"),1);
assert.equal(db("SELECT requested_by FROM public.encounter_command_requests WHERE request_id='"+request+"'"),reactor.uid);
console.log("PASS 95: exact original outer Reaction/Attack/Damage spent one reaction and dealt synthetic deterministic 4 HP");

const replay=await attack(reactor.client,id(5120),null,request);
assert.ifError(replay.error);assert.deepEqual(replay.data,first.data);
expectDenied(await attack(reactor.client,id(5120),null,randomUUID()),
 /P13_WINDOW_RESOLVED/,"Fresh UUID for already-resolved W");
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1120)+"'"),"16");
console.log("PASS 96: exact attack retry returns one cached result without a second attack/HP spend");

db("UPDATE public.encounter_participants SET controller_user_id=NULL WHERE id='"+id(1121)+"'");
expectDenied(await attack(reactor.client,id(5120),null,request),
 /P13_ACCESS_DENIED/,"Revoked reaction actor");
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1120)+"'"),"16");
console.log("PASS 97: revoked reactor cannot retrieve cached attack/damage result (R2)");

db("UPDATE public.encounter_participants SET reaction_available=false WHERE id='"+id(1131)+"'");
expectDenied(await attack(reactor.client,id(5130),null,randomUUID()),
 /Reaction already spent/i,"Already-spent reaction");
assert.equal(db("SELECT status FROM public.encounter_reaction_windows WHERE id='"+id(5130)+"'"),"pending");
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1130)+"'"),"20");
assert.equal(count("SELECT count(*) FROM public.encounter_command_requests WHERE encounter_id='"+id(913)+"'"),0);
console.log("PASS 98: original reaction budget check rolls back ledger/window/damage");

db("UPDATE public.encounter_participants SET is_hidden=true WHERE id='"+id(1140)+"'");
expectDenied(await attack(reactor.client,id(5140),null,randomUUID()),
 /P13_REQUEST_REJECTED/,"Hidden target");
assert.equal(db("SELECT status FROM public.encounter_reaction_windows WHERE id='"+id(5140)+"'"),"pending");
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1140)+"'"),"20");
console.log("PASS 99: original attack is blocked before private hidden-mover details are disclosed");

const [a,b]=await Promise.all([
 attack(reactor.client,id(5150),null,randomUUID()),
 attack(reactor.client,id(5150),null,randomUUID())
]);
assert.equal([a,b].filter(x=>!x.error).length,1);
expectDenied([a,b].find(x=>x.error),/P13_WINDOW_RESOLVED/,"Racing different reaction IDs");
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1150)+"'"),"16");
assert.equal(count("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(915)+
 "' AND event_type='opportunity_attack'"),1);
console.log("PASS 100: different UUIDs racing for W spend one reaction and deal damage once");

const sameId=randomUUID();
const [same1,same2]=await Promise.all([
 attack(reactor.client,id(5160),null,sameId),
 attack(reactor.client,id(5160),null,sameId)
]);
assert.ifError(same1.error);assert.ifError(same2.error);
assert.deepEqual(same1.data,same2.data);
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1160)+"'"),"16");
assert.equal(count("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+sameId+"' AND result IS NOT NULL"),1);
assert.equal(count("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(916)+
 "' AND event_type='opportunity_attack'"),1);
console.log("PASS 101: identical JWT attack UUID races converge on a single damage/ledger result");

const [rAttack,rPass]=await Promise.all([
 attack(reactor.client,id(5170),null,randomUUID()),
 pass(reactor.client,id(5170),randomUUID())
]);
assert.equal([rAttack,rPass].filter(x=>!x.error).length,1);
expectDenied([rAttack,rPass].find(x=>x.error),/P13_WINDOW_RESOLVED/,
 "Concurrent Pass versus Attack");
const resolvedChoice=db("SELECT choice FROM public.encounter_reaction_windows WHERE id='"+id(5170)+"'");
assert.ok(["pass","attack"].includes(resolvedChoice));
const expectedHp=resolvedChoice==="attack"?16:20;
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1170)+"'"),String(expectedHp));
assert.equal(count("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(917)+
 "' AND event_type IN ('opportunity_attack','reaction_pass')"),1);
console.log("PASS 102: concurrent Pass versus Attack produces exactly one authoritative W resolution");

const resistant=await attack(reactor.client,id(5180),null,randomUUID());
assert.ifError(resistant.error);
assert.equal(resistant.data.attack.rawDamage,4);
assert.equal(resistant.data.attack.damage.resistant,true);
assert.equal(resistant.data.attack.damage.damage,2);
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1180)+"'"),"18");
console.log("PASS 103: original damage source honors synthetic bludgeoning resistance (4→2)");

const immune=await attack(reactor.client,id(5190),null,randomUUID());
assert.ifError(immune.error);
assert.equal(immune.data.attack.damage.immune,true);
assert.equal(immune.data.attack.damage.damage,0);
assert.equal(db("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1190)+"'"),"20");
assert.equal(db("SELECT reaction_available FROM public.encounter_participants WHERE id='"+id(1191)+"'"),"f");
console.log("PASS 104: original damage source honors immunity and still expends attack reaction");

const direct=await reactor.client.rpc("encounter_opportunity_attack_internal_v1",{
 p_reactor_id:id(1181),p_mover_id:id(1180),p_inventory_item_id:null
});
assert.ok(direct.error);assert.equal(direct.error.code,"42501");
const anon=make();
const anonCall=await attack(anon,id(5180),null,randomUUID());
assert.ok(anonCall.error);assert.equal(anonCall.error.code,"42501");
console.log("PASS 105: private/source attack processors and anonymous research Attack RPC cannot bypass guards");
console.log("P1.3 cases 93–105 PASS with original unarmed outer, attack and damage sources. Synthetic roll, inventory and snapshots: NOT real weapon/rules parity or production acceptance.");
