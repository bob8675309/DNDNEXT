// Independent I2J historical source audit: NO SQL, network, production or gameplay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const paths={
 v2:'sql/20260720_01_subclass_compatibility_and_selection.sql',
 oldV3:'sql/20260808_11_character_level_up_v3.sql',
 newV3:'sql/20260808_19_source_aware_level_up_spell_access.sql',
 ledger:'docs/I2_I_ADMIN_FEATURE_OPTION_A_WRITER_COVERAGE_2026-11-12.json'
};
const expected={
 v2:'4e938bc3217f11b8a4ef589da83af00aaca51782',
 oldV3:'1e1df113b95b1579b086a2d95f7acd34f427bc6e',
 newV3:'ba4443302d37bb99532695e438bd1c0d0f1e4e5c',
 ledger:'772af5e05ec494f9526445a5ad9eb05bad0f5d78'
};
const data=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,readFileSync(path.join(root,p))]));
const source=Object.fromEntries(Object.entries(data).map(([k,b])=>[k,b.toString('utf8')]));
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function sqlBody(text,signature){
 const begin=text.search(new RegExp('create or replace function\\s+'+signature.replaceAll('.','\\.')+'\\s*\\(','i'));
 assert.ok(begin>=0,'Missing historical function '+signature);
 const rest=text.slice(begin);
 const end=rest.search(/\n(?:\$\$|\$function\$);/i);
 assert.ok(end>=0,'Truncated historical function '+signature);
 return rest.slice(0,end);
}
const v2=sqlBody(source.v2,'public.complete_character_level_up_v2');
const oldV3=sqlBody(source.oldV3,'public.complete_character_level_up_v3');
const newV3=sqlBody(source.newV3,'public.complete_character_level_up_v3');
const ledger=JSON.parse(source.ledger);
const hasDelegate=s=>/perform\s+public\.complete_character_level_up_v1\s*\(\s*p_character_id\s*,\s*v_selections\s*\)/i.test(s);
const hasMirror=s=>/update\s+public\.players\s+p\s+set\s+sheet\s*=\s*v_sheet\s*,\s*updated_at\s*=\s*now\(\)/i.test(s);
test('I2J-01 original source blobs unchanged',()=>{
 for(const k of Object.keys(paths))assert.equal(gitBlob(data[k]),expected[k],paths[k]+' changed: stop and re-audit');
});
test('I2J-02 v2 authorization is explicitly present in historical SQL',()=>{
 assert.match(v2,/security definer/i);
 assert.match(v2,/private\.can_manage_character_progression_v1\s*\(\s*p_character_id\s*\)/i);
 assert.match(source.v2,/revoke all on function public\.complete_character_level_up_v2\(uuid,jsonb\) from public, anon/i);
 assert.match(source.v2,/grant execute on function public\.complete_character_level_up_v2\(uuid,jsonb\) to authenticated/i);
});
test('I2J-03 v2 invokes separately mirrored original v1',()=>assert.equal(hasDelegate(v2),true));
test('I2J-04 v2 canonical per-character update exists',()=>{
 assert.match(v2,/update\s+public\.character_sheets\s+set\s+sheet\s*=\s*v_sheet\s*,\s*updated_at\s*=\s*now\(\)/i);
});
test('I2J-05 v2 has additional direct account-wide mirror',()=>{
 assert.equal(hasMirror(v2),true);
 assert.equal((v2.match(/update\s+public\.players\s+p\s+set/gi)||[]).length,1);
 assert.match(v2,/where\s+p\.user_id\s+in\s*\(\s*select\s+cp\.user_id\s+from\s+public\.character_permissions\s+cp\s+where\s+cp\.character_id\s*=\s*p_character_id\s*\)/i);
});
test('I2J-06 direct v2 mirror is conditional on source-backed subclass',()=>{
 const branch=v2.search(/if\s+v_name\s+is\s+not\s+null\s+then/i);
 const direct=v2.search(/update\s+public\.players\s+p\s+set/i);
 assert.ok(branch>=0&&direct>branch);
 assert.match(v2,/private\.resolve_subclass_choice_v1\s*\(/i);
});
test('I2J-07 older v3 calls v2 but later v3 calls a different base',()=>{
 assert.match(oldV3,/public\.complete_character_level_up_v2\s*\(/);
 assert.doesNotMatch(newV3,/complete_character_level_up_v2\s*\(/);
 assert.match(newV3,/private\.complete_character_level_up_base_v3\s*\(/);
});
test('I2J-08 immutable ledger remains 34 original with 12 bounded and 22 untested',()=>{
 assert.equal(ledger.original_update_writer_total,34);
 assert.equal(ledger.original_update_writer_scratch_tested,12);
 assert.equal(ledger.original_update_writer_untested,22);
 assert.equal(ledger.original_update_writers.length,34);
 assert.equal(new Set(ledger.original_update_writers.map(x=>x.signature)).size,34);
 assert.equal(ledger.original_update_writers.filter(x=>x.status==='not_option_a_tested').length,22);
});
test('I2J-09 v2 is still untested, not signed',()=>{
 const w=ledger.original_update_writers.find(w=>w.signature==='public.complete_character_level_up_v2(p_character_id uuid, p_selections jsonb)');
 assert.ok(w);
 assert.equal(w.status,'not_option_a_tested');
 assert.equal(w.source_md5,'28a227a1dfb9a3cc5516c5b7afb874b0');
});
test('I2J-10 negative source mutation detects lost account mirror',()=>{
 const mutation=v2.replace(/update\s+public\.players\s+p\s+set\s+sheet\s*=\s*v_sheet\s*,\s*updated_at\s*=\s*now\(\)/i,'/* removed only in simulated negative */');
 assert.equal(hasMirror(v2),true);
 assert.equal(hasMirror(mutation),false);
});
test('I2J-11 negative source mutation detects lost v1 call',()=>{
 const mutation=v2.replace(/perform\s+public\.complete_character_level_up_v1\s*\(\s*p_character_id\s*,\s*v_selections\s*\)/i,'/* removed only in simulated negative */');
 assert.equal(hasDelegate(v2),true);
 assert.equal(hasDelegate(mutation),false);
});
console.log('I2J SOURCE-ONLY PASS. No PG17, JWT, hosted SQL, gameplay or live ACL tested.');
