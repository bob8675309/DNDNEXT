import fs from 'node:fs';
import assert from 'node:assert/strict';
const script=fs.readFileSync('scripts/test_eldritch_blast_real_auth.mjs','utf8');
const fixture=fs.readFileSync('scripts/fixtures/eldritch_blast_auth_bridge_pg16.sql','utf8');
for(const marker of [
 'prodRef=','DNDNEXT_EB_STAGING_URL','DNDNEXT_EB_STAGING_PUBLISHABLE_KEY',
 'signInWithPassword','auth.getUser()','auth.getClaims()',
 'DNDNEXT_EB_MUTATING_TEST_CONFIRM','YES_DISPOSABLE_STAGING_CAST_ONLY',
 'DNDNEXT_EB_TEST_OWNER_UID','DNDNEXT_EB_DISPOSABLE_ENCOUNTER_ID',
 'assert.deepEqual(repeat.data,cast','isDenied(foreignReplay.error)'
]) assert.ok(script.includes(marker),'Missing real session safety contract: '+marker);
assert.ok(!script.includes('service_role_key'));
assert.match(fixture,/delete from public\.character_permissions/);
assert.match(fixture,/Revoked editor retained permission/);
assert.match(fixture,/Revoked user created an effectful command/);
console.log('Signed-in staging harness safety and mock revocation contracts PASS');
