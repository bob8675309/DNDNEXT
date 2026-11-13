#!/usr/bin/env node
// I2J: original held I2C v1/signup into a disposable-only fixture,
// WITHOUT reinstalling original public v2 over #324 immutable wrapper.
// Reads pinned Git blob; never connects to a database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const originalPath='scripts/fixtures/i2j/pinned/i2c_original_creation_signup_shared_forge_pg17.sql';
const bytes=fs.readFileSync(path.join(root,originalPath));
const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
assert.equal(blob,'1717bbac40bb4f53c87857675bf70c7181982c34','original held I2C fixture changed');
const raw=bytes.toString('utf8').replace(/\r\n/g,'\n');
const markerV2='-- SOURCE-ORIGINAL public.create_player_character_v2(p_payload jsonb, p_spell_choices jsonb) MD5 0351f0a00acae023278e1b8b065b00c9';
const markerSignup='-- SOURCE-ORIGINAL public.sync_user_profile() MD5 dd7113eec05655a661309838acce6030';
const a=raw.indexOf(markerV2),b=raw.indexOf(markerSignup);
assert.ok(a>0&&b>a,'original I2C v2 delimiter not found');
assert.equal(raw.indexOf(markerV2,a+1),-1);
assert.equal(raw.indexOf(markerSignup,b+1),-1);
let body=raw.slice(0,a)+raw.slice(b);
const oldCheck=" IF md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))<>'0351f0a00acae023278e1b8b065b00c9' THEN RAISE EXCEPTION 'I2C exact original function changed: public.create_player_character_v2'; END IF;\n";
const oldRevoke='REVOKE ALL ON FUNCTION public.create_player_character_v2(jsonb,jsonb) FROM PUBLIC,anon;\nGRANT EXECUTE ON FUNCTION public.create_player_character_v2(jsonb,jsonb) TO authenticated;\n';
for(const s of [oldCheck,oldRevoke]){
 assert.equal(body.split(s).length,2,'original v2 check/ACL source changed');
 body=body.replace(s,'');
}
const oldEcho="\\echo 'PASS I2C-ORIGINAL: five original live functions source-hash-verified, signup trigger and Fighter spell helper in disposable signed Forge'";
assert.equal(body.split(oldEcho).length,2);
body=body.replace(oldEcho,"\\echo 'PASS I2J-V1 original source: v1 + signup/helper exact; #324 public v2 untouched'");
assert.ok(!body.includes('CREATE OR REPLACE FUNCTION public.create_player_character_v2('));
assert.ok(!body.includes('CREATE OR REPLACE FUNCTION public.create_player_character_v3('));
assert.ok(body.includes('CREATE OR REPLACE FUNCTION public.create_player_character_v1('));
assert.ok(body.includes('CREATE OR REPLACE FUNCTION public.sync_user_profile()'));
assert.ok(body.includes('CREATE TRIGGER i2c_auth_user_profile_after_insert'));
const header=[
 '-- I2J DISPOSABLE ONLY: source-original v1 + signup. NEVER HOSTED.',
 '-- Pinned I2C Git blob 1717bbac40bb4f53c87857675bf70c7181982c34.',
 '-- Original public v2 source/check/ACL excluded to preserve immutable #324.',
 'DO $i2j_setup$',
 'DECLARE v_v2 text;',
 'BEGIN',
 " IF current_database()<>'postgres'",
 " OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999",
 " OR current_setting('application_name')<>'dndnext-i2j-v1-local'",
 " OR to_regclass('private.test_admins') IS NULL",
 " OR to_regclass('public.user_profiles') IS NOT NULL",
 " OR to_regclass('auth.users') IS NULL",
 " OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL",
 " OR to_regclass('public.character_backstory_secrets') IS NULL",
 " THEN RAISE EXCEPTION 'I2J-v1 source setup requires empty local immutable/Story PG17'; END IF;",
 " v_v2 := pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure);",
 " IF md5(v_v2)='0351f0a00acae023278e1b8b065b00c9'",
 " OR position('private.reserve_player_creation_intent_v1' IN v_v2)=0",
 " OR position('private.create_player_character_v2_source_20261105' IN v_v2)=0",
 " THEN RAISE EXCEPTION 'I2J-v1 requires #324 public v2 IMMUTABLE wrapper'; END IF;",
 'END $i2j_setup$;'
].join('\n');
const sql=header+'\n'+body+'\n';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check'){
 console.log('PASS I2J setup: original v1/signup/helpers pinned; original public v2 excluded.');
 console.log('NO DB executed. Immutable v2 source must also be verified in isolated PG17.');
}else if(args.length===2&&args[0]==='--out'){
 const dest=path.resolve(args[1]);
 assert.ok(path.isAbsolute(args[1])&&dest.endsWith('.sql'),'absolute .sql path required');
 assert.ok(!dest.startsWith(root+path.sep),'scratch SQL must be outside repository');
 fs.writeFileSync(dest,sql,{flag:'wx',mode:0o600});
 console.log('WROTE I2J original v1-only source setup '+dest);
}else throw Error('Usage: --check | --out /absolute/scratch.sql');
