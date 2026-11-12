#!/usr/bin/env node
// I2-H: source-original Tough level-up writer under genuine local signed v5.
// SQL-seeded featureless Fighter lv1->2/feat instances; complete original v5
// signature intact. Other TWO already-tested I2-B account mirrors locally
// source-locked and suppressed before new Tough original RED to isolate cause.
// Strict local PG17/GoTrue only: NEVER run with hosted Supabase.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";

const e=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGDATABASE:"postgres",DNDNEXT_I2H_LOCAL_CONFIRM:"I2H_TOUGH_V5_SIGNED_DISPOSABLE_ONLY"
}))assert.equal(e[k],v,"I2H forbidden outside disposable signed PG17: "+k);
assert.match(e.DNDNEXT_I2H_LOCAL_URL||"",/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_I2H_LOCAL_ANON_KEY);
const local=(args)=>{
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{
 encoding:"utf8",env:{...e,PGUSER:"postgres"},timeout:35000});
 assert.equal(r.status,0,"I2H local SQL error: "+r.stderr+"\n"+(r.stdout||"").slice(-650));
 return r.stdout.trim();
};
const sql=q=>local(["-qAt","-c",q]);
const fixture=path=>local(["-q","-f",path]);
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const uid=()=>randomUUID();
const md5=sig=>sql("SELECT md5(pg_get_functiondef("+lit(sig)+"::regprocedure))");
const sheet=id=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+lit(id));
const legacy=w=>sql("SELECT sheet::text FROM public.players WHERE user_id="+lit(w.uid));
const stamp=w=>sql("SELECT updated_at::text FROM public.players WHERE user_id="+lit(w.uid));
const progressed=id=>sql("SELECT class_level::text FROM public.character_progression WHERE character_id="+lit(id));
const maxhp=id=>sql("SELECT sheet->>'maxHp' FROM public.character_sheets WHERE character_id="+lit(id));
const countEvent=id=>Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+lit(id)+" AND event_type='level_up_completed'"));
const snap=people=>people.map(w=>({w,old:legacy(w),stamp:stamp(w)}));
const freeze=(before,where)=>{for(const o of before){
 assert.equal(legacy(o.w),o.old,where+" legacy bytes frozen "+o.w.name);
 assert.equal(stamp(o.w),o.stamp,where+" legacy timestamp frozen "+o.w.name);
}};
const client=()=>createClient(e.DNDNEXT_I2H_LOCAL_URL,e.DNDNEXT_I2H_LOCAL_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const actors=[];
for(const name of ["owner","editor","outsider","archive"]){
 const c=client(),email="i2h-"+uid()+"@example.invalid",password="I2H-"+uid()+"-P9!";
 assert.ifError((await c.auth.signUp({email,password})).error);
 const login=await c.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const claims=await c.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.sub,login.data.user.id);
 assert.equal(claims.data.claims.role,"authenticated");
 const who={name,uid:login.data.user.id,client:c};
 sql("INSERT INTO public.players(user_id,sheet) VALUES("+lit(who.uid)+",'{}'::jsonb)");
 actors.push(who);
}
const [owner,editor,outsider,archive]=actors;
const classId="00000000-0000-0000-0000-000000008201";
function character(name,acquired=null){
 const id=uid(),v={classKey:"fighter",rulesetSource:"XPHB",ruleset:"2024",level:1,
 hp:12,maxHp:12,abilities:{con:{score:12}},meta:{classKey:"fighter",rulesetSource:"XPHB",level:1}};
 sql("INSERT INTO public.characters(id,name,kind) VALUES("+lit(id)+","+lit(name)+",'npc');"+
 "INSERT INTO public.character_sheets(character_id,sheet) VALUES("+lit(id)+","+lit(JSON.stringify(v))+"::jsonb);"+
 "INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by)"+
 " VALUES("+lit(id)+","+lit(classId)+",1,300,true,"+lit(owner.uid)+")"+
 " ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,class_level=excluded.class_level,"+
 " experience_points=excluded.experience_points,pending_level_up=excluded.pending_level_up,created_by=excluded.created_by;"+
 "INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,metadata_ready,status,created_by)"+
 " VALUES("+lit(id)+",1,2,true,'open',"+lit(owner.uid)+");"+
 "INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES"+
 "("+lit(id)+","+lit(owner.uid)+",true),("+lit(id)+","+lit(editor.uid)+",true)");
 if(acquired!==null)sql("INSERT INTO public.character_option_grant_instances(character_id,option_name,acquisition_level)"+
 " VALUES("+lit(id)+",'Tough|XPHB',"+acquired+")");
 return id;
}
const A=character("I2H owner archived Fighter A");
const B=character("I2H original Tough RED shared Fighter B",1);
const C=character("I2H no Tough baseline Fighter C");
const D=character("I2H Tough GREEN shared Fighter D",1);
const E=character("I2H Tough acquired too late Fighter E",2);
const F=character("I2H invalid input Fighter F",1);
const G=character("I2H revoked editor Fighter G",1);
const sheetA=sheet(A);
const level=(who,id,selections={hp_method:"fixed"})=>who.client.rpc(
 "complete_character_level_up_v5",{p_character_id:id,p_selections:selections});
