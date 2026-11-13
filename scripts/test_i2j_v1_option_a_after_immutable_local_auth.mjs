#!/usr/bin/env node
// I2J-V1: signed ORIGINAL RED -> source-exact Option A v1 GREEN with #324
// immutable public v2 and #351 Story. Entirely disposable GoTrue/PG17 only.
// The workflow must stage Stage1-3, #324 and #351 BEFORE this script.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
const e=process.env;
for(const [k,v] of Object.entries({
 CI:'true',GITHUB_ACTIONS:'true',PGHOST:'127.0.0.1',PGPORT:'55622',
 PGDATABASE:'postgres',PGUSER:'postgres',PGAPPNAME:'dndnext-i2j-v1-local',
 DNDNEXT_I2J_V1_CONFIRM:'DISPOSABLE_ONLY_V1_AFTER_IMMUTABLE'
}))assert.equal(e[k],v,'Refuse unsafe I2J signed fixture '+k);
assert.match(e.DNDNEXT_I2J_V1_LOCAL_URL||'',/^http:\/\/127\.0\.0\.1:55621\/?$/);
assert.ok(e.DNDNEXT_I2J_V1_ANON_KEY,'missing genuine local GoTrue anon');
const mk=()=>createClient(e.DNDNEXT_I2J_V1_LOCAL_URL,e.DNDNEXT_I2J_V1_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const ps=(argv)=>{
 const res=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1',...argv],
  {env:e,encoding:'utf8',timeout:40000});
 assert.equal(res.status,0,'disposable psql: '+(res.stderr||'').slice(-2000));
 return res.stdout.trim();
};
const sql=q=>ps(['-qAt','-c',q]);
const file=p=>ps(['-q','-f',p]);
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const md5=sig=>sql('SELECT md5(pg_get_functiondef('+quote(sig)+'::regprocedure))');
const account=w=>sql("SELECT row_to_json(z)::text FROM (SELECT name,sheet,updated_at FROM public.players WHERE user_id="+quote(w.id)+") z");
const sheet=id=>sql("SELECT sheet::text FROM public.character_sheets WHERE character_id="+quote(id));
const tally=(t,id)=>sql("SELECT count(*) FROM public."+t+" WHERE "+(t==='characters'?"id":"character_id")+"="+quote(id));
const countNonce=id=>sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id="+quote(id));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const rpc=async(w,name,args)=>{
 for(let n=0;n<35;n++){
  const r=await w.client.rpc(name,args);
  if(r.error?.code==='PGRST202'){await pause(250);continue}
  return r;
 }
 throw Error('local RPC schema cache did not expose '+name);
};
const ok=(r,label)=>{assert.ifError(r.error);assert.ok(r.data,label+' missing id');return r.data;};
const rejected=(r,label,code)=>{
 assert.ok(r.error,label+' unexpectedly succeeded');
 assert.equal(r.error.code,code,label+' SQLSTATE');
};
async function actor(label){
 const client=mk(),email='i2j-'+randomUUID()+'@example.invalid',password='I2JV1-'+randomUUID()+'-X!';
 const sign=await client.auth.signUp({email,password,options:{data:{display_name:label}}});
 assert.ifError(sign.error);
 const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const u=await client.auth.getUser();assert.ifError(u.error);
 const claims=await client.auth.getClaims();assert.ifError(claims.error);
 assert.equal(claims.data.claims.sub,u.data.user.id);
 assert.equal(claims.data.claims.role,'authenticated');
 return {id:u.data.user.id,client,label};
}
const payload=(name,nonce)=>({
 name,secret:null,...(nonce?{creation_request_id:nonce}:{}),
 sheet:{classKey:'fighter',level:1,marker:'I2J-V1 '+name,
   startingEquipmentSelections:{mode:'package',classOption:'A',ruleset:'vanilla'}}
});
const v1=(w,name)=>rpc(w,'create_player_character_v1',{p_payload:payload(name),p_spell_choices:[]});
const v2=(w,name,nonce)=>rpc(w,'create_player_character_v2',{p_payload:payload(name,nonce),p_spell_choices:[]});
const v3Story=(w,name,nonce,story)=>rpc(w,'create_player_character_with_private_backstory_v1',{
 p_payload:payload(name,nonce),p_spell_choices:[],p_magic_selections:[],p_private_backstory:story
});
const sig={
v1:'public.create_player_character_v1(jsonb,jsonb)',
v2:'public.create_player_character_v2(jsonb,jsonb)',
v3:'public.create_player_character_v3(jsonb,jsonb,jsonb)',
privV2:'private.create_player_character_v2_source_20261105(jsonb,jsonb)',
privV3:'private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)',
story:'public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)',
intent:'private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)',
signup:'public.sync_user_profile()'
};
const before=Object.fromEntries(Object.entries(sig).map(([k,v])=>[k,md5(v)]));
assert.equal(before.v1,'e2db5802f1f51b93f5b9d374a835e4b9');
assert.notEqual(before.v2,'0351f0a00acae023278e1b8b065b00c9');
assert.equal(before.v3,'ab48d46376075a79b3f5a5de21fdada6');
assert.equal(before.privV2,'1d06d00eb4b4aa4c125796d761f5e259');
assert.equal(before.story,'6e39477f971c9d40c6726c9f4dbc456e');
assert.equal(before.intent,'5fac54802474043d8233cc17a75f4c0f');
assert.equal(before.signup,'dd7113eec05655a661309838acce6030');
assert.ok(sql("SELECT position('reserve_player_creation_intent_v1' in pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))::int")!=='0');
console.log('PASS I2J-V1-01: source-exact historical v1, original signup and unmodified immutable v2/v3, Story, private copied v2');

