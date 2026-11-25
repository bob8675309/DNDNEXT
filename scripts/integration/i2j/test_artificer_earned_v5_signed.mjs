// Disposable I2J only. Reuse P1.3 source-authentic v5 graph; do not repeat T43/T44/T45.
// Captured EFA Artificer plan authority; historical earned wrapper separately pinned.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=process.env;
for(const [k,v] of Object.entries({GITHUB_ACTIONS:'true',CI:'true',PGHOST:'127.0.0.1',PGPORT:'54322',PGDATABASE:'postgres',DNDNEXT_P13_LEVELUP_LOCAL_CONFIRM:'P13_SOURCE_V5_LOCAL_AUTH_ONLY',DNDNEXT_I2J_ARTIFICER_CONFIRM:'I2J_DISPOSABLE_ARTIFICER_V5_ONLY'}))assert.equal(env[k],v,'unsafe '+k);
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
assert.equal(sql("SELECT to_regclass('private.p13_levelup_case_guard') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL AND to_regclass('public.class_feature_option_catalog') IS NULL"),'t');
const original=pinned('scripts/fixtures/i1l_artificer_original_plan_materializer_pg17.sql','975d92fa5fef8f77e4fb690921ebba84113dfa41');
const bmSetup=pinned('scripts/fixtures/i1f_battle_master_joint_setup_pg17.sql','c5ae0b31605d9374b295eee01eefdda0718afb80');
const plans=pinned('sql/20260808_60_artificer_magic_item_plan_instances.sql','4611fbc42ed71ed0cf5d6d2216d950684920ef93');
const nullFix=pinned('scripts/fixtures/i1l_artificer_projection_null_parent_candidate_pg17.sql','f8e01104bf8d6cccf144808235dcacb372d843ff');
const wizOriginal=pinned('scripts/fixtures/i1e_wizard_original_functions_pg17.sql','c0322578db9e848b20a476b32681c07e316f0870');
const subclass=pinned('sql/20260720_01_subclass_compatibility_and_selection.sql','4e938bc3217f11b8a4ef589da83af00aaca51782');
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
sql("ALTER TABLE public.class_feature_option_catalog ADD COLUMN repeatable boolean NOT NULL DEFAULT false, ADD COLUMN prerequisites jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN choice_schema jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN description text; CREATE TABLE public.items_catalog(id uuid PRIMARY KEY,item_key text,item_name text,item_type text,item_rarity text,payload jsonb); CREATE TABLE public.inventory_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id text,owner_type text,item_id uuid REFERENCES public.items_catalog(id),quantity int DEFAULT 1); REVOKE ALL ON public.items_catalog,public.inventory_items FROM PUBLIC,anon,authenticated;");
sql(stmt(original,'INSERT INTO public.class_feature_option_catalog'));sql(stmt(original,'INSERT INTO public.items_catalog'));
const helpers=[
 ['private.artificer_plan_count_v1','(integer)','3b2a115e3059fcfac280d90a788bc9b9'],
 ['private.artificer_plan_slot_level_v1','(integer)','4797ebbbbc9888aa02771b0de6afcf30'],
 ['private.artificer_plan_item_is_eligible_v1','(uuid,uuid)','483bd056efd89e769cdefe97f1c80e62'],
 ['private.validate_artificer_plan_choice_v1','(uuid,integer,text,uuid,text)','42730b6b8cc5fb57c55799f2b4396bf7'],
 ['private.sync_character_artificer_plan_projection_v1','(uuid)','5ebf572db01143e9b523c7dba0d43ad5'],
 ['private.materialize_player_forge_artificer_plans_v1','()','67766989a466b82f170b5e00f9154e24']
];
for(const [n,sig,hash] of helpers){sql(captured(original,n));assert.equal(md5(n+sig),hash,n)}
const earnedName='private.apply_level_up_artificer_plans_v1(uuid,integer,jsonb)',projName=helpers[4][0]+helpers[4][1];
for(const n of ['private.artificer_plan_item_options_v1','private.artificer_plan_parent_options_v1','private.artificer_plan_fields_v1','private.level_up_artificer_plan_groups_v1','private.level_up_artificer_plan_replacement_group_v1','private.apply_level_up_artificer_plans_v1'])sql(fn(plans,n));
const earnedHash=md5(earnedName);console.log('I2J-AR historical earned helper installed MD5 '+earnedHash+' (no captured live MD5 asserted; historical source scope)');
sql(stmt(original,'CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_artificer_plans_'));
sql(fn(authority,'private.guard_direct_class_option_authority_mutation_v1'));sql(stmt(authority,'create trigger character_class_option_instances_direct_authority_guard_v1'));
const trigger=()=>sql("SELECT pg_get_triggerdef(oid,true) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND tgname='character_progression_materialize_player_forge_artificer_plans_' AND tgenabled='O' AND tgdeferrable AND tginitdeferred");
const trig=trigger();assert.match(trig,/AFTER INSERT ON/);
sql(captured(wizOriginal,'private.highest_spell_level_from_slots_v1'));
sql("CREATE TABLE public.class_feature_catalog(feature_type text,class_key text,class_source text,subclass_name text,subclass_short_name text,source text,description text); INSERT INTO public.class_feature_catalog VALUES('subclass','artificer','EFA','Alchemist','Alchemist','EFA',NULL)");
sql(fn(subclass,'private.resolve_subclass_choice_v1'));
sql("CREATE OR REPLACE FUNCTION private.p13_only_plain_fighter(p_character_id uuid,p_to_level int) RETURNS void LANGUAGE plpgsql STABLE AS $w$ BEGIN IF p_to_level<>6 OR NOT EXISTS(SELECT 1 FROM public.character_progression cp JOIN public.class_catalog cc ON cc.id=cp.class_id WHERE cp.character_id=p_character_id AND cc.class_key='artificer' AND cc.source='EFA' AND cp.class_level IN (5,6)) THEN RAISE EXCEPTION 'I2J reduced fixture restricts unrelated tails to Artificer 5→6'; END IF; END $w$;");
sql("CREATE OR REPLACE FUNCTION private.apply_level_up_warlock_invocation_replacement_v2(uuid,int,jsonb,jsonb,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $w$ BEGIN PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3); PERFORM private.p13_only_empty($5); IF jsonb_typeof($4)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys($4) k WHERE k NOT IN ('artificer-plan-slot-5','artificer-plan-replacement') AND k NOT LIKE 'artificer-plan-slot-%') THEN RAISE EXCEPTION 'I2J unrelated class choices not staged'; END IF; RETURN '[]'::jsonb; END $w$;");
sql("CREATE OR REPLACE FUNCTION private.sync_character_eldritch_invocations_v1(uuid) RETURNS void LANGUAGE plpgsql AS $w$ BEGIN PERFORM private.p13_only_plain_fighter($1,6); END $w$;");
sql("CREATE OR REPLACE FUNCTION private.level_up_persistent_choice_gaps_v1(text,text,int,int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $w$ BEGIN IF $1<>'artificer' OR $2<>'EFA' OR $3<>5 OR $4<>6 THEN RAISE EXCEPTION 'I2J unrelated gap metadata not staged'; END IF; RETURN '[]'::jsonb; END $w$;");
sql("CREATE OR REPLACE FUNCTION public.is_preferred_class_version_v1(uuid) RETURNS boolean LANGUAGE sql STABLE AS $w$ SELECT EXISTS(SELECT 1 FROM public.class_catalog WHERE id=$1 AND source='EFA' AND class_key='artificer') $w$;");
sql("CREATE OR REPLACE FUNCTION public.xp_threshold_for_level_v1(int) RETURNS bigint LANGUAGE sql IMMUTABLE AS $w$ SELECT CASE $1 WHEN 5 THEN 6500 WHEN 6 THEN 14000 WHEN 7 THEN 23000 ELSE 100000 END $w$;");
const cls='46ea4181-2a9c-4f4e-b886-e246b462ed44';
sql("INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability) VALUES("+q(cls)+",'artificer','Artificer','EFA','2014',8,'int')");
for(const [l,xp] of [[5,6500],[6,14000]])sql("INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,features,proficiency_bonus,cantrips_known,spells_known,spell_slots) VALUES("+q(cls)+","+l+","+xp+",'[]',3,2,6,'[4,2,0,0,0]')");
const ids=[];for(let i=0;i<8;i++){const id=randomUUID();ids.push(id);sql("INSERT INTO public.spells_catalog(id,name,level) VALUES("+q(id)+","+q('I2J synthetic existing Artificer '+i)+","+(i<2?0:1)+")")}
const common='artificer-plan:common-magic-item-that-isn-t-a-potion-a-scroll-or-cursed|EFA',fixed=['1-shield','1-wand-of-the-war-mage','1-weapon','1-wraps-of-unarmed-power'].map(k=>'artificer-plan:'+k+'|EFA'),armor='artificer-plan:1-armor|EFA',limb='8adeb0df-1434-41f3-8702-1e1e3e0b5da7',potion='d0f8d472-b20f-402b-8405-b65a4330d348',reagent=randomUUID();
sql("INSERT INTO public.items_catalog(id,item_key,item_name,item_type,item_rarity,payload) VALUES("+q(reagent)+",'i2j-synthetic-reagent','I2J synthetic reagent','Alchemy Ingredient','common','{}')");
assert.equal(sql("SELECT count(*) FROM public.class_feature_option_catalog WHERE option_type='artificer-plan' AND source='EFA'"),'6');
assert.equal(sql("SELECT private.artificer_plan_item_is_eligible_v1('f8897bf9-5bb5-4e4f-8280-ad2a2e941112',"+q(limb)+")"),'t');
for(const id of [potion,reagent])assert.equal(sql("SELECT private.artificer_plan_item_is_eligible_v1('f8897bf9-5bb5-4e4f-8280-ad2a2e941112',"+q(id)+")"),'f');
sql("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated; NOTIFY pgrst,'reload schema'");assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(earnedName)+",'EXECUTE')"),'f');verify();
console.log('PASS I2J-AR01 six captured original function MD5s, original materializer trigger, six original plan IDs, two original item IDs, reduced ordinary spell metadata; historical earned helper not deployed-MD5 certified');
async function actor(){const client=createClient(env.DNDNEXT_P13_LEVELUP_URL,env.DNDNEXT_P13_LEVELUP_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),email='i2j-artificer-'+randomUUID()+'@example.invalid',password='I2j-'+randomUUID()+'!';assert.ifError((await client.auth.signUp({email,password})).error);assert.ifError((await client.auth.signInWithPassword({email,password})).error);const u=await client.auth.getUser(),c=await client.auth.getClaims();assert.ifError(u.error);assert.ifError(c.error);assert.equal(c.data.claims.sub,u.data.user.id);assert.equal(c.data.claims.role,'authenticated');return {client,id:u.data.user.id}}