const toughSig="private.apply_tough_progression_bonus_v1(uuid,integer)";
const origTough="2b8bca48b7067e2e67b66defcb7f2c10";
const origV5="02d74b973a763c53c595be20e35e512f";
const origBase="e33639d549ef557976a3970ea51f5238";
assert.equal(md5(toughSig),origTough);
assert.equal(md5("private.normalize_player_choice_name_v1(text)"),"dd8cdd5b47efe99b1cfff9c2bf7635dd");
assert.equal(md5("public.complete_character_level_up_v5(uuid,jsonb)"),origV5);
assert.equal(sql("SELECT private.normalize_player_choice_name_v1('Tough|XPHB')"),"tough");
assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(toughSig)+",'EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')"),"t");
console.log("PASS I2H-01 live-original Tough and normalizer MD5, v5 signed role/denied private helper and canonical source-qualified name");

fixture("scripts/fixtures/i2h_inherited_levelup_no_mirror_isolation_pg17.sql");
assert.equal(md5(toughSig),origTough);
assert.equal(md5("public.complete_character_level_up_v5(uuid,jsonb)"),origV5);
for(const [sig,marker] of [
 ["private.complete_character_level_up_base_v3(uuid,jsonb)","I2H_INHERITED_BASE_V3_NO_LEGACY_MIRROR"],
 ["private.sync_player_forge_class_spell_summary_v1(uuid)","I2H_INHERITED_CLASS_SUMMARY_NO_LEGACY_MIRROR"]
]){
 const body=sql("SELECT pg_get_functiondef("+lit(sig)+"::regprocedure)");
 assert.ok(body.includes(marker));
 assert.ok(!body.toLowerCase().includes("update public.players"));
}
console.log("PASS I2H-02 only two previously covered I2-B original account mirrors disabled with exact source-reversal MD5; Tough ORIGINAL still installed");

sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+lit(A)+"),updated_at=now() WHERE user_id="+lit(owner.uid));
sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+lit(C)+"),updated_at=now() WHERE user_id="+lit(editor.uid));
sql("UPDATE public.players SET sheet="+lit(JSON.stringify({historical:"I2H untouched unmarked account",level:12}))+
 "::jsonb WHERE user_id="+lit(archive.uid));
const pre=snap(actors);
const noFeat=await level(owner,C);
assert.ifError(noFeat.error);
assert.equal(noFeat.data.toughProgressionBonus,0);
assert.equal(maxhp(C),"19");assert.equal(progressed(C),"2");assert.equal(countEvent(C),1);
freeze(pre,"genuine signed no-Tough v5 baseline");
console.log("PASS I2H-03 real owner JWT v5 Fighter no-Tough level-up succeeds, bonus=0, all historical accounts frozen under already-tested inherited no-mirror baseline");

const outsiderDenied=await level(outsider,B);
assert.ok(outsiderDenied.error);assert.equal(outsiderDenied.error.code,"42501");
assert.equal(progressed(B),"1");freeze(pre,"original denied outsider");
const red=await level(owner,B);
assert.ifError(red.error);
assert.equal(red.data.toughProgressionBonus,2);
assert.equal(progressed(B),"2");assert.equal(maxhp(B),"21");assert.equal(countEvent(B),1);
assert.equal(legacy(owner),sheet(B));
assert.equal(legacy(editor),sheet(B));
assert.notEqual(legacy(owner),pre[0].old);
assert.notEqual(legacy(editor),pre[1].old);
assert.equal(legacy(archive),pre[3].old);
assert.equal(sheet(A),sheetA);
assert.equal(md5(toughSig),origTough);
console.log("PASS I2H-04 ORIGINAL TOUGH RED: authentic signed v5 returns +2 HP but original private Tough overwrites TWO unrelated editor legacy account sheets; inherited mirrors pre-isolated");

