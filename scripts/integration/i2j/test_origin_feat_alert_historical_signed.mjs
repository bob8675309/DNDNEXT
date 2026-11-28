// I2J historical public-source nested Alert only. Derived from immutable WL setup; not restored-source acceptance.
// Original captured Warlock guards, acquisition and historical earned/projection source pinned separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=process.env;
assert.equal(env.DNDNEXT_I2J_ORIGIN_HISTORICAL_CONFIRM,'I2J_PUBLIC_HISTORY_ALERT_ONLY');
for(const [k,v] of Object.entries({GITHUB_ACTIONS:'true',CI:'true',PGHOST:'127.0.0.1',PGPORT:'54322',PGDATABASE:'postgres',DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:'P13_SOURCE_V5_LOCAL_AUTH_ONLY',DNDNEXT_I2J_WARLOCK_CONFIRM:'I2J_DISPOSABLE_WARLOCK_V5_ONLY'}))assert.equal(env[k],v,'unsafe '+k);
assert.match(env.DNDNEXT_P13_LEVELUP_URL||'',/^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(env.DNDNEXT_P13_LEVELUP_ANON_KEY);
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const json=v=>q(JSON.stringify(v))+'::jsonb';
function psql(args){const x=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-qAt',...args],{encoding:'utf8',timeout:30000,env:{...env,PGUSER:'postgres'}});assert.equal(x.status,0,'local PG17: '+x.stderr);return x.stdout.trim()}
const sql=s=>psql(['-c',s]);
function pinned(p,h){const b=readFileSync(p);assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),h,p);return b.toString('utf8')}
function fn(s,n){const key='create or replace function '+n+'(';const i=s.toLowerCase().indexOf(key);assert.ok(i>=0&&s.toLowerCase().indexOf(key,i+key.length)<0,n);const j=s.indexOf('\n$$;',i);assert.ok(j>i,n);return s.slice(i,j+4)}
pinned('scripts/integration/i2j/test_warlock_earned_v5_signed.mjs','632af4a77ccf525e3d2b5fbe64d2409e2d21af44');
const source='scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql';
pinned(source,'b3168d0c9ec92ae1c0c389ccf55655209f2841f8');
pinned('scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql','6619cc35a9e927696868bf13d3c8942116c9c8c3');


assert.equal(sql('SELECT current_database()'),'postgres');assert.match(sql('SHOW server_version'),/^17\./);
assert.equal(sql("SELECT to_regclass('private.p13_levelup_case_guard') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL AND to_regclass('public.class_feature_option_catalog') IS NULL"),'t');
const gSetup=pinned('scripts/fixtures/i1g_warlock_invocation_joint_setup_pg17.sql','fe3a95f0562ddf804b10ef1938af383d09e74ea1');
const bmSetup=pinned('scripts/fixtures/i1f_battle_master_joint_setup_pg17.sql','c5ae0b31605d9374b295eee01eefdda0718afb80');
const guards='scripts/fixtures/i1g_warlock_original_functions_pg17.sql',acquisition='scripts/fixtures/i1g_warlock_original_acquisition_pg17.sql',guardDDL='scripts/fixtures/i1g_warlock_original_trigger_install_pg17.sql';
pinned(guards,'7a1cb66a17552b11e52c391563d0cf5aba52829a');pinned(acquisition,'7ec34da724bb22ed5d299ff27a5e07e0f0373180');pinned(guardDDL,'90fd7a3f7dc81fd146605de131747755312b4aa9');
const hSetup=pinned('scripts/fixtures/i1h_warlock_acquisition_with_guards_pg17.sql','c8c22cafa567f986d8049060d02e687fd040601e');
const earned=pinned('sql/20260808_26_earned_warlock_invocation_progression.sql','e32062499f2e3b40ce2be38c22fa4f1cafa90f3c');
const projection=pinned('sql/20260808_37_sync_eldritch_invocation_sheet_projection.sql','84f1bc63a0761023dc2c48d71705faba99a23df7');
const normal=pinned('scripts/fixtures/forge_progression_authority_original_pg17.sql','3a0b6caeb6712f67af7895433df15f1439b19581');
const access=pinned('sql/20260808_19_source_aware_level_up_spell_access.sql','ba4443302d37bb99532695e438bd1c0d0f1e4e5c');
const wizOriginal=pinned('scripts/fixtures/i1e_wizard_original_functions_pg17.sql','c0322578db9e848b20a476b32681c07e316f0870');
const authority=pinned('sql/20260808_21_player_forge_class_option_instance_authority.sql','81db89dad30e5bbc2c9f07a8f4fbd72782a09294');
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


