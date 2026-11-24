// Derive an ephemeral signed test from exact original source; never change it.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const pins={"scripts/test_i1c_forge_private_story_nonce_local_auth.mjs":"90fb3058bc1c93ef72a331bad0747920c3c1202e","sql/candidates/20261109_player_story_complete_intent_i1c_research.sql":"91f5fb918bf205f2d4462e2ff0089f656601328e","sql/candidates/20261105_player_creation_immutable_intent_v1.sql":"99bceee24c1718570237e70a65fe3172f4c9fbc9","sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql":"01e48823ac3a46aa5880e98200e97c2595501ce7"};
for(const [path,sha] of Object.entries(pins)){const b=fs.readFileSync(path);assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha,path+' source drift');}
const source=fs.readFileSync('scripts/test_i1c_forge_private_story_nonce_local_auth.mjs','utf8');
const tail=fs.readFileSync('scripts/integration/i2j/i1c_mixed_api_nonce_research_tail.mjs','utf8');
const p1=fs.readFileSync('scripts/integration/i2j/i1c_mixed_api_nonce_research_tail.mjs');
assert.equal(createHash('sha1').update('blob '+p1.length+'\0').update(p1).digest('hex'),'481459b4ad1e4aa8ffb372b50a6732e464366e5e','P1 historical extension drift');
const p2=fs.readFileSync('scripts/integration/i2j/i1c_versioned_atomic_story_research_tail.mjs','utf8');
fs.writeFileSync('scripts/.i2j_i1c_mixed_api_research_tmp.mjs',source+'\n'+tail+'\n'+p2,{flag:'wx'});