fixture("scripts/fixtures/i2h_option_a_tough_progression_scratch_pg17.sql");
const after=sql("SELECT pg_get_functiondef("+lit(toughSig)+"::regprocedure)");
assert.ok(after.includes("I2H_OPTION_A_NO_TOUGH_LEGACY_MIRROR"));
assert.ok(!after.toLowerCase().includes("update public.players"));
assert.notEqual(md5(toughSig),origTough);
assert.equal(md5("public.complete_character_level_up_v5(uuid,jsonb)"),origV5);
assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(toughSig)+",'EXECUTE')"),"f");
console.log("PASS I2H-05 reversible single Tough-account-UPDATE scratch applied AFTER red, original public v5 and private ACL unchanged");

sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+lit(D)+"),updated_at=now() WHERE user_id="+lit(owner.uid));
sql("UPDATE public.players SET sheet=(SELECT sheet FROM public.character_sheets WHERE character_id="+lit(C)+"),updated_at=now() WHERE user_id="+lit(editor.uid));
const frozen=snap(actors);
assert.equal(legacy(owner),sheet(D),"matching owner legacy specimen");
const green=await level(editor,D);
assert.ifError(green.error);
assert.equal(green.data.toughProgressionBonus,2);
assert.equal(progressed(D),"2");assert.equal(maxhp(D),"21");assert.equal(countEvent(D),1);
assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id="+lit(D)+" AND status='completed'"),"1");
freeze(frozen,"same-character and unrelated editor Tough GREEN");
assert.equal(sheet(A),sheetA);
console.log("PASS I2H-06 signed COEDITOR Fighter Tough 1->2 gets +2, canonical HP/level/session/event persist; same/other legacy snapshots and timestamps frozen");

const delayed=await level(owner,E);
assert.ifError(delayed.error);
assert.equal(delayed.data.toughProgressionBonus,0);
assert.equal(maxhp(E),"19");assert.equal(progressed(E),"2");
freeze(frozen,"Tough acquisition same target level no bonus");
console.log("PASS I2H-07 acquisition-level=target-level Tough correctly yields 0 extra HP and no legacy account change");

const invalid=await level(owner,F,{hp_method:"wrong"});
assert.ok(invalid.error,"Bad HP choice accepted");
assert.equal(progressed(F),"1");assert.equal(maxhp(F),"12");assert.equal(countEvent(F),0);
freeze(frozen,"invalid canonical rollback");
const replay=await level(owner,D);
assert.ok(replay.error,"Duplicated completed review accepted");
assert.equal(countEvent(D),1);
freeze(frozen,"replay rollback");
console.log("PASS I2H-08 invalid HP and completed-review replay reject without duplicate Tough effect/event/account writes");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+lit(G)+" AND user_id="+lit(owner.uid));
const revoked=await level(owner,G);
assert.ok(revoked.error);assert.equal(revoked.error.code,"42501");
const denied=await level(outsider,G);
assert.ok(denied.error);assert.equal(denied.error.code,"42501");
assert.equal(progressed(G),"1");assert.equal(countEvent(G),0);
freeze(frozen,"revoked and outsider");
console.log("PASS I2H-09 original current editor revocation and unrelated signed identity denied; no canonical or legacy writes");

assert.equal(md5("public.complete_character_level_up_v5(uuid,jsonb)"),origV5);
assert.equal(md5("private.normalize_player_choice_name_v1(text)"),"dd8cdd5b47efe99b1cfff9c2bf7635dd");
assert.equal(md5("public.complete_character_level_up_v4(uuid,jsonb)"),"f8338ef170c6e27b972e777eeae406b8");
assert.equal(md5("public.complete_character_level_up_v3(uuid,jsonb)"),"4467e166234c67fc12dd73da0e46b379");
freeze(frozen,"final provenance");
console.log("PASS I2H-10 public v5/v4/v3, original normalized Tough semantics, previous signed source scope and historical snapshots preserved");
console.log("I2H original Tough RED/scratch GREEN COMPLETE in reduced signed P1.3 Fighter fixture only; not modern Forge v3/31-trigger, full feat acquisition or production release.");
