// I2J source-only nested Origin feat custody checkpoint. No database or network.
// Original restored definition/body MD5 receipts; bodies remain outside Git.
// The historical Git source may be reused ONLY at body-candidate scope.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
const pins=Object.freeze({
  "m24": {
    "path": "sql/20260808_24_source_owned_origin_feat_authority.sql",
    "blob": "bdc9e3513a689adf66c8b95b80ecb8ee76fb5203"
  },
  "m34": {
    "path": "sql/20260808_34_reversible_source_owned_origin_feats.sql",
    "blob": "97383438092320618fbcd4aa0de304ae77f3c64a"
  },
  "m26": {
    "path": "sql/20260808_26_earned_warlock_invocation_progression.sql",
    "blob": "e32062499f2e3b40ce2be38c22fa4f1cafa90f3c"
  },
  "norm": {
    "path": "scripts/fixtures/forge_progression_authority_original_pg17.sql",
    "blob": "3a0b6caeb6712f67af7895433df15f1439b19581"
  },
  "pref": {
    "path": "scripts/fixtures/forge_warlock_preferred_spell_original_pg17.sql",
    "blob": "f9bf748582986a452110f9b5c326cead61e76374"
  }
});
const receipts=Object.freeze([
  [
    "private.apply_source_owned_origin_feat_v1",
    "b7d69d8643a6b2ba2be8efbb4ee41243",
    "cf3b49f8b47f7e845225a093e559e3e8",
    9897,
    "m34",
    true
  ],
  [
    "private.level_up_warlock_invocation_groups_v1",
    "8b91253ca4ee176c0261ee9293ae9fae",
    "c8c6e14e9b3da48d65708de804fed017",
    7126,
    "m26",
    true
  ],
  [
    "private.normalize_player_choice_name_v1",
    "dd8cdd5b47efe99b1cfff9c2bf7635dd",
    "eeddcc8bd3ded94d1274ed977e59bd72",
    302,
    "norm",
    true
  ],
  [
    "private.origin_feat_choice_rows_v1",
    "057150d304d8176457a0f2d7c122e275",
    "c2caa5d339dc3c980013a0b598fb84eb",
    321,
    "m24",
    true
  ],
  [
    "private.origin_feat_spell_choice_v1",
    "221ff69a6cbc538ee858bee57255ce99",
    "1de558005e951544e73299e80676a9b2",
    390,
    "m24",
    true
  ],
  [
    "public.is_preferred_spell_version_v1",
    "68993ebe31db168b77329aea0f466c5d",
    "939d45079d9e0e8b4a83f030aabb9efa",
    85,
    "pref",
    true
  ],
  [
    "private.apply_level_up_warlock_invocations_v1",
    "ed0655adf02e9413157efe8a8bd414f9",
    "0b7112385043b7b46ec5616fa5234d1f",
    11372,
    "m26",
    false
  ],
  [
    "private.validate_source_owned_origin_feat_v1",
    "eee232817f6bd71eba8b92a1439a8ebf",
    "ea48233094d0b2b7e7c76d3d52638469",
    5612,
    "m24",
    false
  ],
  [
    "private.origin_feat_skill_choice_valid_v1",
    "834656a216b9ed35dec299ea694b58a2",
    "c0226a358e3a6b139c11b6c631dcaa21",
    416,
    "m24",
    false
  ],
  [
    "private.origin_feat_tool_choice_valid_v1",
    "8f8c4f640dea212ab2bd9dc04c46b823",
    "064c3344543ff1d420b86e86d6615cc3",
    708,
    "m24",
    false
  ],
  [
    "private.player_sheet_skill_key_v1",
    "3b44b44ce828c6ac46ff9eaa935fa150",
    "c5ae1b5aa44a6c957d237c9eefe62719",
    730,
    null,
    null
  ]
]);
const md5=b=>createHash('md5').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function bodyOf(source,name){
 const marker=new RegExp('\\bcreate\\s+(?:or\\s+replace\\s+)?function\\s+'+name.replace('.','\\.')+'\\s*\\(','ig');
 const matches=[...source.matchAll(marker)];
 assert.equal(matches.length,1,'missing/ambiguous function identity: '+name);
 const b=source.slice(matches[0].index).match(/\bAS\s+(\$[a-z_]*\$)([\s\S]*?)\1/i);
 assert.ok(b,'missing dollar-quoted body: '+name);
 return Buffer.from(b[2],'utf8');
}
function matchesReceipt(body,receipt){
 return Buffer.isBuffer(body)&&body.length===receipt[3]&&md5(body)===receipt[2];
}
const files={};
for(const [key,pin] of Object.entries(pins)){
 files[key]=readFileSync(fileURLToPath(new URL(pin.path,root)));
 test('I2J-OF immutable Git source '+key,()=>assert.equal(gitBlob(files[key]),pin.blob));
}
for(const r of receipts){
 test('I2J-OF source body disposition '+r[0],()=>{
  assert.match(r[1],/^[a-f0-9]{32}$/);
  assert.match(r[2],/^[a-f0-9]{32}$/);
  if(r[4]===null){assert.equal(r[5],null);return;}
  const b=bodyOf(files[r[4]].toString('utf8'),r[0]);
  assert.equal(matchesReceipt(b,r),r[5]);
  if(r[5])assert.equal(matchesReceipt(Buffer.concat([b,Buffer.from(' ')]),r),false);
 });
}
test('I2J-OF absent/duplicate source identities fail closed',()=>{
 assert.throws(()=>bodyOf('','private.synthetic'));
 const f='CREATE FUNCTION private.synthetic() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql;';
 assert.throws(()=>bodyOf(f+'\n'+f,'private.synthetic'));
});
test('I2J-OF release and full graph remain held',()=>{
 const exact=receipts.filter(r=>r[5]===true);
 const mismatch=receipts.filter(r=>r[5]===false);
 const missing=receipts.filter(r=>r[5]===null);
 assert.equal(exact.length,6);assert.equal(mismatch.length,4);assert.equal(missing.length,1);
 const disposition={bodyMatches:exact.length,bodyMismatches:mismatch.length,unlocatedGitCandidate:missing.length,
  fullDefinitionAndAclVerified:false,fixtureGraphComplete:false,signedExecution:false,productionReleaseAllowed:false};
 assert.equal(disposition.fixtureGraphComplete,false);
 assert.equal(disposition.productionReleaseAllowed,false);
 console.log('I2J-OF '+JSON.stringify(disposition));
});
