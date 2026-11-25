// Disposable I2J only. Reuse P1.3 source-authentic v5 graph; do not repeat T43/T44/T45.
// Original captured Wizard helpers and historical earned source pinned separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=process.env;
for(const [k,v] of Object.entries({GITHUB_ACTIONS:'true',CI:'true',PGHOST:'127.0.0.1',PGPORT:'54322',PGDATABASE:'postgres',DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:'P13_SOURCE_V5_LOCAL_AUTH_ONLY',DNDNEXT_I2J_WIZARD_CONFIRM:'I2J_DISPOSABLE_WIZARD_V5_ONLY'}))assert.equal(env[k],v,'unsafe '+k);
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

assert.equal(sql('SELECT current_database()'),'postgres');assert.match(sql('SHOW server_version'),/^17\./);
assert.equal(sql("SELECT to_regclass('private.p13_levelup_case_guard') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL AND to_regclass('public.class_feature_catalog') IS NULL"),'t');
const original='scripts/fixtures/i1e_wizard_original_functions_pg17.sql';
pinned(original,'c0322578db9e848b20a476b32681c07e316f0870');
const setup=pinned('scripts/fixtures/i1e_wizard_joint_setup_pg17.sql','0b833150367ce01297acf82d750de3f01be66044');
const savant=pinned('sql/20260808_41_wizard_savant_forge_chronology.sql','b0f3380b7ec22124ea19de3724867877060c6d92');
const uniqueness=pinned('sql/20260808_40_wizard_savant_spellbook_progression.sql','b01d748d12c61370c23041127fb45d284737ec01');
const signature=pinned('sql/20260808_42_wizard_signature_spells_authority.sql','dd89fa46017482243736f51de41b3ea1d273fec7');
const overlay=pinned('sql/20260808_43_wizard_signature_resource_labels.sql','e05efb5a320f0e0981103c9d41b4f1402e5336f4');
const access=pinned('sql/20260808_19_source_aware_level_up_spell_access.sql','ba4443302d37bb99532695e438bd1c0d0f1e4e5c');
const subclass=pinned('sql/20260720_01_subclass_compatibility_and_selection.sql','4e938bc3217f11b8a4ef589da83af00aaca51782');
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

