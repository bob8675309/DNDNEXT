#!/usr/bin/env node
// Exact original weapon-profile authorization under genuine GoTrue JWTs.
// Disposable PG17 only; original random dice, mocked canonical stats/mitigation.
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
 if(r.status!==0)throw Error("Disposable SQL assertion failed: "+r.stderr);
 return r.stdout.trim();
}
const num=sql=>Number(db(sql));
const who=()=>createClient(e.DNDNEXT_P13_LOCAL_URL,e.DNDNEXT_P13_LOCAL_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const attack=(client,n,item,request)=>client.rpc("p13_candidate_weapon_reaction_research_v1",{p_window_id:id(5000+10*n),p_inventory_item_id:item,p_request_id:request});
const item=n=>id(6000+10*n);
const hp=n=>num("SELECT current_hp FROM public.encounter_participants WHERE id='"+id(1000+10*n)+"'");
const status=n=>db("SELECT reaction_available FROM public.encounter_participants WHERE id='"+id(1001+10*n)+"'");
const logs=n=>num("SELECT count(*) FROM public.encounter_combat_log WHERE encounter_id='"+id(900+n)+"' AND event_type='opportunity_attack'");
const deny=(z,pattern,msg)=>{assert.ok(z.error,msg+" unexpectedly succeeded");assert.match(z.error.message,pattern,msg+": "+z.error.message);};
function verifyHit(z,n,expectedWeapon,expectedType){
 assert.ifError(z.error);const a=z.data.attack;
 assert.equal(z.data.choice,"attack");
 assert.equal(a.weapon,expectedWeapon);assert.equal(a.inventoryItemId,item(n));
 assert.equal(a.damageType,expectedType);assert.equal(a.attackBonus,5);
 assert.equal(a.total,a.roll+5);
 assert.equal(a.critical,a.roll===20);
 const expectedHit=a.roll===20 || (a.roll!==1 && a.total>=a.targetAc);
 assert.equal(a.hit,expectedHit);
 const expectedRaw=expectedHit?(a.critical?5:4):0;
 assert.equal(a.rawDamage,expectedRaw);
 assert.equal(a.damage.damage,expectedRaw);
 assert.equal(hp(n),20-expectedRaw);
 assert.equal(status(n),"f");assert.equal(logs(n),1);
 return a;
}
const users=[],password="P13Weapon-"+randomUUID()+"X9!";
for(const label of ["GM","REACTOR","OUTSIDER"]){
 const client=who(),email="p13-weapon-"+randomUUID()+"@example.invalid";
 const s=await client.auth.signUp({email,password});assert.ifError(s.error);
 const l=await client.auth.signInWithPassword({email,password});assert.ifError(l.error);
 const me=await client.auth.getUser(),claims=await client.auth.getClaims();
 assert.ifError(me.error);assert.ifError(claims.error);
 assert.equal(me.data.user.id,claims.data.claims.sub);
 assert.equal(claims.data.claims.role,"authenticated");
 assert.notEqual(claims.data.claims.is_anonymous,true);
 users.push({client,uid:me.data.user.id,label});
}
const [gm,reactor,outsider]=users;
assert.equal(new Set(users.map(u=>u.uid)).size,3);
db("INSERT INTO public.p13_auth_admins(user_id) VALUES('"+gm.uid+"')");
db("UPDATE public.encounter_participants SET controller_user_id='"+reactor.uid+
 "' WHERE id IN ("+Array.from({length:8},(_,i)=>"'"+id(1301+i*10)+"'").join(",")+")");
console.log("PASS 117: original weapon-profile source loaded; 3 real signed JWTs");

const firstId=randomUUID();
const first=await attack(reactor.client,30,item(30),firstId);
verifyHit(first,30,"Fixture Blade","slashing");
assert.equal(db("SELECT choice FROM public.encounter_reaction_windows WHERE id='"+id(5300)+"'"),"attack");
console.log("PASS 118: owned equipped melee weapon uses source proficiency, random D20, damage and reaction spend");

deny(await attack(reactor.client,32,item(32),randomUUID()),/not equipped or unsupported/i,
 "Unequipped inventory instance");
assert.equal(status(32),"t");assert.equal(hp(32),20);assert.equal(logs(32),0);
console.log("PASS 119: unequipped item rejects without spending HP/reaction/ledger");

deny(await attack(reactor.client,33,item(33),randomUUID()),/melee weapon or Unarmed Strike/i,
 "Ranged weapon in opportunity attack");
assert.equal(status(33),"t");assert.equal(hp(33),20);
console.log("PASS 120: equipped ranged weapon rejected by original melee-only rule");

deny(await attack(reactor.client,34,item(30),randomUUID()),/not equipped or unsupported/i,
 "Another actor's equipped item");
assert.equal(status(34),"t");assert.equal(hp(34),20);assert.equal(logs(34),0);
const valid=await attack(reactor.client,34,item(34),randomUUID());
verifyHit(valid,34,"Fixture Blade","slashing");
console.log("PASS 121: foreign inventory item rejected; own item still works on fresh request");

const replay=await attack(reactor.client,30,item(30),firstId);
assert.ifError(replay.error);assert.deepEqual(replay.data,first.data);
assert.equal(logs(30),1);
deny(await attack(reactor.client,30,item(31),firstId),/P13_REQUEST_CONFLICT/,
 "Weapon instance swapped on same request ID");
console.log("PASS 122: exact melee replay is stable; changed weapon ID cannot reuse cached attack");

const sameId=randomUUID();
const [sameA,sameB]=await Promise.all([
 attack(reactor.client,35,item(35),sameId),
 attack(reactor.client,35,item(35),sameId)
]);
assert.ifError(sameA.error);assert.ifError(sameB.error);
assert.deepEqual(sameA.data,sameB.data);
verifyHit(sameA,35,"Fixture Blade","slashing");
assert.equal(num("SELECT count(*) FROM private.p13_guarded_commands WHERE request_id='"+sameId+"' AND result IS NOT NULL"),1);
console.log("PASS 123: simultaneous equipped same-UUID calls consume one W, HP debit and ledger");

const [a,b]=await Promise.all([
 attack(reactor.client,36,item(36),randomUUID()),
 attack(reactor.client,36,item(36),randomUUID())
]);
assert.equal([a,b].filter(z=>!z.error).length,1);
deny([a,b].find(z=>z.error),/P13_WINDOW_RESOLVED/,"Different equipped-attack request IDs");
const win=[a,b].find(z=>!z.error);
verifyHit(win,36,"Fixture Reach Weapon","piercing");
assert.equal(logs(36),1);
assert.equal(win.data.attack.distanceFt,5);
console.log("PASS 124: reach weapon profile and two competing request IDs resolve one attack");

db("UPDATE public.encounter_participants SET controller_user_id=NULL WHERE id='"+id(1301)+"'");
deny(await attack(reactor.client,30,item(30),firstId),/P13_ACCESS_DENIED/,
 "Revoked reactor with cached equipped attack");
assert.equal(logs(30),1);
console.log("PASS 125: R2 revocation prevents cached equipped-weapon result disclosure");

// Real current source uses can_edit for player-owned inventory. A combat-only
// can_control row does not imply sheet/inventory edit rights. This test records
// existing behavior, not consent to grant can_edit just to make attacks work.
db("UPDATE public.inventory_items SET owner_id='"+reactor.uid+"' WHERE id='"+item(37)+"'");
db("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_control) VALUES('"+
 id(1011)+"','"+reactor.uid+"',false,true)");
deny(await attack(reactor.client,37,item(37),randomUUID()),
 /not equipped or unsupported/i,"Combat-only can_control vs player-owned item");
assert.equal(status(37),"t");assert.equal(hp(37),20);
db("UPDATE public.character_permissions SET can_edit=true WHERE character_id='"+
 id(1011)+"' AND user_id='"+reactor.uid+"'");
const withEdit=await attack(reactor.client,37,item(37),randomUUID());
verifyHit(withEdit,37,"Fixture Blade","slashing");
console.log("PASS 126: original player-owned gear requires can_edit; can_control-only unsupported (security policy gap)");

deny(await attack(outsider.client,31,item(31),randomUUID()),/P13_ACCESS_DENIED/,
 "Outsider supplied another actor's weapon");
const anonymous=await attack(who(),31,item(31),randomUUID());
assert.ok(anonymous.error);assert.equal(anonymous.error.code,"42501");
const direct=await reactor.client.rpc("encounter_weapon_profile_internal_v1",{
 p_participant_id:id(1311),p_inventory_item_id:item(31)});
assert.ok(direct.error);assert.equal(direct.error.code,"42501");
console.log("PASS 127: outsider, anonymous and direct weapon-profile bypass all denied");

const good=await attack(reactor.client,31,item(31),randomUUID());
verifyHit(good,31,"Fixture Blade","slashing");
console.log("PASS 128: independently equipped source-validated weapon attack and effect budget pass");
console.log("P1.3 source-equipped weapon JWT cases 117–128 PASS (synthetic inventory/canonical stats; not production authority/lock proof).");
