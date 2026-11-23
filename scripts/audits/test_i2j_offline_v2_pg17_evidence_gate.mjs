import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ORIGINAL_V2_MD5,ORIGINAL_V2_SIGNATURE,inspectI2JV2OfflineEvidence} from './i2j_offline_v2_pg17_evidence_gate.mjs';
const hash=(a,s)=>createHash(a).update(s,'utf8').digest('hex');
const fixture=[
 "CREATE OR REPLACE FUNCTION public.complete_character_level_up_v2(",
 " p_character_id uuid, p_selections jsonb DEFAULT '{}'::jsonb",
 ") RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER",
 " SET search_path TO 'pg_catalog','public','private','auth' AS $function$",
 "DECLARE v_name text; v_selections jsonb; v_sheet jsonb;",
 "BEGIN",
 " IF NOT private.can_manage_character_progression_v1(p_character_id) THEN",
 " RAISE EXCEPTION 'Not authorized'; END IF;",
 " PERFORM public.complete_character_level_up_v1(p_character_id,v_selections);",
 " IF v_name IS NOT NULL THEN",
 " PERFORM private.resolve_subclass_choice_v1('a','b',v_name,'XPHB');",
 " UPDATE public.character_sheets SET sheet=v_sheet,updated_at=now()",
 " WHERE character_id=p_character_id;",
 " UPDATE public.players p SET sheet=v_sheet,updated_at=now()",
 " WHERE p.user_id IN (SELECT cp.user_id FROM public.character_permissions cp",
 " WHERE cp.character_id=p_character_id);",
 " END IF;",
 " RETURN '{}'::jsonb;",
 "END;",
 "$function$;"
].join('\n')+'\n';
const manifest=(body=fixture)=>({
 manifest_version:'i2j-v2-offline-pg17-evidence-v1',
 source_type:'independent_restored_pg17_pg_get_functiondef',
 postgres_major:17,
 function_identity:ORIGINAL_V2_SIGNATURE,
 backup_id:'offline-pg17-synthetic-fixture',
 restore_receipt:'synthetic test only no genuine restore',
 function_sha256:hash('sha256',body),
 function_md5:hash('md5',body)
});
const candidate=(body=fixture,m=manifest(body),expectedMd5=hash('md5',body))=>
 inspectI2JV2OfflineEvidence({functionDef:body,manifest:m,expectedMd5});
const rejects=(code,body=fixture,m=manifest(body),expectedMd5=hash('md5',body))=>
 assert.throws(()=>candidate(body,m,expectedMd5),e=>e.code===code);
test('I2J-P1-01 synthetic valid specimen returns candidate only, never release',()=>{
 const r=candidate();
 assert.equal(r.status,'CANDIDATE_ONLY_NOT_AUTHORIZED');
 assert.equal(r.production_release_allowed,false);
 assert.equal(r.signed_v2_two_mirror_RED_GREEN_executed,false);
});
test('I2J-P1-02 CLI production source MD5 cannot be replaced by a fixture',()=>{
 assert.equal(ORIGINAL_V2_MD5,'28a227a1dfb9a3cc5516c5b7afb874b0');
 assert.notEqual(hash('md5',fixture),ORIGINAL_V2_MD5);
 assert.throws(()=>inspectI2JV2OfflineEvidence({functionDef:fixture,manifest:manifest()}),
  e=>e.code==='ORIGINAL_V2_MD5_NOT_PROVEN');
});
test('I2J-P1-03 empty or missing input is rejected',()=>{
 rejects('FUNCTION_TEXT_REQUIRED','',manifest(''));
 rejects('RESTORE_MANIFEST_REQUIRED',fixture,null);
});
test('I2J-P1-04 self-asserted restore metadata must pass restrictive shape',()=>{
 rejects('RESTORE_PROVENANCE_INCOMPLETE',fixture,{...manifest(),source_type:'historical_sql'});
 rejects('RESTORE_PROVENANCE_INCOMPLETE',fixture,{...manifest(),postgres_major:16});
 rejects('RESTORE_PROVENANCE_INCOMPLETE',fixture,{...manifest(),restore_receipt:''});
});
test('I2J-P1-05 artifact SHA and recorded MD5 cannot drift',()=>{
 rejects('ARTIFACT_SHA256_DRIFT',fixture+'-- change',manifest(fixture),hash('md5',fixture));
 rejects('ORIGINAL_V2_MD5_NOT_PROVEN',fixture,{...manifest(),function_md5:'0'.repeat(32)});
});
test('I2J-P1-06 wrong v1 function or identity is rejected',()=>{
 rejects('RESTORE_PROVENANCE_INCOMPLETE',fixture,{...manifest(),function_identity:'public.complete_character_level_up_v1(uuid,jsonb)'});
 rejects('NOT_ORIGINAL_V2_FUNCTION_EXPORT',fixture.replace('complete_character_level_up_v2(','complete_character_level_up_v1('));
});
test('I2J-P1-07 SECURITY DEFINER and closed body required',()=>{
 rejects('FUNCTION_TYPE_OR_AUTHORITY_MISMATCH',fixture.replace('SECURITY DEFINER','SECURITY INVOKER'));
 rejects('PG_FUNCTION_BODY_INCOMPLETE',fixture.replace('$function$;\n',''));
});
test('I2J-P1-08 original v1 delegated call is required',()=>{
 rejects('DELEGATED_V1_MIRROR_CALL_MISSING',fixture.replace('public.complete_character_level_up_v1','public.different_function'));
});
test('I2J-P1-09 canonical and subclass source calls required',()=>{
 rejects('SUBCLASS_SOURCE_GUARD_MISSING',fixture.replace('private.resolve_subclass_choice_v1','private.fake_resolver'));
 rejects('CANONICAL_SUBCLASS_WRITE_MISSING',fixture.replace('UPDATE public.character_sheets','UPDATE public.unrelated_table'));
});
test('I2J-P1-10 second account mirror AND editor fanout required',()=>{
 rejects('LEGACY_ACCOUNT_FANOUT_SOURCE_MISSING',fixture.replace('UPDATE public.players p','UPDATE public.other_table p'));
 rejects('LEGACY_ACCOUNT_FANOUT_SOURCE_MISSING',fixture.replace('FROM public.character_permissions cp','FROM public.other_permissions cp'));
});
test('I2J-P1-11 synthetic success never proves role equivalence or backup identity',()=>{
 const r=candidate();
 assert.equal(r.independent_backup_lineage_manually_verified,false);
 assert.equal(r.exact_restored_roles_and_schema_verified,false);
 assert.equal(r.delegated_v1_signed_retested,false);
 assert.equal(r.production_release_allowed,false);
});