// Synthetic bounded catalog schema; preferred view admits only unique XPHB
// specimens, not a claim of real full source priority or spell catalog coverage.
sql("ALTER TABLE public.spells_catalog ADD COLUMN school text, ADD COLUMN spell_key text, ADD COLUMN classes text[], ADD COLUMN source text, ADD COLUMN description text; ALTER TABLE public.character_spells ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN uses_max integer, ADD COLUMN uses_remaining integer, ADD COLUMN recharge text; CREATE UNIQUE INDEX i2j_wizard_spell_provenance_unique ON public.character_spells(character_id,spell_id,source_type,source_key); CREATE VIEW public.spells_catalog_preferred AS SELECT * FROM public.spells_catalog WHERE source='XPHB'; REVOKE ALL ON public.spells_catalog,public.spells_catalog_preferred,public.character_spells FROM PUBLIC,anon,authenticated;");
sql("CREATE TABLE public.class_feature_catalog(feature_type text,class_key text,class_source text,subclass_name text,subclass_short_name text,source text,description text); INSERT INTO public.class_feature_catalog VALUES('subclass','wizard','XPHB','Evoker','Evoker','XPHB',NULL)");
sql(fn(subclass,'private.resolve_subclass_choice_v1'));
// Install actual captured eight helpers (including exact Signature writer).
psql(['-f',original]);
const install=(src,name)=>sql(fn(src,name));
for(const n of ['private.level_up_wizard_savant_group_v1','private.apply_level_up_wizard_savant_v1','private.validate_wizard_spellbook_uniqueness_v1'])install(savant,n);
for(const n of ['private.level_up_wizard_signature_group_v1','private.apply_level_up_wizard_signature_spells_v1'])install(signature,n);
install(overlay,'private.guard_signature_spell_resource_overlay_v1');
install(access,'private.level_up_spell_access_v1');
function ddl(src,start){const needle='\n'+start;assert.equal(src.split(needle).length,2,'expected exactly one executable line: '+start);const i=src.indexOf(needle)+1;const j=src.indexOf(';',i);assert.ok(j>i);sql(src.slice(i,j+1))}
ddl(uniqueness,'create constraint trigger character_spells_validate_wizard_spellbook_uniqueness_v1');
ddl(overlay,'create trigger character_spells_guard_signature_spell_resource_overlay_v1');
ddl(setup,'CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_wizard_final_v1');
const savantName='private.apply_level_up_wizard_savant_v1(uuid,integer,jsonb,text)',sigName='private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)';
const savantHash=md5(savantName),savantRecorded='77f643e44aa6048689a66ff4d01c4694';
console.log('I2J-WZ earned Savant installed MD5 '+savantHash+' recorded '+savantRecorded+' match='+String(savantHash===savantRecorded));
if(savantHash!==savantRecorded)console.log('I2J-WZ Savant source identity HOLD: historical migration scope only');
assert.equal(md5(sigName),'c6d23dc8eccb824e9199ca027139a7da');
const triggerSnapshot=()=>sql("SELECT string_agg(pg_get_triggerdef(oid,true), E'\\n' ORDER BY tgname) FROM pg_trigger WHERE tgname IN ('character_spells_validate_wizard_spellbook_uniqueness_v1','character_spells_guard_signature_spell_resource_overlay_v1','character_progression_materialize_player_forge_wizard_final_v1','sync_character_progression_from_sheet_v1') AND NOT tgisinternal AND tgenabled='O'");
const triggers=triggerSnapshot();assert.match(triggers,/DEFERRABLE INITIALLY DEFERRED/);assert.match(triggers,/BEFORE UPDATE OF/);
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgname IN ('character_spells_validate_wizard_spellbook_uniqueness_v1','character_progression_materialize_player_forge_wizard_final_v1') AND tgdeferrable AND tginitdeferred AND tgenabled='O'"),'2');
// Reduced unrelated helpers: only Evoker 4→5 and 19→20, no other class options.
// The actual base, v3, v4, v5, original sheet-sync and Wizard feature bodies stay intact.
sql("CREATE OR REPLACE FUNCTION private.p13_only_plain_fighter(p_character_id uuid,p_to_level int) RETURNS void LANGUAGE plpgsql STABLE AS $w$ BEGIN IF p_to_level NOT IN (5,20) OR NOT EXISTS(SELECT 1 FROM public.character_progression cp JOIN public.class_catalog cc ON cc.id=cp.class_id WHERE cp.character_id=p_character_id AND cc.class_key='wizard' AND cc.source='XPHB' AND cp.subclass_name='Evoker' AND cp.class_level IN (p_to_level-1,p_to_level)) THEN RAISE EXCEPTION 'I2J reduced fixture restricts unrelated helpers to Evoker 4→5 and 19→20'; END IF; END $w$;");
sql("CREATE OR REPLACE FUNCTION private.apply_level_up_warlock_invocation_replacement_v2(uuid,int,jsonb,jsonb,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $w$ BEGIN PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3); PERFORM private.p13_only_empty($5); IF jsonb_typeof($4)<>'object' OR ($4-'wizard-savant-spellbook-addition'-'wizard-signature-spells')<>'{}'::jsonb THEN RAISE EXCEPTION 'I2J unrelated class choices not staged'; END IF; RETURN '[]'::jsonb; END $w$;");
sql("CREATE OR REPLACE FUNCTION private.sync_character_eldritch_invocations_v1(uuid) RETURNS void LANGUAGE plpgsql AS $w$ DECLARE n int; BEGIN SELECT class_level INTO n FROM public.character_progression WHERE character_id=$1; PERFORM private.p13_only_plain_fighter($1,n); END $w$;");
sql("CREATE OR REPLACE FUNCTION private.level_up_persistent_choice_gaps_v1(text,text,int,int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $w$ BEGIN IF $1<>'wizard' OR $2<>'XPHB' OR $4 NOT IN (5,20) OR $3<>$4-1 THEN RAISE EXCEPTION 'I2J unrelated gap metadata not staged'; END IF; RETURN '[]'::jsonb; END $w$;");
sql("CREATE OR REPLACE FUNCTION public.is_preferred_class_version_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS $w$ SELECT EXISTS(SELECT 1 FROM public.class_catalog WHERE id=$1 AND source='XPHB' AND class_key='wizard') $w$;");
sql("CREATE FUNCTION public.is_preferred_spell_version_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS $w$ SELECT EXISTS(SELECT 1 FROM public.spells_catalog_preferred WHERE id=$1) $w$;");
sql("CREATE OR REPLACE FUNCTION public.xp_threshold_for_level_v1(int) RETURNS bigint LANGUAGE sql IMMUTABLE AS $w$ SELECT CASE $1 WHEN 4 THEN 2700 WHEN 5 THEN 6500 WHEN 6 THEN 14000 WHEN 19 THEN 305000 WHEN 20 THEN 355000 ELSE 100000 END $w$;");
const cls='00000000-0000-0000-0000-000000008802';
sql("INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability) VALUES("+q(cls)+",'wizard','Wizard','XPHB','2024',6,'int')");
for(const [l,xp,pb,cantrips,slots] of [[4,2700,2,4,[4,3]],[5,6500,3,4,[4,3,2]],[19,305000,6,5,[4,3,3,3,3,2,1,1,1]],[20,355000,6,5,[4,3,3,3,3,2,2,1,1]]])
 sql("INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,features,proficiency_bonus,cantrips_known,spell_slots) VALUES("+q(cls)+","+l+","+xp+",'[]',"+pb+","+cantrips+","+json(slots)+")");