function extract(src,start,end){const i=src.indexOf('\n'+start),j=src.indexOf('\n'+end,i+1);assert.ok(i>=0&&j>i,start);return src.slice(i+1,j)}
function stmt(src,start){const needle='\n'+start;assert.equal(src.split(needle).length,2,start);const i=src.indexOf(needle)+1,j=src.indexOf(';',i);assert.ok(j>i,start);return src.slice(i,j+1)}
function captured(src,name){const i=src.toLowerCase().indexOf('create or replace function '+name+'('),j=src.indexOf('\n$function$;',i);assert.ok(i>=0&&j>i,name);return src.slice(i,j+12)}
sql(extract(bmSetup,'CREATE TABLE public.class_feature_option_catalog(','-- Original live XPHB Fighter maneuver IDs'));
sql(stmt(gSetup,'CREATE TABLE private.player_forge_source_choice_legacy_v1'));
sql(stmt(gSetup,'ALTER TABLE public.class_feature_option_catalog'));
sql(stmt(gSetup,'INSERT INTO public.class_feature_option_catalog'));
sql("ALTER TABLE public.class_feature_option_catalog ADD COLUMN description text;");
sql(stmt(gSetup,'ALTER TABLE public.spells_catalog'));
sql(stmt(gSetup,'INSERT INTO public.spells_catalog'));
sql("CREATE VIEW public.character_option_catalog_preferred AS SELECT * FROM public.character_option_catalog WHERE source='XPHB'; CREATE VIEW public.spells_catalog_preferred AS SELECT * FROM public.spells_catalog WHERE source='XPHB';");
sql(stmt(gSetup,'INSERT INTO public.character_option_catalog'));
sql("REVOKE ALL ON public.character_option_catalog_preferred,public.character_option_grant_instances,public.spells_catalog,public.spells_catalog_preferred,public.character_spells FROM PUBLIC,anon,authenticated; REVOKE ALL ON private.player_forge_source_choice_legacy_v1 FROM PUBLIC,anon,authenticated");
sql(captured(normal,'private.normalize_player_choice_name_v1'));
assert.equal(md5('private.normalize_player_choice_name_v1(text)'),'dd8cdd5b47efe99b1cfff9c2bf7635dd');
psql(['-f',guards]);psql(['-f',acquisition]);psql(['-f',guardDDL]);sql(stmt(hSetup,'CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_class_options_v1'));
sql(fn(authority,'private.guard_direct_class_option_authority_mutation_v1'));sql(stmt(authority,'create trigger character_class_option_instances_direct_authority_guard_v1'));
for(const n of ['private.level_up_warlock_invocation_groups_v1','private.apply_level_up_warlock_invocations_v1'])sql(fn(earned,n));
sql(fn(projection,'private.sync_character_eldritch_invocations_v1'));
sql(captured(wizOriginal,'private.highest_spell_level_from_slots_v1'));sql(fn(access,'private.level_up_spell_access_v1'));
const earnedName='private.apply_level_up_warlock_invocations_v1(uuid,integer,jsonb,jsonb)',syncName='private.sync_character_eldritch_invocations_v1(uuid)',validator='private.validate_existing_normalized_warlock_invocations_v2()';
const earnedHash=md5(earnedName),syncHash=md5(syncName),expectedEarned='ed0655adf02e9413157efe8a8bd414f9',expectedSync='69361283a0ba3b9d83a2104256a86f66';
console.log('I2J-WL earned helper MD5 '+earnedHash+' recorded '+expectedEarned+' match='+String(earnedHash===expectedEarned));
console.log('I2J-WL projection helper MD5 '+syncHash+' recorded '+expectedSync+' match='+String(syncHash===expectedSync));
if(earnedHash!==expectedEarned||syncHash!==expectedSync)console.log('I2J-WL source identity HOLD: mismatched helper limited to historical migration scope');
assert.equal(md5(validator),'4f1752db655b6ba490113f604c7583ef');
assert.equal(md5('private.reject_unmarked_legacy_warlock_invocations_v1()'),'631fbb585f47e71a619ca8ac8e212407');
assert.equal(md5('private.validate_and_materialize_player_forge_class_options_v1()'),'6df5aee6f0519c9c77758d6e887ed8e4');
const triggerNames="'character_progression_reject_unmarked_legacy_warlock_invocation','character_progression_validate_player_forge_class_options_v1','character_progression_validate_player_forge_class_options_v2'";
const triggerSnapshot=()=>sql("SELECT string_agg(pg_get_triggerdef(oid,true), E'\\n' ORDER BY tgname) FROM pg_trigger WHERE tgname IN ("+triggerNames+") AND tgenabled='O' AND tgdeferrable AND tginitdeferred");
const triggers=triggerSnapshot();assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgname IN ("+triggerNames+") AND tgenabled='O' AND tgdeferrable AND tginitdeferred"),'3');
// No replacement selected. The v5 replacement tail receives the earned feat payload too;
// this disposable no-replacement fixture allows only the bound Alert row through to v4.
// It does not validate the row's choices; the real historical validator must do that.
// No replacement selected, no other class features. Explicitly reduced v2
// replacement wrapper and unrelated helper exits; no real replacement/feat claim.
sql("CREATE OR REPLACE FUNCTION private.p13_only_plain_fighter(p_character_id uuid,p_to_level int) RETURNS void LANGUAGE plpgsql STABLE AS $w$ BEGIN IF p_to_level<>2 OR NOT EXISTS(SELECT 1 FROM public.character_progression cp JOIN public.class_catalog cc ON cc.id=cp.class_id WHERE cp.character_id=p_character_id AND cc.class_key='warlock' AND cc.source='XPHB' AND cp.class_level IN (1,2)) THEN RAISE EXCEPTION 'I2J reduced fixture restricts unrelated tails to Warlock 1→2'; END IF; END $w$;");
sql("CREATE OR REPLACE FUNCTION private.apply_level_up_warlock_invocation_replacement_v2(uuid,int,jsonb,jsonb,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $w$ BEGIN PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3); IF jsonb_typeof($5) IS DISTINCT FROM 'array' OR jsonb_array_length($5)>1 THEN RAISE EXCEPTION 'I2J fixture only stages one earned Alert child'; END IF; IF EXISTS(SELECT 1 FROM jsonb_array_elements($5) AS f(instance) WHERE jsonb_typeof(f.instance) IS DISTINCT FROM 'object' OR f.instance->>'acquisitionOwnerKey' IS DISTINCT FROM 'warlock-invocation-slot-2' OR f.instance->>'optionId' IS DISTINCT FROM '735de8f5-94b0-4052-a7b2-8ae15ac9a55c' OR $4#>>'{warlock-invocation-slot-2,invocation,0}' IS DISTINCT FROM 'optional-feature:lessons-of-the-first-ones|XPHB' OR $4#>>'{warlock-invocation-slot-2,child-lessons-of-the-first-ones,0}' IS DISTINCT FROM f.instance->>'optionId') THEN RAISE EXCEPTION 'I2J fixture only stages one earned Alert child'; END IF; IF jsonb_typeof($4)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys($4) k WHERE k NOT IN ('warlock-invocation-slot-2','warlock-invocation-slot-3')) OR NOT EXISTS(SELECT 1 FROM public.character_sheets WHERE character_id=$1 AND jsonb_typeof(sheet->'sourceChoices')='object') THEN RAISE EXCEPTION 'I2J unrelated choices or missing source parent not staged'; END IF; RETURN '[]'::jsonb; END $w$;");
sql("CREATE OR REPLACE FUNCTION private.level_up_persistent_choice_gaps_v1(text,text,int,int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $w$ BEGIN IF $1<>'warlock' OR $2<>'XPHB' OR $3<>1 OR $4<>2 THEN RAISE EXCEPTION 'I2J unrelated gap metadata not staged'; END IF; RETURN '[]'::jsonb; END $w$;");
sql("CREATE OR REPLACE FUNCTION public.is_preferred_class_version_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS $w$ SELECT EXISTS(SELECT 1 FROM public.class_catalog WHERE id=$1 AND source='XPHB' AND class_key='warlock') $w$;");
sql("CREATE FUNCTION public.is_preferred_spell_version_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS $w$ SELECT EXISTS(SELECT 1 FROM public.spells_catalog_preferred WHERE id=$1) $w$;");
const historicalFeat=pinned('sql/20260808_24_source_owned_origin_feat_authority.sql','bdc9e3513a689adf66c8b95b80ecb8ee76fb5203');
const materializerSource=pinned('sql/20260808_34_reversible_source_owned_origin_feats.sql','97383438092320618fbcd4aa0de304ae77f3c64a');
const featName='private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text)';
const featValidator='private.validate_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb)';
sql(fn(historicalFeat,'private.origin_feat_spell_choice_v1'));
sql(fn(historicalFeat,'private.origin_feat_skill_choice_valid_v1'));
sql(fn(historicalFeat,'private.validate_source_owned_origin_feat_v1'));
sql(fn(materializerSource,'private.apply_source_owned_origin_feat_v1'));
const materializerHash=md5(featName),historicalValidatorHash=md5(featValidator);
assert.equal(materializerHash,'b7d69d8643a6b2ba2be8efbb4ee41243','exact materializer installation');
assert.notEqual(historicalValidatorHash,'eee232817f6bd71eba8b92a1439a8ebf','historical validator must not masquerade as restored source');
assert.equal(earnedHash,'dfe9c0f7de7904c2b308c2dacb0897ce','historical earned source');
console.log('I2J-OF-HIST source materializer '+materializerHash+' historical validator '+historicalValidatorHash+' historical earned '+earnedHash);
const cls='6792abd0-1fd9-44fb-ae4c-56c307ab791a';
sql("INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability) VALUES("+q(cls)+",'warlock','Warlock','XPHB','2024',8,'cha')");
for(const [lv,xp,slots,known] of [[1,0,[1],2],[2,300,[2],3]])sql("INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,features,proficiency_bonus,cantrips_known,spells_known,spell_slots) VALUES("+q(cls)+","+lv+","+xp+",'[]',2,2,"+known+","+json(slots)+")");
const ordinaryIds=[randomUUID(),randomUUID(),randomUUID()];
for(const [i,id] of ordinaryIds.entries())sql("INSERT INTO public.spells_catalog(id,name,level,classes,source,school,spell_key) VALUES("+q(id)+","+q('I2J synthetic ordinary Warlock '+i)+",1,ARRAY['Warlock'],'XPHB','Enchantment',"+q('i2j-warlock-ordinary-'+i)+")");
sql("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated; NOTIFY pgrst,'reload schema'");
for(const n of [earnedName,syncName,validator])assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(n)+",'EXECUTE')"),'f');
assert.equal(sql("SELECT has_function_privilege('anon','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')"),'f');verify();
console.log('PASS OF-HIST-01 original public v5 chain, original materializer fingerprint, historical earned and validator, bounded schema and catalog');
async function actor(){const client=createClient(env.DNDNEXT_P13_LEVELUP_URL,env.DNDNEXT_P13_LEVELUP_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),email='i2j-warlock-'+randomUUID()+'@example.invalid',password='I2j-'+randomUUID()+'!';assert.ifError((await client.auth.signUp({email,password})).error);assert.ifError((await client.auth.signInWithPassword({email,password})).error);const u=await client.auth.getUser(),c=await client.auth.getClaims();assert.ifError(u.error);assert.ifError(c.error);assert.equal(c.data.claims.sub,u.data.user.id);assert.equal(c.data.claims.role,'authenticated');return {client,id:u.data.user.id}}