sql("INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability) VALUES ('00000000-0000-0000-0000-00000000a2f1','fighter','Fighter','XPHB','2024',10,null) ON CONFLICT(id) DO NOTHING;"+
"INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots,cantrips_known,spells_known) "+
"VALUES('00000000-0000-0000-0000-00000000a2f1',1,0,2,'{}',0,0);");
const red=await actor('I2J v1 original signup display');
assert.equal(JSON.parse(account(red)).sheet.constructor,Object);
assert.deepEqual(JSON.parse(account(red)).sheet,{});
sql("UPDATE public.players SET sheet='{\"archive\":\"OLD_POPULATED_V1\"}'::jsonb WHERE user_id="+quote(red.id));
const redBefore=account(red),redId=ok(await v1(red,'I2J V1 SOURCE RED '+randomUUID().slice(0,8)),'v1 signed original');
assert.equal(tally('characters',redId),'1');
assert.equal(tally('character_sheets',redId),'1');
assert.equal(tally('character_permissions',redId),'1');
assert.notEqual(account(red),redBefore);
assert.notDeepEqual(JSON.parse(account(red)).sheet,{archive:'OLD_POPULATED_V1'});
assert.ok(JSON.parse(account(red)).sheet.marker.includes('SOURCE RED'));
assert.ok(JSON.parse(account(red)).name.includes('SOURCE RED'));
assert.ok(JSON.parse(sheet(redId)).marker.includes('SOURCE RED'));
console.log('PASS I2J-V1-02 ORIGINAL RED: signed original v1 overwrites pre-existing populated account sheet AND name; canonical row persists');
const redEmpty=await actor('I2J original empty snapshot');
const emptyBefore=account(redEmpty);
ok(await v1(redEmpty,'I2J V1 ORIGINAL EMPTY '+randomUUID().slice(0,8)),'v1 original empty');
assert.notEqual(account(redEmpty),emptyBefore);
assert.notDeepEqual(JSON.parse(account(redEmpty)).sheet,{});
console.log('PASS I2J-V1-03 ORIGINAL EMPTY RED: original v1 even overwrites existing {} historical account snapshot');

file('scripts/fixtures/i2j_v1_option_a_identity_only_after_immutable_pg17.sql');
const afterPatch=Object.fromEntries(Object.entries(sig).map(([k,v])=>[k,md5(v)]));
assert.notEqual(afterPatch.v1,before.v1);
for(const k of Object.keys(sig).filter(k=>k!=='v1'))
 assert.equal(afterPatch[k],before[k],'changed unrelated original function '+k);
assert.ok(sql("SELECT position('I2J_V1_OPTION_A_IDENTITY_ONLY' in pg_get_functiondef('public.create_player_character_v1(jsonb,jsonb)'::regprocedure))::int")!=='0');
console.log('PASS I2J-V1-04: reversible ONLY v1 account block patched; immutable public v2/v3 and Story/private sources remain exact');

const green=await actor('I2J historical profile preserved');
sql("UPDATE public.players SET sheet='{\"archive\":\"MUST_STAY_SAME_V1\"}'::jsonb WHERE user_id="+quote(green.id));
const gBefore=account(green),gId=ok(await v1(green,'I2J V1 FIXED GREEN '+randomUUID().slice(0,8)),'green v1');
assert.equal(account(green),gBefore,'legacy name, sheet and timestamp must be byte-identical');
assert.equal(tally('characters',gId),'1');
assert.equal(tally('character_permissions',gId),'1');
assert.ok(JSON.parse(sheet(gId)).marker.includes('FIXED GREEN'));
rejected(await v1(green,'I2J V1 SECOND '+randomUUID().slice(0,8)),'legacy single-character guard','23505');
assert.equal(account(green),gBefore);
console.log('PASS I2J-V1-05: signed patched v1 preserves populated legacy name/sheet/updated_at, canonical rows, one-character restriction');
const empty=await actor('I2J empty sheet preserved');
const eBefore=account(empty),eId=ok(await v1(empty,'I2J V1 GREEN EMPTY '+randomUUID().slice(0,8)),'green empty v1');
assert.equal(account(empty),eBefore,'existing {} account row must remain inert');
assert.equal(tally('character_sheets',eId),'1');
console.log('PASS I2J-V1-06: existing {} legacy sheet, display name and timestamp stay unchanged');

