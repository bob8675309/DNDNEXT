// Disposable I2J/P1.3 composition: public Git DDL only, never private source.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const pins={
 p13:['scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql','6619cc35a9e927696868bf13d3c8942116c9c8c3'],
 original:['scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql','b3168d0c9ec92ae1c0c389ccf55655209f2841f8'],
 catalog:['sql/20260711_01_canonical_spell_class_and_character_option_catalogs.sql','43e6261e4dd906d713e4a53150b37e0a5d1e6abc'],
 spells:['sql/20260706_01_spell_catalog_foundation.sql','7efab442b46b0b055dfde6d197254c68c286d7b1'],
 instances:['sql/20260808_01_character_option_grant_instances.sql','e6482a248ff16ffff91dda1fc772c42c2d63fd77'],
 identity:['sql/20260808_08_character_spell_source_identity.sql','3f9192c21fc709332a3ee62bc01383099f1219ad']
};
const sources=Object.fromEntries(Object.entries(pins).map(([key,[path,sha]])=>{
 const b=readFileSync(new URL(path,root));
 assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha,path);
 return [key,b.toString('utf8')];
}));
function one(key,re){const matches=[...sources[key].matchAll(re)];assert.equal(matches.length,1,key+': '+re);return matches[0][0]}
const presence=one('catalog',/create table if not exists public\.character_option_grants \([\s\S]*?\n\);/g);
const instances=one('instances',/create table if not exists public\.character_option_grant_instances \([\s\S]*?\n\);/g);
const presenceIndex=one('catalog',/create index if not exists character_option_grants_character_idx[\s\S]*?;/g);
const instanceIndexes=[...sources.instances.matchAll(/create index if not exists character_option_grant_instances_\w+[\s\S]*?;/g)].map(m=>m[0]);assert.equal(instanceIndexes.length,3);
const instancePolicy=one('instances',/create policy character_option_grant_instances_rpc_only[\s\S]*?;/g);
const labelIndex=one('spells',/create unique index if not exists character_spells_unique_source_idx[\s\S]*?;/g);
const guard=[
 '\\set ON_ERROR_STOP on','BEGIN;',
 'DO $guard$ BEGIN',
 " IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 OR inet_server_port()<>5432",
 " OR to_regclass('private.p13_levelup_case_guard') IS NULL OR to_regclass('auth.users') IS NULL",
 " OR to_regclass('public.character_option_grants') IS NOT NULL OR to_regclass('public.character_option_grant_instances') IS NOT NULL",
 " OR EXISTS(SELECT 1 FROM public.characters) OR EXISTS(SELECT 1 FROM public.character_spells)",
 " THEN RAISE EXCEPTION 'I2J bridge requires empty disposable P1.3 PG17 fixture'; END IF;",
 " IF NOT EXISTS(SELECT 1 FROM private.p13_levelup_case_guard WHERE scope='disposable') THEN RAISE EXCEPTION 'Missing disposable guard'; END IF; END $guard$;"
].join('\n');
// Additive fixture-only fields; do not claim entire original schema, defaults or policies.
const columns=[
 'ALTER TABLE public.character_option_catalog ADD COLUMN option_key text, ADD COLUMN category text, ADD COLUMN description text, ADD COLUMN raw_payload jsonb;',
 'ALTER TABLE public.spells_catalog ADD COLUMN spell_key text, ADD COLUMN slug text, ADD COLUMN source text, ADD COLUMN school text, ADD COLUMN classes text[], ADD COLUMN description text, ADD COLUMN range_text text, ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();',
 'ALTER TABLE public.character_spells ADD COLUMN uses_max integer, ADD COLUMN uses_remaining integer, ADD COLUMN recharge text, ADD COLUMN save_dc_override integer, ADD COLUMN attack_bonus_override integer, ADD COLUMN notes text, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();'
];
process.stdout.write([guard,...columns,presence,instances,presenceIndex,...instanceIndexes,labelIndex,sources.identity,
 'ALTER TABLE public.character_option_grants ENABLE ROW LEVEL SECURITY;',
 'ALTER TABLE public.character_option_grant_instances ENABLE ROW LEVEL SECURITY;',instancePolicy,
 // Scratch-only conservative boundary; not an original effective ACL claim.
 'REVOKE ALL ON public.character_option_grants,public.character_option_grant_instances FROM PUBLIC,anon,authenticated;',
 'COMMIT;'].join('\n')+'\n');