const owner=await actor(),editor=await actor(),viewer=await actor(),outsider=await actor(),actors=[owner,editor,viewer,outsider];
for(const a of actors)sql("INSERT INTO public.players(user_id,sheet) VALUES("+q(a.id)+","+json({historical:a.id})+")");
const account=()=>actors.map(a=>sql('SELECT md5(to_jsonb(p)::text) FROM public.players p WHERE user_id='+q(a.id)));
function mark(label){for(const [i,a] of actors.entries())sql("UPDATE public.players SET sheet="+json({historical:label+'-'+i})+",updated_at=now() WHERE user_id="+q(a.id))}
const key=n=>'optional-feature:'+n+'|XPHB',pact=key('pact-of-the-blade'),armor=key('armor-of-shadows'),mind=key('eldritch-mind'),agon=key('agonizing-blast'),thirst=key('thirsting-blade'),eb='47d3fd14-695b-4d54-a3fb-9c210ed59952',poison='27d42a4f-4fbc-44c2-8f8c-e8d68978ef98';
const def=n=>sql('SELECT pg_get_functiondef('+q(n)+'::regprocedure)');
const once=(s,old,v)=>{assert.equal(s.split(old).length,2,'source anchor drift '+old);return s.replace(old,v)};
const baseName='private.complete_character_level_up_base_v3(uuid,jsonb)',summaryName='private.sync_player_forge_class_spell_summary_v1(uuid)';
const baseBody=def(baseName),summaryBody=def(summaryName),earnedBody=def(earnedName),syncBody=def(syncName),oldValidator=def(validator);
const baseMirror="  update public.players p set sheet = v_sheet, updated_at = now()\n  where p.user_id in (\n    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id\n  );";
const summaryMirror="  update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
const earnedMirror="  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
const omission='  -- I2J explicitly NON-ORIGINAL disposable Option A: historical account frozen.';
function seed(xp=300){
 const id=randomUUID(),w=' WHERE character_id='+q(id),slot='warlock-invocation-slot-1';
 const first={ownerType:'class-option',ownerKey:'warlock-invocation-1',source:'XPHB',placement:'class',level:1,metadata:{family:'eldritch-invocation',slot:1,acquisitionLevel:1},fields:{invocation:{selections:[{key:pact,value:pact,label:'Pact of the Blade',source:'XPHB',kind:'eldritch-invocation'}]}}};
 const sheet={classKey:'warlock',rulesetSource:'XPHB',ruleset:'2024',level:1,hp:9,maxHp:9,abilities:{con:{score:12}},sourceChoices:{[slot]:first},eldritchInvocations:['Pact of the Blade'],meta:{classKey:'warlock',rulesetSource:'XPHB',level:1,creator:'shared_character_forge_player_v2'}};
 let ss='';for(const spell of [eb,poison,...ordinaryIds.slice(0,2)])ss+=" INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload) VALUES("+q(id)+","+q(spell)+",'class','warlock','Warlock',true,true,"+([eb,poison].includes(spell)?'true':'false')+",'cha','{}');";
 sql("BEGIN; INSERT INTO public.characters(id,name) VALUES("+q(id)+",'I2J earned Warlock'); INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,created_by) VALUES("+q(id)+","+q(cls)+",1,"+xp+",true,"+q(owner.id)+"); INSERT INTO public.character_sheets(character_id,sheet) VALUES("+q(id)+","+json(sheet)+");"+ss+" INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+q(id)+","+q(owner.id)+",true),("+q(id)+","+q(editor.id)+",true),("+q(id)+","+q(viewer.id)+",false); INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,status,metadata_ready,created_by) VALUES("+q(id)+",1,2,'open',true,"+q(owner.id)+"); COMMIT;");
 assert.equal(sql('SELECT class_level FROM public.character_progression'+w),'1');assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets"+w),'1');assert.equal(sql("SELECT sheet#>>'{meta,creator}' FROM public.character_sheets"+w),'shared_character_forge_player_v2');
 const initial=JSON.parse(sql("SELECT to_jsonb(g) FROM public.character_class_option_grant_instances g"+w));assert.equal(initial.instance_key,slot);assert.equal(initial.option_catalog_id,'7776f12d-eef4-47c6-a996-c1ddf45c5071');assert.equal(initial.acquired_level,1);
 return {id,w,initial};
}
const snap=t=>Object.fromEntries(['character_progression','character_sheets','character_spells','character_class_option_grant_instances','character_option_grant_instances','character_option_grants','character_level_up_sessions','character_level_events','character_permissions'].map(table=>[table,sql("SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public."+table+" t"+t.w)]).concat([['accounts',account()],['legacy',sql("SELECT count(*) FROM private.player_forge_source_choice_legacy_v1"+t.w)]]));
function input(a=armor,b=mind,childA,childB){
 const slot=(k,c)=>({invocation:[k],...(c?{['child-'+k.split(':')[1].split('|')[0]]:[c]}:{})});
 return {hp_method:'fixed',spell_choices:[{spell_id:ordinaryIds[2],prepared:true}],class_option_feat_instances:[],replacement_selections:{},class_choice_selections:{'warlock-invocation-slot-2':slot(a,childA),'warlock-invocation-slot-3':slot(b,childB)}};
}
async function apply(a,t,p){let res;for(let i=0;i<35;i++){res=await a.client.rpc('complete_character_level_up_v5',{p_character_id:t.id,p_selections:p});if(res.error?.code!=='PGRST202')break;await new Promise(r=>setTimeout(r,300))}assert.notEqual(res.error?.code,'PGRST202');return res}
async function deny(a,t,p,pattern,code){const before=snap(t),x=await apply(a,t,p);assert.ok(x.error,'invalid Warlock choice accepted');if(code)assert.equal(x.error.code,code,JSON.stringify(x.error));if(pattern)assert.match(x.error.message,pattern);assert.deepEqual(snap(t),before)}
function final(t,expected,children={}){
 assert.equal(sql('SELECT class_level FROM public.character_progression'+t.w),'2');assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets"+t.w),'2');assert.equal(sql("SELECT sheet#>>'{meta,level}' FROM public.character_sheets"+t.w),'2');assert.equal(sql("SELECT sheet->>'maxHp' FROM public.character_sheets"+t.w),'15');
 const rows=JSON.parse(sql("SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object('option_key',o.option_key,'name',o.name) ORDER BY g.instance_key) FROM public.character_class_option_grant_instances g JOIN public.class_feature_option_catalog o ON o.id=g.option_catalog_id WHERE g.character_id="+q(t.id)));
 assert.deepEqual(rows.map(x=>x.option_key),[pact,...expected]);assert.deepEqual(rows.map(x=>x.acquired_level),[1,2,2]);assert.equal(rows[0].id,t.initial.id);assert.equal(rows[0].updated_at,t.initial.updated_at);
 const sh=JSON.parse(sql("SELECT sheet FROM public.character_sheets"+t.w));assert.deepEqual(sh.eldritchInvocations,rows.map(x=>x.name));assert.equal(sh.meta.creator,'shared_character_forge_player_v2');for(const [i,row] of rows.entries()){const group=sh.sourceChoices[row.instance_key];assert.equal(group.fields.invocation.selections[0].key,row.option_key);assert.equal(group.metadata.acquisitionLevel,row.acquired_level);if(children[i])assert.equal(row.choices.child.key,children[i])}
 assert.equal(sql("SELECT count(*) FROM public.character_spells"+t.w),'5');assert.equal(sql("SELECT count(*) FROM public.character_spells"+t.w+" AND spell_id="+q(ordinaryIds[2])+" AND source_type='class' AND raw_payload->>'grantedAtLevel'='2'"),'1');
 assert.equal(sql("SELECT count(*) FROM public.character_level_events"+t.w+" AND event_type='level_up_completed' AND from_level=1 AND to_level=2"),'1');assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions"+t.w+" AND status='completed' AND from_level=1 AND to_level=2"),'1');
}