const owner=await actor(),editor=await actor(),viewer=await actor(),outsider=await actor(),actors=[owner,editor,viewer,outsider];
for(const a of actors)sql("INSERT INTO public.players(user_id,sheet) VALUES("+q(a.id)+","+json({historical:a.id})+")");
const accounts=()=>actors.map(a=>sql('SELECT md5(to_jsonb(p)::text) FROM public.players p WHERE user_id='+q(a.id)));
const inventory=()=>sql("SELECT md5(coalesce(string_agg(to_jsonb(i)::text,'' ORDER BY to_jsonb(i)::text),'')) FROM public.inventory_items i");
function mark(label){for(const [i,a] of actors.entries())sql("UPDATE public.players SET sheet="+json({historical:label+'-'+i})+",updated_at=now() WHERE user_id="+q(a.id))}
const def=n=>sql('SELECT pg_get_functiondef('+q(n)+'::regprocedure)'),once=(s,old,v)=>{assert.equal(s.split(old).length,2,'source anchor drift '+old);return s.replace(old,v)};
const baseName='private.complete_character_level_up_base_v3(uuid,jsonb)',summaryName='private.sync_player_forge_class_spell_summary_v1(uuid)',originalProj=def(projName);
const baseMirror="  update public.players p set sheet = v_sheet, updated_at = now()\n  where p.user_id in (\n    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id\n  );",summaryMirror="  update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
const projMirror="  update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in(\n    select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id\n  );";
const omission='  -- I2J NON-ORIGINAL disposable Option A omission.';
sql(once(def(baseName),baseMirror,omission));sql(once(def(summaryName),summaryMirror,omission));const baseSafe=md5(baseName),summarySafe=md5(summaryName);
const rows=t=>JSON.parse(sql("SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object('option_key',o.option_key) ORDER BY g.instance_key) FROM public.character_class_option_grant_instances g JOIN public.class_feature_option_catalog o ON o.id=g.option_catalog_id WHERE g.character_id="+q(t.id)));
function seed(xp=14000,missingParent=false){
 const id=randomUUID(),w=' WHERE character_id='+q(id),sourceChoices={};for(const [i,k] of fixed.entries())sourceChoices['artificer-plan-slot-'+(i+1)]={fields:{plan:{selections:[{key:k}]}}};
 const sh={classKey:'artificer',rulesetSource:'EFA',ruleset:'2014',level:5,hp:35,maxHp:35,abilities:{con:{score:12}},subclassName:'Alchemist',subclassSource:'EFA',classFeatureChoices:{},sourceChoices,meta:{creator:'shared_character_forge_player_v2',classKey:'artificer',rulesetSource:'EFA',level:5,subclassName:'Alchemist',subclassSource:'EFA'}};
 let spells='';for(const [i,sp] of ids.entries())spells+=" INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload) VALUES("+q(id)+","+q(sp)+",'class','artificer','Artificer',true,true,"+(i<2?'true':'false')+",'int','{}');";
 sql("BEGIN; INSERT INTO public.characters(id,name) VALUES("+q(id)+",'I2J Artificer'); INSERT INTO public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,subclass_name,subclass_source,created_by) VALUES("+q(id)+","+q(cls)+",5,"+xp+",true,'Alchemist','EFA',"+q(owner.id)+"); INSERT INTO public.character_sheets(character_id,sheet) VALUES("+q(id)+","+json(sh)+");"+spells+" INSERT INTO public.character_permissions(character_id,user_id,can_edit) VALUES("+q(id)+","+q(owner.id)+",true),("+q(id)+","+q(editor.id)+",true),("+q(id)+","+q(viewer.id)+",false); INSERT INTO public.character_level_up_sessions(character_id,from_level,to_level,status,metadata_ready,created_by) VALUES("+q(id)+",5,6,'open',true,"+q(owner.id)+"); INSERT INTO public.inventory_items(owner_id,owner_type,item_id,quantity) VALUES("+q(id)+",'character',"+q(limb)+",1); COMMIT;");
 const t={id,w};t.initial=rows(t);assert.deepEqual(t.initial.map(x=>x.option_key),fixed);assert.ok(t.initial.every(x=>x.acquired_level===2));
 assert.equal(sql("SELECT jsonb_array_length(sheet#>'{classFeatureChoices,artificer-magic-item-plans,selections}') FROM public.character_sheets"+w),'4');
 if(missingParent)sql("UPDATE public.character_sheets SET sheet=sheet-'classFeatureChoices'"+w);
 assert.equal(sql('SELECT class_level FROM public.character_progression'+w),'5');assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets"+w),'5');return t;
}
const snap=t=>Object.fromEntries(['character_progression','character_sheets','character_spells','character_class_option_grant_instances','character_level_up_sessions','character_level_events','character_permissions'].map(table=>[table,sql("SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public."+table+" t"+t.w)]).concat([['accounts',accounts()],['inventory',inventory()]]));
function groups(t){return [JSON.parse(sql('SELECT private.level_up_artificer_plan_groups_v1('+q(t.id)+',6)'))[0],JSON.parse(sql('SELECT private.level_up_artificer_plan_replacement_group_v1('+q(t.id)+',6)'))[0]]}
function input(t,newPlan=armor,repl=common,item=limb){
 const [a,b]=groups(t),child=g=>g.fields.find(f=>f.metadata?.planOptionKey===common).id;
 const n={plan:[newPlan]};if(newPlan===common&&item)n[child(a)]=[item];
 const r={replace:['artificer-plan-1'],plan:[repl]};if(repl===common&&item)r[child(b)]=[item];
 return {hp_method:'fixed',spell_choices:[],class_option_feat_instances:[],replacement_selections:{},class_choice_selections:{[a.id]:n,[b.id]:r}};
}
async function apply(a,t,p){let res;for(let i=0;i<35;i++){res=await a.client.rpc('complete_character_level_up_v5',{p_character_id:t.id,p_selections:p});if(res.error?.code!=='PGRST202')break;await new Promise(r=>setTimeout(r,300))}assert.notEqual(res.error?.code,'PGRST202');return res}
async function deny(a,t,p,pattern,code){const b=snap(t),x=await apply(a,t,p);assert.ok(x.error,'unexpected accepted plan');if(code)assert.equal(x.error.code,code,JSON.stringify(x.error));if(pattern)assert.match(x.error.message,pattern);assert.deepEqual(snap(t),b)}
function checkFinal(t,projection=true){
 assert.equal(sql('SELECT class_level FROM public.character_progression'+t.w),'6');assert.equal(sql("SELECT sheet->>'level' FROM public.character_sheets"+t.w),'6');assert.equal(sql("SELECT sheet#>>'{meta,level}' FROM public.character_sheets"+t.w),'6');assert.equal(sql("SELECT sheet->>'maxHp' FROM public.character_sheets"+t.w),'41');
 const rr=rows(t);assert.equal(rr.length,5);assert.deepEqual(rr.map(x=>x.option_key),[common,...fixed.slice(1),armor]);assert.deepEqual(rr.map(x=>x.acquired_level),[6,2,2,2,6]);assert.equal(rr[0].id,t.initial[0].id);assert.equal(rr[0].instance_key,t.initial[0].instance_key);assert.equal(rr[0].metadata.replacedAtLevel,6);assert.equal(rr[0].choices.child.key,limb);for(let i=1;i<4;i++)assert.deepEqual(rr[i],t.initial[i]);assert.ok(rr.every(x=>x.metadata.materializesInventory===false));
 const sh=JSON.parse(sql("SELECT sheet FROM public.character_sheets"+t.w));const p=sh.classFeatureChoices?.['artificer-magic-item-plans'];if(projection){assert.equal(p.count,5);assert.deepEqual(p.selections.map(x=>x.instanceKey),rr.map(x=>x.instance_key));assert.deepEqual(p.selections.map(x=>x.key),rr.map(x=>x.option_key));assert.equal(p.selections[0].item.key,limb)}else assert.equal(p,undefined);
 assert.equal(sql("SELECT count(*) FROM public.character_spells"+t.w),'8');
 assert.equal(sql("SELECT count(*) FROM public.character_level_up_sessions"+t.w+" AND status='completed' AND from_level=5 AND to_level=6"),'1');assert.equal(sql("SELECT count(*) FROM public.character_level_events"+t.w+" AND event_type='level_up_completed' AND from_level=5 AND to_level=6"),'1');
 for(const [table,path] of [['character_progression',"level_choices#>'{6,artificer_plan_delta,added}'"],['character_level_up_sessions',"selections#>'{artificer_plan_delta,added}'"],['character_level_events',"details#>'{artificerPlanDelta,added}'"]])assert.equal(sql("SELECT jsonb_array_length("+path+") FROM public."+table+t.w),'1');
}
const red=seed(),good=input(red),[ga,gr]=groups(red);assert.equal(ga.id,'artificer-plan-slot-5');assert.equal(gr.id,'artificer-plan-replacement');assert.deepEqual(gr.fields[0].options.map(x=>x.key),red.initial.map(x=>x.instance_key));assert.ok(ga.fields[0].options.some(x=>x.key===armor));assert.ok(!ga.fields[0].options.some(x=>x.key===fixed[0]));
const opt=ga.fields.find(f=>f.metadata?.planOptionKey===common);assert.ok(opt.options.some(x=>x.key===limb));assert.ok(!opt.options.some(x=>[potion,reagent].includes(x.key)));
mark('artificer-original');await deny(viewer,red,good,null,'42501');await deny(outsider,red,good,null,'42501');
const missing=structuredClone(good);delete missing.class_choice_selections[ga.id];await deny(owner,red,missing,/requires exactly one plan/i);
await deny(owner,red,input(red,fixed[0]),/already a learned Magic Item Plan/i);
await deny(owner,red,input(red,armor,common,null),/requires one concrete magic item/i);
await deny(owner,red,input(red,armor,common,potion),/not legal/i);await deny(owner,red,input(red,armor,common,reagent),/not legal/i);
await deny(owner,red,input(red,common,common,limb),/different magic item/i);
const low=seed(13999);await deny(editor,low,input(low),/required XP threshold/i);
console.log('PASS I2J-AR02 genuine signed negative choices, viewer/outsider, source-qualified wildcard, duplicate and XP rollback, inventory snapshots');
mark('artificer-writer-red');const history=accounts(),inv=inventory();const rr=await apply(editor,red,good);assert.ifError(rr.error);checkFinal(red);assert.equal(inventory(),inv);const changed=accounts();for(let i=0;i<3;i++)assert.notEqual(changed[i],history[i]);assert.equal(changed[3],history[3]);console.log('I2J-AR03 EARNED PROJECTION WRITER RED: signed 5→6 acquisition and replacement succeed, original projection alone overwrites linked accounts (existing T17 writer, no new count)');
const missingParent=seed(14000,true),mpInv=inventory();mark('artificer-parent-red');const mr=await apply(editor,missingParent,input(missingParent));assert.ifError(mr.error);checkFinal(missingParent,false);assert.equal(inventory(),mpInv);console.log('I2J-AR04 EARNED NULL-PARENT RED: original 5→6 commits grants without required sheet projection on legacy missing parent; distinct earned path of prior I1L/T17 defect');
const nullCandidate=captured(nullFix,helpers[4][0]);sql(nullCandidate);assert.equal(once(def(projName),"if coalesce(jsonb_typeof(v_sheet->'classFeatureChoices'),'')<>'object' then","if jsonb_typeof(v_sheet->'classFeatureChoices')<>'object' then"),originalProj);
sql(once(def(projName),projMirror,omission));const projSafe=md5(projName);
const green=seed(14000,true);mark('artificer-green');const frozen=accounts(),invs=inventory(),unrelated=snap(red),payload=input(green);
sql("UPDATE public.character_permissions SET can_edit=false"+green.w+" AND user_id="+q(owner.id));await deny(owner,green,payload,null,'42501');
const ok=await apply(editor,green,payload);assert.ifError(ok.error);checkFinal(green);assert.deepEqual(accounts(),frozen);assert.equal(inventory(),invs);assert.deepEqual(snap(red),unrelated);await deny(editor,green,payload,null);
console.log('PASS I2J-AR05 reuse prior NULL-safe + isolated Option A candidate through actual signed earned v5; all accounts, inventory, other character, replacement row identity and history preserved');
const race=seed();mark('artificer-race');const p=input(race),stable=accounts(),items=inventory();const a=await Promise.all([apply(owner,race,p),apply(editor,race,p)]);assert.equal(a.filter(x=>!x.error).length,1,JSON.stringify(a));checkFinal(race);assert.deepEqual(accounts(),stable);assert.equal(inventory(),items);
const neg=seed();await deny(editor,neg,input(neg,common,common,limb),/different magic item/i);const directBefore=snap(neg);const direct=await editor.client.from('character_class_option_grant_instances').delete().eq('character_id',neg.id);assert.ok(direct.error);assert.deepEqual(snap(neg),directBefore);
for(const [n,h] of fingerprints.filter(([n])=>n!==baseName&&n!==summaryName))assert.equal(md5(n),h,n);for(const [n,sig,hash] of helpers.filter(([n])=>n!==helpers[4][0]))assert.equal(md5(n+sig),hash,n);
assert.equal(md5(baseName),baseSafe);assert.equal(md5(summaryName),summarySafe);assert.equal(md5(projName),projSafe);assert.equal(md5(earnedName),earnedHash);assert.equal(trigger(),trig);
console.log('PASS I2J-AR06 concurrent exactly-one, post-candidate wildcard rejection, direct grant DML denial, original trigger and helper source intact');
console.log('I2J-AR RESULT: bounded historical earned v5 5→6 plan acquisition/replacement and exact original projection RED/GREEN; six of 56 plans, two real items, synthetic spell metadata, reduced unrelated helpers; no full inventory graph, role/browser/production/release proof');