const spellIds={};
for(const [key,lev,school,source,classes] of [
 ['oldFirst',1,'Evocation','XPHB',['Wizard']],['oldSecond',2,'Evocation','XPHB',['Wizard']],
 ['savantNew',3,'Evocation','XPHB',['Wizard']],['ordinaryA',3,'Conjuration','XPHB',['Wizard']],['ordinaryB',2,'Illusion','XPHB',['Wizard']],
 ['oldSavantThird',3,'Evocation','XPHB',['Wizard']],['oldNormalThird',3,'Abjuration','XPHB',['Wizard']],
 ['signatureNew',3,'Evocation','XPHB',['Wizard']],['highNew',9,'Evocation','XPHB',['Wizard']],
 ['notInBook',3,'Evocation','XPHB',['Wizard']],['wrongSchool',3,'Illusion','XPHB',['Wizard']],
 ['wrongClass',3,'Evocation','XPHB',['Cleric']],['notUnlocked',4,'Evocation','XPHB',['Wizard']],['oldSource',3,'Evocation','PHB',['Wizard']]
]){
 const id=randomUUID();spellIds[key]=id;
 sql("INSERT INTO public.spells_catalog(id,name,level,school,spell_key,source,classes,description) VALUES("+q(id)+","+q('I2J synthetic '+key)+","+lev+","+q(school)+","+q('i2j-'+key)+","+q(source)+",ARRAY["+classes.map(q).join(',')+"],NULL)");
}
sql("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated; NOTIFY pgrst,'reload schema'");
for(const n of [savantName,sigName,'private.apply_level_up_wizard_signature_spells_v1(uuid,integer,jsonb)'])assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(n)+",'EXECUTE')"),'f');
assert.equal(sql("SELECT has_function_privilege('anon','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')"),'f');
verify();
console.log('PASS I2J-WZ01 exact v5/v4/v3/base/sheet sync and captured Signature source, historical earned/uniqueness/overlay pinned; reduced preferred catalog and unrelated helpers explicitly bounded');
async function actor(){const client=createClient(env.DNDNEXT_P13_LEVELUP_URL,env.DNDNEXT_P13_LEVELUP_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),email='i2j-wizard-'+randomUUID()+'@example.invalid',password='I2j-'+randomUUID()+'!';assert.ifError((await client.auth.signUp({email,password})).error);assert.ifError((await client.auth.signInWithPassword({email,password})).error);const u=await client.auth.getUser(),c=await client.auth.getClaims();assert.ifError(u.error);assert.ifError(c.error);assert.equal(c.data.claims.sub,u.data.user.id);assert.equal(c.data.claims.role,'authenticated');return {client,id:u.data.user.id}}