const alertId='735de8f5-94b0-4052-a7b2-8ae15ac9a55c',lessons='optional-feature:lessons-of-the-first-ones|XPHB',slot='warlock-invocation-slot-2',child='child-lessons-of-the-first-ones',instanceKey='invocation-'+slot+'-origin-feat';
function alertInput(){
 const p=input(lessons,mind,alertId);
 p.class_option_feat_instances=[{instanceId:'level-2-'+slot+'-'+child,optionId:alertId,name:'Alert',source:'XPHB',category:'O',optionType:'feat',acquisitionOwnerType:'class-option',acquisitionOwnerKey:slot,acquisitionLevel:2,choices:{},fixedEffects:[],fixedSpellTokens:[]}];
 return p;
}
assert.equal(sql("SELECT count(*) FROM public.character_option_catalog WHERE id="+q(alertId)+" AND name='Alert' AND source='XPHB' AND category='O'"),'1');
// Carry forward the already characterized final-state-only candidate, not a new original validator claim.
 let corrected=once(oldValidator,"  v_expected integer:=0;","  v_current public.character_progression%rowtype;\n  v_expected integer:=0;");
 corrected=once(corrected,"  select * into v_class from public.class_catalog where id=new.class_id;",
 "  select * into v_current from public.character_progression where character_id=new.character_id;\n  if not found then\n    if not exists(select 1 from public.characters where id=new.character_id) and not exists(select 1 from public.character_class_option_grant_instances where character_id=new.character_id) then return new; end if;\n    raise exception 'Warlock progression missing at deferred validation.';\n  end if;\n  select * into v_class from public.class_catalog where id=v_current.class_id;");
 assert.ok(corrected.includes('new.class_level'));corrected=corrected.replaceAll('new.class_level','v_current.class_level');sql(corrected);const candidateHash=md5(validator);assert.notEqual(candidateHash,'4f1752db655b6ba490113f604c7583ef');

