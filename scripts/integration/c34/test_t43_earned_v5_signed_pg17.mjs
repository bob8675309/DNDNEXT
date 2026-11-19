#!/usr/bin/env node
// T43: REAL source-original public complete_character_level_up_v5 (not T42 wrapper)
// with original source Sorcerer Metamagic / Warlock Mystic Arcanum chooser.
// After preserved P1.3 signed F06-F28 suite in DISPOSABLE local PG17.
// Surrounding no-choice invocation/other-class tails + preferred catalog are
// deliberately reduced synthetic fixtures; NOT complete production class parity.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto,{randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";
const env=process.env;
for(const [key,value] of Object.entries({
  GITHUB_ACTIONS:"true",CI:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:"P13_SOURCE_V5_LOCAL_AUTH_ONLY",
  DNDNEXT_T43_SOURCE_V5_CONFIRM:"T43_DISPOSABLE_P13_ORIGINAL_V5_SORCERER_WARLOCK"
}))assert.equal(env[key],value,"T43 unsafe execution environment "+key);
assert.equal(env.DNDNEXT_P13_LEVELUP_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_P13_LEVELUP_ANON_KEY);
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const uuid=u=>{assert.match(u,/^[a-f0-9-]{36}$/i);return "'"+u+"'";};
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
function pinned(p,expected){
  const data=fs.readFileSync(path.join(root,p));
  assert.equal(blob(data),expected,"T43 historical original Git blob mismatch: "+p);
  return data.toString();
}
const p13=pinned("scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql","b3168d0c9ec92ae1c0c389ccf55655209f2841f8");
const choices=pinned("sql/20260808_18_metamagic_mystic_arcanum_progression.sql","ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f");
const simple=pinned("sql/20260808_16_simple_class_choice_delta_authority.sql","2e70facd2b5905bf85a63697ed0f895feb27aad5");
const normalize=pinned("sql/20260806_00_player_forge_source_choice_foundation.sql","3df1c688ad4a23085c0cdde1a14da10bd77f4fec");
function sql(s){
  const p=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",s],{
    cwd:root,env,encoding:"utf8",timeout:35000
  });
  assert.equal(p.status,0,"T43 local PG17 fixture error: "+String(p.stderr).slice(-2200));
  return p.stdout.trim();
}
function fn(src,name){
  const start=src.toLowerCase().indexOf("create or replace function "+name.toLowerCase()+"(");
  assert.ok(start>=0,"Missing original function "+name);
  const rest=src.slice(start),m=/\n(?:\$function\$|\$\$);/.exec(rest);
  assert.ok(m,"Original SQL terminator missing for "+name);
  return rest.slice(0,m.index+m[0].length);
}
function fingerprint(name,md5){
 const val=sql("SELECT md5(pg_get_functiondef("+lit(name)+"::regprocedure))");
 assert.equal(val,md5,"T43 source-original deployed function fingerprint drift: "+name);
}
const v5="public.complete_character_level_up_v5(uuid,jsonb)";
const v4="public.complete_character_level_up_v4(uuid,jsonb)";
const v3="public.complete_character_level_up_v3(uuid,jsonb)";
const base="private.complete_character_level_up_base_v3(uuid,jsonb)";
const summary="private.sync_player_forge_class_spell_summary_v1(uuid)";
const additional="private.apply_additional_level_class_choices_v1(uuid,integer,jsonb)";
const expected=new Map([
 [v5,"02d74b973a763c53c595be20e35e512f"],
 [v4,"f8338ef170c6e27b972e777eeae406b8"],
 [v3,"4467e166234c67fc12dd73da0e46b379"],
 [base,"e33639d549ef557976a3970ea51f5238"],
 [summary,"5b1b275a268a57591a2e35a05ce7480d"],
 ["private.can_manage_character_progression_v1(uuid)","ac70e4ec033d86c4e0a254d50d429a45"]
]);
const originalBase=fn(p13,"private.complete_character_level_up_base_v3");
const originalSummary=fn(p13,"private.sync_player_forge_class_spell_summary_v1");
const originalAdditional=fn(choices,"private.apply_additional_level_class_choices_v1");
const originalGetter=fn(choices,"public.get_character_level_class_choice_options_v1");
const baseMirror=[
 "  update public.players p set sheet = v_sheet, updated_at = now()",
 "  where p.user_id in (",
 "    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id",
 "  );"
].join("\n");
const summaryMirror=[
 "  update public.players p set sheet=v_sheet,updated_at=now()",
 "  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);"
].join("\n");
const additionalMirror="  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
for(const [body,mirror,label] of [
 [originalBase,baseMirror,"base"],[originalSummary,summaryMirror,"summary"],
 [originalAdditional,additionalMirror,"additional"]
])assert.equal(body.split(mirror).length,2,"Original legacy account mirror drift: "+label);
const onlyCandidate=(body,mirror,label)=>body.replace(mirror,"  -- T43 explicitly NON-ORIGINAL scratch Option A: freeze "+label+" historical account Sheet.");
const greenBase=onlyCandidate(originalBase,baseMirror,"base");
const greenSummary=onlyCandidate(originalSummary,summaryMirror,"summary");
const greenAdditional=onlyCandidate(originalAdditional,additionalMirror,"additional");
for(const body of [greenBase,greenSummary,greenAdditional])assert.doesNotMatch(body,/update public\.players p/);
const client=()=>createClient(env.DNDNEXT_P13_LEVELUP_URL,env.DNDNEXT_P13_LEVELUP_ANON_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
async function actor(name){
 const who=client(),email="t43-"+name+"-"+randomUUID()+"@example.invalid",password="T43-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const user=await who.auth.getUser(),claims=await who.auth.getClaims();
 assert.ifError(user.error);assert.ifError(claims.error);
 const id=user.data.user.id;
 assert.equal(claims.data.claims.sub,id);
 assert.equal(claims.data.claims.role,"authenticated");
 return {id,who};
}
async function rpc(who,name,args){
 let response;
 for(let i=0;i<35;i++){
  response=await who.rpc(name,args);
  if(response.error?.code!=="PGRST202")break;
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert.notEqual(response.error?.code,"PGRST202","T43 signed PostgREST RPC not loaded: "+name);
 return response;
}
const sorcererClass="00000000-0000-0000-0000-000000008243";
const warlockClass="00000000-0000-0000-0000-000000008244";
const spellId="00000000-0000-0000-0000-000000008245";
const input=(kind,choice)=>({
 hp_method:"fixed",class_choice_selections:kind==="sorcerer"?
 {"sorcerer-metamagic":{selection:choice}}:
 {"warlock-mystic-arcanum-6":{selection:choice}},
 spell_choices:[],class_option_feat_instances:[],replacement_selections:{}
});
const sorcererInput=input("sorcerer",["quickened-spell","subtle-spell"]);
const warlockInput=input("warlock",["spell-"+spellId]);
const level=(who,id,choices)=>rpc(who,"complete_character_level_up_v5",{p_character_id:id,p_selections:choices});
const progress=id=>Number(sql("SELECT class_level FROM public.character_progression WHERE character_id="+uuid(id)));
const canon=id=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+uuid(id));
const legacy=who=>sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+uuid(who.id));
const events=id=>Number(sql("SELECT count(*) FROM public.character_level_events WHERE character_id="+uuid(id)+" AND event_type='level_up_completed'"));
const completed=id=>Number(sql("SELECT count(*) FROM public.character_level_up_sessions WHERE character_id="+uuid(id)+" AND status='completed'"));
const names=(id,group)=>JSON.parse(sql("SELECT coalesce(sheet#>'{classFeatureChoices,"+group+",selections}','[]'::jsonb)::text FROM public.character_sheets WHERE character_id="+uuid(id))).map(x=>x.name);
function hist(who,marker){
 const data=JSON.stringify({marker,historicalAccountCharacter:"NOT_THIS_TARGET"});
 sql("INSERT INTO public.players(user_id,sheet) VALUES("+uuid(who.id)+","+lit(data)+"::jsonb) ON CONFLICT(user_id) DO UPDATE SET sheet=excluded.sheet,updated_at=now()");
 assert.equal(sql("SELECT sheet->>'marker' FROM public.players WHERE user_id="+uuid(who.id)),marker);
}
function link(id,who,canEdit){
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+uuid(id)+","+uuid(who.id)+","+(canEdit?"true":"false")+") ON CONFLICT(character_id,user_id) DO UPDATE SET can_edit=excluded.can_edit");
}
function char(name,kind,owner,options={}){
 const id=randomUUID(),war=kind==="warlock";
 const cid=war?warlockClass:sorcererClass,from=war?10:1,to=from+1;
 const xp=Object.hasOwn(options,"xp")?options.xp:(war?100000:300);
 const data=JSON.stringify({
   classKey:kind,rulesetSource:"XPHB",ruleset:"2024",level:from,
   hp:war?60:10,maxHp:war?60:10,abilities:{con:{score:12}},
   marker:name,meta:{classKey:kind,rulesetSource:"XPHB",level:from}
 });
 sql("INSERT INTO public.characters(id,name,kind) VALUES("+uuid(id)+","+lit("T43 "+name)+",'npc')");
 sql("INSERT INTO public.character_sheets(character_id,sheet) VALUES("+uuid(id)+","+lit(data)+"::jsonb)");
 // Exact P1.3 sheet AFTER INSERT trigger initializes the progression row.
 sql("INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by) "+
  "VALUES("+uuid(id)+","+uuid(cid)+","+from+","+xp+",true,"+uuid(owner.id)+") "+
  "ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,class_level=excluded.class_level,"+
  "experience_points=excluded.experience_points,pending_level_up=excluded.pending_level_up,created_by=excluded.created_by");
 sql("INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,metadata_ready,status,created_by) "+
  "VALUES("+uuid(id)+","+from+","+to+","+(options.metadataReady===false?"false":"true")+",'open',"+uuid(owner.id)+")");
 return id;
}
function assertWarlock(id){
 assert.equal(progress(id),11);
 assert.deepEqual(names(id,"warlock-mystic-arcanum-6"),["T43 Synthetic XPHB Warlock Sixth"]);
 const row=JSON.parse(sql("SELECT row_to_json(r)::text FROM ("+
  "SELECT source_type,source_key,known,prepared,always_available,uses_max,uses_remaining,recharge,casting_stat,raw_payload "+
  "FROM public.character_spells WHERE character_id="+uuid(id)+" AND spell_id="+uuid(spellId)+") r"));
 assert.equal(row.source_type,"class-feature");
 assert.equal(row.source_key,"warlock-mystic-arcanum-6");
 assert.equal(row.uses_max,1);assert.equal(row.uses_remaining,1);
 assert.equal(row.recharge,"long-rest");
 assert.equal(row.known,true);assert.equal(row.prepared,true);assert.equal(row.always_available,true);
 assert.equal(row.casting_stat,"cha");
 assert.equal(row.raw_payload.feature,"Mystic Arcanum");
 assert.equal(row.raw_payload.grantedAtLevel,11);
 assert.equal(sql("SELECT coalesce(sheet->'spellSlots','{}'::jsonb)::text FROM public.character_sheets WHERE character_id="+uuid(id)),"{}");
 assert.equal(events(id),1);assert.equal(completed(id),1);
}
function assertSorcerer(id){
 assert.equal(progress(id),2);
 assert.deepEqual(names(id,"sorcerer-metamagic"),["Quickened Spell","Subtle Spell"]);
 assert.equal(events(id),1);assert.equal(completed(id),1);
 assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets WHERE character_id="+uuid(id)),"2");
}
assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
assert.equal(sql("SELECT to_regclass('auth.users') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regclass('private.p13_levelup_case_guard') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
for(const [f,md5] of expected)fingerprint(f,md5);
// P1.3 original signed F06-F28 must run first, fully unchanged; its existing
// local no-choice stubs are restricted to Fighter, so expand ONLY the reduced
// class-specific helper gates below, never v5/v4/v3/base source bodies.
sql([
"CREATE OR REPLACE FUNCTION private.p13_only_plain_fighter(p_character_id uuid,p_to_level integer)",
"RETURNS void LANGUAGE plpgsql STABLE AS $t43$ DECLARE k text;",
"BEGIN SELECT cc.class_key INTO k FROM public.character_progression cp",
"JOIN public.class_catalog cc ON cc.id=cp.class_id WHERE cp.character_id=p_character_id;",
"IF NOT ((k='fighter' AND p_to_level=2) OR (k='sorcerer' AND p_to_level=2)",
" OR (k='warlock' AND p_to_level=11)) THEN",
"RAISE EXCEPTION 'T43 fixture restricts non-Fighter tails to Sorcerer 2 / Warlock 11';",
"END IF; END $t43$;"
].join("\n"));
sql([
"CREATE OR REPLACE FUNCTION private.sync_character_eldritch_invocations_v1(p_character_id uuid)",
"RETURNS void LANGUAGE plpgsql AS $t43$ DECLARE n integer;",
"BEGIN SELECT class_level INTO n FROM public.character_progression WHERE character_id=p_character_id;",
"PERFORM private.p13_only_plain_fighter(p_character_id,n); END $t43$;"
].join("\n"));
sql([
"CREATE OR REPLACE FUNCTION public.is_preferred_class_version_v1(p_class_id uuid)",
"RETURNS boolean LANGUAGE sql STABLE AS $t43$",
"SELECT EXISTS(SELECT 1 FROM public.class_catalog",
"WHERE id=p_class_id AND source='XPHB' AND class_key IN ('fighter','sorcerer','warlock')); $t43$;"
].join("\n"));
// The *five* source-defined extra choice helpers are copied byte-for-byte from
// source-pinned original migrations. The reduced stub tails above are explicit.
for(const [src,name] of [
 [normalize,"private.normalize_player_choice_name_v1"],
 [simple,"private.simple_level_class_choice_groups_v1"],
 [choices,"private.level_up_persistent_choice_gaps_v1"],
 [choices,"private.additional_level_class_choice_groups_v1"],
 [choices,"private.apply_additional_level_class_choices_v1"],
 [choices,"public.get_character_level_class_choice_options_v1"]
])sql(fn(src,name));
sql("REVOKE ALL ON FUNCTION private.apply_additional_level_class_choices_v1(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated");
sql("REVOKE ALL ON FUNCTION public.get_character_level_class_choice_options_v1(uuid) FROM PUBLIC,anon");
sql("GRANT EXECUTE ON FUNCTION public.get_character_level_class_choice_options_v1(uuid) TO authenticated");
// Only synthetic preferred Warlock 6th-level choice exists here; not the
// full production XPHB catalog. Defense-in-depth: read is revoked for clients.
for(const col of ["spell_key text","source text","classes text[]","school text"])
 sql("ALTER TABLE public.spells_catalog ADD COLUMN IF NOT EXISTS "+col);
for(const col of [
 "uses_max integer","uses_remaining integer","recharge text",
 "updated_at timestamptz NOT NULL DEFAULT now()"
])sql("ALTER TABLE public.character_spells ADD COLUMN IF NOT EXISTS "+col);
sql("CREATE UNIQUE INDEX IF NOT EXISTS t43_character_spell_source_unique "+
 "ON public.character_spells(character_id,spell_id,source_type,source_key)");
sql("CREATE VIEW public.spells_catalog_preferred WITH (security_invoker=true) AS "+
 "SELECT id,name,level,spell_key,source,classes,school FROM public.spells_catalog "+
 "WHERE source='XPHB'");
sql("REVOKE ALL ON public.spells_catalog_preferred FROM PUBLIC,anon,authenticated");
sql("INSERT INTO public.spells_catalog(id,name,level,spell_key,source,classes,school) "+
 "VALUES("+uuid(spellId)+",'T43 Synthetic XPHB Warlock Sixth',6,'t43-sixth','XPHB',ARRAY['Warlock'],'Necromancy')");
sql("INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability) VALUES "+
 "("+uuid(sorcererClass)+",'sorcerer','Sorcerer','XPHB','2024',6,'cha'),"+
 "("+uuid(warlockClass)+",'warlock','Warlock','XPHB','2024',8,'cha')");
for(const [id,levels] of [[sorcererClass,[1,2]],[warlockClass,[10,11]]]){
 for(const lvl of levels){
  const xp=lvl===1?0:lvl===2?300:100000;
  // Reduced class-slot and ordinary spell-known deltas are deliberately
  // neutral, so this T43 covers *additional* class options, not Pact Magic or
  // ordinary Sorcerer/Warlock spell learning.
  sql("INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,features,"+
    "proficiency_bonus,cantrips_known,spells_known,spell_slots) VALUES("+
    uuid(id)+","+lvl+","+xp+",'[]'::jsonb,"+(lvl>=10?4:2)+",0,0,'{}'::jsonb)");
 }
}
for(const [name,hash] of expected)fingerprint(name,hash);
assert.equal(sql("SELECT has_function_privilege('anon',"+lit(v5)+"::regprocedure,'EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(v5)+"::regprocedure,'EXECUTE')"),"t");
assert.equal(sql("SELECT has_function_privilege('authenticated',"+lit(additional)+"::regprocedure,'EXECUTE')"),"f");
assert.equal(sql("SELECT has_table_privilege('authenticated','public.spells_catalog_preferred','SELECT')"),"f");
sql("NOTIFY pgrst,'reload schema'");
console.log("PASS T43-SOURCE-STAGE: unchanged source-identical original v5/v4/v3/base/summary and original choice helpers; synthetic bounded Sorcerer/Warlock class metadata and preferred spell view isolated");

const owner=await actor("owner"),editor=await actor("editor"),viewer=await actor("viewer");
const safeOwner=await actor("green-owner"),safeEditor=await actor("green-editor"),safeViewer=await actor("green-viewer"),outsider=await actor("outsider");
for(const [a,mark] of [[owner,"T43 RED OWNER"],[editor,"T43 RED EDITOR"],[viewer,"T43 RED VIEWER"],
 [safeOwner,"T43 GREEN OWNER"],[safeEditor,"T43 GREEN EDITOR"],[safeViewer,"T43 GREEN VIEWER"]])hist(a,mark);
const originalS=char("original-sorcerer","sorcerer",owner);
const originalW=char("original-warlock","warlock",owner);
const greenS=char("green-sorcerer","sorcerer",safeOwner);
const greenW=char("green-warlock","warlock",safeOwner);
const blocked=char("low-xp-sorcerer","sorcerer",owner,{xp:0});
const unrelated=char("unrelated-sorcerer","sorcerer",safeOwner);
for(const id of [originalS,originalW,blocked])for(const [a,edit] of [[owner,true],[editor,true],[viewer,false]])link(id,a,edit);
for(const id of [greenS,greenW])for(const [a,edit] of [[safeOwner,true],[safeEditor,true],[safeViewer,false]])link(id,a,edit);
link(unrelated,safeOwner,true);
const frozenOther=canon(unrelated),initialS=canon(originalS),initialW=canon(originalW);
const legacyRed=[legacy(owner),legacy(editor),legacy(viewer)];
const legacySafe=[legacy(safeOwner),legacy(safeEditor),legacy(safeViewer)];

const options=await rpc(owner.who,"get_character_level_class_choice_options_v1",{p_character_id:originalS});
assert.ifError(options.error);
assert.equal(options.data.level,2);
assert.equal(options.data.groups.find(x=>x.id==="sorcerer-metamagic").fields[0].options.length,10);
const warOptions=await rpc(owner.who,"get_character_level_class_choice_options_v1",{p_character_id:originalW});
assert.ifError(warOptions.error);
assert.equal(warOptions.data.level,11);
assert.equal(warOptions.data.groups.find(x=>x.id==="warlock-mystic-arcanum-6").fields[0].options[0].key,"spell-"+spellId);

for(const a of [outsider,viewer]){
 const denied=await level(a,originalS,sorcererInput);
 assert.ok(denied.error);assert.equal(denied.error.code,"42501");
 const deniedW=await level(a,originalW,warlockInput);
 assert.ok(deniedW.error);assert.equal(deniedW.error.code,"42501");
}
const anon=await client().rpc("complete_character_level_up_v5",{p_character_id:originalS,p_selections:sorcererInput});
assert.ok(anon.error);
for(const values of [
 ["quickened-spell","quickened-spell"],["quickened-spell","fabricated"],
 ["quickened-spell"]
]){
 const denied=await level(owner,originalS,input("sorcerer",values));
 assert.ok(denied.error,"Invalid source choices unexpectedly committed");
}
for(const deniedInput of [input("warlock",["spell-"+randomUUID()]),input("warlock",["spell-"+spellId,"spell-"+spellId])]){
 const denied=await level(owner,originalW,deniedInput);
 assert.ok(denied.error);
}
const deniedXp=await level(owner,blocked,sorcererInput);
assert.ok(deniedXp.error,"Insufficient XP allowed after private choice mutation");
assert.equal(progress(blocked),1);assert.equal(events(blocked),0);assert.equal(completed(blocked),0);
assert.deepEqual(names(blocked,"sorcerer-metamagic"),[]);
assert.equal(canon(originalS),initialS);assert.equal(canon(originalW),initialW);
for(const [i,a] of [owner,editor,viewer].entries())assert.equal(legacy(a),legacyRed[i]);
console.log("PASS T43-ORIGINAL-NEGATIVES: signed actual v5 outsider/viewer/anonymous and wrong/duplicate/short picks denied; original low-XP base veto rolls back earlier real class helper mutation atomically");

let res=await level(owner,originalS,sorcererInput);
assert.ifError(res.error);
assertSorcerer(originalS);
assert.ok(res.data?.classChoices?.length);
assert.equal(sql("SELECT jsonb_array_length(level_choices#>'{2,class_choice_delta}') FROM public.character_progression WHERE character_id="+uuid(originalS)),"1");
assert.equal(sql("SELECT jsonb_array_length(selections->'class_choice_delta') FROM public.character_level_up_sessions WHERE character_id="+uuid(originalS)+" AND status='completed'"),"1");
for(const a of [owner,editor,viewer])assert.equal(legacy(a),canon(originalS));
assert.equal(canon(unrelated),frozenOther);
console.log("PASS T43-ORIGINAL-V5-SORCERER-RED: genuine source-authored public earned-v5 1->2 serialized Metamagic, HP, progress/session/event, clobbered 3 unrelated historical accounts");

for(const [a,label] of [[owner,"T43 RED2 OWNER"],[editor,"T43 RED2 EDITOR"],[viewer,"T43 RED2 VIEWER"]])hist(a,label);
const redWar=await level(editor,originalW,warlockInput);
assert.ifError(redWar.error);assertWarlock(originalW);
for(const a of [owner,editor,viewer])assert.equal(legacy(a),canon(originalW));
assert.equal(canon(unrelated),frozenOther);
console.log("PASS T43-ORIGINAL-V5-WARLOCK-RED: real source-authored public earned-v5 10->11 grants typed Mystic Arcanum long-rest spell; all 3 historic accounts overwritten again");

// Install exact three ONE-CLAUSE NON-ORIGINAL Option A candidates in local PG17.
// Original source files, original public v5/v4/v3 functions, RPC grants remain.
sql(greenBase);sql(greenSummary);sql(greenAdditional);
for(const [f,md5] of expected)if(![base,summary].includes(f))fingerprint(f,md5);
assert.notEqual(sql("SELECT md5(pg_get_functiondef("+lit(base)+"::regprocedure))"),expected.get(base));
assert.notEqual(sql("SELECT md5(pg_get_functiondef("+lit(summary)+"::regprocedure))"),expected.get(summary));
assert.equal(sql("SELECT pg_get_functiondef("+lit(additional)+"::regprocedure) LIKE '%update public.players p%'"),"f");
console.log("PASS T43-OPTION-A-SOURCE: only 3 originally separate private historical whole-account Sheet writers omitted; v5/v4/v3 source identities, other arithmetic, class/spell logic unchanged");

res=await level(safeOwner,greenS,sorcererInput);
assert.ifError(res.error);assertSorcerer(greenS);
assert.ok(res.data?.classChoices?.length);
for(const [i,a] of [safeOwner,safeEditor,safeViewer].entries())assert.equal(legacy(a),legacySafe[i]);
assert.equal(canon(unrelated),frozenOther);
const repeated=await level(safeOwner,greenS,sorcererInput);
assert.ok(repeated.error);
assert.equal(events(greenS),1);assert.equal(completed(greenS),1);
console.log("PASS T43-OPTION-A-SORCERER: full signed original v5 canonical, HP/session/event with all THREE independent historical account Sheets frozen; replay no duplicate");

sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+uuid(greenW)+" AND user_id="+uuid(safeOwner.id));
const revoked=await level(safeOwner,greenW,warlockInput);
assert.ok(revoked.error);assert.equal(revoked.error.code,"42501");
res=await level(safeEditor,greenW,warlockInput);assert.ifError(res.error);assertWarlock(greenW);
for(const [i,a] of [safeOwner,safeEditor,safeViewer].entries())assert.equal(legacy(a),legacySafe[i]);
assert.equal(canon(unrelated),frozenOther);
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
console.log("PASS T43-OPTION-A-WARLOCK-REVOKE: real v5 signed coeditor grants typed 6th-level source-shaped Mystic Arcanum while revoked owner (same JWT) denied; 3 account histories frozen");

console.log("PASS T43 RESEARCH: original v5 Sorcerer and Warlock earned transitions RED, separately sourced 3-mirror Option A GREEN; P1.3 fully inherited; reduced ordinary spell metadata and optional-class helpers, no browser/production approval");