const owner=await actor(),editor=await actor(),viewer=await actor(),outsider=await actor(),actors=[owner,editor,viewer,outsider];
for(const a of actors)sql("INSERT INTO public.players(user_id,sheet) VALUES("+q(a.id)+","+json({historical:a.id})+")");
const acct=()=>actors.map(a=>sql('SELECT md5(to_jsonb(p)::text) FROM public.players p WHERE user_id='+q(a.id)));
function mark(label){for(const [i,a] of actors.entries())sql("UPDATE public.players SET sheet="+json({historical:label+'-'+i})+",updated_at=now() WHERE user_id="+q(a.id))}
const definition=n=>sql('SELECT pg_get_functiondef('+q(n)+'::regprocedure)');
function once(s,old,newText){assert.equal(s.split(old).length,2,'source anchor drift '+old);return s.replace(old,newText)}
const baseName='private.complete_character_level_up_base_v3(uuid,jsonb)',summaryName='private.sync_player_forge_class_spell_summary_v1(uuid)';
const baseBody=definition(baseName),summaryBody=definition(summaryName),savantBody=definition(savantName),sigBody=definition(sigName);
const baseMirror="  update public.players p set sheet = v_sheet, updated_at = now()\n  where p.user_id in (\n    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id\n  );";
const summaryMirror="  update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
const savantMirror="  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
const omission='  -- I2J explicitly NON-ORIGINAL disposable Option A account history frozen.';
sql(once(baseBody,baseMirror,omission));sql(once(summaryBody,summaryMirror,omission));
const baseSafe=md5(baseName),summarySafe=md5(summaryName);
assert.equal(md5(savantName),savantHash);assert.equal(md5(sigName),'c6d23dc8eccb824e9199ca027139a7da');
function seed(from,options={}){
 const id=randomUUID(),w=' WHERE character_id='+q(id),to=from+1,xp=options.xp??(to===5?6500:355000);
 const data={classKey:'wizard',rulesetSource:'XPHB',ruleset:'2024',level:from,hp:30,maxHp:30,abilities:{con:{score:12}},subclassName:'Evoker',subclassSource:'XPHB',classFeatureChoices:{},meta:{classKey:'wizard',rulesetSource:'XPHB',level:from,subclassName:'Evoker',subclassSource:'XPHB'}};
 // Existing reduced earned-history specimen, not a fresh Forge creation:
 // intentionally no Forge creator marker, old spellbook rows seeded explicitly.
 const items=from===4?[['oldFirst','class-feature','wizard-evocation-savant',3],['oldSecond','class-feature','wizard-evocation-savant',3]]:[['oldFirst','class-feature','wizard-evocation-savant',3],['oldSecond','class-feature','wizard-evocation-savant',3],['oldSavantThird','class-feature','wizard-evocation-savant-level-5',5],['oldNormalThird','class','wizard',5]];
 let inserts='';
 for(const [key,type,sk,lv] of items){
  const limited=options.limited===key;
  const payload=type==='class-feature'?{wizardSpellbook:true,grantedAtLevel:lv,feature:'Evocation Savant',school:'Evocation',creator:'character_progression_v5'}:{grantedAtLevel:lv,creator:'level_up_v3'};
  inserts+=" INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload,uses_max,uses_remaining,recharge) VALUES("+q(id)+","+q(spellIds[key])+","+q(type)+","+q(sk)+","+q(type==='class-feature'?'Evocation Savant':'Wizard')+",true,false,false,'int',"+json(payload)+","+(limited?"2,1,'long_rest'":"NULL,NULL,NULL")+");";
 }
 sql("BEGIN; INSERT INTO public.characters(id,name) VALUES("+q(id)+",'I2J synthetic earned Wizard'); INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,subclass_name,subclass_source,created_by) VALUES("+q(id)+","+q(cls)+","+from+","+xp+",true,'Evoker','XPHB',"+q(owner.id)+"); INSERT INTO public.character_sheets(character_id,sheet) VALUES("+q(id)+","+json(data)+");"+inserts+" INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+q(id)+","+q(owner.id)+",true),("+q(id)+","+q(editor.id)+",true),("+q(id)+","+q(viewer.id)+",false); INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,status,metadata_ready,created_by) VALUES("+q(id)+","+from+","+to+",'open',true,"+q(owner.id)+"); COMMIT;");
 assert.equal(sql('SELECT class_level FROM public.character_progression'+w),String(from));
 assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets"+w),String(from));
 assert.equal(sql("SELECT count(*) FROM public.character_spells"+w),String(items.length));
 return {id,w,from,to,initial:items.length};
}
const snap=t=>Object.fromEntries(['character_progression','character_sheets','character_spells','character_level_up_sessions','character_level_events','character_permissions'].map(table=>[table,sql("SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public."+table+" t"+t.w)]).concat([['accounts',acct()]]));
const spell=(t,key)=>JSON.parse(sql("SELECT row_to_json(s)::text FROM public.character_spells s"+t.w+" AND spell_id="+q(spellIds[key])));
const normal=keys=>keys.map(key=>({spell_id:spellIds[key],prepared:false}));
function choices(ordinary,savantKeys=[],signatureKeys=[]){
 const groups={};if(savantKeys.length)groups['wizard-savant-spellbook-addition']={spells:savantKeys.map(k=>spellIds[k])};if(signatureKeys.length)groups['wizard-signature-spells']={spells:signatureKeys.map(k=>spellIds[k])};
 return {hp_method:'fixed',spell_choices:normal(ordinary),class_option_feat_instances:[],replacement_selections:{},class_choice_selections:groups};
}
const s5=choices(['ordinaryA','ordinaryB'],['savantNew']);
const s20=choices(['signatureNew','highNew'],[],['oldSavantThird','signatureNew']);
async function apply(a,t,p){let res;for(let i=0;i<35;i++){res=await a.client.rpc('complete_character_level_up_v5',{p_character_id:t.id,p_selections:p});if(res.error?.code!=='PGRST202')break;await new Promise(r=>setTimeout(r,300))}assert.notEqual(res.error?.code,'PGRST202');return res}
async function deny(a,t,p,pattern,code){const b=snap(t),x=await apply(a,t,p);assert.ok(x.error,'unexpected accepted invalid Wizard choice');if(code)assert.equal(x.error.code,code,JSON.stringify(x.error));if(pattern)assert.match(x.error.message,pattern);assert.deepEqual(snap(t),b,'failed transaction changed state')}
function final(t,delta,kind){
 assert.equal(sql('SELECT class_level FROM public.character_progression'+t.w),String(t.to));
 assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets"+t.w),String(t.to));
 assert.equal(sql("SELECT sheet#>>'{meta,level}' FROM public.character_sheets"+t.w),String(t.to));
 assert.equal(sql("SELECT sheet->>'maxHp' FROM public.character_sheets"+t.w),'35');
 assert.equal(sql('SELECT count(*) FROM public.character_spells'+t.w),String(t.initial+(kind==='savant'?3:2)));
 assert.equal(sql('SELECT count(DISTINCT spell_id) FROM public.character_spells'+t.w),String(t.initial+(kind==='savant'?3:2)));
 assert.equal(sql("SELECT count(*) FROM public.character_level_events"+t.w+" AND event_type='level_up_completed' AND from_level="+t.from+" AND to_level="+t.to),'1');
 assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions"+t.w+" AND status='completed' AND from_level="+t.from+" AND to_level="+t.to),'1');
 const sk=kind==='savant'?'wizard_savant_delta':'wizard_signature_delta',ek=kind==='savant'?'wizardSavantDelta':'wizardSignatureDelta';
 assert.equal(sql("SELECT jsonb_array_length(level_choices#>"+q('{'+t.to+','+sk+'}')+") FROM public.character_progression"+t.w),String(delta));
 assert.equal(sql("SELECT jsonb_array_length(selections->"+q(sk)+") FROM public.character_level_up_sessions"+t.w),String(delta));
 assert.equal(sql("SELECT jsonb_array_length(details->"+q(ek)+") FROM public.character_level_events"+t.w+" AND event_type='level_up_completed'"),String(delta));
}
function checkSavant(t){
 final(t,1,'savant');
 const x=spell(t,'savantNew');assert.equal(x.source_type,'class-feature');assert.equal(x.source_key,'wizard-evocation-savant-level-5');assert.equal(x.known,true);assert.equal(x.prepared,false);assert.equal(x.always_available,false);assert.equal(x.casting_stat,'int');assert.equal(x.raw_payload.wizardSpellbook,true);assert.equal(x.raw_payload.grantedAtLevel,5);
 for(const k of ['ordinaryA','ordinaryB']){const y=spell(t,k);assert.equal(y.source_type,'class');assert.equal(y.raw_payload.grantedAtLevel,5);assert.equal(y.raw_payload.accessType,'class');assert.equal(y.prepared,false)}
 const proj=JSON.parse(sql("SELECT sheet#>'{classFeatureChoices,wizard-evocation-savant-level-5,selections}' FROM public.character_sheets"+t.w));assert.deepEqual(proj.map(x=>x.key),[spellIds.savantNew]);
}
function checkSignature(t,oldAssignment){
 final(t,2,'signature');
 const old=spell(t,'oldSavantThird'),fresh=spell(t,'signatureNew');assert.equal(old.id,oldAssignment);assert.equal(old.source_type,'class-feature');assert.equal(old.source_key,'wizard-evocation-savant-level-5');assert.equal(old.raw_payload.grantedAtLevel,5);assert.equal(old.raw_payload.wizardSpellbook,true);
 assert.equal(fresh.source_type,'class');assert.equal(fresh.source_key,'wizard');assert.equal(fresh.raw_payload.grantedAtLevel,20);
 for(const x of [old,fresh]){assert.equal(x.prepared,true);assert.equal(x.always_available,true);assert.equal(x.uses_max,1);assert.equal(x.uses_remaining,1);assert.equal(x.recharge,'short_rest');assert.equal(x.raw_payload.signatureSpell,true);assert.equal(x.raw_payload.signatureSpellGrantedAtLevel,20);assert.equal(x.raw_payload.resourceLabel,'Signature Spell');assert.equal(x.raw_payload.signatureSpellRecharge,'short_rest_or_long_rest')}
 const ordinary=spell(t,'highNew');assert.equal(ordinary.source_type,'class');assert.equal(ordinary.uses_max,null);assert.equal(ordinary.raw_payload.signatureSpell,undefined);
 const projected=JSON.parse(sql("SELECT sheet->'signatureSpells' FROM public.character_sheets"+t.w));assert.deepEqual(projected.map(x=>x.key),[spellIds.oldSavantThird,spellIds.signatureNew]);
}
const red=seed(4);
const sg=JSON.parse(sql('SELECT private.level_up_wizard_savant_group_v1('+q(red.id)+',5)'));
assert.equal(sg.length,1);assert.equal(sg[0].fields[0].count,1);assert.equal(sg[0].metadata.slotLevelBefore,2);assert.equal(sg[0].metadata.slotLevelAfter,3);
const available=sg[0].fields[0].options.map(x=>x.key);assert.ok(available.includes(spellIds.savantNew));for(const k of ['oldFirst','wrongSchool','wrongClass','notUnlocked','oldSource'])assert.ok(!available.includes(spellIds[k]),k);
mark('savant-red');const redHistory=acct();
await deny(viewer,red,s5,null,'42501');await deny(outsider,red,s5,null,'42501');
await deny(owner,red,choices(['ordinaryA','ordinaryB']),/requires exactly 1 free spellbook selection/i);
await deny(owner,red,choices(['ordinaryA','ordinaryB'],['wrongSchool']),/not a source-legal/i);
await deny(owner,red,choices(['ordinaryA','ordinaryB'],['oldFirst']),/already in this Wizard spellbook/i);
await deny(owner,red,choices(['ordinaryA','ordinaryB'],['oldSource']),/not a source-legal/i);
await deny(owner,red,choices(['savantNew','ordinaryB'],['savantNew']),/A Wizard spell can appear only once in the character spellbook/i);
await deny(owner,red,choices(['ordinaryA','ordinaryB'],['notUnlocked']),/not a source-legal/i);
const low=seed(4,{xp:6400});await deny(editor,low,s5,/required XP threshold/i);
console.log('PASS I2J-WZ02 Savant source choice group, denied viewer/outsider, count/school/source/level/existing membership, deferred cross-provenance duplicate and XP rollback');
const result=await apply(editor,red,s5);assert.ifError(result.error);checkSavant(red);
const changed=acct();for(let i=0;i<3;i++)assert.notEqual(changed[i],redHistory[i]);assert.equal(changed[3],redHistory[3]);
assert.equal(md5(baseName),baseSafe);assert.equal(md5(summaryName),summarySafe);
console.log('I2J-WZ03 ISOLATED SAVANT WRITER RED: genuine signed 4→5 persists three spells and canonical history, original Savant alone overwrites linked accounts, other mirror writers frozen');
sql(once(savantBody,savantMirror,omission));const savantSafe=md5(savantName);assert.notEqual(savantSafe,savantHash);
const green=seed(4);mark('savant-green');const history=acct();
sql("UPDATE public.character_permissions SET can_edit=false"+green.w+" AND user_id="+q(owner.id));await deny(owner,green,s5,null,'42501');
const greenResult=await apply(editor,green,s5);assert.ifError(greenResult.error);checkSavant(green);assert.deepEqual(acct(),history);
await deny(editor,green,s5,null);console.log('PASS I2J-WZ04 isolated Savant Option A omission, signed canonical state and frozen account timestamps, revocation/replay unchanged');
const sigRed=seed(19);mark('signature-earned-red');const sigRedHistory=acct(),oldId=spell(sigRed,'oldSavantThird').id;
const sigGroup=JSON.parse(sql('SELECT private.level_up_wizard_signature_group_v1('+q(sigRed.id)+',20)'));assert.equal(sigGroup.length,1);assert.equal(sigGroup[0].fields[0].count,2);assert.ok(sigGroup[0].fields[0].options.some(x=>x.key===spellIds.signatureNew));
assert.deepEqual(JSON.parse(sql('SELECT private.level_up_wizard_savant_group_v1('+q(sigRed.id)+',20)')),[]);
await deny(owner,sigRed,choices(['signatureNew','highNew'],[],['oldSavantThird','notInBook']),/not in this Wizard.s spellbook/i);
await deny(owner,sigRed,choices(['signatureNew','highNew'],[],['oldSavantThird','oldSavantThird']),/Signature Spell selections must be distinct/i);
await deny(owner,sigRed,choices(['signatureNew','highNew']),/Signature Spells require exactly two/i);
await deny(owner,sigRed,choices(['signatureNew','highNew'],[],['oldSavantThird','highNew']),/not a level-3 Wizard spell/i);
const sigCollision=seed(19,{limited:'oldNormalThird'});await deny(editor,sigCollision,choices(['signatureNew','highNew'],[],['oldSavantThird','oldNormalThird']),/cannot overwrite another limited-use resource/i);
console.log('PASS I2J-WZ05 earned Signature invalid final membership/count/duplicate/level and second-overlay collision roll back earlier ordinary level-up and first overlay');
const earnedRed=await apply(editor,sigRed,s20);assert.ifError(earnedRed.error);checkSignature(sigRed,oldId);
const sigChanged=acct();for(let i=0;i<3;i++)assert.notEqual(sigChanged[i],sigRedHistory[i]);assert.equal(sigChanged[3],sigRedHistory[3]);
assert.equal(md5(sigName),'c6d23dc8eccb824e9199ca027139a7da');assert.equal(md5(savantName),savantSafe);
console.log('I2J-WZ06 EARNED SIGNATURE RED: actual signed 19→20 overlays old Savant assignment and newly learned ordinary spell after v4; original Signature mirror overwrites linked accounts (same writer previously proven T16, not new count)');
sql(once(sigBody,summaryMirror,omission));const sigSafe=md5(sigName);assert.notEqual(sigSafe,'c6d23dc8eccb824e9199ca027139a7da');
const sigGreen=seed(19);mark('signature-earned-green');const frozen=acct(),oldGreen=spell(sigGreen,'oldSavantThird').id;
const unrelated=snap(green);
await deny(viewer,sigGreen,s20,null,'42501');await deny(outsider,sigGreen,s20,null,'42501');
const concurrent=await Promise.all([apply(owner,sigGreen,s20),apply(editor,sigGreen,s20)]);assert.equal(concurrent.filter(x=>!x.error).length,1,JSON.stringify(concurrent));assert.equal(concurrent.filter(x=>x.error).length,1);
checkSignature(sigGreen,oldGreen);assert.deepEqual(acct(),frozen);assert.deepEqual(snap(green),unrelated);
await deny(editor,sigGreen,s20,null);
console.log('PASS I2J-WZ07 signed earned Signature Option A, old assignment identity preserved, same-level learned spell resource, concurrent exactly one completion, replay and unrelated account/character isolation');
const afterCollision=seed(19,{limited:'oldNormalThird'});await deny(editor,afterCollision,choices(['signatureNew','highNew'],[],['oldSavantThird','oldNormalThird']),/cannot overwrite another limited-use resource/i);
const afterDuplicate=seed(4);await deny(editor,afterDuplicate,choices(['savantNew','ordinaryB'],['savantNew']),/A Wizard spell can appear only once in the character spellbook/i);
for(const [n,h] of fingerprints.filter(([n])=>n!==baseName&&n!==summaryName))assert.equal(md5(n),h,n);
assert.equal(md5(baseName),baseSafe);assert.equal(md5(summaryName),summarySafe);assert.equal(md5(savantName),savantSafe);assert.equal(md5(sigName),sigSafe);assert.equal(triggerSnapshot(),triggers);
console.log('PASS I2J-WZ08 candidate negatives retain original overlay and deferred uniqueness; public v5/v4/v3, sheet sync and trigger graph unchanged');
console.log('I2J-WZ RESULT: bounded earned Wizard RED/GREEN only; no fresh creation rerun, rest lifecycle rerun, full catalog, other class choices, real parent/browser, production or release acceptance');