const missing=await actor('I2J missing profile fallback');
sql('DELETE FROM public.players WHERE user_id='+quote(missing.id));
assert.equal(sql('SELECT count(*) FROM public.players WHERE user_id='+quote(missing.id)),'0');
const fallback=ok(await v1(missing,'I2J V1 GREEN FALLBACK '+randomUUID().slice(0,8)),'missing profile');
const fallbackAccount=JSON.parse(account(missing));
assert.equal(fallbackAccount.name,missing.label);
assert.deepEqual(fallbackAccount.sheet,{});
assert.ok(JSON.parse(sheet(fallback)).marker.includes('FALLBACK'));
console.log('PASS I2J-V1-07: authenticated missing-profile fallback creates account ID/name only, no canonical sheet mirror');

file('scripts/fixtures/i2j/pinned/i2c_option_a_signup_profile_acl_scratch_pg17.sql');
const rogue=await green.client.from('players').update({sheet:{forged:'bad'}}).eq('user_id',green.id);
rejected(rogue,'direct legacy sheet edit','42501');
const anon=await mk().from('players').select('user_id').limit(1);
assert.ok(anon.error,'anonymous account read must be denied');
const renamed=await green.client.from('players').update({name:'I2J manual profile rename'}).eq('user_id',green.id).select('name').single();
assert.ifError(renamed.error);
assert.equal(renamed.data.name,'I2J manual profile rename');
assert.deepEqual(JSON.parse(account(green)).sheet,{archive:'MUST_STAY_SAME_V1'});
console.log('PASS I2J-V1-08: signed profile name still editable; direct sheet edit and anon read denied under source-original I2C ACL');

const newV2=await actor('I2J v2 after v1 fix');
const v2Hash=md5(sig.v2),v3Hash=md5(sig.v3),privateV2Hash=md5(sig.privV2);
assert.equal(privateV2Hash,'1d06d00eb4b4aa4c125796d761f5e259');
file('scripts/fixtures/i2j/pinned/i2d_option_a_private_forge_source_scratch_pg17.sql');
assert.equal(md5(sig.v2),v2Hash);
assert.equal(md5(sig.v3),v3Hash);
assert.equal(md5(sig.privV2),'00b2167041b9c2e4e1a98d3873839f37');
assert.equal(md5(sig.v1),afterPatch.v1);
console.log('PASS I2J-V1-09: original I2D private copied v2 repair coexists; immutable public v2 and repaired v1 unchanged');

const oldV2=account(newV2),nonce=randomUUID();
const created=ok(await v2(newV2,'I2J FROZEN V2 '+randomUUID().slice(0,8),nonce),'immutable v2 after I2D');
assert.equal(countNonce(nonce),'1');
assert.equal(account(newV2),oldV2,'v2 writes to frozen {} legacy account sheet');
assert.equal(ok(await v2(newV2,JSON.parse(sheet(created)).marker.replace('I2J-V1 ',''),nonce),'same nonce retry'),created);
assert.equal(countNonce(nonce),'1');
assert.equal(tally('characters',created),'1');
const foreign=await v2(green,'I2J FOREIGN NONCE '+randomUUID().slice(0,8),nonce);
rejected(foreign,'foreign nonce replay','42501');
console.log('PASS I2J-V1-10: immutable public v2 creates canonical row with I2D no-sheet mirror, idempotent same nonce, denies foreign reuse');

// #351 Story branch: original wrapper and current source intact after v1/I2D.
const author=await actor('I2J creator private story');
const beforeStory=account(author),storyNonce=randomUUID();
const storyName='I2J PRIVATE STORY '+randomUUID().slice(0,8),privateText='I2J signed creator-only unpublished Story';
const storyId=ok(await v3Story(author,storyName,storyNonce,privateText),'Story via original immutable path');
assert.equal(account(author),beforeStory);
assert.equal(sql('SELECT secret_text FROM public.character_backstory_secrets WHERE character_id='+quote(storyId)),privateText);
assert.equal(sql('SELECT coalesce(secret,\'\') FROM public.characters WHERE id='+quote(storyId)),'');
assert.equal(ok(await v3Story(author,storyName,storyNonce,privateText),'same Story replay'),storyId);
rejected(await v3Story(author,storyName,storyNonce,privateText+' CHANGED'),'changed Story replay','22023');
assert.equal(account(author),beforeStory);
console.log('PASS I2J-V1-11: #351 Story-aware nonce still enforces no silent changed-text replay, no account mirror');
console.log('I2J-V1 RESULT: signed ORIGINAL populated+empty RED, v1-only source-reversible GREEN, immutable public v2 and private I2D coexist. Disposable reduced PG17 fixture ONLY, 31/31 original production trigger co-residency and 34/34 account writer freeze NOT CLAIMED.');
