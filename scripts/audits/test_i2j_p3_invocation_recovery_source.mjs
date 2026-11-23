// I2J-P3 original Warlock recovery account-writer, UI -> RPC -> SQL source-contract audit.
// SOURCE ONLY: does not execute SQL, access GitHub/network, require DB credentials, or mutate game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const pinned=Object.freeze({
 sql:['sql/20260808_28_legacy_warlock_invocation_recovery.sql','292acd8000ada950ebcd14e1a917b55918499edb'],
 ui:['components/CharacterInvocationRecovery.js','c58774853c6140981592fa84b9040c0fcb4a8c58'],
 level:['components/CharacterLevelUpChoices.js','3fa76acd1811a77b0c3e93711906bfb5afb17584'],
 panel:['components/CharacterClassPanel.js','d39d2bceab944d3d4ec42cc2cfda92609ce51a2b'],
 ledger:['docs/I2_I_ADMIN_FEATURE_OPTION_A_WRITER_COVERAGE_2026-11-12.json','772af5e05ec494f9526445a5ad9eb05bad0f5d78'],
 grants:['sql/20260808_21_player_forge_class_option_instance_authority.sql','81db89dad30e5bbc2c9f07a8f4fbd72782a09294'],
});
const blobs=Object.fromEntries(Object.entries(pinned).map(([k,[p]])=>[k,fs.readFileSync(path.join(root,p))]));
const source=Object.fromEntries(Object.entries(blobs).map(([k,b])=>[k,b.toString('utf8')]));
const gitHash=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const start=source.sql.search(/create\s+or\s+replace\s+function\s+public\.recover_character_invocations_v1\s*\(/i);
assert.ok(start>=0,'original recovery function missing');
const end=source.sql.indexOf('\n$$;',start);
assert.ok(end>start,'original function truncated');
const original=source.sql.slice(start,end);
const ledger=JSON.parse(source.ledger);
const accountUpdate=/update\s+public\.players\s+p\s+set\s+sheet\s*=\s*v_sheet\s*,\s*updated_at\s*=\s*now\(\)\s+where\s+p\.user_id\s+in\s*\(\s*select\s+cp\.user_id\s+from\s+public\.character_permissions\s+cp\s+where\s+cp\.character_id\s*=\s*p_character_id\s*\)/i;
const characterUpdate=/update\s+public\.character_sheets\s+set\s+sheet\s*=\s*v_sheet\s*,\s*updated_at\s*=\s*now\(\)\s+where\s+character_id\s*=\s*p_character_id/i;
test('I2J-P3-01 all six historical SQL, UI, ledger and grants source blobs are pinned',()=>{
 for(const [k,[p,sha]] of Object.entries(pinned))assert.equal(gitHash(blobs[k]),sha,p+' changed; source audit must be repeated');
});
test('I2J-P3-02 original public recovery is one of 22 untested, not signed accepted',()=>{
 assert.equal(ledger.original_update_writer_total,34);
 assert.equal(ledger.original_update_writer_scratch_tested,12);
 assert.equal(ledger.original_update_writer_untested,22);
 const w=ledger.original_update_writers.find(x=>x.signature==='public.recover_character_invocations_v1(p_character_id uuid, p_selections jsonb)');
 assert.ok(w);
 assert.equal(w.source_md5,'05f6d19a7e2f45d890c62c27cb419e7f');
 assert.equal(w.status,'not_option_a_tested');
});
test('I2J-P3-03 actual source UI imports through Class Panel -> Level Up -> Recovery',()=>{
 assert.match(source.panel,/import CharacterLevelUpChoices from "\.\/CharacterLevelUpChoices"/);
 assert.match(source.panel,/<CharacterLevelUpChoices\s+character=\{character\}/);
 assert.match(source.level,/import CharacterInvocationRecovery from "\.\/CharacterInvocationRecovery"/);
 assert.match(source.level,/<CharacterInvocationRecovery\s+characterId=\{characterId\}/);
});
test('I2J-P3-04 mounted recovery actually calls get then mutation RPC, not a static panel label',()=>{
 assert.match(source.ui,/supabase\.rpc\("get_character_invocation_recovery_v1"/);
 assert.match(source.ui,/supabase\.rpc\("recover_character_invocations_v1"/);
 assert.match(source.ui,/sourceChoiceGroupsComplete\s*\(\s*groups\s*,\s*selections\s*\)/);
 assert.match(source.ui,/!payload\?\.required\s*\|\|\s*!payload\?\.recoverable\s*\|\|\s*!complete/);
 assert.match(source.ui,/onRecovered\?\.\(data\s*\|\|\s*null\)/);
});
test('I2J-P3-05 SQL original checks per-character permission before mutations',()=>{
 assert.match(original,/security\s+definer/i);
 assert.match(original,/private\.can_manage_character_progression_v1\s*\(\s*p_character_id\s*\)/i);
 assert.match(source.sql,/revoke all on function public\.recover_character_invocations_v1\(uuid,jsonb\) from public/i);
 assert.match(source.sql,/grant execute on function public\.recover_character_invocations_v1\(uuid,jsonb\) to authenticated,service_role/i);
});
test('I2J-P3-06 Warlock XPHB and progression row lock are preserved',()=>{
 assert.match(original,/from public\.character_progression where character_id=p_character_id for update/i);
 assert.match(original,/lower\(coalesce\(v_class\.class_key,''\)\)<>'warlock'/i);
 assert.match(original,/upper\(coalesce\(v_class\.source,''\)\)<>'XPHB'/i);
});
test('I2J-P3-07 fully normalized state returns before any account writes',()=>{
 const noOp=original.indexOf('if v_actual=v_expected then return public.get_character_invocation_recovery_v1(p_character_id);');
 const mirror=original.search(accountUpdate);
 assert.ok(noOp>=0&&mirror>noOp);
});
test('I2J-P3-08 partial normalized state aborts instead of writing invalid grants',()=>{
 assert.match(original,/if v_actual<>0 then raise exception 'Partial normalized Invocation history requires GM reconciliation/i);
});
test('I2J-P3-09 ambiguous Lessons of the First Ones effects explicitly require GM reconciliation',()=>{
 assert.match(original,/Lessons of the First Ones requires GM reconciliation/i);
 assert.match(original,/coalesce\s*\(\s*o\.choice_schema->>'kind'\s*,\s*''\s*\)\s*<>\s*'origin-feat'/i);
});
test('I2J-P3-10 recovery honors original legacy names and prevents invented invocation list',()=>{
 assert.match(original,/Invocation recovery must preserve the current Invocation names already recorded on the legacy sheet/i);
 assert.match(original,/array_agg\(value order by value\)/i);
});
test('I2J-P3-11 invocation slot, source/catalog and repeatable restrictions preserved',()=>{
 assert.match(original,/v_group_id:='warlock-invocation-recovery-'/i);
 assert.match(original,/o\.option_type='eldritch-invocation' and o\.source='XPHB'/i);
 assert.match(original,/if not v_option\.repeatable then/i);
 assert.match(original,/Repeated % instances must use different affected cantrips/i);
});
test('I2J-P3-12 cantrip child choices source/level/damage/range are constrained',()=>{
 assert.match(original,/public\.is_preferred_spell_version_v1\s*\(/i);
 assert.match(original,/v_spell\.level<>0/i);
 assert.match(original,/lower\(c\)='warlock'/i);
 assert.match(original,/v_spell\.damage_types/i);
 assert.match(original,/minRangeFeet/i);
});
test('I2J-P3-13 normalized grants and historical order marker are canonical preserved outputs',()=>{
 assert.match(original,/insert into public\.character_class_option_grant_instances\s*\(/i);
 assert.match(original,/recoveredCurrentState',true,'historicalOrderUnknown',true/i);
 assert.match(original,/jsonb_set\(v_sheet,'\{meta,invocationRecovery\}'/i);
 assert.match(source.grants,/create table if not exists public\.character_class_option_grant_instances/i);
});
test('I2J-P3-14 per-character canonical update is separate from account-wide mirror',()=>{
 assert.match(original,characterUpdate);
 assert.match(original,accountUpdate);
 assert.ok(original.search(accountUpdate)>original.search(characterUpdate));
 assert.equal((original.match(/update\s+public\.players\s+p\s+set/gi)||[]).length,1);
});
test('I2J-P3-15 synthetic-negative removal of legacy mirror is independently detectable',()=>{
 const mutant=original.replace(accountUpdate,'/* synthetic removal in string only */');
 assert.match(original,accountUpdate);
 assert.doesNotMatch(mutant,accountUpdate);
 assert.match(mutant,characterUpdate);
 assert.match(mutant,/insert into public\.character_class_option_grant_instances/i);
});
test('I2J-P3-16 synthetic-negative loss of partial-state guard is independently detectable',()=>{
 const guard=/if v_actual<>0 then raise exception 'Partial normalized Invocation history requires GM reconciliation before recovery\.';/i;
 assert.match(original,guard);
 const mutant=original.replace(guard,'/* synthetic guard removal */');
 assert.doesNotMatch(mutant,guard);
 assert.match(mutant,accountUpdate);
});
console.log('I2J-P3 SOURCE ONLY: mounted recovery RPC risks account fanout; ORIGINAL SIGNED evidence UNTESTED, coverage remains 12/34.');
