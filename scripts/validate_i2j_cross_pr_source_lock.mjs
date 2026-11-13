#!/usr/bin/env node
// I2J: source-identity / static-order preflight ONLY. No SQL, secrets, database or deployments.
// Usage: node scripts/validate_i2j_cross_pr_source_lock.mjs [--remote]
// --remote needs a repository-reading GITHUB_TOKEN or GH_TOKEN for private DNDNEXT.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = new URL('../docs/integration/I2J_CROSS_PR_SOURCE_LOCK_2026-11-12.json', import.meta.url);
const m = JSON.parse(readFileSync(root, 'utf8'));
const sha = /^[0-9a-f]{40}$/;
const byId = new Map(m.sources.map(x => [x.id,x]));
assert.equal(m.schema,'i2j-cross-pr-source-lock-v1');
assert.equal(m.release_state,'BLOCKED_SOURCE_INVENTORY_ONLY');
assert.equal(m.source_count,m.sources.length);
assert.equal(byId.size,m.sources.length,'duplicate source id');
assert.ok(m.sources.length >= 19,'lost a required source');
assert.ok(sha.test(m.base_main));
assert.equal(m.source_heads.main,m.base_main);
for (const f of m.sources) {
  assert.match(f.blob_sha,sha,'invalid source blob '+f.id);
  assert.match(f.head,sha,'invalid source head '+f.id);
  assert.equal(f.head,m.source_heads[f.source_pr],'drifted PR/head '+f.id);
  assert.ok(f.path && !f.path.startsWith('/') && !f.path.includes('..'),'unsafe source path');
  assert.equal(f.disposition,f.source_pr==='main'?'exact_copy_research_unapplied':'deferred_preserved_pinned');
}
const must = ['immutable_324','inventory_stage4','npc_stage1','npc_stage2','npc_stage3','forge_ui_345','npc_panel_345','npc_admin_345','player_profile_345','story_nonce_351','story_nonce_signed_test_351','option_a_creation_371','option_a_acl_371','option_a_private_v2_371','option_a_signed_test_371','npc_privacy_signed_test_345','admin_rights_318','delegate_rights_312','global_lock_graph_317'];
for(const id of must) assert.ok(byId.has(id),'missing original/deferred evidence '+id);
assert.deepEqual(m.source_order_hypothesis,[
  'npc_stage1','npc_stage2','npc_stage3','immutable_324','story_nonce_351',
  'option_a_creation_371','option_a_private_v2_371','option_a_acl_371','inventory_stage4'
]);
assert.equal(m.read_only_production_census.original_account_UPDATE_writers,34);
assert.equal(m.read_only_production_census.option_a_writers_bounded_tested,12);
assert.equal(m.read_only_production_census.option_a_writers_not_bounded_tested,22);
assert.equal(m.read_only_production_census.forge_related_enabled_triggers,31);
assert.equal(m.read_only_production_census.npc_privacy_rpc_installed,false);
assert.equal(m.read_only_production_census.creator_story_table_installed,false);
assert.equal(m.read_only_production_census.old_inventory_owner_check_still_enforced,true);

if(!process.argv.includes('--remote')) {
  console.log('PASS I2J manifest shape, frozen source heads and no-lost-work references ('+m.sources.length+').');
  console.log('NOT TESTED: upstream SHA/content fetch, SQL composition, signed auth, 31-trigger co-residency, browser, restore, production.');
  process.exit(0);
}
const token=process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
assert.ok(token,'--remote requires GitHub read access token; do not silently skip evidence');
const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
async function get(url) {
  const res=await fetch(url,{headers,redirect:'error'});
  assert.equal(res.status,200,'remote API '+res.status+' '+url);
  return res.json();
}
const api='https://api.github.com/repos/'+m.repository;
const heads=Object.entries(m.source_heads);
for(const [label,expected] of heads) {
  const commit=await get(api+'/git/commits/'+expected);
  assert.equal(commit.sha,expected,'missing pinned commit '+label);
}
const sources=new Map();
for(const f of m.sources) {
  const data=await get(api+'/contents/'+f.path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(f.head));
  assert.equal(data.sha,f.blob_sha,'source blob DRIFT '+f.id+' '+f.path);
  assert.equal(data.type,'file');
  assert.equal(data.encoding,'base64');
  const content=Buffer.from(data.content.replace(/\\s/g,''),'base64').toString('utf8');
  assert.ok(content.length>0,'empty pinned file '+f.id);
  sources.set(f.id,content);
}
function contains(id,needle) {assert.ok(sources.get(id).includes(needle),'missing source semantic guard '+id+' '+needle);}
contains('npc_stage2','REVOKE SELECT (');
contains('npc_stage2','background,motivation,quirk,mannerism,voice');
contains('npc_stage2','get_npc_dossier_admin_v1');
contains('npc_stage3','character_public_secret_revelations');
contains('npc_stage3','reveal.public_text');
assert.ok(!sources.get('npc_stage3').includes("coalesce(nullif(p.secret,''),p.s->>'secret')"),'Stage3 re-exposes raw GM secret');
contains('story_nonce_351','__dndnext_private_story_intent_sha256_i1c');
contains('story_nonce_351','ON CONFLICT (character_id) DO NOTHING');
contains('story_nonce_351','SECURITY INVOKER');
contains('option_a_private_v2_371','I2D_OPTION_A_PRIVATE_FORGE_LEGACY_FREEZE');
contains('option_a_creation_371','I2C original create source drift');
contains('option_a_acl_371','direct legacy-sheet insertion/update rejected');
for(const expr of [
'ALTER POLICY inventory_items_insert_owner_or_admin',
'ALTER POLICY inventory_items_update_owner_or_admin',
'ALTER POLICY inventory_items_delete_owner_or_admin',
'ALTER POLICY inventory_items_select_owner_or_admin',
'ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_owner_type_chk'
])contains('inventory_stage4',expr);
const inventory=sources.get('inventory_stage4');
assert.ok(inventory.indexOf('BEGIN;') < inventory.indexOf('ALTER POLICY') && inventory.lastIndexOf('COMMIT;')>inventory.indexOf('DROP CONSTRAINT'),'inventory changes not atomically staged');
console.log('PASS I2J remote SHA/content and static guard assertions ('+sources.size+' source blobs).');
console.log('NOT TESTED: executable SQL composition, signed auth, 31-trigger co-residency, browser, DB+Storage restore, production.');
