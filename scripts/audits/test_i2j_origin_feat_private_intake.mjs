import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pins,verifySourceRows,readPrivateExport} from './i2j_origin_feat_private_intake.mjs';
const definition='CREATE OR REPLACE FUNCTION private.synthetic(p_value text)\n RETURNS text\n LANGUAGE sql\n AS $function$ SELECT p_value $function$\n';
const md5=createHash('md5').update(definition).digest('hex');
const pin={schema:'private',name:'synthetic',args:'p_value text',md5,owner:'postgres',acl:['postgres=X/postgres','service_role=X/postgres']};
const row={schema:pin.schema,name:pin.name,arguments:pin.args,md5,owner:pin.owner,acl:[...pin.acl].reverse(),definition};
test('OF-INTAKE-01 unique immutable 13 scoped identities, five previously held',()=>{
 assert.equal(pins.length,13);
 assert.equal(new Set(pins.map(p=>p.schema+'.'+p.name+'('+p.args+')')).size,13);
 assert.equal(pins.filter(p=>p.acl===null).length,9);
 for(const p of pins)assert.match(p.md5,/^[a-f0-9]{32}$/);
 assert.ok(Object.isFrozen(pins)&&pins.every(Object.isFrozen));
});
test('OF-INTAKE-02 exact synthetic text and metadata produce hash-only receipt',()=>{
 const result=verifySourceRows([row],[pin]);
 assert.equal(result.verifiedCount,1);
 assert.equal(result.verified[0].sha256,createHash('sha256').update(definition).digest('hex'));
 assert.equal(result.verified[0].bytes,Buffer.byteLength(definition));
 assert.ok(!JSON.stringify(result).includes(definition));
 for(const k of ['installedFingerprintVerified','effectivePrivilegesVerified','dependencyClosureVerified','signedExecution','releaseAllowed'])assert.equal(result[k],false);
});
test('OF-INTAKE-03 missing, duplicate, wrong argument identity rejected',()=>{
 for(const input of [[],[row,row],[{...row,arguments:'p_value uuid'}]])assert.throws(()=>verifySourceRows(input,[pin]),/missing or duplicate/);
});
test('OF-INTAKE-04 exact hash rejects changes, claimed MD5 and newline normalization',()=>{
 for(const bad of [{...row,definition:definition+' '},{...row,md5:'0'.repeat(32)},{...row,definition:definition.replaceAll('\n','\r\n')}])assert.throws(()=>verifySourceRows([bad],[pin]),/fingerprint|identity mismatch/);
});
test('OF-INTAKE-05 owner and ACL metadata, null distinct from empty',()=>{
 for(const bad of [{...row,owner:'other'},{...row,acl:null},{...row,acl:[]},{...row,acl:undefined}])assert.throws(()=>verifySourceRows([bad],[pin]),/owner\/ACL/);
 assert.equal(verifySourceRows([{...row,acl:null}],[{...pin,acl:null}]).verified[0].aclRecordedAsNull,true);
});
test('OF-INTAKE-06 malformed input and wrong definition header fail closed',()=>{
 for(const input of [{},[null],['x']])assert.throws(()=>verifySourceRows(input,[pin]));
 assert.throws(()=>verifySourceRows([{...row,definition:definition.replace('private.synthetic','public.synthetic')}],[pin]),/identity mismatch/);
});
test('OF-INTAKE-07 refuse input within repo, including symlink resolving there',()=>{
 const outer=mkdtempSync(join(tmpdir(),'i2j-intake-'));
 try{
  const path=join(outer,'inside.json');writeFileSync(path,'[]');
  assert.throws(()=>readPrivateExport(path,outer),/outside the repository/);
  const link=join(outer,'link.json');symlinkSync(path,link);
  assert.throws(()=>readPrivateExport(link,outer),/outside the repository/);
 }finally{rmSync(outer,{recursive:true,force:true});}
});
test('OF-INTAKE-08 synthetic export never accepted by fixed actual pins',()=>{
 assert.throws(()=>verifySourceRows([row]),/missing or duplicate/);
});
