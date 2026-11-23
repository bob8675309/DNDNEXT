// I2J-P2: historical weapon mastery account-snapshot source audit.
// No SQL evaluation, hosted/production access, gameplay writes or paid services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sources=Object.freeze({
 weapon:'sql/20260808_45_runtime_weapon_mastery.sql',
 runtime:'sql/20260808_44_runtime_feature_choices_spell_mastery.sql',
 rest:'sql/20260810_89_pending_rest_runtime_choices.sql',
 ledger:'docs/I2_I_ADMIN_FEATURE_OPTION_A_WRITER_COVERAGE_2026-11-12.json'
});
const pinned=Object.freeze({
 weapon:'8c270f53de4eaf076cbf13b0d42b64eb811e8d90',
 runtime:'0d9ec7d003eca7589cce2f77f09f71432f7d8961',
 rest:'6c5f4a5f3cfe43a634d3a4daa0592d000e644b1f',
 ledger:'772af5e05ec494f9526445a5ad9eb05bad0f5d78'
});
const bytes=Object.fromEntries(Object.entries(sources).map(([k,p])=>[k,readFileSync(path.join(root,p))]));
const text=Object.fromEntries(Object.entries(bytes).map(([k,b])=>[k,b.toString('utf8')]));
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const begin=text.weapon.search(/create\s+or\s+replace\s+function\s+public\.configure_character_weapon_mastery_v1\s*\(/i);
assert.ok(begin>=0,'Historical original weapon mastery function missing');
const rest=text.weapon.slice(begin);
const end=rest.search(/\n\$\$;/);
assert.ok(end>0,'Incomplete historical weapon mastery SQL function');
const body=rest.slice(0,end);
const ledger=JSON.parse(text.ledger);
const mirror=/update\s+public\.players\s+p\s+set\s+sheet\s*=\s*v_sheet\s*,\s*updated_at\s*=\s*now\(\)\s+where\s+p\.user_id\s+in\s*\(\s*select\s+cp\.user_id\s+from\s+public\.character_permissions\s+cp\s+where\s+cp\.character_id\s*=\s*p_character_id\s*\)/i;
const canonical=/update\s+public\.character_sheets\s+set\s+sheet\s*=\s*v_sheet\s*,\s*updated_at\s*=\s*now\(\)\s+where\s+character_id\s*=\s*p_character_id/i;
test('I2J-P2-01 full historical source, runtime, rest and ledger blobs pinned',()=>{
 for(const k of Object.keys(sources))assert.equal(blob(bytes[k]),pinned[k],sources[k]+' drift: stop and re-audit');
});
test('I2J-P2-02 writer ledger identifies UNTESTED original weapon mastery writer',()=>{
 assert.equal(ledger.original_update_writer_total,34);
 assert.equal(ledger.original_update_writer_scratch_tested,12);
 assert.equal(ledger.original_update_writer_untested,22);
 const w=ledger.original_update_writers.find(w=>w.signature==='public.configure_character_weapon_mastery_v1(p_character_id uuid, p_item_ids uuid[])');
 assert.ok(w,'Original source writer disappeared');
 assert.equal(w.status,'not_option_a_tested');
 assert.equal(w.source_md5,'32fa55b69478af07f8f0002b967a5704');
});
test('I2J-P2-03 original RPC authorization plus SECURITY DEFINER are explicit',()=>{
 assert.match(body,/security\s+definer/i);
 assert.match(body,/private\.can_manage_character_progression_v1\s*\(\s*p_character_id\s*\)/i);
 assert.match(text.weapon,/revoke all on function public\.configure_character_weapon_mastery_v1\(uuid,uuid\[\]\) from public,anon/i);
 assert.match(text.weapon,/grant execute on function public\.configure_character_weapon_mastery_v1\(uuid,uuid\[\]\) to authenticated,service_role/i);
});
test('I2J-P2-04 XPHB feature class and exact capacity are required',()=>{
 assert.match(body,/upper\s*\(\s*coalesce\s*\(\s*v_class\.source\s*,\s*''\s*\)\s*\)\s*<>\s*'XPHB'/i);
 assert.match(body,/private\.xphb_class_weapon_mastery_count_v1\s*\(/i);
 assert.match(body,/cardinality\s*\(\s*p_item_ids\s*\)\s*<>\s*v_capacity/i);
 assert.match(text.weapon,/when\s+'fighter'\s+then/i);
});
test('I2J-P2-05 distinct items and source-qualified weapon options are enforced',()=>{
 assert.match(body,/count\s*\(\s*distinct\s+item_id\s*\)\s+from\s+unnest\s*\(\s*p_item_ids\s*\)/i);
 assert.match(body,/private\.xphb_class_weapon_mastery_options_v1\s*\(/i);
 assert.match(body,/if\s+v_option\s+is\s+null\s+then\s+raise\s+exception/i);
});
test('I2J-P2-06 prior runtime state and Long Rest replacement cadence are preserved',()=>{
 assert.match(body,/public\.character_runtime_feature_choices/i);
 assert.match(body,/feature_key\s*=\s*'class-weapon-mastery'\s+for\s+update/i);
 assert.match(body,/if\s+v_changed_existing\s*>\s*1\s+then\s+raise\s+exception/i);
 assert.match(body,/rest_type\s*=\s*'long_rest'/i);
 assert.match(body,/v_latest_long_rest\s*<=\s*v_runtime\.replacement_anchor_at/i);
});
test('I2J-P2-07 unchanged selections return before any account-sheet write',()=>{
 const idxReturn=body.search(/if\s+v_changed_existing\s*=\s*0\s+and\s+v_old_count\s*=\s*v_capacity\s+then\s+return\s+public\.get_character_weapon_mastery_v1/i);
 const idxMirror=body.search(mirror);
 assert.ok(idxReturn>=0&&idxMirror>idxReturn);
});
test('I2J-P2-08 canonical runtime upsert is independent of account snapshot fanout',()=>{
 assert.match(body,/insert\s+into\s+public\.character_runtime_feature_choices/i);
 assert.match(body,/on\s+conflict\s*\(\s*character_id\s*,\s*feature_key\s*\)\s+do\s+update/i);
 assert.match(body,/jsonb_build_object\s*\(\s*'selections'\s*,\s*v_new_state/i);
});
test('I2J-P2-09 canonical per-character projection and account mirror both exist',()=>{
 assert.match(body,/jsonb_set\s*\(\s*v_sheet\s*,\s*'\{weaponMasteries\}'\s*,\s*v_names/i);
 assert.match(body,/jsonb_set\s*\(\s*v_sheet\s*,\s*'\{meta,weaponMasteries\}'\s*,\s*v_names/i);
 assert.match(body,canonical);
 assert.match(body,mirror);
});
test('I2J-P2-10 legacy account fanout is not bound to a matching character sheet',()=>{
 const match=mirror.exec(body);assert.ok(match);
 assert.doesNotMatch(match[0],/\bp\.character_id\s*=/i);
 assert.equal((body.match(/update\s+public\.players\s+p\s+set/gi)||[]).length,1);
});
test('I2J-P2-11 source negative: account mirror removal fails the expected source contract',()=>{
 const altered=body.replace(mirror,'/* synthetic MIRROR REMOVED, no SQL executed */');
 assert.match(body,mirror);
 assert.doesNotMatch(altered,mirror);
 assert.match(altered,canonical);
});
test('I2J-P2-12 source negative: canonical runtime upsert removal is detected independently',()=>{
 const upsert=/insert\s+into\s+public\.character_runtime_feature_choices/i;
 const altered=body.replace(upsert,'/* synthetic runtime-upsert removed */');
 assert.match(body,upsert);
 assert.doesNotMatch(altered,upsert);
 assert.match(altered,mirror);
});
test('I2J-P2-13 runtime authority and rest-profile consumer are preserved',()=>{
 assert.match(text.runtime,/create\s+table\s+if\s+not\s+exists\s+public\.character_runtime_feature_choices/i);
 assert.match(text.runtime,/primary\s+key\s*\(\s*character_id\s*,\s*feature_key\s*\)/i);
 assert.match(text.runtime,/alter\s+table\s+public\.character_runtime_feature_choices\s+enable\s+row\s+level\s+security/i);
 assert.match(text.rest,/get_character_weapon_mastery_v1/);
});
console.log('I2J-P2 SOURCE-ONLY: historical weapon mastery original UPDATE remains UNTESTED; 12/34 bounded signed, 22 outstanding. No SQL, role, browser or deployed parity acceptance.');
