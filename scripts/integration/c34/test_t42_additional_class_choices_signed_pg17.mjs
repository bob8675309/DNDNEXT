#!/usr/bin/env node
// T42 limited signed helper probe: NOT a public earned-v5 transaction or UI.
// Previous #364 tested earned-v5 featureless Fighter; this tests original
// additional Sorcerer choices under a separately labeled local-only wrapper.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto,{randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";

const env=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T42_SIGNED_CONFIRM:"ADDITIONAL_CLASS_CHOICES_ORIGINAL_HELPER_LOCAL_ONLY"
}))assert.equal(env[k],v,"T42 unsafe environment "+k);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const q=x=>{assert.match(x,/^[0-9a-f-]{36}$/i);return "'"+x+"'";};
const lit=x=>"'"+String(x).replaceAll("'","''")+"'";
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
function pinned(p,sha){const b=fs.readFileSync(path.join(root,p));assert.equal(blob(b),sha);return b.toString();}
const source=pinned("sql/20260808_18_metamagic_mystic_arcanum_progression.sql","ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f");
const normal=pinned("sql/20260806_00_player_forge_source_choice_foundation.sql","3df1c688ad4a23085c0cdde1a14da10bd77f4fec");
const simple=pinned("sql/20260808_16_simple_class_choice_delta_authority.sql","2e70facd2b5905bf85a63697ed0f895feb27aad5");
function sql(x){const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",x],{cwd:root,env,encoding:"utf8",timeout:30000});assert.equal(r.status,0,"T42 scratch SQL: "+String(r.stderr).slice(-1800));return r.stdout.trim();}
function fn(src,name){const a=src.toLowerCase().indexOf("create or replace function "+name.toLowerCase()+"(");assert.ok(a>=0,"missing "+name);const s=src.slice(a),m=/\n(?:\$function\$|\$\$);/.exec(s);assert.ok(m,"terminator "+name);return s.slice(0,m.index+m[0].length);}
const groups=fn(source,"private.additional_level_class_choice_groups_v1");
const original=fn(source,"private.apply_additional_level_class_choices_v1");
const getter=fn(source,"public.get_character_level_class_choice_options_v1");
const normalize=fn(normal,"private.normalize_player_choice_name_v1");
const simpleGroups=fn(simple,"private.simple_level_class_choice_groups_v1");
const mirror="  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
assert.equal(original.split(mirror).length,2);
assert.ok(!mirror.includes("can_edit"));
const candidate=original.replace(mirror,"  -- T42 NON-ORIGINAL Option A: historical account snapshots frozen.");
assert.notEqual(candidate,original);assert.doesNotMatch(candidate,/update public\.players p/);
for(const s of ["not source-legal","already selected","classFeatureChoices","update public.character_sheets set sheet=v_sheet","private.normalize_player_choice_name_v1"])assert.ok(candidate.includes(s));
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
async function actor(label,role){const who=client(),email="t42-"+label+"-"+randomUUID()+"@example.invalid",password="T42-"+randomUUID()+"!";assert.ifError((await who.auth.signUp({email,password})).error);assert.ifError((await who.auth.signInWithPassword({email,password})).error);const u=await who.auth.getUser(),claims=await who.auth.getClaims();assert.ifError(u.error);assert.ifError(claims.error);const id=u.data.user.id;assert.equal(claims.data.claims.sub,id);sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(id)+","+lit(role)+") ON CONFLICT(id) DO UPDATE SET role=excluded.role");return {who,id};}
async function rpc(who,name,args){let r;for(let i=0;i<35;i++){r=await who.rpc(name,args);if(r.error?.code!=="PGRST202")break;await new Promise(resolve=>setTimeout(resolve,300));}assert.notEqual(r.error?.code,"PGRST202","missing PostgREST "+name);return r;}
async function make(gm,name,cls,key){const r=await rpc(gm.who,"create_character_v1",{p_payload:{name:"T42 "+name+" "+randomUUID().slice(0,7),kind:"npc",creation_request_id:randomUUID(),sheet:{classKey:key,classSource:"XPHB",level:1,marker:name}}});assert.ifError(r.error);const id=r.data;assert.match(id,/^[0-9a-f-]{36}$/i);sql("INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points) VALUES("+q(id)+","+q(cls)+",1,0) ON CONFLICT(character_id) DO UPDATE SET class_id=excluded.class_id,class_level=excluded.class_level");return id;}
function link(cid,a,edit){sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+q(cid)+","+q(a.id)+","+(edit?"true":"false")+",false,false) ON CONFLICT(character_id,user_id) DO UPDATE SET can_edit=excluded.can_edit");}
function hist(a,marker){sql("INSERT INTO public.players(user_id,name,sheet) VALUES("+q(a.id)+","+lit(marker)+","+lit(JSON.stringify({marker,legacyCharacter:"OTHER_HISTORICAL"}))+"::jsonb)");}
const canonical=id=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(id));
const legacy=a=>sql("SELECT md5(sheet::text) FROM public.players WHERE user_id="+q(a.id));
const names=id=>JSON.parse(sql("SELECT coalesce(sheet#>'{classFeatureChoices,sorcerer-metamagic,selections}','[]'::jsonb)::text FROM public.character_sheets WHERE character_id="+q(id))).map(x=>x.name);
const payload=keys=>({"sorcerer-metamagic":{selection:keys}});
const apply=(a,id,keys)=>rpc(a.who,"t42_local_additional_choice_probe_v1",{p_character_id:id,p_to_level:2,p_selections:payload(keys)});
assert.equal(sql("SELECT current_database()"),"postgres");
assert.match(sql("SHOW server_version"),/^17\./);
assert.equal(sql("SELECT to_regclass('auth.users') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('private.can_manage_character_progression_v1(uuid)') IS NOT NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
assert.equal(sql("SELECT to_regprocedure('public.complete_character_level_up_v5(uuid,jsonb)') IS NULL"),"t","C34 does not stage real earned-v5");
if(sql("SELECT to_regprocedure('private.normalize_player_choice_name_v1(text)') IS NULL")==="t")sql(normalize);
if(sql("SELECT to_regprocedure('private.simple_level_class_choice_groups_v1(uuid,integer)') IS NULL")==="t")sql(simpleGroups);
sql(groups);sql(original);sql(getter);
sql("REVOKE ALL ON FUNCTION private.apply_additional_level_class_choices_v1(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated");
sql("REVOKE ALL ON FUNCTION private.additional_level_class_choice_groups_v1(uuid,integer) FROM PUBLIC,anon,authenticated");
sql("REVOKE ALL ON FUNCTION public.get_character_level_class_choice_options_v1(uuid) FROM PUBLIC,anon");
sql("GRANT EXECUTE ON FUNCTION public.get_character_level_class_choice_options_v1(uuid) TO authenticated");
sql([
"CREATE OR REPLACE FUNCTION public.t42_local_additional_choice_probe_v1(p_character_id uuid,p_to_level integer,p_selections jsonb)",
"RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private','auth' AS $t42$",
"BEGIN",
"IF NOT private.can_manage_character_progression_v1(p_character_id) THEN",
"RAISE EXCEPTION 'No T42 local permission.' USING errcode='42501'; END IF;",
"IF p_to_level<>2 THEN RAISE EXCEPTION 'T42 only tests Sorcerer level two.' USING errcode='22023'; END IF;",
"RETURN private.apply_additional_level_class_choices_v1(p_character_id,p_to_level,p_selections);",
"END; $t42$;"
].join("\n"));
sql("REVOKE ALL ON FUNCTION public.t42_local_additional_choice_probe_v1(uuid,integer,jsonb) FROM PUBLIC,anon");
sql("GRANT EXECUTE ON FUNCTION public.t42_local_additional_choice_probe_v1(uuid,integer,jsonb) TO authenticated");
sql("NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT has_function_privilege('anon','public.t42_local_additional_choice_probe_v1(uuid,integer,jsonb)','EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','private.apply_additional_level_class_choices_v1(uuid,integer,jsonb)','EXECUTE')"),"f");
console.log("PASS T42-ORIGINAL-SETUP: source migration intact, private helper + real getter, separately labeled local signed test wrapper; actual v5 not installed");

const gm=await actor("gm","gm"),owner=await actor("owner","player"),editor=await actor("editor","player"),viewer=await actor("viewer","player"),outsider=await actor("outsider","player");
const safeOwner=await actor("green-owner","player"),safeEditor=await actor("green-editor","player"),safeViewer=await actor("green-viewer","player");
sql("INSERT INTO private.test_admins(id) VALUES("+q(gm.id)+") ON CONFLICT DO NOTHING");
const sorcerer="00000000-0000-0000-0000-000000000142",fighter="00000000-0000-0000-0000-000000000001";
sql("INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die) VALUES("+q(sorcerer)+",'sorcerer','Sorcerer','XPHB','2024',6)");
const originalId=await make(gm,"original",sorcerer,"sorcerer");
const greenId=await make(gm,"green",sorcerer,"sorcerer");
const unrelated=await make(gm,"unrelated",fighter,"fighter");
for(const [id,members] of [[originalId,[[owner,true],[editor,true],[viewer,false]]],[greenId,[[safeOwner,true],[safeEditor,true],[safeViewer,false]]]])for(const [a,edit] of members)link(id,a,edit);
for(const [a,marker] of [[owner,"T42_OWNER_HISTORY"],[editor,"T42_EDITOR_HISTORY"],[viewer,"T42_VIEWER_HISTORY"],[safeOwner,"T42_GREEN_OWNER"],[safeEditor,"T42_GREEN_EDITOR"],[safeViewer,"T42_GREEN_VIEWER"]])hist(a,marker);
const first=canonical(originalId),greenFirst=canonical(greenId),otherFirst=canonical(unrelated);
const owners=[legacy(owner),legacy(editor),legacy(viewer)];
const frozen=[legacy(safeOwner),legacy(safeEditor),legacy(safeViewer)];
const opts=await rpc(owner.who,"get_character_level_class_choice_options_v1",{p_character_id:originalId});
assert.ifError(opts.error);assert.equal(opts.data.level,2);
const group=opts.data.groups.find(g=>g.id==="sorcerer-metamagic");
assert.equal(group.kind,"metamagic");assert.equal(group.fields[0].count,2);
assert.equal(group.fields[0].options.length,10);
for(const a of [outsider,viewer]){
 const get=await rpc(a.who,"get_character_level_class_choice_options_v1",{p_character_id:originalId});
 assert.ok(get.error);assert.equal(get.error.code,"42501");
 const denied=await apply(a,originalId,["quickened-spell","subtle-spell"]);
 assert.ok(denied.error);assert.equal(denied.error.code,"42501");
}
const anon=await client().rpc("t42_local_additional_choice_probe_v1",{p_character_id:originalId,p_to_level:2,p_selections:payload(["quickened-spell","subtle-spell"])});
assert.ok(anon.error);
for(const keys of [["quickened-spell","quickened-spell"],["quickened-spell","fabricated"],["quickened-spell"]]){
 const bad=await apply(owner,originalId,keys);assert.ok(bad.error,"bad class choices accepted");
}
assert.equal(canonical(originalId),first);
for(const [i,a] of [owner,editor,viewer].entries())assert.equal(legacy(a),owners[i]);
console.log("PASS T42-ORIGINAL-NEGATIVES: real source options getter, outsider/read-only/anon blocked, duplicate/forged/incomplete picks rolled back");

let r=await apply(owner,originalId,["quickened-spell","subtle-spell"]);assert.ifError(r.error);
assert.deepEqual(names(originalId),["Quickened Spell","Subtle Spell"]);
assert.notEqual(canonical(originalId),first);
for(const a of [owner,editor,viewer])assert.equal(legacy(a),canonical(originalId));
assert.equal(canonical(greenId),greenFirst);assert.equal(canonical(unrelated),otherFirst);
console.log("PASS T42-ORIGINAL-SIGNED-RED: source original Metamagic helper overwrites owner, editor AND read-only linked historic account Sheets");

sql(candidate);
assert.equal(sql("SELECT pg_get_functiondef('private.apply_additional_level_class_choices_v1(uuid,integer,jsonb)'::regprocedure) LIKE '%update public.players p%'"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','private.apply_additional_level_class_choices_v1(uuid,integer,jsonb)','EXECUTE')"),"f");
console.log("PASS T42-OPTION-A-SOURCE: only account-wide mirror removed, source-original option and canonical guards unchanged");
r=await apply(safeOwner,greenId,["careful-spell","distant-spell"]);assert.ifError(r.error);
assert.deepEqual(names(greenId),["Careful Spell","Distant Spell"]);
assert.notEqual(canonical(greenId),greenFirst);
for(const [i,a] of [safeOwner,safeEditor,safeViewer].entries())assert.equal(legacy(a),frozen[i]);
const stable=canonical(greenId);
for(const keys of [["careful-spell","distant-spell"],["careful-spell","fabricated"]]){
 const invalid=await apply(safeOwner,greenId,keys);assert.ok(invalid.error);
}
assert.equal(canonical(greenId),stable);assert.equal(canonical(unrelated),otherFirst);
console.log("PASS T42-OPTION-A-GREEN: canonical additions succeed with all 3 historical accounts frozen; invalid and duplicates denied");
sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(greenId)+" AND user_id="+q(safeOwner.id));
const revoked=await apply(safeOwner,greenId,["empowered-spell","extended-spell"]);
assert.ok(revoked.error);assert.equal(revoked.error.code,"42501");
r=await apply(safeEditor,greenId,["empowered-spell","extended-spell"]);assert.ifError(r.error);
assert.deepEqual(names(greenId),["Careful Spell","Distant Spell","Empowered Spell","Extended Spell"]);
for(const [i,a] of [safeOwner,safeEditor,safeViewer].entries())assert.equal(legacy(a),frozen[i]);
assert.equal(canonical(unrelated),otherFirst);
assert.equal(sql("SELECT to_regprocedure('public._force_depart_on_route_assign()') IS NULL"),"t");
console.log("PASS T42-OPTION-A-REVOKE: same JWT access revoked, authorized editor continues; linked read-only account remains frozen");
console.log("PASS T42 LIMITED HELPER: signed source-original Sorcerer Metamagic RED then non-original Option A GREEN; full earned-v5, Warlock and browser release HOLD");