assert.equal(triggerSnapshot(),triggers);
assert.equal(md5(featName),materializerHash);
const denied=seed(),p=alertInput();
await deny(viewer,denied,p,null,'42501');
await deny(outsider,denied,p,null,'42501');
const absent=alertInput();absent.class_option_feat_instances=[];
await deny(owner,denied,absent,/nested Origin feat choices to be complete/i);
const malformed=alertInput();malformed.class_option_feat_instances[0].choices=[];
await deny(owner,denied,malformed,/choices must be an object/i);
console.log('PASS OF-HIST-02 signed authorization and missing or malformed nested choice rollback');
// Freeze already characterized writers to isolate the distinct real materializer.
sql(once(baseBody,baseMirror,omission));sql(once(summaryBody,summaryMirror,omission));sql(once(syncBody,summaryMirror,omission));sql(once(earnedBody,earnedMirror,omission));
const frozenWriters=[baseName,summaryName,syncName,earnedName].map(n=>[n,md5(n)]);
function verifyFeat(t){
 final(t,[lessons,mind],{1:alertId});
 const rows=JSON.parse(sql("SELECT to_jsonb(g) FROM public.character_option_grant_instances g"+t.w));
 assert.equal(rows.instance_key,instanceKey);assert.equal(rows.option_id,alertId);assert.equal(rows.acquisition_owner_type,'class-option');assert.equal(rows.acquisition_owner_key,slot);assert.equal(rows.acquisition_level,2);assert.equal(rows.option_name,'Alert');assert.deepEqual(rows.choices,{});assert.deepEqual(rows.effects,[]);assert.equal(rows.granted_by,editor.id);
 const presence=JSON.parse(sql("SELECT to_jsonb(g) FROM public.character_option_grants g"+t.w));assert.equal(presence.option_id,alertId);assert.equal(presence.granted_by,editor.id);
 const sh=JSON.parse(sql("SELECT sheet FROM public.character_sheets"+t.w));assert.ok(sh.feats.includes('Alert'));assert.equal(sh.featGrantInstances.filter(x=>x.instanceId===instanceKey&&x.optionId===alertId&&x.acquisitionOwnerKey===slot).length,1);
}
const exactFeat=def(featName),red=seed();mark('origin-feat-red');const originalAccounts=account();
const originalOutcome=await apply(editor,red,alertInput());assert.ifError(originalOutcome.error);verifyFeat(red);
for(let i=0;i<3;i++)assert.notEqual(account()[i],originalAccounts[i]);assert.equal(account()[3],originalAccounts[3]);assert.equal(md5(featName),materializerHash);
console.log('PASS OF-HIST-03 genuine signed v5 nested Alert and exact materializer; isolated linked account mirror RED in historical caller graph');
const mirror="  update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
sql(once(exactFeat,mirror,omission));const featCandidateHash=md5(featName);assert.notEqual(featCandidateHash,materializerHash);
const green=seed();mark('origin-feat-green');const frozen=account(),untouched=snap(red);
const greenOutcome=await apply(editor,green,alertInput());assert.ifError(greenOutcome.error);verifyFeat(green);assert.deepEqual(account(),frozen);assert.deepEqual(snap(red),untouched);
await deny(editor,green,alertInput(),null);
for(const [n,h] of frozenWriters)assert.equal(md5(n),h);
assert.equal(md5(featValidator),historicalValidatorHash);assert.equal(md5(validator),candidateHash);assert.equal(md5(featName),featCandidateHash);assert.equal(triggerSnapshot(),triggers);
console.log('PASS OF-HIST-04 isolated materializer mirror omission, canonical feat and normalized/legacy grants, replay rollback and unrelated-character preservation');
console.log('OF-HIST RESULT: actual signed v5 public historical earned/validator, exact original materializer RED and scratch GREEN only; restored caller/validator and full Option A release remain HOLD');
