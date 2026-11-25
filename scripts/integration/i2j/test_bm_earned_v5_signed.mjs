// Disposable I2J only. Reuse P1.3 source-authentic v5 graph; do not repeat T43/T44/T45.
// Historical BM helper is pinned to repository bytes; recorded live MD5 compared explicitly.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=process.env;
for(const [k,v] of Object.entries({GITHUB_ACTIONS:'true',CI:'true',PGHOST:'127.0.0.1',PGPORT:'54322',PGDATABASE:'postgres',DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:'P13_SOURCE_V5_LOCAL_AUTH_ONLY',DNDNEXT_I2J_BM_CONFIRM:'I2J_DISPOSABLE_BM_V5_ONLY'}))assert.equal(env[k],v,'unsafe '+k);
assert.match(env.DNDNEXT_P13_LEVELUP_URL||'',/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_P13_LEVELUP_ANON_KEY);
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const json=v=>q(JSON.stringify(v))+'::jsonb';
function psql(args){const x=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-qAt',...args],{encoding:'utf8',timeout:30000,env:{...env,PGUSER:'postgres'}});assert.equal(x.status,0,'local PG17: '+x.stderr);return x.stdout.trim()}
const sql=s=>psql(['-c',s]);
function pinned(p,h){const b=readFileSync(p);assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),h,p);return b.toString('utf8')}
function fn(s,n){const key='create or replace function '+n+'(';const i=s.toLowerCase().indexOf(key);assert.ok(i>=0&&s.toLowerCase().indexOf(key,i+key.length)<0,n);const j=s.indexOf('\n$$;',i);assert.ok(j>i,n);return s.slice(i,j+4)}
const source='scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql';
pinned(source,'b3168d0c9ec92ae1c0c389ccf55655209f2841f8');
pinned('scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql','6619cc35a9e927696868bf13d3c8942116c9c8c3');
const setup=pinned('scripts/fixtures/i1f_battle_master_joint_setup_pg17.sql','c5ae0b31605d9374b295eee01eefdda0718afb80');
const original='scripts/fixtures/i1f_battle_master_original_functions_pg17.sql';
pinned(original,'fbda236e3c1b96ef9a93c44f0a2f99a6cd77adf9');
const battle=pinned('sql/20260808_39_battle_master_maneuver_progression.sql','8782874160f4fa098241292920aa826ed17ee2d1');
const normal=pinned('sql/20260806_00_player_forge_source_choice_foundation.sql','3df1c688ad4a23085c0cdde1a14da10bd77f4fec');
const subclass=pinned('sql/20260720_01_subclass_compatibility_and_selection.sql','4e938bc3217f11b8a4ef589da83af00aaca51782');
assert.equal(sql('SELECT current_database()'),'postgres');assert.match(sql('SHOW server_version'),/^17\./);
assert.equal(sql("SELECT to_regclass('private.p13_levelup_case_guard') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL AND to_regclass('public.class_feature_option_catalog') IS NULL"),'t');
const fingerprints=[
 ['public.complete_character_level_up_v5(uuid,jsonb)','02d74b973a763c53c595be20e35e512f'],
 ['public.complete_character_level_up_v4(uuid,jsonb)','f8338ef170c6e27b972e777eeae406b8'],
 ['public.complete_character_level_up_v3(uuid,jsonb)','4467e166234c67fc12dd73da0e46b379'],
 ['private.complete_character_level_up_base_v3(uuid,jsonb)','e33639d549ef557976a3970ea51f5238'],
 ['private.sync_character_progression_from_sheet_v1()','bb1a3a2d1600ce33cd4fcadac5e0f3a9'],
 ['private.sync_player_forge_class_spell_summary_v1(uuid)','5b1b275a268a57591a2e35a05ce7480d'],
 ['private.can_manage_character_progression_v1(uuid)','ac70e4ec033d86c4e0a254d50d429a45']
];
const md5=n=>sql("SELECT md5(pg_get_functiondef("+q(n)+"::regprocedure))");
function verify(){for(const [n,h] of fingerprints)assert.equal(md5(n),h,n)}
verify();
// Reduced catalog/table DDL and exact twelve known identities from I1-F,
// not the unrelated Forge/Story setup. Reuse the original trigger statements.
const start=setup.indexOf('CREATE TABLE public.class_feature_option_catalog(');
const end=setup.indexOf('\\i scripts/fixtures/i1f_battle_master_original_functions_pg17.sql');
assert.ok(start>=0&&end>start);
sql(setup.slice(start,end));
sql(fn(normal,'private.normalize_player_choice_name_v1'));
psql(['-f',original]);
const ts=setup.indexOf('CREATE CONSTRAINT TRIGGER character_progression_materialize_battle_master_maneuvers_v1');
const te=setup.indexOf('-- Internal definer functions',ts);
assert.ok(ts>=0&&te>ts);
sql(setup.slice(ts,te));
sql(fn(battle,'private.level_up_battle_master_maneuver_group_v1'));
sql(fn(battle,'private.apply_level_up_battle_master_maneuvers_v1'));
const helper='private.apply_level_up_battle_master_maneuvers_v1(uuid,integer,jsonb,text)';
const actual=md5(helper),recorded='4154e92e9228cdc42bad2bc9fed37562';
console.log('I2J-BM historical helper MD5 '+actual+' recorded '+recorded+' match='+String(actual===recorded));
if(actual!==recorded)console.log('I2J-BM source identity HOLD: only checked-in historical helper scope, not exact deployed body');
assert.equal(md5('private.validate_existing_battle_master_maneuvers_v1()'),'8bc8a467e95b07e93df833bcfc585e80');
assert.equal(md5('private.materialize_player_forge_battle_master_maneuvers_v1()'),'daf3fc12e7c30165dca50ca650f9d308');
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND tgname IN ('character_progression_materialize_battle_master_maneuvers_v1','character_progression_validate_battle_master_maneuvers_v1') AND tgdeferrable AND tginitdeferred AND tgenabled='O'"),'2');
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_sheets'::regclass AND tgname='sync_character_progression_from_sheet_v1' AND tgenabled='O'"),'1');
assert.equal(sql("SELECT count(*) FROM public.class_feature_option_catalog WHERE option_type='battle-master-maneuver' AND source='XPHB'"),'12');
// Explicitly reduced non-BM auxiliary helpers: allow ONLY this level and class,
// no unrelated choices. Original public v5/v4/v3/base and sheet sync unchanged.
sql("CREATE OR REPLACE FUNCTION private.p13_only_plain_fighter(p_character_id uuid,p_to_level int) RETURNS void LANGUAGE plpgsql STABLE AS $bm$ BEGIN IF p_to_level<>7 OR NOT EXISTS(SELECT 1 FROM public.character_progression cp JOIN public.class_catalog cc ON cc.id=cp.class_id WHERE cp.character_id=p_character_id AND cc.class_key='fighter' AND cc.source='XPHB' AND cp.subclass_name='Battle Master' AND cp.class_level IN (6,7)) THEN RAISE EXCEPTION 'I2J reduced fixture restricts unrelated tails to Battle Master 6→7'; END IF; END $bm$;");
sql("CREATE OR REPLACE FUNCTION private.apply_level_up_warlock_invocation_replacement_v2(uuid,int,jsonb,jsonb,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $bm$ BEGIN PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3); PERFORM private.p13_only_empty($5); IF jsonb_typeof($4)<>'object' OR ($4-'fighter-battle-master-maneuvers')<>'{}'::jsonb THEN RAISE EXCEPTION 'I2J unrelated choices not staged'; END IF; RETURN '[]'::jsonb; END $bm$;");
sql("CREATE OR REPLACE FUNCTION private.sync_character_eldritch_invocations_v1(uuid) RETURNS void LANGUAGE plpgsql AS $bm$ BEGIN PERFORM private.p13_only_plain_fighter($1,7); END $bm$;");
sql("CREATE OR REPLACE FUNCTION private.level_up_persistent_choice_gaps_v1(text,text,int,int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $bm$ BEGIN IF $1<>'fighter' OR $2<>'XPHB' OR $3<>6 OR $4<>7 THEN RAISE EXCEPTION 'I2J reduced persistent gap helper permits only 6→7'; END IF; RETURN '[]'::jsonb; END $bm$;");
sql("CREATE OR REPLACE FUNCTION public.xp_threshold_for_level_v1(int) RETURNS bigint LANGUAGE sql IMMUTABLE AS $bm$ SELECT CASE WHEN $1=6 THEN 14000 WHEN $1=7 THEN 23000 WHEN $1=8 THEN 34000 WHEN $1<=1 THEN 0 WHEN $1=2 THEN 300 WHEN $1=3 THEN 900 ELSE 100000 END $bm$;");
sql("CREATE TABLE public.class_feature_catalog(feature_type text,class_key text,class_source text,subclass_name text,subclass_short_name text,source text,description text); INSERT INTO public.class_feature_catalog VALUES('subclass','fighter','XPHB','Battle Master','Battle Master','XPHB',NULL)");
sql(fn(subclass,'private.resolve_subclass_choice_v1'));
const cls='00000000-0000-0000-0000-000000008201';
sql("INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,features,proficiency_bonus,spell_slots) VALUES("+q(cls)+",6,14000,'[]',3,'{}'),("+q(cls)+",7,23000,'[]',3,'{}')");
sql("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated; NOTIFY pgrst,'reload schema'");
assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(helper)+",'EXECUTE')"),'f');
assert.equal(sql("SELECT has_function_privilege('anon','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')"),'f');
verify();
console.log('PASS I2J-BM01 source graph, paired original deferrals and 12 source identities; reduced non-BM helpers explicitly bounded');
async function actor(){const client=createClient(env.DNDNEXT_P13_LEVELUP_URL,env.DNDNEXT_P13_LEVELUP_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),email='i2j-bm-'+randomUUID()+'@example.invalid',password='I2j-'+randomUUID()+'!';assert.ifError((await client.auth.signUp({email,password})).error);assert.ifError((await client.auth.signInWithPassword({email,password})).error);const u=await client.auth.getUser(),c=await client.auth.getClaims();assert.ifError(u.error);assert.ifError(c.error);assert.equal(c.data.claims.sub,u.data.user.id);assert.equal(c.data.claims.role,'authenticated');return {client,id:u.data.user.id}}
const owner=await actor(),editor=await actor(),outsider=await actor();
for(const [a,mark] of [[owner,'owner'],[editor,'editor'],[outsider,'outsider']])sql("INSERT INTO public.players(user_id,sheet) VALUES("+q(a.id)+","+json({historical:'unrelated-'+mark})+")");
const catalog=JSON.parse(sql("SELECT jsonb_agg(jsonb_build_object('name',name,'key',option_key,'source',source,'kind',option_type) ORDER BY name) FROM public.class_feature_option_catalog WHERE option_type='battle-master-maneuver' AND source='XPHB'"));
const target=randomUUID(),group='fighter-xphb-battle-master-3-maneuver-options-0';
const choices={[group]:{kind:'battle-master-maneuver',subclassName:'Battle Master',source:'XPHB',count:3,selections:catalog.slice(0,3)}};
const sheet={classKey:'fighter',rulesetSource:'XPHB',ruleset:'2024',level:6,hp:48,maxHp:48,abilities:{con:{score:12}},subclassName:'Battle Master',subclassSource:'XPHB',classFeatureChoices:choices,meta:{classKey:'fighter',rulesetSource:'XPHB',level:6,creator:'shared_character_forge_player_v2',classFeatureChoices:choices}};
// Seed coherent source-shaped character and open synthetic review in one transaction.
// Original deferred INSERT materializer creates the three grants, not a mock.
sql("BEGIN; INSERT INTO public.characters(id,name) VALUES("+q(target)+",'I2J Battle Master six'); INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,subclass_name,subclass_source,created_by) VALUES("+q(target)+","+q(cls)+",6,23000,true,'Battle Master','XPHB',"+q(owner.id)+"); INSERT INTO public.character_sheets(character_id,sheet) VALUES("+q(target)+","+json(sheet)+"); INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+q(target)+","+q(owner.id)+",true),("+q(target)+","+q(editor.id)+",true); INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,status,metadata_ready,created_by) VALUES("+q(target)+",6,7,'open',true,"+q(owner.id)+"); COMMIT;");
const where=' WHERE character_id='+q(target);
assert.equal(sql('SELECT class_level FROM public.character_progression'+where),'6');
assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets"+where),'6');
assert.equal(sql("SELECT sheet#>>'{meta,level}' FROM public.character_sheets"+where),'6');
assert.equal(sql('SELECT count(*) FROM public.character_class_option_grant_instances'+where),'3');
assert.equal(sql('SELECT count(*) FROM public.character_class_option_grant_instances'+where+' AND acquired_level=3'),'3');
const groups=JSON.parse(sql('SELECT private.level_up_battle_master_maneuver_group_v1('+q(target)+',7)'));
assert.equal(groups.length,1);assert.equal(groups[0].metadata.delta,2);
const fields=groups[0].fields,options=fields.find(f=>f.id==='maneuvers').options.map(o=>o.key);
assert.ok(options.length>=3);
const picked={maneuvers:options.slice(0,2),replace:[fields.find(f=>f.id==='replace').options[0].key],with:[options[2]]};
const input=g=>({hp_method:'fixed',spell_choices:[],class_option_feat_instances:[],replacement_selections:{},class_choice_selections:{'fighter-battle-master-maneuvers':g}});
async function level(a,g){let res;for(let i=0;i<35;i++){res=await a.client.rpc('complete_character_level_up_v5',{p_character_id:target,p_selections:input(g)});if(res.error?.code!=='PGRST202')break;await new Promise(r=>setTimeout(r,300))}assert.notEqual(res.error?.code,'PGRST202');return res}
const snapshots=()=>Object.fromEntries(['character_progression','character_sheets','character_class_option_grant_instances','character_level_up_sessions','character_level_events','character_spells','character_permissions'].map(t=>[t,sql("SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public."+t+" t"+where)]).concat([['players',sql("SELECT md5(string_agg(to_jsonb(p)::text,'' ORDER BY user_id)) FROM public.players p")]]));
const before=snapshots();
console.log('PASS I2J-BM02 coherent Sheet/CP level 6, 3 original materialized grants and real source choice group; synthetic review row');
const deny=await level(outsider,picked);assert.equal(deny.error?.code,'42501');assert.deepEqual(snapshots(),before);
const bad=await level(owner,{...picked,with:[picked.maneuvers[0]]});assert.match(bad.error?.message||'',/replacement maneuver must be different/i);assert.deepEqual(snapshots(),before);
sql("UPDATE public.character_permissions SET can_edit=false"+where+" AND user_id="+q(owner.id));
const revokedBefore=snapshots(),revoked=await level(owner,picked);
assert.equal(revoked.error?.code,'42501');assert.deepEqual(snapshots(),revokedBefore);
sql("UPDATE public.character_permissions SET can_edit=true"+where+" AND user_id="+q(owner.id));
// Permissions table has no timestamps in this fixture; complete snapshots restored.
assert.deepEqual(snapshots(),before);
console.log('PASS I2J-BM03 signed outsider/revoked JWT and replacement-conflict negatives, full row hashes unchanged');
const outcome=await level(editor,picked);
if(outcome.error){
 assert.equal(outcome.error.code,'P0001',JSON.stringify(outcome.error));
 assert.match(outcome.error.message,/Battle Master Fighter level 6 requires 3 normalized maneuver instance\(s\); found 5\./);
 assert.deepEqual(snapshots(),before,'original failed transaction must roll back grants/sheets/progression/session/event/all accounts');
 console.log('I2J-BM04 CHARACTERIZED RED: actual signed original public v5, coherent 6→7, queued prior-level deferred validation sees five grants; full rollback');
}else{
 assert.equal(sql('SELECT class_level FROM public.character_progression'+where),'7');
 assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets"+where),'7');
 assert.equal(sql('SELECT count(*) FROM public.character_class_option_grant_instances'+where),'5');
 assert.equal(sql('SELECT count(*) FROM public.character_level_events'+where+" AND event_type='level_up_completed'"),'1');
 assert.equal(sql('SELECT count(*) FROM public.character_level_up_sessions'+where+" AND status='completed'"),'1');
 console.log('I2J-BM04 COUNTEREXAMPLE: original public v5 succeeded in this fixture; inspect account and event state before further work');
}
verify();assert.equal(md5(helper),actual);
console.log('I2J-BM RESULT: characterization only; no Option A correction, full catalog, parent/browser or release acceptance');
