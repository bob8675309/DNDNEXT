// Generate ONLY a disposable schema fixture from pinned, already tracked Git DDL.
// No network, process execution, private source files or database connection.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const pins={
  "catalog": {
    "path": "sql/20260711_01_canonical_spell_class_and_character_option_catalogs.sql",
    "blob": "43e6261e4dd906d713e4a53150b37e0a5d1e6abc"
  },
  "spell": {
    "path": "sql/20260706_01_spell_catalog_foundation.sql",
    "blob": "7efab442b46b0b055dfde6d197254c68c286d7b1"
  },
  "instances": {
    "path": "sql/20260808_01_character_option_grant_instances.sql",
    "blob": "e6482a248ff16ffff91dda1fc772c42c2d63fd77"
  },
  "identity": {
    "path": "sql/20260808_08_character_spell_source_identity.sql",
    "blob": "3f9192c21fc709332a3ee62bc01383099f1219ad"
  }
};
const sources={};
for(const [key,pin] of Object.entries(pins)){
 const b=readFileSync(new URL(pin.path,root));
 assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),pin.blob,'source drift '+pin.path);
 sources[key]=b.toString('utf8');
}
function one(source,regex,label){
 const m=[...source.matchAll(regex)];
 assert.equal(m.length,1,'missing/ambiguous '+label);
 return m[0][0];
}
function table(key,name){
 return one(sources[key],new RegExp('create table if not exists public\\.'+name+'\\s*\\([\\s\\S]*?\\n\\);','ig'),name);
}
// Deliberately reduced auth and character identities. No original functions installed.
const bootstrap=String.raw`
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'i2j_origin_feat_fixture'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR inet_server_port()<>5432
 OR to_regclass('public.characters') IS NOT NULL
 OR to_regclass('auth.users') IS NOT NULL
 OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m'))
 THEN RAISE EXCEPTION 'I2J schema-only fixture requires fresh disposable PG17 database'; END IF;
END $guard$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.characters(id uuid PRIMARY KEY);
`;
const oldIndex=one(sources.spell,/create unique index if not exists character_spells_unique_source_idx[\s\S]*?;/ig,'legacy source label index');
process.stdout.write([
 bootstrap,
 table('catalog','character_option_catalog'),
 table('spell','spells_catalog'),
 table('spell','character_spells'),
 table('catalog','character_option_grants'),
 table('instances','character_option_grant_instances'),
 oldIndex,
 sources.identity,
 // Contract staging only. Actual restored policy/grant/effective-role parity not established.
 'ALTER TABLE public.character_option_grants ENABLE ROW LEVEL SECURITY;',
 'ALTER TABLE public.character_option_grant_instances ENABLE ROW LEVEL SECURITY;',
 'COMMIT;'
].join('\n')+'\n');
